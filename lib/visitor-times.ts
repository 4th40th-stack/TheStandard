export function formatVisitorLocalTime(date = new Date()): string {
  try {
    return date.toLocaleString()
  } catch {
    return date.toISOString()
  }
}
export function getVisitorTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function formatVisitorUtcTime(date = new Date()): string {
  try {
    return date.toISOString().replace("T", " ").replace("Z", " UTC")
  } catch {
    return String(date)
  }
}
