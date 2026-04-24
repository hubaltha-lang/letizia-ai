import { createClient } from '@/lib/supabase/server'
import Dashboard from '@/components/Dashboard'
import { checkAccess } from '@/lib/access'
import type { PlanType } from '@/lib/admin'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch full profile including plan fields
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, full_name, age, location, modalities, practice_status, persona, mission, services, plan_type, trial_end_at, plan_end_at')
    .eq('id', user!.id)
    .single()

  const access = checkAccess({
    plan_type: (profile?.plan_type ?? 'none') as PlanType,
    trial_end_at: profile?.trial_end_at ?? null,
    plan_end_at: profile?.plan_end_at ?? null,
  })

  return (
    <Dashboard
      userId={user!.id}
      displayName={profile?.display_name ?? user!.email ?? 'User'}
      accessBlocked={!access.allowed}
      initialProfile={{
        display_name: profile?.display_name ?? user!.email ?? 'User',
        full_name: profile?.full_name ?? '',
        age: profile?.age ?? null,
        location: profile?.location ?? '',
        modalities: profile?.modalities ?? '',
        practice_status: (profile?.practice_status ?? '') as '' | 'full_time' | 'part_time' | 'starting_out',
        persona: profile?.persona ?? '',
        mission: profile?.mission ?? '',
        services: profile?.services ?? '',
      }}
    />
  )
}
