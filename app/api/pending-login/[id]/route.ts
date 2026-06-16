import { NextRequest, NextResponse } from 'next/server'
import { getPendingLogin } from '@/lib/pending-logins'
import { claimAndSendAdminLoginOutcome } from '@/lib/pending-login-outcome-notify'

/** GET: used by 2FA verify page to poll status. Approve/deny is done in Admin Portal only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await getPendingLogin(id)
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    try {
      await claimAndSendAdminLoginOutcome(id)
    } catch (notifyErr) {
      console.error('[pending-login] admin outcome notify:', notifyErr)
    }

    return NextResponse.json({
      id: record.id,
      status: record.status,
      method: record.method,
    })
  } catch (e) {
    console.error('Pending login get error:', e)
    return NextResponse.json({ error: 'Failed to get pending login' }, { status: 500 })
  }
}
