import { createAdminClient } from '@/lib/admin'
import type { AdminUser, Invite } from '@/lib/admin'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const admin = createAdminClient()

  // Fetch all users joined with their profiles
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const userIds = authUsers?.users.map((u) => u.id) ?? []

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, full_name, plan_type, trial_start_at, trial_end_at, plan_start_at, plan_end_at')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const users: AdminUser[] = (authUsers?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? '',
    display_name: profileMap[u.id]?.display_name ?? '',
    full_name: profileMap[u.id]?.full_name ?? '',
    created_at: u.created_at,
    plan_type: (profileMap[u.id]?.plan_type ?? 'none') as AdminUser['plan_type'],
    trial_start_at: profileMap[u.id]?.trial_start_at ?? null,
    trial_end_at: profileMap[u.id]?.trial_end_at ?? null,
    plan_start_at: profileMap[u.id]?.plan_start_at ?? null,
    plan_end_at: profileMap[u.id]?.plan_end_at ?? null,
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const { data: invites } = await admin
    .from('invites')
    .select('id, email, invited_at, accepted_at, user_id, plan_type, plan_start_at, plan_end_at, token')
    .order('invited_at', { ascending: false })

  return (
    <AdminDashboard
      initialUsers={users}
      initialInvites={(invites ?? []) as Invite[]}
    />
  )
}
