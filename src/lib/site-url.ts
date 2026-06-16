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
