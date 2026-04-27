import AuthForm from '@/components/AuthForm'
import { createAdminClient } from '@/lib/admin'

interface Props {
  searchParams: Promise<{ invite?: string }>
}

export default async function AuthPage({ searchParams }: Props) {
  const { invite: token } = await searchParams

  let inviteEmail: string | null = null
  let invitePlanType: string | null = null

  if (token) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('invites')
      .select('email, accepted_at, plan_type')
      .eq('token', token)
      .is('accepted_at', null)
      .single()
    inviteEmail = data?.email ?? null
    invitePlanType = data?.plan_type ?? null
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(26,44,65,0.04)_0%,_transparent_60%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(197,160,89,0.05)_0%,_transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#C5A059] to-[#8B6914] mb-4 shadow-xl shadow-[#C5A059]/25">
            <span className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-playfair)' }}>L</span>
          </div>
          <h1 className="text-3xl font-light text-[#1A2C41] tracking-widest uppercase" style={{ fontFamily: 'var(--font-playfair)' }}>
            Letizia
          </h1>
          <p className="text-[#1A2C41]/40 text-sm mt-1 tracking-wider uppercase">Wellness Intelligence</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl shadow-[#1A2C41]/5">
          <AuthForm inviteEmail={inviteEmail} inviteToken={token ?? null} invitePlanType={invitePlanType} />
        </div>

        <p className="text-center text-[#1A2C41]/30 text-xs mt-6">
          Your strategies. Your clients. Elevated by AI.
        </p>
      </div>
    </main>
  )
}
