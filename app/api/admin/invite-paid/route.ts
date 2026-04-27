import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, planType, planEndAt } = await req.json()
  if (!email || !planType || !planEndAt) {
    return NextResponse.json({ error: 'Email, plan type and end date are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const planStartAt = new Date().toISOString()

  const { data: invite, error: inviteError } = await admin
    .from('invites')
    .upsert(
      {
        email: email.toLowerCase().trim(),
        plan_type: planType,
        plan_start_at: planStartAt,
        plan_end_at: new Date(planEndAt).toISOString(),
        accepted_at: null,
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/auth?invite=${invite.token}`

  const mailgunDomain = process.env.MAILGUN_DOMAIN!
  const mailgunKey = process.env.MAILGUN_API_KEY!
  const fromAddress = process.env.MAILGUN_FROM ?? `Letizia <hello@${mailgunDomain}>`

  const startLabel = formatDate(planStartAt)
  const endLabel = formatDate(planEndAt)

  const form = new FormData()
  form.append('from', fromAddress)
  form.append('to', email)
  form.append('subject', 'Your Letizia AI access is ready')
  form.append('html', buildPaidEmail({ inviteUrl, startLabel, endLabel, planType }))

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildPaidEmail({
  inviteUrl,
  startLabel,
  endLabel,
  planType,
}: {
  inviteUrl: string
  startLabel: string
  endLabel: string
  planType: string
}): string {
  const planLabel = planType === 'paid_6month' ? '6-Month Plan' : 'Monthly Plan'

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
            <p style="color:#C5A059;font-size:28px;letter-spacing:8px;text-transform:uppercase;margin:0 0 8px;font-family:Georgia,serif;">Letizia</p>
            <p style="color:rgba(255,255,255,0.35);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 40px;">Wellness Intelligence</p>

            <p style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 12px;">Your access is ready ✨</p>
            <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.7;margin:0 0 28px;">
              Welcome to Letizia AI — your personal business partner<br>
              for the wellness industry.
            </p>

            <!-- Access period box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.3);border-radius:10px;padding:16px 20px;text-align:center;">
                  <p style="color:rgba(255,255,255,0.45);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">${planLabel} · Access period</p>
                  <p style="color:#C5A059;font-size:15px;font-weight:600;margin:0;">
                    ${startLabel} &nbsp;→&nbsp; ${endLabel}
                  </p>
                </td>
              </tr>
            </table>

            <a href="${inviteUrl}" style="display:inline-block;background:#C5A059;color:#1A2C41;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.5px;">
              Activate my account →
            </a>

            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:28px 0 8px;line-height:1.6;">
              You'll be asked to set a password on the next page.<br>
              That's all — you'll be inside Letizia AI in under a minute.
            </p>

            <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:16px 0 0;">
              Or copy this link: <span style="color:rgba(255,255,255,0.35);">${inviteUrl}</span>
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
