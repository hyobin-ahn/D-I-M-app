export default async function handler(req, res) {
  const { code, market } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing stock code' });
  }

  // 기본 종목 fallback 사전 (사용자 계좌 보유 포트폴리오 기준)
  const defaultStockMap = {
    '005935': { stockName: '삼성전자우', closePrice: '167,500', compareToPreviousClosePrice: '8400', fluctuationsRatio: '5.28', currency: 'KRW' },
    '005930': { stockName: '삼성전자', closePrice: '216,500', compareToPreviousClosePrice: '6500', fluctuationsRatio: '3.10', currency: 'KRW' },
    'TSLA.O': { stockName: '테슬라', closePrice: '373.2000', compareToPreviousClosePrice: '10.7600', fluctuationsRatio: '2.97', currency: 'USD' },
    'TSLA': { stockName: '테슬라', closePrice: '373.2000', compareToPreviousClosePrice: '10.7600', fluctuationsRatio: '2.97', currency: 'USD' },
    '0094M0': { stockName: 'RISE 코리아밸류업위클리고정커버드콜', closePrice: '14,235', compareToPreviousClosePrice: '390', fluctuationsRatio: '2.82', currency: 'KRW' },
    'SPCX.O': { stockName: '스페이스X', closePrice: '152.4600', compareToPreviousClosePrice: '3.8400', fluctuationsRatio: '2.58', currency: 'USD' },
    'SPCX': { stockName: '스페이스X', closePrice: '152.4600', compareToPreviousClosePrice: '3.8400', fluctuationsRatio: '2.58', currency: 'USD' },
    '000660': { stockName: 'SK하이닉스', closePrice: '1,288,000', compareToPreviousClosePrice: '26000', fluctuationsRatio: '2.06', currency: 'KRW' },
    '489030': { stockName: 'PLUS 고배당주위클리커버드콜', closePrice: '6,115', compareToPreviousClosePrice: '60', fluctuationsRatio: '0.99', currency: 'KRW' },
    'GOOGL.O': { stockName: '알파벳 A', closePrice: '349.6700', compareToPreviousClosePrice: '0.4500', fluctuationsRatio: '0.13', currency: 'USD' },
    'GOOGL': { stockName: '알파벳 A', closePrice: '349.6700', compareToPreviousClosePrice: '0.4500', fluctuationsRatio: '0.13', currency: 'USD' },
    'SKHY.O': { stockName: 'SK하이닉스(ADR)', closePrice: '143.1600', compareToPreviousClosePrice: '-2.9500', fluctuationsRatio: '-2.02', currency: 'USD' },
    'SKHY': { stockName: 'SK하이닉스(ADR)', closePrice: '143.1600', compareToPreviousClosePrice: '-2.9500', fluctuationsRatio: '-2.02', currency: 'USD' }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const isWorld = market === 'world' || code.includes('.') || /^[A-Za-z]/.test(code);
  const endpoints = isWorld
    ? [
        `https://polling.finance.naver.com/api/realtime/worldstock/stock/${code}`,
        `https://api.stock.naver.com/stock/${code}/basic`
      ]
    : [
        `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`,
        `https://api.stock.naver.com/stock/${code}/basic`
      ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // polling format standard
        if (data && data.datas && data.datas.length > 0) {
          return res.status(200).json(data);
        }
        // basic format standard
        if (data && (data.stockName || data.closePrice)) {
          return res.status(200).json({
            datas: [{
              stockName: data.stockName || code,
              closePrice: data.closePrice,
              compareToPreviousClosePrice: data.compareToPreviousClosePrice,
              fluctuationsRatio: data.fluctuationsRatio
            }]
          });
        }
      }
    } catch (_) {
      // Continue to next endpoint or fallback
    }
  }

  // Fallback data if live api is unreachable or offline
  const fallback = defaultStockMap[code];
  if (fallback) {
    return res.status(200).json({
      datas: [fallback],
      fallback: true
    });
  }

  return res.status(404).json({ error: `Stock data not available for ${code}` });
}
