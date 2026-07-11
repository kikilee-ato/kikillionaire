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

// In-memory cache for Google Sheets data (server-side only)
interface CachedData {
  Assets: Asset[];
  Transactions: Transaction[];
  timestamp: number;
}

let sheetsCache: CachedData | null = null;
const CACHE_TTL = 15000; // 15 seconds cache lifetime

/**
 * 양쪽 시트(Assets, Transactions)의 데이터를 한 번의 API 호출로 가져옵니다.
 * 서버 메모리에 15초간 캐싱을 유지합니다.
 */
export async function fetchSheetDataAll(): Promise<{ Assets: Asset[]; Transactions: Transaction[] }> {
  if (!GAS_URL) {
    console.warn('NEXT_PUBLIC_GAS_URL이 설정되지 않았습니다.');
    return { Assets: [], Transactions: [] };
  }

  const now = Date.now();
  if (sheetsCache && (now - sheetsCache.timestamp < CACHE_TTL)) {
    return {
      Assets: sheetsCache.Assets,
      Transactions: sheetsCache.Transactions
    };
  }

  try {
    const res = await fetch(`${GAS_URL}?sheet=all`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store', // API 수준의 Next.js 강제 캐시는 비활성화하고 로컬 메모리 캐시 사용
    });

    if (!res.ok) throw new Error('Failed to fetch all data from GAS');
    const data = await res.json();
    
    // 캐시 업데이트
    sheetsCache = {
      Assets: data.Assets || [],
      Transactions: data.Transactions || [],
      timestamp: now
    };

    return sheetsCache;
  } catch (error) {
    console.error('fetchSheetDataAll error:', error);
    // 에러 발생 시 기존 캐시가 있다면 리턴, 없으면 빈 배열 리턴
    if (sheetsCache) return sheetsCache;
    return { Assets: [], Transactions: [] };
  }
}

/**
 * 특정 시트의 데이터를 가져옵니다. (단일 시트용 예외 처리 / 하위 호환성 유지)
 */
export async function fetchSheetData<T>(sheetName: string): Promise<T[]> {
  const allData = await fetchSheetDataAll();
  if (sheetName === 'Assets') {
    return allData.Assets as unknown as T[];
  } else if (sheetName === 'Transactions') {
    return allData.Transactions as unknown as T[];
  }
  
  // 예외 시트 요청 시 단독 페치 수행
  try {
    const res = await fetch(`${GAS_URL}?sheet=${sheetName}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Failed to fetch ${sheetName} from GAS`);
    return await res.json() as T[];
  } catch (error) {
    console.error(`fetchSheetData (${sheetName}) error:`, error);
    return [];
  }
}

/**
 * 특정 시트에 새로운 행을 추가합니다.
 * 추가 성공 시 로컬 캐시를 즉시 파기하여 최신 데이터를 반영하도록 합니다.
 */
export async function appendRow(sheetName: string, data: any) {
  if (!GAS_URL) return { success: false, error: 'No GAS URL' };

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'append',
        sheet: sheetName,
        data: data
      })
    });
    
    const result = await res.json();
    
    // 신규 추가에 성공하면 로컬 캐시 무효화 (Invalidate cache)
    if (result && result.success) {
      sheetsCache = null;
    }
    
    return result;
  } catch (error) {
    console.error('appendRow error:', error);
    return { success: false, error };
  }
}

