import { formatQueryForDisplay } from "@/lib/search-referrer"
import type { SeoVisitRow } from "@/lib/seo-visit-store"
import { getSeoReportTimezone } from "@/lib/seo-report-timezone"
import { SITE_DISPLAY_NAME, SITE_ORIGIN } from "@/lib/site-url"

const SEP = "━━━━━━━━━━━━━━━━━"

export interface SeoReportData {
  period: "day" | "week" | "month"
  periodLabel: string
  siteName: string
  siteUrl: string
  timezone: string
  totalVisits: number
  engineTotals: Array<{ engine: string; count: number; queryNotProvided: number }>
  queryBreakdown: Array<{ engine: string; query: string; count: number }>
  directAndOther: number
}

const ENGINE_DISPLAY: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  yahoo: "Yahoo",
  duckduckgo: "DuckDuckGo",
  brave: "Brave",
  ecosia: "Ecosia",
  aol: "AOL",
  ask: "Ask",
  baidu: "Baidu",
  yandex: "Yandex",
  startpage: "Startpage",
  qwant: "Qwant",
  kagi: "Kagi",
  mojeek: "Mojeek",
  naver: "Naver",
  seznam: "Seznam",
  sogou: "Sogou",
  swisscows: "Swisscows",
  presearch: "Presearch",
  dogpile: "Dogpile",
  webcrawler: "WebCrawler",
  lycos: "Lycos",
  gibiru: "Gibiru",
  meta: "Meta Search",
  you: "You.com",
  perplexity: "Perplexity",
  msn: "MSN",
  other_search: "Other search",
  direct: "Direct",
  referral: "Other referral",
}

function engineLabel(raw: string | null): string {
  if (!raw) return "Unknown"
  const key = raw.toLowerCase()
  return ENGINE_DISPLAY[key] ?? raw
}

export function buildSeoReportFromRows(
  rows: SeoVisitRow[],
  period: "day" | "week" | "month",
  periodLabel: string,
): SeoReportData {
  const siteName = rows[0]?.site_name ?? SITE_DISPLAY_NAME
  const siteUrl = rows[0]?.site_url ?? SITE_ORIGIN

  const engineMap = new Map<string, { count: number; queryNotProvided: number }>()
  const queryMap = new Map<string, number>()
  let directAndOther = 0

  for (const row of rows) {
    const engineRaw = row.search_engine?.trim() || "Unknown"
    const engineKey = engineRaw.toLowerCase()
    const isDirect = engineKey === "direct" || engineKey === "(direct)"
    const isSearch =
      !isDirect &&
      engineKey !== "referral" &&
      engineKey !== "other referral" &&
      !engineRaw.startsWith("http")

    if (isDirect || (!isSearch && engineKey === "referral")) {
      directAndOther++
      continue
    }

    if (!isSearch) {
      directAndOther++
      continue
    }

    const label = engineLabel(engineRaw)
    const bucket = engineMap.get(label) ?? { count: 0, queryNotProvided: 0 }
    bucket.count++
    if (!row.search_query?.trim()) {
      bucket.queryNotProvided++
    }
    engineMap.set(label, bucket)

    const q = row.search_query?.trim()
    if (q) {
      const qKey = `${label}\0${q.toLowerCase()}`
      queryMap.set(qKey, (queryMap.get(qKey) ?? 0) + 1)
    }
  }

  const engineTotals = [...engineMap.entries()]
    .map(([engine, stats]) => ({ engine, ...stats }))
    .sort((a, b) => b.count - a.count)

  const queryBreakdown = [...queryMap.entries()]
    .map(([key, count]) => {
      const [engine, query] = key.split("\0")
      return { engine, query, count }
    })
    .sort((a, b) => b.count - a.count)

  return {
    period,
    periodLabel,
    siteName,
    siteUrl,
    timezone: getSeoReportTimezone(),
    totalVisits: rows.length,
    engineTotals,
    queryBreakdown,
    directAndOther,
  }
}

export function formatSeoReportForTelegram(report: SeoReportData): string[] {
  const periodTitle =
    report.period === "day"
      ? "Daily"
      : report.period === "week"
        ? "Weekly"
        : "Monthly"

  let message = `📊 SEO ${periodTitle} Report — ${report.siteName}\n`
  message += `${report.siteUrl}\n`
  message += `Period: ${report.periodLabel} (${report.timezone})\n`
  message += `${SEP}\n\n`

  if (report.totalVisits === 0) {
    message += "No SEO visits recorded for this period.\n"
    message += `\n${SEP}\n`
    message += `Generated at: ${new Date().toISOString()}`
    return [message]
  }

  message += `Search engine totals\n`
  for (const { engine, count, queryNotProvided } of report.engineTotals) {
    if (queryNotProvided > 0) {
      message += `  ${engine}: ${count} (${queryNotProvided} query not provided)\n`
    } else {
      message += `  ${engine}: ${count}\n`
    }
  }
  if (report.directAndOther > 0) {
    message += `  Direct / other: ${report.directAndOther}\n`
  }

  message += `\nTotal visits logged: ${report.totalVisits}\n`

  if (report.queryBreakdown.length > 0) {
    message += `\nTop queries (where available)\n`
    const byEngine = new Map<string, Array<{ query: string; count: number }>>()
    for (const item of report.queryBreakdown.slice(0, 40)) {
      const list = byEngine.get(item.engine) ?? []
      list.push({ query: item.query, count: item.count })
      byEngine.set(item.engine, list)
    }
    for (const [engine, queries] of byEngine) {
      message += `  ${engine}\n`
      for (const q of queries.slice(0, 10)) {
        message += `    • ${q.query} (${q.count})\n`
      }
    }
  }

  message += `\n${SEP}\n`
  message += `Generated at: ${new Date().toISOString()}`

  return splitTelegramMessages(message, 4096)
}

function splitTelegramMessages(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const parts: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining)
      break
    }
    const slice = remaining.slice(0, maxLen)
    const breakAt = slice.lastIndexOf("\n")
    const cut = breakAt > maxLen * 0.5 ? breakAt : maxLen
    parts.push(remaining.slice(0, cut))
    remaining = remaining.slice(cut).trimStart()
  }
  return parts
}

export { formatQueryForDisplay }
