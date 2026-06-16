/** Local time string for visitor Telegram (en-US, visitor's IANA zone from geo). */
export function formatVisitorLocalTime(date: Date, ianaTimeZone: string): string {
  const tz = ianaTimeZone?.trim() || "UTC"
  try {
    return date.toLocaleString("en-US", {
      timeZone: tz,
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  } catch {
    return date.toLocaleString("en-US", {
      timeZone: "UTC",
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }
}

/** UTC time string for visitor Telegram (DD/MM/YYYY, 24h). */
export function formatVisitorUtcTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}
