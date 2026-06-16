import { getSql } from "@/lib/db"
import { getReportDateString } from "@/lib/seo-report-timezone"
import { getSiteId } from "@/lib/site-id"

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export interface SeoVisitRow {
  id: string
  site_id: string
  site_name: string
  site_url: string
  visited_at: string
  report_date: string
  referrer_raw: string | null
  search_engine: string | null
  search_query: string | null
  page_url: string
}

let tableReady = false

async function ensureTable(): Promise<void> {
  if (!hasDatabaseUrl() || tableReady) return
  const sql = await getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS seo_referrer_visits (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      site_name TEXT NOT NULL,
      site_url TEXT NOT NULL,
      visited_at TIMESTAMPTZ NOT NULL,
      report_date TEXT NOT NULL,
      referrer_raw TEXT,
      search_engine TEXT,
      search_query TEXT,
      page_url TEXT NOT NULL
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_seo_visits_site_date
    ON seo_referrer_visits (site_id, report_date)
  `
  tableReady = true
}

function generateId(): string {
  return `sv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function insertSeoVisit(data: {
  siteName: string
  siteUrl: string
  visitedAt: Date
  referrerRaw: string
  searchEngineKey: string
  searchEngineLabel: string
  searchQuery: string | null
  pageUrl: string
}): Promise<boolean> {
  if (!hasDatabaseUrl()) return false

  try {
    await ensureTable()
    const siteId = await getSiteId()
    const reportDate = getReportDateString(data.visitedAt)
    const sql = await getSql()
    const engineStored = data.searchEngineKey === "direct" ? "direct" : data.searchEngineLabel

    await sql`
      INSERT INTO seo_referrer_visits (
        id, site_id, site_name, site_url, visited_at, report_date,
        referrer_raw, search_engine, search_query, page_url
      ) VALUES (
        ${generateId()},
        ${siteId},
        ${data.siteName},
        ${data.siteUrl},
        ${data.visitedAt.toISOString()},
        ${reportDate},
        ${data.referrerRaw},
        ${engineStored},
        ${data.searchQuery},
        ${data.pageUrl}
      )
    `
    return true
  } catch (error) {
    console.error("insertSeoVisit failed:", error)
    return false
  }
}

export interface SeoVisitAggregate {
  search_engine: string | null
  search_query: string | null
  count: number
}

export async function fetchSeoVisitsForRange(
  startDate: string,
  endDate: string,
): Promise<SeoVisitRow[]> {
  if (!hasDatabaseUrl()) return []

  await ensureTable()
  const siteId = await getSiteId()
  const sql = await getSql()

  const rows = await sql`
    SELECT
      id,
      site_id,
      site_name,
      site_url,
      visited_at::text AS visited_at,
      report_date,
      referrer_raw,
      search_engine,
      search_query,
      page_url
    FROM seo_referrer_visits
    WHERE site_id = ${siteId}
      AND report_date >= ${startDate}
      AND report_date <= ${endDate}
    ORDER BY visited_at ASC
  `

  return rows as SeoVisitRow[]
}

export async function countVisitsForRange(startDate: string, endDate: string): Promise<number> {
  const rows = await fetchSeoVisitsForRange(startDate, endDate)
  return rows.length
}
