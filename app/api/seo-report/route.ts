import { NextRequest, NextResponse } from "next/server"

import {
  getDateRangeForPeriod,
  getPreviousMonthRange,
  getReportDateString,
  isLastDayOfMonthInReportTz,
  isSundayInReportTz,
} from "@/lib/seo-report-timezone"
import { buildSeoReportFromRows, formatSeoReportForTelegram } from "@/lib/seo-traffic-report"
import { fetchSeoVisitsForRange } from "@/lib/seo-visit-store"
import { isSeoTelegramConfigured, sendSeoAdminMessage } from "@/lib/telegram-seo-admin"
import { SITE_DISPLAY_NAME, SITE_ORIGIN } from "@/lib/site-url"

export const dynamic = "force-dynamic"

function isManualReportTrigger(request: NextRequest): boolean {
  const isLocal =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "development"
  if (isLocal) return true

  const secret = process.env.CRON_SECRET?.trim()
  const param = request.nextUrl.searchParams.get("secret")?.trim()
  return !!(secret && param === secret)
}

function isVercelCronInvocation(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron-schedule")) return true

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false

  const auth = request.headers.get("authorization")?.trim()
  return auth === `Bearer ${cronSecret}`
}

function isAuthorizedCron(request: NextRequest): boolean {
  if (isVercelCronInvocation(request)) return true
  return isManualReportTrigger(request)
}

async function sendPeriodReport(period: "day" | "week" | "month", endDate?: string) {
  const reportEnd = endDate ?? getReportDateString()
  const range = getDateRangeForPeriod(period, reportEnd)
  const rows = await fetchSeoVisitsForRange(range.startDate, range.endDate)
  const report = buildSeoReportFromRows(rows, period, range.label)
  const messages = formatSeoReportForTelegram(report)

  for (const msg of messages) {
    await sendSeoAdminMessage(msg)
  }

  return { period, range, visitCount: rows.length }
}

async function sendMonthlyFromPreviousMonthRange() {
  const monthRange = getPreviousMonthRange()
  const rows = await fetchSeoVisitsForRange(monthRange.startDate, monthRange.endDate)
  const report = buildSeoReportFromRows(rows, "month", monthRange.label)
  for (const msg of formatSeoReportForTelegram(report)) {
    await sendSeoAdminMessage(msg)
  }
  return {
    period: "month" as const,
    range: monthRange,
    visitCount: rows.length,
    triggeredBy: "last_day_of_month",
  }
}

/** Daily cron bundle: daily always; weekly on Sunday; monthly on last day of month. */
async function runScheduledReportBundle() {
  const results: unknown[] = []
  results.push(await sendPeriodReport("day"))
  if (isSundayInReportTz()) {
    results.push(await sendPeriodReport("week"))
  }
  if (isLastDayOfMonthInReportTz()) {
    results.push(await sendMonthlyFromPreviousMonthRange())
  }
  return results
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isSeoTelegramConfigured()) {
      return NextResponse.json(
        { error: "TELEGRAM_SEO_BOT_TOKEN and TELEGRAM_SEO_ADMIN are not configured" },
        { status: 503 },
      )
    }

    const periodParam = request.nextUrl.searchParams.get("period") ?? "day"
    if (!["day", "week", "month", "all"].includes(periodParam)) {
      return NextResponse.json({ error: "Invalid period. Use day, week, month, or all." }, { status: 400 })
    }

    const manual = isManualReportTrigger(request)
    const results: unknown[] = []

    if (periodParam === "day") {
      results.push(...(await runScheduledReportBundle()))
    }

    if (periodParam === "all") {
      results.push(...(await runScheduledReportBundle()))
    }

    if (periodParam === "week") {
      results.push(await sendPeriodReport("week"))
    }

    if (periodParam === "month") {
      const monthRange = isLastDayOfMonthInReportTz()
        ? getPreviousMonthRange()
        : getDateRangeForPeriod("month", getReportDateString())
      const rows = await fetchSeoVisitsForRange(monthRange.startDate, monthRange.endDate)
      const report = buildSeoReportFromRows(rows, "month", monthRange.label)
      for (const msg of formatSeoReportForTelegram(report)) {
        await sendSeoAdminMessage(msg)
      }
      results.push({
        period: "month",
        range: monthRange,
        visitCount: rows.length,
      })
    }

    return NextResponse.json({
      success: true,
      site: SITE_DISPLAY_NAME,
      siteUrl: SITE_ORIGIN,
      manual,
      results,
    })
  } catch (error) {
    console.error("SEO report error:", error)
    return NextResponse.json({ error: "Failed to generate SEO report" }, { status: 500 })
  }
}
