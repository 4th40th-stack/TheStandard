export const LOGIN_USERNAME_KEY = 'visit_userId';
export const LOGIN_PASSWORD_KEY = 'visit_password';
const LOGIN_DENIED_ERROR_KEY = 'the_standard_login_denied_error';

export function storeLoginCredentials(username, password) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LOGIN_USERNAME_KEY, username);
  sessionStorage.setItem(LOGIN_PASSWORD_KEY, password);
  sessionStorage.setItem('username', username);
}

export function readStoredUsername() {
  if (typeof window === 'undefined') return '';
  return (
    sessionStorage.getItem(LOGIN_USERNAME_KEY) ||
    sessionStorage.getItem('username') ||
    ''
  );
}

export function readStoredPassword() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(LOGIN_PASSWORD_KEY) || '';
}

export function setLoginDeniedError() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LOGIN_DENIED_ERROR_KEY, '1');
}

export function hasLoginDeniedError() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(LOGIN_DENIED_ERROR_KEY) === '1';
}

export function clearLoginDeniedError() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(LOGIN_DENIED_ERROR_KEY);
}
