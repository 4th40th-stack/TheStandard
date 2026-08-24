/**
 * Canonical public origin for metadata, Open Graph, sitemap, structured data, and robots.
 * Production hostname: www.floreshr247.com
 */
export const SITE_URL = "https://www.floreshr247.com"

/** Legacy Flores portal (.vbhtml help/registration pages). */
export const LEGACY_PORTAL_ORIGIN = "https://www.flores247.com"

export const SITE_DISPLAY_NAME = "Flores247" as const

/** ≥15 characters for Bing/Google; used as root layout default `<title>`. */
export const DEFAULT_SITE_TITLE = "Flores247 - Login to Your Benefits Account"

/** Shown at the top of Telegram alerts so multi-site bots can tell projects apart. */
export const TELEGRAM_SITE_LABEL = "Flores247OG" as const

export const SITE_ORIGIN = SITE_URL.replace(/\/$/, "")

export const SITE_HOMEPAGE_CANONICAL = `${SITE_ORIGIN}/`

export const CANONICAL_HOST = new URL(SITE_URL).hostname

/** IndexNow verification key (hosted at /{INDEXNOW_KEY}.txt). */
export const INDEXNOW_KEY = "efafc24dc3cd45d6927d403d81b7391b"

export type SitePlatform = "alight" | "wealthcare" | "other"

/** Override when auto-detect is wrong. */
export const SITE_PLATFORM: SitePlatform | undefined = undefined

export function detectSitePlatform(): SitePlatform {
  if (SITE_PLATFORM) return SITE_PLATFORM
  const host = (CANONICAL_HOST).toLowerCase()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const label = SITE_DISPLAY_NAME.toLowerCase()
  if (/wealthcare|aptia365|flores247|flores/i.test(host + label)) return "wealthcare"
  if (/alight|worklife|work-life|workife/i.test(host + label)) return "alight"
  return "other"
}

/** Site name for 🌐 New Visitor (…) — suffix Alight/Wealthcare when applicable. */
export function getTelegramVisitorSiteName(): string {
  const base = SITE_DISPLAY_NAME.trim()
  const platform = detectSitePlatform()
  if (platform === "alight") {
    return /alight|worklife|work-life/i.test(base) ? base : `${base} Alight`
  }
  if (platform === "wealthcare") {
    return /wealthcare/i.test(base) ? base : `${base} Wealthcare`
  }
  return base
}

