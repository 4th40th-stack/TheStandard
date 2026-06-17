import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { enrichIpGeo } from "@/lib/ip-geolocation"
import { getReferrerLabelForNotification } from "@/lib/referrer-display"
import { getTelegramVisitorSiteName, SITE_ORIGIN } from "@/lib/site-url"
import { sendVisitorNotification, type VisitorTelegramData } from "@/lib/telegram"
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

function joinLocation(parts: Array<string | null | undefined>): string {
  const values = parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter((part) => part.length > 0)

  return values.length > 0 ? values.join(", ") : UNKNOWN
}

function getCountryName(countryCode: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryCode
  } catch {
    return countryCode
  }
}

function getHeaderGeoData(request: NextRequest) {
  const countryCode = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase() || null
  const countryName = countryCode ? getCountryName(countryCode) : null
  const region = request.headers.get("x-vercel-ip-country-region")?.trim() || null
  const city = request.headers.get("x-vercel-ip-city")?.trim() || null
  const timezone = request.headers.get("x-vercel-ip-timezone")?.trim() || null

  return {
    location: joinLocation([city, region, countryName]),
    timezone: timezone || UNKNOWN,
    countryCode,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClientBody
    const ua = body.userAgent ?? ""

    if (isLikelyBotUserAgent(ua)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "bot" })
    }

    const clientIp = getClientIpFromRequest(request)
    const headerGeo = getHeaderGeoData(request)
    const geo = await enrichIpGeo(clientIp)
    const mergedCountryCode = headerGeo.countryCode || geo.countryCode
    const mergedLocation = headerGeo.location !== UNKNOWN ? headerGeo.location : geo.location
    const mergedTimezone = headerGeo.timezone !== UNKNOWN ? headerGeo.timezone : geo.timezone

    const ipForMessage = clientIp || geo.ip || UNKNOWN

    const rawReferrer = body.referrer?.trim() || "Direct"
    const referrerLabel = getReferrerLabelForNotification(rawReferrer)
    const pageUrlRaw = body.pageUrl?.trim()
    const pageUrl =
      pageUrlRaw && /^https?:\/\//i.test(pageUrlRaw) ? pageUrlRaw : SITE_ORIGIN

    const now = new Date()
    const tz = mergedTimezone?.trim() || "UTC"
    const localTime = formatVisitorLocalTime(now, tz)
    const utcTime = formatVisitorUtcTime(now)

    const siteName = getTelegramVisitorSiteName()
    const payload: VisitorTelegramData = {
      siteName,
      location:
        mergedLocation !== UNKNOWN
          ? mergedLocation
          : mergedCountryCode
            ? getCountryName(mergedCountryCode)
            : UNKNOWN,
      ip: ipForMessage,
      timezone: mergedTimezone,
      isp: geo.isp,
      userAgent: ua || UNKNOWN,
      screen: body.screen ?? UNKNOWN,
      language: body.language ?? UNKNOWN,
      referrer: referrerLabel,
      pageUrl,
      localTime,
      utcTime,
    }

    await logActivity({
      type: "visitor",
      timestamp: now.toISOString(),
      data: payload,
    })

    const telegramSent = await sendVisitorNotification(payload)
    const parsedReferrer = parseSearchReferrer(rawReferrer)
    const siteUrlForSeo = SITE_ORIGIN

    await insertSeoVisit({
      siteName,
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
          siteName,
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
    return NextResponse.json({ ok: true, telegramSent, seoTelegramSent })
  } catch (error) {
    console.error("Error sending visitor notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
