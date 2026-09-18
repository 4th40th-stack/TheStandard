/**
 * Hardened visitor detection for visit Telegram alerts.
 * Accurately parses Platform, Browser, and Device from User-Agent + Client Hints.
 */

export type VisitorClientHints = {
  mobile?: boolean
  platform?: string
  platformVersion?: string
  model?: string
  screen?: string
}

export type VisitorDetectedInfo = {
  platform: string
  platformVersion: string | null
  platformLabel: string
  browserName: string
  browserVersion: string | null
  browserType: "Mobile" | "Tablet" | "Desktop" | "Bot"
  browserLabel: string
  deviceLabel: string

  // Backwards-compatible aliases
  os: string
  version: string | null
  label: string
  device: string
}

export type VisitorOsInfo = VisitorDetectedInfo

const WINDOWS_NT_MAP: Record<string, string> = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.2": "XP",
  "5.1": "XP",
  "5.0": "2000",
}

function normalizeAndroidVersion(ver: string | null | undefined): string | null {
  if (!ver) return null
  const clean = ver.trim()
  const parts = clean.split(".")
  if (parts.length === 1) return `${parts[0]}.0.0`
  if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`
  return clean
}

function extractAndroidModel(ua: string): string | null {
  const match = ua.match(/Android\s+[\d.]+;\s*(?:[a-zA-Z]{2}(?:-[a-zA-Z]{2})?;\s*)?([^;()]+?)(?:\s+Build|\s+AppleWebKit|\))/i)
  if (!match) return null
  let model = match[1].trim()
  model = model.replace(/^[a-zA-Z]{2}-[a-zA-Z]{2};\s*/i, "").trim()
  if (/^wv$/i.test(model) || /^Mobile$/i.test(model) || /^Linux$/i.test(model)) {
    return null
  }
  return model || null
}

function resolveAndroidDeviceName(rawModel: string): string {
  const model = rawModel.trim()

  // Samsung Galaxy flagship & popular models
  if (/^SM-S928/i.test(model)) return "Samsung Galaxy S24 Ultra"
  if (/^SM-S926/i.test(model)) return "Samsung Galaxy S24+"
  if (/^SM-S921/i.test(model)) return "Samsung Galaxy S24"
  if (/^SM-S918/i.test(model)) return "Samsung Galaxy S23 Ultra"
  if (/^SM-S916/i.test(model)) return "Samsung Galaxy S23+"
  if (/^SM-S911/i.test(model)) return "Samsung Galaxy S23"
  if (/^SM-S908/i.test(model)) return "Samsung Galaxy S22 Ultra"
  if (/^SM-S906/i.test(model)) return "Samsung Galaxy S22+"
  if (/^SM-S901/i.test(model)) return "Samsung Galaxy S22"
  if (/^SM-G998/i.test(model)) return "Samsung Galaxy S21 Ultra"
  if (/^SM-G996/i.test(model)) return "Samsung Galaxy S21+"
  if (/^SM-G991/i.test(model)) return "Samsung Galaxy S21"
  if (/^SM-F946/i.test(model)) return "Samsung Galaxy Z Fold5"
  if (/^SM-F936/i.test(model)) return "Samsung Galaxy Z Fold4"
  if (/^SM-F731/i.test(model)) return "Samsung Galaxy Z Flip5"
  if (/^SM-F721/i.test(model)) return "Samsung Galaxy Z Flip4"
  if (/^SM-A546/i.test(model)) return "Samsung Galaxy A54 5G"
  if (/^SM-A536/i.test(model)) return "Samsung Galaxy A53 5G"
  if (/^SM-A346/i.test(model)) return "Samsung Galaxy A34 5G"
  if (/^SM-A155|^SM-A156/i.test(model)) return "Samsung Galaxy A15"
  if (/^SM-A145|^SM-A146/i.test(model)) return "Samsung Galaxy A14"
  if (/^SM-X/i.test(model)) return `Samsung Galaxy Tab (${model})`
  if (/^SM-|^GT-|^SCH-|^SGH-/i.test(model)) return `Samsung Galaxy (${model})`

  // Google Pixel
  if (/Pixel/i.test(model)) {
    return /^Google/i.test(model) ? model : `Google ${model}`
  }

  // Xiaomi / Redmi / POCO
  if (/Redmi|POCO|Xiaomi|Mi\s/i.test(model) || /^2[0-9]{6}|^M2[0-9]{5}/i.test(model)) {
    return `Xiaomi (${model})`
  }

  // OnePlus / OPPO
  if (/OnePlus|CPH|PGEM|PFFM|OPPO/i.test(model)) {
    return `OnePlus/OPPO (${model})`
  }

  // Vivo / iQOO
  if (/Vivo|iQOO|V2[0-9]{3}/i.test(model)) {
    return `Vivo (${model})`
  }

  // Realme
  if (/^RMX/i.test(model) || /Realme/i.test(model)) {
    return `Realme (${model})`
  }

  // Motorola
  if (/moto|Motorola/i.test(model)) {
    return `Motorola (${model})`
  }

  // Sony Xperia
  if (/^XQ-|Xperia/i.test(model)) {
    return `Sony Xperia (${model})`
  }

  // Nothing Phone
  if (/^A063|^AIN065|Nothing/i.test(model)) {
    return `Nothing Phone (${model})`
  }

  // Huawei / Honor
  if (/HUAWEI|HONOR|ELS-|VOG-|TAS-|NOH-|ALN-/i.test(model)) {
    return `Huawei/Honor (${model})`
  }

  return `Android (${model})`
}

/**
 * Parses full visitor information:
 * - 🖥 Platform (e.g. "Android 13.0.0", "Windows 11", "iOS 17.5.1")
 * - 👨‍💻 Browser (e.g. "Chrome 151.0.0.0 (Mobile)", "Safari 18.2 (Mobile)", "Edge 131.0.2903.86 (Desktop)")
 * - 📱 Device (e.g. "Samsung Galaxy S24 Ultra", "iPhone", "iPad", "Mac", "Windows PC")
 */
export function parseVisitorInfo(userAgent: string, clientHints?: VisitorClientHints): VisitorDetectedInfo {
  const ua = (userAgent ?? "").trim()
  const hints = clientHints ?? {}

  // 1. BOT & CRAWLER CHECK
  const isBot = /googlebot|bingbot|applebot|yandexbot|duckduckbot|baiduspider|slurp|facebookexternalhit|whatsapp|telegrambot|twitterbot|discordbot|ahrefsbot|semrushbot|petalbot|bytespider/i.test(ua)

  // 2. BROWSER TYPE: (Mobile), (Tablet), (Desktop), (Bot)
  let browserType: "Mobile" | "Tablet" | "Desktop" | "Bot" = "Desktop"

  if (isBot) {
    browserType = "Bot"
  } else if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet|PlayBook|Silk|Kindle/i.test(ua)) {
    browserType = "Tablet"
  } else if (
    hints.mobile === true ||
    /Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  ) {
    browserType = "Mobile"
  } else {
    browserType = "Desktop"
  }

  // 3. BROWSER NAME & VERSION
  let browserName = "Unknown"
  let browserVersion: string | null = null

  if (isBot) {
    const botMatch = ua.match(/(Googlebot|bingbot|Applebot|YandexBot|DuckDuckBot|Baiduspider|AhrefsBot|SemrushBot)[\/\s]([\d.]+)/i)
    if (botMatch) {
      browserName = botMatch[1]
      browserVersion = botMatch[2]
    } else {
      browserName = "Crawler/Bot"
    }
  } else if (/SamsungBrowser\/([\d.]+)/i.test(ua)) {
    browserName = "Samsung Internet"
    browserVersion = ua.match(/SamsungBrowser\/([\d.]+)/i)?.[1] ?? null
  } else if (/Edg(?:e|A|iOS)?\/([\d.]+)/i.test(ua)) {
    browserName = "Edge"
    browserVersion = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/i)?.[1] ?? null
  } else if (/OPR\/([\d.]+)|Opera Mini\/([\d.]+)|Opera\/([\d.]+)/i.test(ua)) {
    browserName = "Opera"
    const m = ua.match(/OPR\/([\d.]+)|Opera Mini\/([\d.]+)|Opera\/([\d.]+)/i)
    browserVersion = m?.[1] || m?.[2] || m?.[3] || null
  } else if (/Vivaldi\/([\d.]+)/i.test(ua)) {
    browserName = "Vivaldi"
    browserVersion = ua.match(/Vivaldi\/([\d.]+)/i)?.[1] ?? null
  } else if (/Brave\/([\d.]+)/i.test(ua)) {
    browserName = "Brave"
    browserVersion = ua.match(/Brave\/([\d.]+)/i)?.[1] ?? null
  } else if (/DuckDuckGo\/([\d.]+)|DDG\/([\d.]+)/i.test(ua)) {
    browserName = "DuckDuckGo"
    const m = ua.match(/DuckDuckGo\/([\d.]+)|DDG\/([\d.]+)/i)
    browserVersion = m?.[1] || m?.[2] || null
  } else if (/UCBrowser\/([\d.]+)/i.test(ua)) {
    browserName = "UC Browser"
    browserVersion = ua.match(/UCBrowser\/([\d.]+)/i)?.[1] ?? null
  } else if (/YaBrowser\/([\d.]+)/i.test(ua)) {
    browserName = "Yandex Browser"
    browserVersion = ua.match(/YaBrowser\/([\d.]+)/i)?.[1] ?? null
  } else if (/Instagram[\s\/]([\d.]+)/i.test(ua)) {
    browserName = "Instagram"
    browserVersion = ua.match(/Instagram[\s\/]([\d.]+)/i)?.[1] ?? null
  } else if (/FBAN|FBAV\/([\d.]+)/i.test(ua)) {
    browserName = "Facebook App"
    browserVersion = ua.match(/FBAV\/([\d.]+)/i)?.[1] ?? null
  } else if (/TikTok|musical_ly/i.test(ua)) {
    browserName = "TikTok"
  } else if (/MicroMessenger\/([\d.]+)/i.test(ua)) {
    browserName = "WeChat"
    browserVersion = ua.match(/MicroMessenger\/([\d.]+)/i)?.[1] ?? null
  } else if (/Twitter|TwitterAndroid|Twitter for iPhone/i.test(ua)) {
    browserName = "Twitter/X"
  } else if (/LinkedInApp/i.test(ua)) {
    browserName = "LinkedIn"
  } else if (/Firefox\/([\d.]+)|FxiOS\/([\d.]+)|Focus\/([\d.]+)/i.test(ua)) {
    browserName = "Firefox"
    const m = ua.match(/Firefox\/([\d.]+)|FxiOS\/([\d.]+)|Focus\/([\d.]+)/i)
    browserVersion = m?.[1] || m?.[2] || m?.[3] || null
  } else if (/CriOS\/([\d.]+)/i.test(ua)) {
    browserName = "Chrome"
    browserVersion = ua.match(/CriOS\/([\d.]+)/i)?.[1] ?? null
  } else if (/Chrome\/([\d.]+)/i.test(ua)) {
    browserName = "Chrome"
    browserVersion = ua.match(/Chrome\/([\d.]+)/i)?.[1] ?? null
  } else if (/Version\/([\d.]+).*Safari/i.test(ua)) {
    browserName = "Safari"
    browserVersion = ua.match(/Version\/([\d.]+).*Safari/i)?.[1] ?? null
  } else if (/Safari\/([\d.]+)/i.test(ua)) {
    browserName = "Safari"
    browserVersion = ua.match(/Safari\/([\d.]+)/i)?.[1] ?? null
  }

  const browserLabel = browserVersion
    ? `${browserName} ${browserVersion} (${browserType})`
    : `${browserName} (${browserType})`

  // 4. PLATFORM & HARDENED OS + DEVICE CLASS
  let platform = "Unknown"
  let platformVersion: string | null = null
  let deviceLabel = "Unknown"

  if (isBot) {
    platform = "Bot / Crawler"
    deviceLabel = "Bot"
  } else if (/iPhone|iPad|iPod/i.test(ua) || /CPU (?:iPhone )?OS (\d+[_\d]*)/i.test(ua)) {
    const isPad = /iPad/i.test(ua)
    platform = isPad ? "iPadOS" : "iOS"
    const m = ua.match(/OS (\d+[_\d]*)/i)
    platformVersion = m ? m[1].replace(/_/g, ".") : null
    deviceLabel = isPad ? "iPad" : /iPod/i.test(ua) ? "iPod Touch" : "iPhone"
  } else if (/Android/i.test(ua) || hints.platform?.toLowerCase() === "android") {
    platform = "Android"
    const m = ua.match(/Android\s+([\d.]+)/i)
    const rawVer = hints.platformVersion || m?.[1] || null
    platformVersion = normalizeAndroidVersion(rawVer)

    const extractedModel = hints.model || extractAndroidModel(ua)
    if (extractedModel) {
      deviceLabel = resolveAndroidDeviceName(extractedModel)
    } else {
      deviceLabel = browserType === "Tablet" ? "Android Tablet" : "Android Phone"
    }
  } else if (/Windows NT/i.test(ua) || /Windows/i.test(ua) || hints.platform?.toLowerCase() === "windows") {
    platform = "Windows"
    deviceLabel = "Windows PC"
    const ntMatch = ua.match(/Windows NT (\d+\.\d+)/i)
    const nt = ntMatch?.[1]
    if (nt === "10.0") {
      if (hints.platformVersion) {
        const major = parseInt(hints.platformVersion.split(".")[0], 10)
        platformVersion = major >= 13 ? "11" : "10"
      } else {
        platformVersion = "10/11"
      }
    } else if (nt) {
      platformVersion = WINDOWS_NT_MAP[nt] ?? `NT ${nt}`
    }
  } else if (/Macintosh|Mac OS X/i.test(ua) || hints.platform?.toLowerCase() === "macos") {
    platform = "macOS"
    deviceLabel = "Mac"
    const macMatch = ua.match(/Mac OS X (\d+[._\d]*)/i)
    const uaMacVer = macMatch ? macMatch[1].replace(/_/g, ".") : null
    platformVersion = hints.platformVersion || uaMacVer
  } else if (/HarmonyOS/i.test(ua) || /HMSCore/i.test(ua)) {
    platform = "HarmonyOS"
    const hmMatch = ua.match(/HarmonyOS\s*([\d.]+)?/i)
    platformVersion = hmMatch?.[1] || null
    deviceLabel = "Huawei Device"
  } else if (/CrOS/i.test(ua)) {
    platform = "Chrome OS"
    deviceLabel = "Chromebook"
    const croMatch = ua.match(/CrOS\s+(?:[^\s]+\s+)?([\d.]+)/i)
    platformVersion = croMatch?.[1] || null
  } else if (/Linux/i.test(ua) || hints.platform?.toLowerCase() === "linux") {
    deviceLabel = "Linux PC"
    const distros = ["Ubuntu", "Debian", "Fedora", "Arch", "CentOS", "Mint", "Manjaro", "Red Hat", "openSUSE", "Alpine"]
    let detectedDistro: string | null = null
    for (const d of distros) {
      if (new RegExp(d, "i").test(ua)) {
        detectedDistro = d
        break
      }
    }
    platform = detectedDistro ? `Linux (${detectedDistro})` : "Linux"
  }

  const platformLabel = platformVersion ? `${platform} ${platformVersion}` : platform

  return {
    platform,
    platformVersion,
    platformLabel,
    browserName,
    browserVersion,
    browserType,
    browserLabel,
    deviceLabel,
    // Backwards-compatible fields
    os: platform,
    version: platformVersion,
    label: platformLabel,
    device: deviceLabel,
  }
}

export function parseVisitorOs(userAgent: string): VisitorOsInfo {
  return parseVisitorInfo(userAgent)
}
