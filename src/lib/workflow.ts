/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient } from '@supabase/supabase-js'

export type EntityType = 'objective' | 'kpi' | 'risk'

// ----------------------------------------------------------------------
// 1. Submit for Approval
// ----------------------------------------------------------------------
export async function submitForApproval(
  supabase: SupabaseClient,
  params: {
    entityType: EntityType
    entityId: string
    departmentId: string
    requestedBy: string
  }
) {
  // 1. Get the workflow template for the department
  const { data: template, error: tmplErr } = await supabase
    .from('workflow_templates')
    .select('id, workflow_template_steps(id, step_order, label, company_role_id), departments(manager_id)')
    .eq('department_id', params.departmentId)
    .single()

  if (tmplErr || !template) throw new Error("No workflow template found for this department.")
  
  const steps = Array.isArray(template.workflow_template_steps) ? template.workflow_template_steps : []
  if (steps.length === 0) throw new Error("Workflow template has no steps configured.")
  
  // Sort steps to find the first one
  steps.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)
  const firstStep = steps[0]
  
  const depts = Array.isArray(template.departments) ? template.departments[0] : template.departments;
  const isDelegated = depts?.manager_id && depts.manager_id !== params.requestedBy
  const initialIndex = isDelegated ? -1 : 0

  // 2. Create the approval request
  const { data: request, error: reqErr } = await supabase
    .from('approval_requests')
    .insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      department_id: params.departmentId,
      requested_by: params.requestedBy,
      workflow_template_id: template.id,
      current_step_index: initialIndex,
      status: 'PENDING_APPROVAL',
      is_delegated: isDelegated
    })
    .select('id')
    .single()

  if (reqErr) throw new Error(`Failed to create approval request: ${reqErr.message}`)

  // 3. Log the SUBMITTED action
  await supabase
    .from('approval_actions')
    .insert({
      approval_request_id: request.id,
      actor_id: params.requestedBy,
      action: 'SUBMITTED',
      step_index: initialIndex,
      step_label: isDelegated ? 'Staff Submission' : 'Submission',
      comment: 'Submitted for approval'
    })

  // 4. Update the actual entity status (if they have a workflow_status column)
  // For Phase 1, we might just update the generic requests table, but normally you sync it.
  // We'll skip mutating the base entity directly here if it doesn't have the status column yet,
  // but report_cycles uses workflow_status. In our new schema, approval_requests tracks it.

  // 5. Notify the appropriate approvers
  if (isDelegated) {
    // Notify the department manager
    await supabase.from('notifications').insert({
      recipient_id: depts.manager_id,
      approval_request_id: request.id,
      type: 'ACTION_REQUIRED',
      title: `Pre-Approval Required: ${params.entityType.toUpperCase()}`,
      message: `A delegated ${params.entityType} requires your manager pre-approval.`
    })
  } else {
    // Notify the first step approvers
    await notifyApproversAtStep(supabase, request.id, params.departmentId, firstStep.company_role_id, params.entityType)
  }

  return request
}

// ----------------------------------------------------------------------
// 2. Approve Step
// ----------------------------------------------------------------------
export async function approveStep(
  supabase: SupabaseClient,
  params: {
    requestId: string
    actorId: string
    comment?: string
  }
) {
  // 1. Fetch the request and its template steps
  const { data: request, error: reqErr } = await supabase
    .from('approval_requests')
    .select('*, workflow_templates(workflow_template_steps(id, step_order, label, company_role_id))')
    .eq('id', params.requestId)
    .single()

  if (reqErr || !request) throw new Error("Request not found")

  const templates = Array.isArray(request.workflow_templates) ? request.workflow_templates[0] : request.workflow_templates
  const steps = Array.isArray(templates?.workflow_template_steps) ? templates.workflow_template_steps : []
  steps.sort((a, b) => a.step_order - b.step_order)

  const currentIndex = request.current_step_index
  
  if (currentIndex === -1) {
    // 3A. Pre-Approval step completed by Department Manager
    // Move to step 0
    await supabase
      .from('approval_requests')
      .update({ current_step_index: 0 })
      .eq('id', request.id)
      
    // Insert APPROVE action
    await supabase
      .from('approval_actions')
      .insert({
        approval_request_id: request.id,
        actor_id: params.actorId,
        action: 'APPROVED',
        step_index: -1,
        step_label: 'Department Manager Pre-Approval',
        comment: params.comment || 'Approved for normal routing'
      })

    // Notify the first step in the normal chain
    const firstStep = steps[0]
    await notifyApproversAtStep(supabase, request.id, request.department_id, firstStep.company_role_id, request.entity_type)
    return
  }

  const currentStep = steps[currentIndex]
  const isLastStep = currentIndex === steps.length - 1

  // 2. Insert APPROVE action
  await supabase
    .from('approval_actions')
    .insert({
      approval_request_id: request.id,
      actor_id: params.actorId,
      action: 'APPROVED',
      step_index: currentIndex,
      step_label: currentStep?.label || `Step ${currentIndex + 1}`,
      comment: params.comment || 'Approved'
    })

  if (isLastStep) {
    // 3A. It was the last step -> PUBLISH
    await supabase
      .from('approval_requests')
      .update({ status: 'PUBLISHED' })
      .eq('id', request.id)
      
    // Notify requester
    await supabase.from('notifications').insert({
      recipient_id: request.requested_by,
      approval_request_id: request.id,
      type: 'WORKFLOW_APPROVED',
      title: `${request.entity_type.toUpperCase()} Approved`,
      message: `Your ${request.entity_type} has been fully approved and published.`
    })
  } else {
    // 3B. Not the last step -> MOVE TO NEXT
    const nextIndex = currentIndex + 1
    const nextStep = steps[nextIndex]

    await supabase
      .from('approval_requests')
      .update({ current_step_index: nextIndex })
      .eq('id', request.id)

    // Notify next approvers
    await notifyApproversAtStep(supabase, request.id, request.department_id, nextStep.company_role_id, request.entity_type)
  }
}

// ----------------------------------------------------------------------
// 3. Reject Step
// ----------------------------------------------------------------------
export async function rejectStep(
  supabase: SupabaseClient,
  params: {
    requestId: string
    actorId: string
    comment: string // Rejection requires comment
  }
) {
  if (!params.comment?.trim()) throw new Error("Rejection comment is required.")

  const { data: request } = await supabase
    .from('approval_requests')
    .select('*, workflow_templates(workflow_template_steps(id, step_order, label))')
    .eq('id', params.requestId)
    .single()

  if (!request) throw new Error("Request not found")

  const templates = Array.isArray(request.workflow_templates) ? request.workflow_templates[0] : request.workflow_templates
  const steps = Array.isArray(templates?.workflow_template_steps) ? templates.workflow_template_steps : []
  steps.sort((a, b) => a.step_order - b.step_order)
  const currentStep = steps[request.current_step_index]

  // 1. Update status to REJECTED
  await supabase
    .from('approval_requests')
    .update({ status: 'REJECTED' })
    .eq('id', params.requestId)

  const stepLabel = request.current_step_index === -1 
    ? 'Department Manager Pre-Approval' 
    : (currentStep?.label || `Step ${request.current_step_index + 1}`)

  // 2. Insert REJECT action
  await supabase
    .from('approval_actions')
    .insert({
      approval_request_id: params.requestId,
      actor_id: params.actorId,
      action: 'REJECTED',
      step_index: request.current_step_index,
      step_label: stepLabel,
      comment: params.comment
    })

  // 3. Notify the requester
  await supabase.from('notifications').insert({
    recipient_id: request.requested_by,
    approval_request_id: params.requestId,
    type: 'WORKFLOW_REJECTED',
    title: `${request.entity_type.toUpperCase()} Rejected`,
    message: `Your ${request.entity_type} was rejected at step "${stepLabel}". Reason: ${params.comment}`
  })
}

// ----------------------------------------------------------------------
// 4. Resubmit (After Rejection)
// ----------------------------------------------------------------------
export async function resubmit(
  supabase: SupabaseClient,
  params: {
    requestId: string
    actorId: string // Must be the original requester
  }
) {
  const { data: request } = await supabase
    .from('approval_requests')
    .select('*, workflow_templates(workflow_template_steps(step_order, company_role_id))')
    .eq('id', params.requestId)
    .single()

  if (!request) throw new Error("Request not found")
  if (request.status !== 'REJECTED') throw new Error("Only rejected requests can be resubmitted.")

  const templates = Array.isArray(request.workflow_templates) ? request.workflow_templates[0] : request.workflow_templates
  const steps = Array.isArray(templates?.workflow_template_steps) ? templates.workflow_template_steps : []
  steps.sort((a, b) => a.step_order - b.step_order)
  const firstStep = steps[0]

  // 1. Reset to step 0
  await supabase
    .from('approval_requests')
    .update({ 
      current_step_index: 0,
      status: 'PENDING_APPROVAL' 
    })
    .eq('id', params.requestId)

  // 2. Insert SUBMITTED action
  await supabase
    .from('approval_actions')
    .insert({
      approval_request_id: params.requestId,
      actor_id: params.actorId,
      action: 'SUBMITTED',
      step_index: 0,
      step_label: 'Resubmission',
      comment: 'Resubmitted after rejection'
    })

  // 3. Notify first approvers again
  await notifyApproversAtStep(supabase, request.id, request.department_id, firstStep.company_role_id, request.entity_type)
}

// ----------------------------------------------------------------------
// Internal Helper: Notify Approvers
// ----------------------------------------------------------------------
async function notifyApproversAtStep(
  supabase: SupabaseClient, 
  requestId: string, 
  departmentId: string, 
  roleId: string,
  entityType: string
) {
  // Find all active employees in this department with the target company role
  const { data: approvers } = await supabase
    .from('employees')
    .select('id')
    .eq('department_id', departmentId)
    .eq('company_role_id', roleId)
    .eq('is_active', true)

  if (!approvers || approvers.length === 0) {
    console.warn(`No active approvers found for role ${roleId} in department ${departmentId}`)
    return
  }

  // Insert a notification for each potential approver
  const notifications = approvers.map(a => ({
    recipient_id: a.id,
    approval_request_id: requestId,
    type: 'ACTION_REQUIRED',
    title: `Approval Required: ${entityType.toUpperCase()}`,
    message: `A new ${entityType} requires your review in the approval chain.`
  }))

  await supabase.from('notifications').insert(notifications)
}
