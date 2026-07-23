const SHARD_ID_RE = /^pl_s(\d+)_/
const BACKUP_ID_RE = /^pl_b_/

export type CreateTarget = { kind: 'primary'; index: number } | { kind: 'backup' }

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

export function getDatabaseUrls(): string[] {
  return [process.env.DATABASE_URL, process.env.DATABASE_URL_2]
    .map((u) => u?.trim())
    .filter((u): u is string => Boolean(u))
}

export function getBackupDatabaseUrl(): string | null {
  const url = process.env.DATABASE_BACKUP_FALLBACK?.trim()
  return url || null
}

export function hasBackupDatabaseUrl(): boolean {
  return Boolean(getBackupDatabaseUrl())
}

/** True when DATABASE_URL and/or DATABASE_URL_2 are set (primary shards only). */
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
      `Invalid shard index ${index}; configure DATABASE_URL${index > 0 ? `_2` : ''}.`,
    )
  }
  return url
}

export function isBackupPendingId(id: string): boolean {
  return BACKUP_ID_RE.test(id)
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

/** Try DATABASE_URL (shard 0) first, then DATABASE_URL_2 when both exist. */
export function getCreateShardOrder(): number[] {
  const count = getShardCount()
  if (count <= 0) return []
  if (count === 1) return [0]
  return [0, 1]
}

/** Primary shards first (DB1 then DB2), then shared backup last. */
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
  if (index === 0) return process.env.NEON_PROJECT_ID?.trim() || null
  if (index === 1) return process.env.NEON_PROJECT_ID_2?.trim() || null
  return null
}
