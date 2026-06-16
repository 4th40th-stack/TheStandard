const DEFAULT_TZ = "Europe/London"

export function getSeoReportTimezone(): string {
  return process.env.SEO_REPORT_TIMEZONE?.trim() || DEFAULT_TZ
}

export type ReportTzLocalTime = {
  hour: number
  minute: number
  /** 0 = Sunday … 6 = Saturday (in report timezone) */
  weekday: number
}

/** Clock time in the report IANA timezone (handles GMT/BST automatically). */
export function getLocalTimeInReportTz(
  now: Date = new Date(),
  timeZone?: string,
): ReportTzLocalTime {
  const tz = timeZone ?? getSeoReportTimezone()
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now)

  const hour = Number(parts.find((p) => p.type === "hour")?.value)
  const minute = Number(parts.find((p) => p.type === "minute")?.value)
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? ""
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return { hour, minute, weekday: weekdayMap[weekdayStr] ?? -1 }
}

/** True when today is Sunday in the report timezone. */
export function isSundayInReportTz(now: Date = new Date()): boolean {
  return getLocalTimeInReportTz(now).weekday === 0
}

/** YYYY-MM-DD in SEO report timezone */
export function getReportDateString(date: Date = new Date(), timeZone?: string): string {
  const tz = timeZone ?? getSeoReportTimezone()
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Whether tomorrow (in report TZ) is the 1st — trigger monthly report after daily cron */
export function isLastDayOfMonthInReportTz(now: Date = new Date()): boolean {
  const tz = getSeoReportTimezone()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowDay = new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(
    tomorrow,
  )
  return tomorrowDay === "1"
}

export function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) return startDate
  return `${startDate} – ${endDate}`
}

/** Inclusive date range for period ending on endDate (YYYY-MM-DD) */
export function getDateRangeForPeriod(
  period: "day" | "week" | "month",
  endDate: string,
): { startDate: string; endDate: string; label: string } {
  if (period === "day") {
    return { startDate: endDate, endDate, label: endDate }
  }

  const [y, m, d] = endDate.split("-").map(Number)
  const end = new Date(Date.UTC(y, m - 1, d))

  if (period === "week") {
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - 6)
    const startDate = start.toISOString().slice(0, 10)
    return { startDate, endDate, label: formatDateRangeLabel(startDate, endDate) }
  }

  const startDate = `${y}-${String(m).padStart(2, "0")}-01`
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(end)
  return { startDate, endDate, label }
}

/** Previous calendar month in report TZ (for end-of-month monthly cron) */
export function getPreviousMonthRange(now: Date = new Date()): {
  startDate: string
  endDate: string
  label: string
} {
  const tz = getSeoReportTimezone()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
  const endDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(new Date(Date.UTC(prevYear, prevMonth - 1, 1)))
  return { startDate, endDate, label }
}
