export interface ParsedSearchReferrer {
  /** Human label, e.g. Google, Bing, (direct) */
  searchEngineLabel: string
  /** Stable key for aggregation, e.g. google, bing, direct */
  searchEngineKey: string
  searchQuery: string | null
  referrerOrigin: string
  isDirect: boolean
  isSearchEngine: boolean
}

const QUERY_PARAMS = [
  "q",
  "p",
  "qry",
  "query",
  "text",
  "search",
  "wd",
  "word",
  "encKeyword",
  "kw",
] as const

const SEARCH_ENGINE_RULES: Array<{ test: (host: string) => boolean; key: string; label: string }> = [
  { test: (h) => h.includes("google."), key: "google", label: "Google" },
  { test: (h) => h === "bing.com" || h.endsWith(".bing.com"), key: "bing", label: "Bing" },
  { test: (h) => h.includes("yahoo."), key: "yahoo", label: "Yahoo" },
  { test: (h) => h.includes("duckduckgo.com"), key: "duckduckgo", label: "DuckDuckGo" },
  { test: (h) => h.includes("search.brave.com") || h === "brave.com", key: "brave", label: "Brave" },
  { test: (h) => h.includes("ecosia.org"), key: "ecosia", label: "Ecosia" },
  { test: (h) => h.includes("aol.com"), key: "aol", label: "AOL" },
  { test: (h) => h.includes("ask.com"), key: "ask", label: "Ask" },
  { test: (h) => h.includes("baidu.com"), key: "baidu", label: "Baidu" },
  { test: (h) => h.includes("yandex."), key: "yandex", label: "Yandex" },
  { test: (h) => h.includes("startpage.com"), key: "startpage", label: "Startpage" },
  { test: (h) => h.includes("qwant.com"), key: "qwant", label: "Qwant" },
  { test: (h) => h.includes("kagi.com"), key: "kagi", label: "Kagi" },
  { test: (h) => h.includes("mojeek.com"), key: "mojeek", label: "Mojeek" },
  { test: (h) => h.includes("naver.com"), key: "naver", label: "Naver" },
  { test: (h) => h.includes("seznam.cz"), key: "seznam", label: "Seznam" },
  { test: (h) => h.includes("sogou.com"), key: "sogou", label: "Sogou" },
  { test: (h) => h.includes("swisscows.com"), key: "swisscows", label: "Swisscows" },
  { test: (h) => h.includes("presearch.com"), key: "presearch", label: "Presearch" },
  { test: (h) => h.includes("dogpile.com"), key: "dogpile", label: "Dogpile" },
  { test: (h) => h.includes("webcrawler.com"), key: "webcrawler", label: "WebCrawler" },
  { test: (h) => h.includes("lycos.com"), key: "lycos", label: "Lycos" },
  { test: (h) => h.includes("gibiru.com"), key: "gibiru", label: "Gibiru" },
  { test: (h) => h.includes("search.meta.com"), key: "meta", label: "Meta Search" },
  { test: (h) => h.includes("you.com"), key: "you", label: "You.com" },
  { test: (h) => h.includes("perplexity.ai"), key: "perplexity", label: "Perplexity" },
  { test: (h) => h.includes("msn.com"), key: "msn", label: "MSN" },
]

function extractQueryFromUrl(url: URL): string | null {
  for (const param of QUERY_PARAMS) {
    const raw = url.searchParams.get(param)?.trim()
    if (!raw) continue
    try {
      return decodeURIComponent(raw.replace(/\+/g, " ")).trim() || null
    } catch {
      return raw
    }
  }
  return null
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "")
}

function matchSearchEngine(hostname: string): { key: string; label: string } | null {
  const host = normalizeHost(hostname)
  for (const rule of SEARCH_ENGINE_RULES) {
    if (rule.test(host)) return { key: rule.key, label: rule.label }
  }
  return null
}

function matchGenericSearchHost(hostname: string, url: URL): { key: string; label: string } | null {
  const host = normalizeHost(hostname)
  if (!host.startsWith("search.") && !host.includes(".search.")) return null
  if (!extractQueryFromUrl(url)) return null
  return { key: "other_search", label: host }
}

/**
 * Parse document.referrer (or "Direct") into search engine + optional query.
 * Google and most modern browsers strip query strings from referrer URLs.
 */
export function parseSearchReferrer(referrer: string | undefined | null): ParsedSearchReferrer {
  const raw = (referrer ?? "").trim()
  if (!raw || raw === "Direct") {
    return {
      searchEngineLabel: "(direct)",
      searchEngineKey: "direct",
      searchQuery: null,
      referrerOrigin: "(direct)",
      isDirect: true,
      isSearchEngine: false,
    }
  }

  if (!raw.startsWith("http")) {
    return {
      searchEngineLabel: raw,
      searchEngineKey: "referral",
      searchQuery: null,
      referrerOrigin: raw,
      isDirect: false,
      isSearchEngine: false,
    }
  }

  try {
    const url = new URL(raw)
    const origin = url.origin
    const engine = matchSearchEngine(url.hostname) ?? matchGenericSearchHost(url.hostname, url)
    const query = extractQueryFromUrl(url)

    if (engine) {
      return {
        searchEngineLabel: engine.label,
        searchEngineKey: engine.key,
        searchQuery: query,
        referrerOrigin: origin,
        isDirect: false,
        isSearchEngine: true,
      }
    }

    return {
      searchEngineLabel: origin,
      searchEngineKey: "referral",
      searchQuery: null,
      referrerOrigin: origin,
      isDirect: false,
      isSearchEngine: false,
    }
  } catch {
    return {
      searchEngineLabel: "(direct)",
      searchEngineKey: "direct",
      searchQuery: null,
      referrerOrigin: raw,
      isDirect: true,
      isSearchEngine: false,
    }
  }
}

export function formatQueryForDisplay(query: string | null, isSearchEngine: boolean): string {
  if (!isSearchEngine) return "—"
  if (query && query.length > 0) return query
  return "(not provided)"
}
