import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import DashboardTopbar from '@/components/DashboardTopbar'
import NotificationBootstrap from '@/components/notifications/NotificationBootstrap'
import NotificationEnableBanner from '@/components/notifications/NotificationEnableBanner'

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
  const sidebarProfile = profile ? {
    ...profile,
    intern_team_directory_enabled: process.env.INTERN_TEAM_DIRECTORY_ENABLED === 'true',
  } : profile

  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar profile={sidebarProfile} />
      <main className="app-content flex min-h-screen flex-1 flex-col">
        <DashboardTopbar profile={profile} />
        <NotificationBootstrap />
        <NotificationEnableBanner />
        <div className="flex-1">
          <div className="page-container px-4 py-6 md:px-8 md:py-9">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
