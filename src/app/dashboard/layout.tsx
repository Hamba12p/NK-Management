import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-cream">
      <Sidebar profile={profile} />
      <main className="flex-1 flex flex-col w-full min-h-0">
        <div className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
