export async function getExchangeRate(): Promise<number> {
  try {
    // 무료 API: 1 EUR 기준 각국의 환율 정보 제공
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
      next: { revalidate: 3600 } // 1시간마다 갱신
    });
    
    if (!res.ok) throw new Error('Failed to fetch exchange rate');
    
    const data = await res.json();
    return data.rates.KRW || 1450; // 기본값 폴백
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 1450; // API 실패 시 임의의 기본 환율
  }
}
