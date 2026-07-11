import { NextResponse } from 'next/server';
import { fetchSheetDataAll, Asset, Transaction } from '@/lib/googleSheets';
import { getExchangeRate } from '@/lib/exchangeRate';

// Helper to fetch stock price from Yahoo Finance
async function getStockPrice(ticker: string): Promise<number> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      next: { revalidate: 300 }, // 5분 캐시
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    // 1. Fetch exchange rate (EUR to KRW)
    const eurToKrw = await getExchangeRate();

    // 2. Fetch Assets and Transactions from Google Sheets in a single call
    const { Assets: assets, Transactions: transactions } = await fetchSheetDataAll();


    // 3. Process Assets and calculate real-time valuations
    const processedAssets = await Promise.all(
      assets.map(async (asset) => {
        let currentBalance = Number(asset.Balance) || 0;
        let accruedInterest = 0;
        let stockProfit = 0;

        if (asset.AssetType === 'Savings') {
          // 적금 이자 계산
          const extraStr = asset.Extra || '';
          const parts = extraStr.split('|');
          const rate = Number(parts[0]) || 0; // 이율 (예: 4.5)
          const startDateStr = parts[1] || ''; // 가입일 (예: 2025-10-15)
          const termMonths = Number(parts[2]) || 12; // 만기 기간 (기본값 12개월)
          const maxDays = Math.round(termMonths * 30.4375); // e.g. 12개월 = 365일

          if (rate > 0) {
            const now = new Date();

            // 가입일 이후 추가 입금(Transfer)된 내역 필터링
            const txsToSavings = transactions.filter(
              (tx) => tx.Category === 'Transfer' && tx.ToAsset === asset.AssetName
            );

            // 가입일 이후 추가 입금액 합계 계산
            const totalTransfersAfterStart = txsToSavings
              .filter((tx) => !startDateStr || new Date(tx.Date) > new Date(startDateStr))
              .reduce((sum, tx) => sum + (Number(tx.Amount) || 0), 0);

            // 1. 초기 예치금(Balance - 추가입금액)에 대한 이자 계산 (가입일이 입력된 경우)
            if (startDateStr) {
              const startDate = new Date(startDateStr);
              if (!isNaN(startDate.getTime())) {
                const diffTime = Math.abs(now.getTime() - startDate.getTime());
                // 만기 기간(maxDays)까지만 이자가 발생하도록 제한
                const diffDays = Math.min(maxDays, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                const initialAmount = Math.max(0, (Number(asset.Balance) || 0) - totalTransfersAfterStart);
                accruedInterest += initialAmount * (rate / 100) * (diffDays / 365);
              }
            }

            // 2. 가입일 이후 추가 입금(Transfer)된 내역에 대한 이자 계산
            txsToSavings.forEach((tx) => {
              const txDate = new Date(tx.Date);
              // 가입일 이전의 이체 내역은 중복 계산 방지를 위해 패스
              if (startDateStr && txDate <= new Date(startDateStr)) return;

              const diffTime = Math.abs(now.getTime() - txDate.getTime());
              const diffDays = Math.min(maxDays, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
              const amount = Number(tx.Amount) || 0;
              accruedInterest += amount * (rate / 100) * (diffDays / 365);
            });
            currentBalance += accruedInterest;
          }
        } else if (asset.AssetType === 'Stocks') {
          // 주식 평가금액 계산
          const ticker = asset.Extra || '';
          const quantity = Number(asset.Quantity) || 0;
          if (ticker && quantity > 0) {
            const currentPrice = await getStockPrice(ticker);
            const purchaseValue = Number(asset.Balance) || 0;
            if (currentPrice > 0) {
              const currentValuation = currentPrice * quantity;
              stockProfit = currentValuation - purchaseValue;
              currentBalance = currentValuation;
            } else {
              currentBalance = purchaseValue;
            }
          } else {
            currentBalance = Number(asset.Balance) || 0;
          }
        }



        return {
          ...asset,
          Balance: currentBalance,
          accruedInterest: asset.AssetType === 'Savings' ? accruedInterest : undefined,
          stockProfit: asset.AssetType === 'Stocks' ? stockProfit : undefined
        };
      })
    );

    const ASSET_ORDER: Record<string, number> = {
      'Cash (EUR)': 1,
      'Travel Wallet': 2,
      'N26': 3,
      'KR Bank Deposit': 4,
      'KR Bank Savings': 5
    };

    const sortedAssets = processedAssets.sort((a, b) => {
      const orderA = ASSET_ORDER[a.AssetName] || 99;
      const orderB = ASSET_ORDER[b.AssetName] || 99;
      return orderA - orderB;
    });

    // 4. Calculate Runway & Monthly budget metrics
    // 이중 계산을 제외하고 실제 지출(Category === 'Expense')만 집계
    const expenseTxs = transactions.filter(tx => tx.Category === 'Expense');
    const incomeTxs = transactions.filter(tx => tx.Category === 'Income');

    // 최근 30일 기준 일평균 지출액 계산
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const recentExpenses = expenseTxs.filter(tx => new Date(tx.Date) >= thirtyDaysAgo);
    const recentIncomes = incomeTxs.filter(tx => new Date(tx.Date) >= thirtyDaysAgo);

    // 금액 단위를 EUR로 통일하여 합산 계산
    const totalRecentExpenseEUR = recentExpenses.reduce((sum, tx) => {
      const amount = Number(tx.Amount) || 0;
      return sum + (tx.Currency === 'KRW' ? amount / eurToKrw : amount);
    }, 0);

    const totalRecentIncomeEUR = recentIncomes.reduce((sum, tx) => {
      const amount = Number(tx.Amount) || 0;
      return sum + (tx.Currency === 'KRW' ? amount / eurToKrw : amount);
    }, 0);

    const monthlyExpenseEUR = totalRecentExpenseEUR;
    const monthlyIncomeEUR = totalRecentIncomeEUR;

    // 가용 자산 계산 (AssetType이 Savings, Stocks가 아닌 것들의 합)
    const availableAssetsEUR = sortedAssets
      .filter(asset => asset.AssetType !== 'Savings' && asset.AssetType !== 'Stocks')
      .reduce((sum, asset) => {
        const balance = Number(asset.Balance) || 0;
        return sum + (asset.Currency === 'KRW' ? balance / eurToKrw : balance);
      }, 0);

    // Runway 계산 (남은 가용 자산 / (월 지출 - 월 수입))
    // 만약 월 지출이 월 수입보다 적다면 무한대(유지 가능)로 처리
    const netMonthlyBurnEUR = Math.max(0, monthlyExpenseEUR - monthlyIncomeEUR);
    const runwayMonths = netMonthlyBurnEUR > 0
      ? (availableAssetsEUR / netMonthlyBurnEUR)
      : Infinity;

    return NextResponse.json({
      eurToKrw,
      assets: sortedAssets,
      transactions: transactions.slice(-10).reverse(), // 최근 10개만 리턴
      metrics: {
        availableAssetsEUR,
        monthlyExpenseEUR,
        monthlyIncomeEUR,
        runwayMonths,
        dailyBudgetEUR: netMonthlyBurnEUR > 0 ? (availableAssetsEUR / 30) : 0 // 가이드용 일일 권장 지출액
      }
    });
  } catch (error: any) {
    console.error('Dashboard calculation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
