import { neon, neonConfig } from '@neondatabase/serverless'
import {
  getBackupDatabaseUrl,
  getDatabaseUrlForShard,
  hasBackupDatabaseUrl,
  hasDatabaseUrl,
  normalizeNeonDatabaseUrl,
} from '@/lib/database-urls'

export { hasDatabaseUrl, hasBackupDatabaseUrl }

/** Reuse fetch connections across queries in the same isolate (warmer first hit). */
neonConfig.fetchConnectionCache = true

function createSql(url: string) {
  return neon(normalizeNeonDatabaseUrl(url))
}

type Sql = ReturnType<typeof createSql>

const sqlByShard = new Map<number, Sql>()
let sqlBackup: Sql | null = null

export function getSqlForShard(shardIndex = 0) {
  const cached = sqlByShard.get(shardIndex)
  if (cached) return cached
  const sql = createSql(getDatabaseUrlForShard(shardIndex))
  sqlByShard.set(shardIndex, sql)
  return sql
}

export function getSqlForBackup() {
  if (sqlBackup) return sqlBackup
  const url = getBackupDatabaseUrl()
  if (!url) {
    throw new Error('DATABASE_BACKUP_FALLBACK is not configured.')
  }
  sqlBackup = createSql(url)
  return sqlBackup
}

export function getSql() {
  return getSqlForShard(0)
}
