export const PROJECT_ID = 'the-standard';

export const PROJECT_DISPLAY_NAME = 'The Standard';

export const LOGIN_REDIRECT_URL = 'https://login.standard.com/';

export function getApprovalsUrl() {
  const adminUrlBase = (process.env.ADMIN_PORTAL_URL || '').trim();
  if (!adminUrlBase) return '/admin/login';
  const base = adminUrlBase.replace(/\/+$/, '');
  return `${base}/admin/login?project=${PROJECT_ID}`;
}
