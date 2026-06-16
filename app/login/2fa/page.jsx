'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const METHODS = [
  { id: 'text', label: 'Text Message', description: 'Receive a 6-digit code via text message.', icon: 'SMS' },
  { id: 'call', label: 'Phone Call', description: 'Receive a phone call with your code.', icon: 'Call' },
  { id: 'email', label: 'Email', description: 'Receive an email with your code.', icon: 'Email' },
];

const POLL_INTERVAL_MS = 1500;
const WAIT_TIMEOUT_MS = 90 * 1000;

export default function TwoFAMethodPage() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState('text');
  const [networkError, setNetworkError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!pendingId) return;

    const clearPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    timeoutRef.current = setTimeout(() => {
      clearPolling();
      setPendingId(null);
      setSubmitting(false);
      setNetworkError('Request timed out. Please try again.');
    }, WAIT_TIMEOUT_MS);

    const poll = async () => {
      try {
        const res = await fetch(`/api/pending-login/${encodeURIComponent(pendingId)}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const status = String(data?.status ?? '').trim().toLowerCase();
        if (status === 'approved' || status === 'redirected') {
          clearPolling();
          router.push(`/login/verify?method=${encodeURIComponent(selectedMethod)}`);
          return;
        }
        if (status === 'denied' || status === 'expired') {
          clearPolling();
          setPendingId(null);
          setSubmitting(false);
          setNetworkError(status === 'denied' ? 'Verification denied.' : 'Request timed out.');
        }
      } catch {
        // ignore temporary poll errors
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return clearPolling;
  }, [pendingId, router, selectedMethod]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNetworkError('');
    setSubmitting(true);
    try {
      const pendingMethod = selectedMethod === 'email' ? 'email' : 'text';
      const res = await fetch('/api/pending-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'login',
          password: '',
          method: pendingMethod,
          maskedEmail: '**********',
          maskedPhone: '***-***-****',
          flow: 'login',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setNetworkError('Network error. Please check your connection and try again.');
        setSubmitting(false);
        return;
      }
      setPendingId(data.id);
    } catch {
      setNetworkError('Network error. Please check your connection and try again.');
      setSubmitting(false);
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
          <div className={`twofa-options ${submitting ? 'twofa-options-disabled' : ''}`}>
            {METHODS.map((m) => (
              <label
                key={m.id}
                className={`twofa-option ${selectedMethod === m.id ? 'twofa-option-selected' : ''} ${submitting ? 'twofa-option-disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={selectedMethod === m.id}
                  onChange={() => setSelectedMethod(m.id)}
                  className="twofa-option-input"
                  disabled={submitting}
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
          <button type="submit" className="login-button" disabled={submitting}>
            {submitting ? 'Waiting for approval…' : 'Send Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
