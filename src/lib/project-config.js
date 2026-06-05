export const PROJECT_ID = 'the-standard';

export const PROJECT_DISPLAY_NAME = 'The Standard';

export const LOGIN_REDIRECT_URL = 'https://login.standard.com/';

export function getApprovalsUrl() {
  const adminUrlBase = (process.env.ADMIN_PORTAL_URL || '').trim();
  if (!adminUrlBase) return '/admin/login';
  // Telegram should link to the admin portal origin only.
  // (Admin portal will still show the correct project filtering internally.)
  const base = adminUrlBase
    .replace(/\/+$/, '')
    .replace(/\/admin\/login.*$/i, '')
    .replace(/\?.*$/, '');
  return base;
}
