import { neon } from '@neondatabase/serverless'
import {
  getBackupDatabaseUrl,
  getDatabaseUrlForShard,
  hasBackupDatabaseUrl,
  hasDatabaseUrl,
  normalizeNeonDatabaseUrl,
} from '@/lib/database-urls'

export { hasDatabaseUrl, hasBackupDatabaseUrl }

export function getSqlForShard(shardIndex = 0) {
  const url = getDatabaseUrlForShard(shardIndex)
  return neon(normalizeNeonDatabaseUrl(url))
}

export function getSqlForBackup() {
  const url = getBackupDatabaseUrl()
  if (!url) {
    throw new Error('DATABASE_BACKUP_FALLBACK is not configured.')
  }
  return neon(normalizeNeonDatabaseUrl(url))
}

export function getSql() {
  return getSqlForShard(0)
}
