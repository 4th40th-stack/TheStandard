import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { PROJECT_DISPLAY_NAME } from '@/lib/project-config';
import { parseVisitorInfo } from '@/lib/parse-visitor-os';
import { getNetworkHintLabel } from '@/lib/bot-verification/datacenter-heuristic';

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIp) return realIp.trim();
  return null;
}

async function getGeo(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return { city: 'Unknown', regionName: '', country: 'Unknown', timezone: 'UTC', isp: 'Unknown' };
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country,timezone,isp`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();
    if (data.status !== 'success') return { city: 'Unknown', regionName: '', country: 'Unknown', timezone: 'UTC', isp: 'Unknown' };
    return {
      city: data.city || 'Unknown',
      regionName: data.regionName || '',
      country: data.country || 'Unknown',
      timezone: data.timezone || 'UTC',
      isp: data.isp || 'Unknown',
    };
  } catch {
    return { city: 'Unknown', regionName: '', country: 'Unknown', timezone: 'UTC', isp: 'Unknown' };
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const geo = await getGeo(ip);
    const body = await request.json().catch(() => ({}));
    const { screen = 'Unknown', referrer = 'Direct', url = '' } = body;

    const location = [geo.city, geo.regionName, geo.country].filter(Boolean).join(', ') || 'Unknown';

    const detected = parseVisitorInfo(userAgent);
    const networkHint = getNetworkHintLabel(null, geo.isp);
    const message = [
      `🌐 <b>(${escapeHtml(PROJECT_DISPLAY_NAME)})</b>`,
      '━━━━━━━━━━━━━━━━━━',
      `📍 <b>Location:</b> ${asCode(location)}`,
      `🌍 <b>IP:</b> ${asCode(ip || 'Unknown')}`,
      `⏰ <b>Timezone:</b> ${asCode(geo.timezone)}`,
      `🌐 <b>ISP:</b> ${asCode(geo.isp)}`,
      ...(networkHint ? [`🛡️ <b>VPN/DATA CENTER:</b> ${asCode(networkHint)}`] : []),
      '',
      `🖥 <b>Platform:</b> ${asCode(detected.platformLabel)}`,
      `👨‍💻 <b>Browser:</b> ${asCode(detected.browserLabel)}`,
      `📱 <b>Device:</b> ${asCode(detected.deviceLabel)}`,
      `🖥️ <b>Screen:</b> ${asCode(screen)}`,
      `🔗 <b>Referrer:</b> ${asUrlField(referrer, 'Direct')}`,
      `🌐 <b>URL:</b> ${asUrlField(url)}`,
      '',
      `<a href="https://t.me/th3_allfather">All Father Arógunmásà́</a>`,
    ].join('\n');

    await sendTelegramMessage(message, {
      disablePreview: false,
      previewUrl: 'https://t.me/th3_allfather',
      preferSmallMedia: true,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('notify-visit:', err);
    return NextResponse.json({ error: 'Notification failed' }, { status: 503 });
  }
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function asCode(v) {
  const t = v == null || v === '' ? 'Unknown' : String(v).trim() || 'Unknown';
  return `<code>${escapeHtml(t)}</code>`;
}

function asUrlField(v, fallback = '') {
  const s = v == null ? '' : String(v).trim();
  if (!s || s === 'undefined' || s === 'null' || s === '-') return escapeHtml(fallback);
  return `<a href="${escapeHtml(s)}">${escapeHtml(s)}</a>`;
}
