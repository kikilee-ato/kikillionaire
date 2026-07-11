// Google Apps Script Web App URL
// 사용자가 배포 후 환경 변수에 등록해야 합니다. (.env.local에 NEXT_PUBLIC_GAS_URL=... 형태로 저장)
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

export interface Transaction {
  Date: string;
  Category: 'Income' | 'Expense' | 'Transfer';
  SubCategory?: string; // 식비, 주거비 등 상세 카테고리
  FromAsset: string;
  ToAsset?: string;
  Amount: string | number;
  Currency: 'KRW' | 'EUR';
  Merchant: string;
  Memo?: string;
}

export interface Asset {
  AssetName: string;
  AssetType: 'Deposit' | 'Savings' | 'Stocks' | 'Wallet' | 'Cash';
  Balance: number;
  Currency: 'KRW' | 'EUR';
  Quantity?: number | string; // 보유 수량 (주식 등)
  Extra?: string; // 이자율이나 티커
}

/**
 * 특정 시트의 데이터를 가져옵니다.
 * @param sheetName 'Transactions' | 'Assets'
 */
export async function fetchSheetData<T>(sheetName: string): Promise<T[]> {
  if (!GAS_URL) {
    console.warn('NEXT_PUBLIC_GAS_URL이 설정되지 않았습니다.');
    return [];
  }
  
  try {
    const res = await fetch(`${GAS_URL}?sheet=${sheetName}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Next.js caching 옵션 조정 가능 (예: 캐시 끄기 등)
      cache: 'no-store',
    });
    
    if (!res.ok) throw new Error('Failed to fetch data from GAS');
    const data = await res.json();
    return data as T[];
  } catch (error) {
    console.error('fetchSheetData error:', error);
    return [];
  }
}

/**
 * 특정 시트에 새로운 행을 추가합니다.
 * @param sheetName 'Transactions' | 'Assets'
 * @param data 추가할 데이터 객체
 */
export async function appendRow(sheetName: string, data: any) {
  if (!GAS_URL) return { success: false, error: 'No GAS URL' };

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // GAS CORS 이슈 회피를 위해 text/plain 사용 권장
      },
      body: JSON.stringify({
        action: 'append',
        sheet: sheetName,
        data: data
      })
    });
    
    const result = await res.json();
    return result;
  } catch (error) {
    console.error('appendRow error:', error);
    return { success: false, error };
  }
}
