import type { NextRequest } from "next/server"

/**
 * Best-effort client IP from proxy / edge headers (Vercel, Cloudflare, etc.).
 * Prefer the leftmost IP in X-Forwarded-For (original client).
 */
export function getClientIpFromRequest(request: NextRequest): string {
  const h = request.headers

  const ordered = [
    h.get("x-vercel-forwarded-for"),
    h.get("x-forwarded-for"),
    h.get("cf-connecting-ip"),
    h.get("true-client-ip"),
    h.get("x-real-ip"),
    h.get("fastly-client-ip"),
  ]

  for (const raw of ordered) {
    if (!raw) continue
    const first = raw.split(",")[0]?.trim()
    if (first) return first
  }

  const withIp = request as NextRequest & { ip?: string | null }
  if (withIp.ip) return String(withIp.ip)

  return ""
}
