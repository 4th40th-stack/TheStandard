import { formatQueryForDisplay } from "@/lib/search-referrer"

const SEP = "━━━━━━━━━━━━━━━━━"

export interface SeoVisitNotificationData {
  siteName: string
  siteUrl: string
  searchEngineLabel: string
  searchQuery: string | null
  isSearchEngine: boolean
  referrerRaw: string
  pageUrl: string
  location?: string
  localTime?: string
}

function parseChatIds(): string[] {
  return process.env.TELEGRAM_SEO_ADMIN
    ? process.env.TELEGRAM_SEO_ADMIN.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : []
}

export function isSeoTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_SEO_BOT_TOKEN?.trim() && parseChatIds().length > 0)
}

export async function sendSeoAdminMessage(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_SEO_BOT_TOKEN?.trim()
  const chatIds = parseChatIds()

  if (!token || chatIds.length === 0) {
    return false
  }

  const results = await Promise.allSettled(
    chatIds.map((chatId) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      }),
    ),
  )

  return results.some((r) => r.status === "fulfilled")
}

export async function sendSeoVisitNotification(data: SeoVisitNotificationData): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false

  const queryLine = formatQueryForDisplay(data.searchQuery, data.isSearchEngine)
  const referrerDisplay =
    data.referrerRaw === "Direct" || !data.referrerRaw ? "(direct)" : data.referrerRaw

  const lines = [
    `🔍 SEO Visit — ${data.siteName}`,
    data.siteUrl,
    SEP,
    `🔎 Search engine: ${data.searchEngineLabel}`,
    `📝 Query: ${queryLine}`,
    `🔗 Referrer: ${referrerDisplay}`,
    `🌐 Page: ${data.pageUrl}`,
  ]

  if (data.location?.trim()) {
    lines.push(`📍 Location: ${data.location.trim()}`)
  }
  if (data.localTime?.trim()) {
    lines.push(`🕒 Local time: ${data.localTime.trim()}`)
  }

  return sendSeoAdminMessage(lines.join("\n"))
}
