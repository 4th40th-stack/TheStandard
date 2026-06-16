/**
 * Human-readable referrer for Telegram: direct traffic, or the referrer’s origin
 * (scheme + host + port) — e.g. https://www.google.com — not a generic label.
 */
export function getReferrerLabelForNotification(referrer: string | undefined | null): string {
  const raw = (referrer ?? "").trim()
  if (!raw || raw === "Direct") {
    return "(direct)"
  }
  if (!raw.startsWith("http")) {
    return raw
  }
  try {
    return new URL(raw).origin
  } catch {
    return "(direct)"
  }
}
