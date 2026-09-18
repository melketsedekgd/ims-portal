import { SupabaseClient } from '@supabase/supabase-js'

export async function getCurrentEmployee(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: employee, error } = await supabase
    .from('employees')
    .select('*, departments!employees_department_id_fkey(department_name)')
    .eq('auth_user_id', user.id)
    .single()

  if (error) {
    console.error("Error fetching employee:", error)
  }

  return employee
}

export async function requireSystemAdmin(supabase: SupabaseClient) {
  const employee = await getCurrentEmployee(supabase)
  if (!employee || employee.role !== 'SYSTEM_ADMIN') {
    throw new Error('Unauthorized: System Admin required')
  }
  return employee
}
