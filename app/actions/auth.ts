'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/admin'

export async function claimInvite(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const token = formData.get('token') as string

  if (!email || !password || !token) {
    return { error: 'Missing required fields' }
  }

  const admin = createAdminClient()

  // Verify the invite is still valid
  const { data: invite } = await admin
    .from('invites')
    .select('id, email')
    .eq('token', token)
    .eq('email', email.toLowerCase().trim())
    .is('accepted_at', null)
    .single()

  if (!invite) {
    return { error: 'This invite link is invalid or has already been used.' }
  }

  // Create user as pre-confirmed (no email verification needed)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message.includes('already been registered')) {
      return { error: 'An account with this email already exists. Please sign in.' }
    }
    return { error: createError.message }
  }

  const userId = created.user.id

  // Set up trial and link invite
  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + 7)

  await Promise.all([
    admin.from('invites').update({
      accepted_at: now.toISOString(),
      user_id: userId,
    }).eq('id', invite.id),
    admin.from('profiles').update({
      plan_type: 'trial',
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
    }).eq('id', userId),
  ])

  // Sign them in immediately
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    return { error: 'Account created but sign-in failed. Please sign in manually.' }
  }

  redirect('/dashboard')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('display_name') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: undefined,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If this email was invited, link the invite and activate the 7-day trial
  if (data.user) {
    const admin = createAdminClient()
    const { data: invite } = await admin
      .from('invites')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .is('accepted_at', null)
      .single()

    if (invite) {
      const now = new Date()
      const trialEnd = new Date(now)
      trialEnd.setDate(trialEnd.getDate() + 7)

      await Promise.all([
        admin
          .from('invites')
          .update({ accepted_at: now.toISOString(), user_id: data.user.id })
          .eq('id', invite.id),
        admin
          .from('profiles')
          .update({
            plan_type: 'trial',
            trial_start_at: now.toISOString(),
            trial_end_at: trialEnd.toISOString(),
          })
          .eq('id', data.user.id),
      ])
    }
  }

  return { success: true }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth')
}
