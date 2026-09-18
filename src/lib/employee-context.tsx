'use client'

import { createContext, useContext } from 'react'

export type VisibilityScope = 'ALL' | 'OWN' | string[]

export interface Employee {
  id: string
  auth_user_id: string
  department_id: string
  firstname: string
  lastname: string
  email: string
  role: 'SYSTEM_ADMIN' | 'DEPARTMENT_MANAGER' | 'CONTRIBUTOR' | 'VIEWER'
  company_role_id?: string
  is_active: boolean
  visibility_scope?: VisibilityScope
}

const EmployeeContext = createContext<Employee | null>(null)

export function EmployeeProvider({ employee, children }: { employee: Employee | null, children: React.ReactNode }) {
  // Add default visibility_scope if missing
  const emp = employee ? { ...employee, visibility_scope: employee.visibility_scope || 'OWN' } : null

  return (
    <EmployeeContext.Provider value={emp}>
      {children}
    </EmployeeContext.Provider>
  )
}

export function useEmployee() {
  return useContext(EmployeeContext)
}
