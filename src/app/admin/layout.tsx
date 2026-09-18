import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSystemAdmin } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  try {
    await requireSystemAdmin(supabase)
  } catch (error) {
    redirect('/department')
  }

  return <>{children}</>
}
