#!/usr/bin/env node
/**
 * Audit Neon multi-shard (DB1…DB10) + backup fallback for pending-login sites.
 * See NEON_DATABASE_RULES.md — HARD RULES: Neon stack.
 *
 * Usage: node scripts/audit-neon-database.mjs [project-root]
 * Exit 1 if any check fails.
 * Skips (exit 0) when lib/pending-logins.ts is absent.
 */

import fs from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] ?? process.cwd())

function readIfExists(relPaths) {
  for (const rel of relPaths) {
    const full = path.join(root, rel)
    if (fs.existsSync(full)) return { rel, text: fs.readFileSync(full, "utf8") }
  }
  return null
}

function exists(relPaths) {
  for (const rel of relPaths) {
    if (fs.existsSync(path.join(root, rel))) return rel
  }
  return null
}

const pending = readIfExists(["lib/pending-logins.ts", "src/lib/pending-logins.ts"])
if (!pending) {
  console.log("audit-neon-database: no pending-logins.ts — skip")
  process.exit(0)
}

const failures = []

const urls = readIfExists(["lib/database-urls.ts", "src/lib/database-urls.ts"])
if (!urls) {
  failures.push("missing lib/database-urls.ts (required with pending-logins)")
} else {
  const t = urls.text
  if (!/DATABASE_BACKUP_FALLBACK/.test(t)) {
    failures.push(`${urls.rel}: missing DATABASE_BACKUP_FALLBACK support`)
  }
  if (!/getBackupDatabaseUrl/.test(t)) {
    failures.push(`${urls.rel}: missing getBackupDatabaseUrl`)
  }
  if (!/getCreateTargets|getCreateShardOrder/.test(t)) {
    failures.push(`${urls.rel}: missing getCreateTargets / getCreateShardOrder`)
  }
  if (!/pl_b_|buildBackupPendingId|isBackupPendingId/.test(t)) {
    failures.push(`${urls.rel}: missing backup pending id helpers (pl_b_)`)
  }
  if (!/shardRequiresCcId|createTargetRequiresCcId|isDb2PendingId/.test(t)) {
    failures.push(`${urls.rel}: missing shared-shard CC_ID helpers (shardRequiresCcId / createTargetRequiresCcId)`)
  }
  if (!/MAX_PRIMARY_SHARDS\s*=\s*10/.test(t)) {
    failures.push(`${urls.rel}: missing MAX_PRIMARY_SHARDS = 10`)
  }
  if (!/dbEnvKey|resolvePrimaryDatabaseUrl/.test(t)) {
    failures.push(`${urls.rel}: missing DB_N env resolution (dbEnvKey / resolvePrimaryDatabaseUrl)`)
  }
  if (!/process\.env\.DATABASE_URL/.test(t)) {
    failures.push(`${urls.rel}: must read process.env.DATABASE_URL for shard 0`)
  }
  if (!/legacyDatabaseUrlEnvKeys/.test(t)) {
    failures.push(
      `${urls.rel}: missing legacyDatabaseUrlEnvKeys (DATABASE_URL is official shard 0 primary; DB_1 silent alias only; no DATABASE_URL_N)`,
    )
  }
  // Create order must be sequential [0..count-1], never DB2-first [1, 0]
  if (/return\s*\[\s*1\s*,\s*0\s*\]/.test(t)) {
    failures.push(`${urls.rel}: create order must not prefer DB2-first ([1, 0])`)
  }
  if (!/Array\.from\(\s*\{\s*length:\s*count/.test(t)) {
    failures.push(
      `${urls.rel}: getCreateShardOrder must build sequential indices [0..count-1] (e.g. Array.from({ length: count }, …))`,
    )
  }
  if (!/shardIndex\s*>=\s*1|index\s*>=\s*1/.test(t)) {
    failures.push(`${urls.rel}: shardRequiresCcId / createTargetRequiresCcId must use index >= 1 (DB2–DB10)`)
  }
}

const db = readIfExists(["lib/db.ts", "src/lib/db.ts"])
if (!db) {
  failures.push("missing lib/db.ts")
} else if (!/getSqlForBackup/.test(db.text)) {
  failures.push(`${db.rel}: missing getSqlForBackup`)
}

const ccId = exists(["lib/cc-id.ts", "src/lib/cc-id.ts"])
if (!ccId) {
  failures.push("missing lib/cc-id.ts (CC_ID helpers)")
}

if (!/cc_id|getCcId|ccId/.test(pending.text)) {
  failures.push(`${pending.rel}: must stamp / filter cc_id for backup isolation`)
}

if (!/createTargetRequiresCcId|shardRequiresCcId/.test(pending.text)) {
  failures.push(`${pending.rel}: must skip/filter shared shards with CC_ID (createTargetRequiresCcId / shardRequiresCcId)`)
}

const outcome = readIfExists([
  "lib/pending-login-outcome-notify.ts",
  "src/lib/pending-login-outcome-notify.ts",
])
if (outcome && !/shardRequiresCcId/.test(outcome.text)) {
  failures.push(`${outcome.rel}: shared-shard outcome claim must filter cc_id via shardRequiresCcId`)
}

if (failures.length) {
  console.error("audit-neon-database FAILED:")
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log("audit-neon-database: ok")
process.exit(0)
