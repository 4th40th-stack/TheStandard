const DATACENTER_ASNS = new Set([
  "AS16509",
  "AS14618",
  "AS15169",
  "AS396982",
  "AS8075",
  "AS14061",
  "AS16276",
  "AS24940",
  "AS20473",
  "AS63949",
  "AS13335",
  "AS32934",
  "AS45102",
  "AS31898",
  "AS12876",
  "AS9009",
  "AS51167",
])

const DATACENTER_ORG_KEYWORDS = [
  "amazon",
  "aws",
  "google cloud",
  "microsoft azure",
  "digitalocean",
  "hetzner",
  "ovh",
  "linode",
  "vultr",
  "cloudflare",
  "hosting",
  "datacenter",
  "data center",
  "vps",
  "server",
  "colo",
]

/** Named consumer/commercial VPN brands — win even on datacenter ASNs. */
const NAMED_VPN_BRAND_KEYWORDS = [
  "mullvad",
  "nordvpn",
  "nord security",
  "expressvpn",
  "surfshark",
  "protonvpn",
  "proton ag",
  "private internet",
  "pia ",
  "tunnelbear",
  "cyberghost",
  "ipvanish",
  "purevpn",
  "windscribe",
  "hide.me",
  "hidemyass",
  "hotspot shield",
  "urban vpn",
  "opera vpn",
  "tailscale",
  "zerotier",
  "tor exit",
]

/**
 * Generic tokens that often false-positive on CDN orgs (e.g. "Cloudflare WARP").
 * Only applied when the IP is not already classified as datacenter.
 */
const GENERIC_VPN_PROXY_KEYWORDS = [
  "vpn",
  "proxy",
  "warp",
  "anonymizer",
]

/** @deprecated Use isNamedVpnBrandOrg / isGenericVpnOrProxyOrg; kept for callers. */
const VPN_PROXY_ORG_KEYWORDS = [...NAMED_VPN_BRAND_KEYWORDS, ...GENERIC_VPN_PROXY_KEYWORDS]

export function normalizeAsn(asn: string | null | undefined): string | null {
  if (!asn?.trim()) return null
  const trimmed = asn.trim().toUpperCase()
  if (trimmed.startsWith("AS")) return trimmed
  if (/^\d+$/.test(trimmed)) return `AS${trimmed}`
  return trimmed
}

export function isDatacenterAsn(asn: string | null | undefined): boolean {
  const normalized = normalizeAsn(asn)
  if (!normalized) return false
  return DATACENTER_ASNS.has(normalized)
}

export function isDatacenterOrg(org: string | null | undefined): boolean {
  if (!org?.trim()) return false
  const lower = org.toLowerCase()
  return DATACENTER_ORG_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function orgMatchesAny(org: string | null | undefined, keywords: string[]): boolean {
  if (!org?.trim()) return false
  const lower = org.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword))
}

export function isNamedVpnBrandOrg(org: string | null | undefined): boolean {
  return orgMatchesAny(org, NAMED_VPN_BRAND_KEYWORDS)
}

export function isGenericVpnOrProxyOrg(org: string | null | undefined): boolean {
  return orgMatchesAny(org, GENERIC_VPN_PROXY_KEYWORDS)
}

export function isVpnOrProxyOrg(org: string | null | undefined): boolean {
  return orgMatchesAny(org, VPN_PROXY_ORG_KEYWORDS)
}

export function isDatacenterIpProfile(asn: string | null, org: string | null): boolean {
  return isDatacenterAsn(asn) || isDatacenterOrg(org)
}

/**
 * Heuristic network label for Telegram visit alerts.
 * Named VPN brands first; datacenter ASN/org before generic vpn/proxy/warp tokens
 * (so Cloudflare WARP → Datacenter / hosting, not Likely VPN/proxy).
 */
export function getNetworkHintLabel(
  asn: string | null | undefined,
  orgOrIsp: string | null | undefined,
): string | null {
  const org = orgOrIsp?.trim() || null
  if (isNamedVpnBrandOrg(org)) return "Likely VPN/proxy"
  if (isDatacenterIpProfile(asn ?? null, org)) return "Datacenter / hosting"
  if (isGenericVpnOrProxyOrg(org)) return "Likely VPN/proxy"
  return null
}
