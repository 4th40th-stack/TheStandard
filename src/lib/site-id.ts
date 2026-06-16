let cachedSiteId: string | null = null

/**
 * Unique site key for seo_referrer_visits and reports.
 * Priority: SITE_ID env → lib/project-config (PROJECT_ID / DEFAULT_PROJECT_ID) → VERCEL_PROJECT_NAME
 */
export async function getSiteId(): Promise<string> {
  if (cachedSiteId) return cachedSiteId

  const fromEnv = process.env.SITE_ID?.trim()
  if (fromEnv) {
    cachedSiteId = fromEnv
    return fromEnv
  }

  try {
    const mod = (await import("@/lib/project-config")) as {
      PROJECT_ID?: string
      DEFAULT_PROJECT_ID?: string
    }
    const fromConfig = mod.PROJECT_ID?.trim() || mod.DEFAULT_PROJECT_ID?.trim()
    if (fromConfig) {
      cachedSiteId = fromConfig
      return fromConfig
    }
  } catch {
    // project-config optional
  }

  const vercel = process.env.VERCEL_PROJECT_NAME?.trim()
  cachedSiteId = vercel || "unknown-site"
  return cachedSiteId
}
