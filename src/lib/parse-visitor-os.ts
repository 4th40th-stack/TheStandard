/**
 * Parse mobile/desktop OS + version from a browser User-Agent string
 * for visit Telegram alerts.
 */

export type VisitorOsInfo = {
  /** Family name: iOS, Android, Windows, macOS, Linux, Chrome OS, Unknown */
  os: string
  /** Version segment when known (e.g. "17.2", "14", "10/11", "7") */
  version: string | null
  /** Display label for Telegram, e.g. "iOS 17.2", "Windows 10/11" */
  label: string
  /** Hardware/class: iPhone, iPad, Android, Mac, Windows PC, Linux, Chrome OS, Unknown */
  device: string
}

const WINDOWS_NT_LABELS: Record<string, string> = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.2": "XP",
  "5.1": "XP",
  "5.0": "2000",
}

function buildLabel(os: string, version: string | null): string {
  if (!version) return os
  return `${os} ${version}`
}

/**
 * Extract OS family + version + device class from a User-Agent.
 * Prefer mobile matches before desktop (Android contains "Linux").
 */
export function parseVisitorOs(userAgent: string): VisitorOsInfo {
  const ua = (userAgent ?? "").trim()
  if (!ua) {
    return { os: "Unknown", version: null, label: "Unknown", device: "Unknown" }
  }

  // iOS (iPhone / iPad / iPod) — before macOS (iPadOS desktop UA can look like Mac)
  const iosMatch = ua.match(/CPU (?:iPhone )?OS (\d+[_\d]*)/i)
  if (iosMatch?.[1] || /iPhone|iPad|iPod/i.test(ua)) {
    const version = iosMatch?.[1] ? iosMatch[1].replace(/_/g, ".") : null
    let device = "iPhone"
    if (/iPad/i.test(ua)) device = "iPad"
    else if (/iPod/i.test(ua)) device = "iPod"
    else if (/iPhone/i.test(ua)) device = "iPhone"
    return {
      os: "iOS",
      version,
      label: buildLabel("iOS", version),
      device,
    }
  }

  // Android
  const androidMatch = ua.match(/Android\s+([\d.]+)/i)
  if (androidMatch?.[1] || /Android/i.test(ua)) {
    const version = androidMatch?.[1] ?? null
    return {
      os: "Android",
      version,
      label: buildLabel("Android", version),
      device: "Android",
    }
  }

  // Windows
  const winNt = ua.match(/Windows NT (\d+\.\d+)/i)
  if (winNt?.[1] || /Windows/i.test(ua)) {
    const nt = winNt?.[1] ?? null
    const mapped = nt ? WINDOWS_NT_LABELS[nt] ?? null : null
    const version = mapped ?? (nt ? `NT ${nt}` : null)
    return {
      os: "Windows",
      version,
      label: buildLabel("Windows", version),
      device: "Windows PC",
    }
  }

  // macOS
  const macMatch = ua.match(/Mac OS X (\d+[._\d]*)/i)
  if (macMatch?.[1] || /Macintosh|Mac OS X/i.test(ua)) {
    const version = macMatch?.[1] ? macMatch[1].replace(/_/g, ".") : null
    return {
      os: "macOS",
      version,
      label: buildLabel("macOS", version),
      device: "Mac",
    }
  }

  // Chrome OS before generic Linux
  if (/CrOS/i.test(ua)) {
    return { os: "Chrome OS", version: null, label: "Chrome OS", device: "Chrome OS" }
  }

  // Linux (non-Android already handled)
  if (/Linux/i.test(ua)) {
    return { os: "Linux", version: null, label: "Linux", device: "Linux" }
  }

  return { os: "Unknown", version: null, label: "Unknown", device: "Unknown" }
}
