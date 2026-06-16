import { NextRequest, NextResponse } from "next/server"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { enrichIpGeo } from "@/lib/ip-geolocation"
import { getReferrerLabelForNotification } from "@/lib/referrer-display"
import { SITE_DISPLAY_NAME, SITE_ORIGIN } from "@/lib/site-url"
import { telegramService, type VisitorData } from "@/lib/telegram"
import { parseSearchReferrer } from "@/lib/search-referrer"
import { insertSeoVisit } from "@/lib/seo-visit-store"
import { sendSeoVisitNotification } from "@/lib/telegram-seo-admin"
import { formatVisitorLocalTime, formatVisitorUtcTime } from "@/lib/visitor-times"
import { isLikelyBotUserAgent } from "@/utils/botDetection"

type ClientBody = {
  userAgent?: string
  screen?: string
  language?: string
  referrer?: string
  pageUrl?: string
}

const UNKNOWN = "Unknown"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClientBody
    const ua = body.userAgent ?? ""

    if (isLikelyBotUserAgent(ua)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "bot" })
    }

    const clientIp = getClientIpFromRequest(request)
    const geo = await enrichIpGeo(clientIp)

    const ipForMessage = clientIp || geo.ip || UNKNOWN

    const rawReferrer = body.referrer?.trim() || "Direct"
    const referrerLabel = getReferrerLabelForNotification(rawReferrer)
    const pageUrlRaw = body.pageUrl?.trim()
    const pageUrl =
      pageUrlRaw && /^https?:\/\//i.test(pageUrlRaw) ? pageUrlRaw : SITE_ORIGIN

    const now = new Date()
    const tz = geo.timezone?.trim() || "UTC"
    const localTime = formatVisitorLocalTime(now, tz)
    const utcTime = formatVisitorUtcTime(now)

    const payload: VisitorData = {
      siteName: SITE_DISPLAY_NAME,
      location: geo.location,
      ip: ipForMessage,
      timezone: geo.timezone,
      isp: geo.isp,
      userAgent: ua || UNKNOWN,
      screen: body.screen ?? UNKNOWN,
      language: body.language ?? UNKNOWN,
      referrer: referrerLabel,
      pageUrl,
      localTime,
      utcTime,
    }

    await telegramService.sendVisitorNotification(payload)
    const parsedReferrer = parseSearchReferrer(rawReferrer)
    const siteNameForSeo = payload.siteName ?? SITE_DISPLAY_NAME
    const siteUrlForSeo = SITE_ORIGIN

    await insertSeoVisit({
      siteName: siteNameForSeo,
      siteUrl: siteUrlForSeo,
      visitedAt: now,
      referrerRaw: rawReferrer,
      searchEngineKey: parsedReferrer.searchEngineKey,
      searchEngineLabel: parsedReferrer.searchEngineLabel,
      searchQuery: parsedReferrer.searchQuery,
      pageUrl,
    })

    let seoTelegramSent = false
    if (parsedReferrer.isSearchEngine) {
      try {
        seoTelegramSent = await sendSeoVisitNotification({
          siteName: siteNameForSeo,
          siteUrl: siteUrlForSeo,
          searchEngineLabel: parsedReferrer.searchEngineLabel,
          searchQuery: parsedReferrer.searchQuery,
          isSearchEngine: true,
          referrerRaw: rawReferrer,
          pageUrl,
          location: payload.location,
          localTime: payload.localTime,
        })
      } catch (seoError) {
        console.error("SEO visit notification failed:", seoError)
      }
    }
    return NextResponse.json({ ok: true, telegramSent: true, seoTelegramSent })
  } catch (error) {
    console.error("Error sending visitor notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
