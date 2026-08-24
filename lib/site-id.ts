export function getSiteId(): string {
  return process.env.SITE_ID?.trim() || process.env.NEXT_PUBLIC_SITE_ID?.trim() || "site"
}
export const SITE_ID = getSiteId()
