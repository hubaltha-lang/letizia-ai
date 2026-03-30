import { createClient } from '@/lib/supabase/server'
import Dashboard from '@/components/Dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch full profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, persona, mission, services')
    .eq('id', user!.id)
    .single()

  return (
    <Dashboard
      userId={user!.id}
      displayName={profile?.display_name ?? user!.email ?? 'User'}
      initialProfile={{
        display_name: profile?.display_name ?? user!.email ?? 'User',
        persona: profile?.persona ?? '',
        mission: profile?.mission ?? '',
        services: profile?.services ?? '',
      }}
    />
  )
}
