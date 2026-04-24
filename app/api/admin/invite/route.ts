import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Upsert invite (ignore if already invited)
  const { data: invite, error: inviteError } = await admin
    .from('invites')
    .upsert({ email: email.toLowerCase().trim() }, { onConflict: 'email', ignoreDuplicates: false })
    .select()
    .single()

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  // Send invite email via Mailgun
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/auth?invite=${invite.token}`

  const mailgunDomain = process.env.MAILGUN_DOMAIN!
  const mailgunKey = process.env.MAILGUN_API_KEY!
  const fromAddress = process.env.MAILGUN_FROM ?? `Letizia <hello@${mailgunDomain}>`

  const form = new FormData()
  form.append('from', fromAddress)
  form.append('to', email)
  form.append('subject', "You're invited to try Letizia — AI for wellness professionals")
  form.append('html', buildInviteEmail(inviteUrl))

  const mgRes = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${mailgunKey}`).toString('base64')}`,
    },
    body: form,
  })

  if (!mgRes.ok) {
    const err = await mgRes.text()
    return NextResponse.json({ error: `Mailgun error: ${err}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true, invite })
}

function buildInviteEmail(inviteUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1A2C41;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:40px;text-align:center;">
            <p style="color:#C5A059;font-size:28px;letter-spacing:8px;text-transform:uppercase;margin:0 0 8px;">Letizia</p>
            <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 40px;">Wellness Intelligence</p>

            <p style="color:#ffffff;font-size:18px;font-weight:600;margin:0 0 16px;">You've been invited</p>
            <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.7;margin:0 0 36px;">
              You have a <strong style="color:#C5A059;">7-day free trial</strong> waiting for you.<br>
              Letizia is your AI business partner — built specifically for wellness professionals.
            </p>

            <a href="${inviteUrl}" style="display:inline-block;background:#C5A059;color:#1A2C41;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.5px;">
              Start My Free Trial →
            </a>

            <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:32px 0 0;">
              Or copy this link: <span style="color:rgba(255,255,255,0.4);">${inviteUrl}</span>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`
}
