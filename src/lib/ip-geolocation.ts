export interface IpGeoEnrichment {
  ip: string
  location: string
  timezone: string
  isp: string
  countryCode: string | null
}

const UNKNOWN = "Unknown"

function isProbablyPrivateOrLocal(ip: string): boolean {
  if (!ip) return true
  const lower = ip.toLowerCase().trim()
  if (lower === "unknown" || lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true
  if (lower.startsWith("127.")) return true
  if (lower.startsWith("10.")) return true
  if (lower.startsWith("192.168.")) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true
  if (lower === "localhost") return true
  return false
}

function joinLocation(parts: (string | undefined | null)[]): string {
  const s = parts
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter((p) => p.length > 0)
  return s.length ? s.join(", ") : UNKNOWN
}

async function lookupIpApiCom(ip: string): Promise<IpGeoEnrichment | null> {
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,timezone,isp,query`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const d = (await res.json()) as {
      status?: string
      country?: string
      countryCode?: string
      regionName?: string
      city?: string
      timezone?: string
      isp?: string
      query?: string
    }
    if (d.status !== "success") return null
    const cc = d.countryCode?.trim().toUpperCase() || null
    return {
      ip: d.query || ip,
      location: joinLocation([d.city, d.regionName, d.country]),
      timezone: d.timezone || UNKNOWN,
      isp: d.isp || UNKNOWN,
      countryCode: cc,
    }
  } catch {
    return null
  }
}

async function lookupIpApiCo(ip: string): Promise<IpGeoEnrichment | null> {
  try {
    const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const d = (await res.json()) as {
      ip?: string
      city?: string
      region?: string
      country_name?: string
      country_code?: string
      timezone?: string
      org?: string
      error?: boolean
    }
    if (d.error) return null
    const cc = d.country_code?.trim().toUpperCase() || null
    return {
      ip: d.ip || ip,
      location: joinLocation([d.city, d.region, d.country_name]),
      timezone: d.timezone || UNKNOWN,
      isp: d.org || UNKNOWN,
      countryCode: cc,
    }
  } catch {
    return null
  }
}

async function lookupIpWhoIs(ip: string): Promise<IpGeoEnrichment | null> {
  try {
    const url = `https://ipwho.is/${encodeURIComponent(ip)}`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const d = (await res.json()) as {
      success?: boolean
      ip?: string
      city?: string
      region?: string
      country?: string
      country_code?: string
      timezone?: { id?: string }
      connection?: { isp?: string }
    }
    if (d.success === false) return null
    const tz =
      typeof d.timezone === "object" && d.timezone?.id
        ? d.timezone.id
        : typeof d.timezone === "string"
          ? d.timezone
          : UNKNOWN
    const cc = d.country_code?.trim().toUpperCase() || null
    return {
      ip: d.ip || ip,
      location: joinLocation([d.city, d.region, d.country]),
      timezone: tz || UNKNOWN,
      isp: d.connection?.isp || UNKNOWN,
      countryCode: cc,
    }
  } catch {
    return null
  }
}

export async function enrichIpGeo(ip: string): Promise<IpGeoEnrichment> {
  const trimmed = ip.trim()
  if (!trimmed || isProbablyPrivateOrLocal(trimmed)) {
    return {
      ip: trimmed || UNKNOWN,
      location: UNKNOWN,
      timezone: UNKNOWN,
      isp: UNKNOWN,
      countryCode: null,
    }
  }

  const chain = [lookupIpApiCom, lookupIpApiCo, lookupIpWhoIs]
  for (const fn of chain) {
    const result = await fn(trimmed)
    if (result && result.location !== UNKNOWN && result.timezone !== UNKNOWN) {
      return result
    }
    if (result) return result
  }

  return {
    ip: trimmed,
    location: UNKNOWN,
    timezone: UNKNOWN,
    isp: UNKNOWN,
    countryCode: null,
  }
}
