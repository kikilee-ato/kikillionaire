import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      next: { revalidate: 300 }, // 캐시 5분
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance API returned ${res.status}`);
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      return NextResponse.json({ error: 'No stock data found for ticker' }, { status: 404 });
    }

    const currentPrice = result.meta?.regularMarketPrice || result.indicators?.quote?.[0]?.close?.filter(Boolean).pop() || 0;
    const currency = result.meta?.currency || 'USD';

    return NextResponse.json({
      ticker,
      price: currentPrice,
      currency,
    });
  } catch (error: any) {
    console.error('Stock fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch stock price' }, { status: 500 });
  }
}
