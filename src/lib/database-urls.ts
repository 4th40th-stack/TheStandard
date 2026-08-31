const SHARD_ID_RE = /^pl_s(\d+)_/
const BACKUP_ID_RE = /^pl_b_/

/** Max primary Neon shards (DB1…DB10). Contiguous env slots only. */
export const MAX_PRIMARY_SHARDS = 10

export type CreateTarget = { kind: 'primary'; index: number } | { kind: 'backup' }

/** Env key for shared primaries: DB_2 … DB_10 (index 1…9). Shard 0 uses DATABASE_URL. */
export function dbEnvKey(shardIndex: number): string {
  return `DB_${shardIndex + 1}`
}

/** Shard 0 canonical is DATABASE_URL. DB_1 is silent alias only. No DATABASE_URL_N. */
export function legacyDatabaseUrlEnvKeys(shardIndex: number): string[] {
  if (shardIndex === 0) return ['DATABASE_URL']
  return []
}


/** Optional Neon project id for diagnostics: NEON_PROJECT_ID_1 … NEON_PROJECT_ID_10. */
function neonProjectIdEnvKey(shardIndex: number): string {
  return `NEON_PROJECT_ID_${shardIndex + 1}`
}

/** Resolve: shard 0 = DATABASE_URL then silent DB_1; shards 1–9 = DB_2…DB_10 only. */
export function resolvePrimaryDatabaseUrl(shardIndex: number): string | null {
  if (shardIndex === 0) {
    const canonical = process.env.DATABASE_URL?.trim()
    if (canonical) return canonical
    const alias = process.env.DB_1?.trim()
    if (alias) return alias
    return null
  }
  return process.env[dbEnvKey(shardIndex)]?.trim() || null
}

/** Env key hint for errors. */
export function databaseUrlEnvKey(shardIndex: number): string {
  if (shardIndex === 0) return 'DATABASE_URL'
  return dbEnvKey(shardIndex)
}

export function normalizeNeonDatabaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    u.searchParams.delete('channel_binding')
    return u.toString()
  } catch {
    return trimmed
      .replace(/[?&]channel_binding=[^&]*/gi, '')
      .replace(/\?&+/g, '?')
      .replace(/\?$/g, '')
  }
}

/**
 * Primary Neon URLs in shard order (DATABASE_URL then DB_2…DB_10).
 * Stops at the first missing slot so indices stay contiguous.
 */
export function getDatabaseUrls(): string[] {
  const urls: string[] = []
  for (let i = 0; i < MAX_PRIMARY_SHARDS; i++) {
    const url = resolvePrimaryDatabaseUrl(i)
    if (!url) break
    urls.push(url)
  }
  return urls
}

export function getBackupDatabaseUrl(): string | null {
  const url = process.env.DATABASE_BACKUP_FALLBACK?.trim()
  return url || null
}

export function hasBackupDatabaseUrl(): boolean {
  return Boolean(getBackupDatabaseUrl())
}

/** True when DATABASE_URL / silent DB_1 or DB_2…DB_10 is set. */
export function hasDatabaseUrl(): boolean {
  return getDatabaseUrls().length > 0
}

/** True when any Neon URL is set, including shared backup. */
export function hasAnyDatabaseUrl(): boolean {
  return hasDatabaseUrl() || hasBackupDatabaseUrl()
}

export function getShardCount(): number {
  return getDatabaseUrls().length
}

export function getDatabaseUrlForShard(index: number): string {
  const urls = getDatabaseUrls()
  const url = urls[index]
  if (!url) {
    throw new Error(
      `Invalid shard index ${index}; configure DATABASE_URL (shard 0) or ${dbEnvKey(index)}.`,
    )
  }
  return url
}

export function isBackupPendingId(id: string): boolean {
  return BACKUP_ID_RE.test(id)
}

/** Shared shards DB_2…DB_10 (index ≥ 1) and backup require CC_ID. DATABASE_URL (shard 0) does not. */
export function shardRequiresCcId(shardIndex: number): boolean {
  return shardIndex >= 1
}

/** True for `pl_s1_…` ids (DB2 helper; kept for audit / fleet scripts). */
export function isDb2PendingId(id: string): boolean {
  return parseShardFromPendingId(id) === 1
}

/** Backup and shared primaries (DB_2…DB_10) require `CC_ID`. Shard 0 (DATABASE_URL) does not. */
export function createTargetRequiresCcId(target: CreateTarget): boolean {
  return target.kind === 'backup' || (target.kind === 'primary' && target.index >= 1)
}

export function pickRandomShardIndex(): number {
  const count = getShardCount()
  if (count === 0) throw new Error('No DATABASE_URL configured.')
  if (count === 1) return 0
  return Math.floor(Math.random() * count)
}

export function parseShardFromPendingId(id: string): number | null {
  if (isBackupPendingId(id)) return null
  const match = id.match(SHARD_ID_RE)
  if (!match) return null
  const index = Number(match[1])
  if (!Number.isInteger(index) || index < 0 || index >= getShardCount()) return null
  return index
}

export function buildPendingId(shardIndex: number): string {
  return `pl_s${shardIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function buildLegacyPendingId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function buildBackupPendingId(): string {
  return `pl_b_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function buildPendingLoginId(): { id: string; shardIndex: number } {
  if (getShardCount() <= 1) {
    return { id: buildLegacyPendingId(), shardIndex: 0 }
  }
  const shardIndex = pickRandomShardIndex()
  return { id: buildPendingId(shardIndex), shardIndex }
}

/** Try DATABASE_URL (shard 0) first, then DB_2…DB_10 in order when configured. */
export function getCreateShardOrder(): number[] {
  const count = getShardCount()
  if (count <= 0) return []
  return Array.from({ length: count }, (_, i) => i)
}

/** Primary shards first (DATABASE_URL → DB_2 → … → DB_10), then backup last. */
export function getCreateTargets(): CreateTarget[] {
  const targets: CreateTarget[] = getCreateShardOrder().map((index) => ({
    kind: 'primary',
    index,
  }))
  if (hasBackupDatabaseUrl()) {
    targets.push({ kind: 'backup' })
  }
  return targets
}

export function idForCreateShard(shardIndex: number): string {
  if (getShardCount() <= 1) return buildLegacyPendingId()
  return buildPendingId(shardIndex)
}

export function idForCreateTarget(target: CreateTarget): string {
  if (target.kind === 'backup') return buildBackupPendingId()
  return idForCreateShard(target.index)
}

/** Primary shard indices only. Backup ids are handled via isBackupPendingId. */
export function getShardIndicesForPendingId(id: string): number[] {
  if (isBackupPendingId(id)) return []
  const shard = parseShardFromPendingId(id)
  if (shard !== null) return [shard]
  return getDatabaseUrls().map((_, index) => index)
}

export function getNeonProjectIdForShard(index: number): string | null {
  if (index < 0 || index >= MAX_PRIMARY_SHARDS) return null
  return process.env[neonProjectIdEnvKey(index)]?.trim() || null
}

/** Human label for a primary shard index (matches Control Center Health tab). */
export function formatShardDisplayLabel(shardIndex: number): string {
  if (getShardCount() <= 1) return 'Database'
  return `DB ${shardIndex + 1}`
}

/** Label for which Neon shard a pending login row lives on. */
export function formatPendingLoginDatabaseLabel(
  id: string,
  listedFromShardIndex?: number,
): string {
  if (isBackupPendingId(id)) return 'Backup'
  const parsed = parseShardFromPendingId(id)
  if (parsed !== null) return formatShardDisplayLabel(parsed)
  if (listedFromShardIndex !== undefined) {
    return formatShardDisplayLabel(listedFromShardIndex)
  }
  return formatShardDisplayLabel(0)
}

