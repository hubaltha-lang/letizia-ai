import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify the user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const message = (formData.get('message') as string | null)?.trim()
  const userEmail = (formData.get('userEmail') as string | null) ?? user.email ?? 'Unknown'
  const displayName = (formData.get('displayName') as string | null) ?? userEmail
  const screenshot = formData.get('screenshot') as File | null

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  const mailgunDomain = process.env.MAILGUN_DOMAIN!
  const mailgunKey = process.env.MAILGUN_API_KEY!
  const fromAddress = process.env.MAILGUN_FROM ?? `Letizia Support <hello@${mailgunDomain}>`

  const mg = new FormData()
  mg.append('from', fromAddress)
  mg.append('to', 'hub.altha@gmail.com')
  mg.append('subject', `Support Ticket — ${displayName} (${userEmail})`)
  mg.append('html', buildTicketEmail({ displayName, userEmail, message, hasScreenshot: !!(screenshot && screenshot.size > 0) }))

  if (screenshot && screenshot.size > 0) {
    const buffer = Buffer.from(await screenshot.arrayBuffer())
    const blob = new Blob([buffer], { type: screenshot.type })
    mg.append('attachment', blob, screenshot.name || 'screenshot.png')
  }

  const mgRes = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${mailgunKey}`).toString('base64')}`,
    },
    body: mg,
  })

  if (!mgRes.ok) {
    const err = await mgRes.text()
    console.error('Mailgun error:', err)
    return NextResponse.json({ error: 'Failed to send. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

function buildTicketEmail({
  displayName,
  userEmail,
  message,
  hasScreenshot,
}: {
  displayName: string
  userEmail: string
  message: string
  hasScreenshot: boolean
}): string {
  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e8e8;">

        <!-- Header -->
        <tr>
          <td style="background:#1A2C41;padding:28px 36px;">
            <p style="color:#C5A059;font-size:22px;letter-spacing:6px;text-transform:uppercase;margin:0 0 4px;font-family:Georgia,serif;">Letizia</p>
            <p style="color:rgba(255,255,255,0.35);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0;">Support Ticket</p>
          </td>
        </tr>

        <!-- User info -->
        <tr>
          <td style="padding:28px 36px 20px;border-bottom:1px solid #f0f0f0;">
            <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">From</p>
            <p style="color:#1A2C41;font-size:15px;font-weight:600;margin:0 0 4px;">${displayName.replace(/</g, '&lt;')}</p>
            <p style="color:#888;font-size:13px;margin:0;">
              <a href="mailto:${userEmail.replace(/</g, '&lt;')}" style="color:#C5A059;text-decoration:none;">${userEmail.replace(/</g, '&lt;')}</a>
            </p>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:24px 36px 28px;">
            <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Message</p>
            <div style="background:#f9f9f9;border-left:3px solid #C5A059;border-radius:0 8px 8px 0;padding:16px 20px;">
              <p style="color:#1A2C41;font-size:14px;line-height:1.8;margin:0;">${safeMessage}</p>
            </div>
            ${hasScreenshot ? `<p style="color:#888;font-size:12px;margin:16px 0 0;">📎 Screenshot attached</p>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #f0f0f0;">
            <p style="color:#aaa;font-size:11px;margin:0;">Reply directly to this email to respond to ${displayName.replace(/</g, '&lt;')}.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`
}
