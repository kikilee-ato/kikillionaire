import { NextResponse } from 'next/server';
import { fetchSheetData, Transaction } from '@/lib/googleSheets';

export async function GET() {
  try {
    const transactions = await fetchSheetData<Transaction>('Transactions');
    // Sort transactions by date descending
    const sorted = transactions.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
    return NextResponse.json(sorted);
  } catch (error: any) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch history' }, { status: 500 });
  }
}
