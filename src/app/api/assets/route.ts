import { NextResponse } from 'next/server';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

export async function POST(request: Request) {
  if (!GAS_URL) {
    return NextResponse.json({ error: 'GAS URL is not configured' }, { status: 500 });
  }

  try {
    const payload = await request.json();

    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateAsset',
        sheet: 'Assets',
        data: payload,
      }),
    });

    if (!res.ok) {
      throw new Error(`GAS backend returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Update asset error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update asset' }, { status: 500 });
  }
}
