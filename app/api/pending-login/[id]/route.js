import { NextResponse } from 'next/server';
import { getPendingLogin } from '@/lib/pending-logins';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const record = await getPendingLogin(id);
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ id: record.id, status: record.status, method: record.method });
  } catch (error) {
    console.error('Pending login get error:', error);
    return NextResponse.json({ error: 'Failed to get pending login' }, { status: 500 });
  }
}
