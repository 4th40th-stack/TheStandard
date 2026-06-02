import { POLL_MS } from '@/lib/approval-messages';

export async function pollPendingLogin(pendingId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`/api/pending-login/${encodeURIComponent(pendingId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'approved') return 'approved';
        if (data.status === 'denied') return 'denied';
      }
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  return 'timeout';
}
