import type { NextRequest } from 'next/server'

/** Production site URL used when Control forwards admin decisions back to the member site. */
export function resolveMemberOriginFromEnv(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim()
  if (!raw) return ''
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.replace(/\/+$/, '')
}

/** Prefer env; fall back to request host (works on Vercel preview). */
export function resolveMemberOrigin(request?: NextRequest | Request): string {
  const fromEnv = resolveMemberOriginFromEnv()
  if (fromEnv) return fromEnv
  if (!request) return ''

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!host) return ''

  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`.replace(/\/+$/, '')
}
