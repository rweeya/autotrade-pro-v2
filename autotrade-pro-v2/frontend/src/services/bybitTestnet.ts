// src/services/bybitTestnet.ts

const API_URL = 'https://api-testnet.bybit.com';
const RECV_WINDOW = '5000';

interface Position {
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  leverage: string;
  positionValue: string;
  unrealisedPnl: string;
  tp: string;
  sl: string;
}

interface Balance {
  coin: string;
  walletBalance: string;
  availableBalance: string;
}

let apiKey = 'BBTh4UU9lErjxZhyu4';
let apiSecret = 'irjQnuh8droR2sCfRhW0sXzkBqlAHeqWKpMK';

export function setCredentials(key: string, secret: string) {
  apiKey = key;
  apiSecret = secret;
}

async function sign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function request(method: string, endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const timestamp = Date.now().toString();
  const queryString = Object.entries({ ...params, api_key: apiKey, timestamp, recv_window: RECV_WINDOW })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  
  const signature = await sign(queryString, apiSecret);
  
  const url = `${API_URL}${endpoint}?${queryString}&sign=${signature}`;
  
  const res = await fetch(url, { method });
  if (!res.ok) {
    const err = await res.text();
    console.error('Bybit API Error:', err);
    throw new Error(err);
  }
  return res.json();
}

export async function fetchBalance(): Promise<Balance[]> {
  try {
    const data = await request('GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' });
    const coins = data?.result?.list?.[0]?.coin || [];
    return coins.map((c: any) => ({
      coin: c.coin,
      walletBalance: c.walletBalance,
      availableBalance: c.availableToWithdraw || c.walletBalance,
    }));
  } catch (e) {
    console.error('fetchBalance error:', e);
    return [];
  }
}

export async function fetchPositions(): Promise<Position[]> {
  try {
    const data = await request('GET', '/v5/position/list', { category: 'linear', settleCoin: 'USDT' });
    const list = data?.result?.list || [];
    return list.filter((p: any) => parseFloat(p.size) > 0);
  } catch (e) {
    console.error('fetchPositions error:', e);
    return [];
  }
}

export async function openPosition(
  symbol: string,
  side: 'Buy' | 'Sell',
  qty: string,
  tp: number,
  sl: number
): Promise<boolean> {
  try {
    // ЗАЩИТА: проверяем, нет ли уже открытой позиции по этому символу
    const existing = await fetchPositions();
    const alreadyOpen = existing.find(p => p.symbol === symbol && parseFloat(p.size) > 0);
    if (alreadyOpen) {
      console.warn(`Позиция ${symbol} уже открыта, пропускаем`);
      return false;
    }

    await request('POST', '/v5/order/create', {
      category: 'linear',
      symbol,
      side,
      orderType: 'Market',
      qty,
      timeInForce: 'GTC',
      positionIdx: '0',
    });

    // Ставим TP/SL
    const positions = await fetchPositions();
    const pos = positions.find(p => p.symbol === symbol);
    if (pos) {
      const tpSide = side === 'Buy' ? 'Sell' : 'Buy';
      await request('POST', '/v5/position/trading-stop', {
        category: 'linear',
        symbol,
        takeProfit: tp.toString(),
        stopLoss: sl.toString(),
        positionIdx: '0',
      });
    }

    // ОБЯЗАТЕЛЬНО обновляем баланс после сделки
    await fetchBalance();
    
    return true;
  } catch (e) {
    console.error('openPosition error:', e);
    return false;
  }
}

export async function closePosition(symbol: string): Promise<boolean> {
  try {
    const positions = await fetchPositions();
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos) return false;

    const side = pos.side === 'Buy' ? 'Sell' : 'Buy';
    await request('POST', '/v5/order/create', {
      category: 'linear',
      symbol,
      side,
      orderType: 'Market',
      qty: pos.size,
      timeInForce: 'GTC',
      positionIdx: '0',
    });

    // Обновляем баланс
    await fetchBalance();
    return true;
  } catch (e) {
    console.error('closePosition error:', e);
    return false;
  }
}

export async function closeAllPositions(): Promise<boolean> {
  try {
    const positions = await fetchPositions();
    for (const pos of positions) {
      const side = pos.side === 'Buy' ? 'Sell' : 'Buy';
      await request('POST', '/v5/order/create', {
        category: 'linear',
        symbol: pos.symbol,
        side,
        orderType: 'Market',
        qty: pos.size,
        timeInForce: 'GTC',
        positionIdx: '0',
      });
    }
    await fetchBalance();
    return true;
  } catch (e) {
    console.error('closeAllPositions error:', e);
    return false;
  }
}

export async function checkTPSL(): Promise<string[]> {
  const closed: string[] = [];
  try {
    const positions = await fetchPositions();
    
    // Если позиций стало меньше — значит, TP/SL сработали
    const storedPositions = JSON.parse(localStorage.getItem('openPositions') || '[]');
    const currentSymbols = positions.map(p => p.symbol);
    
    for (const stored of storedPositions) {
      if (!currentSymbols.includes(stored.symbol)) {
        closed.push(stored.symbol);
      }
    }
    
    // Обновляем баланс всегда при проверке
    if (closed.length > 0) {
      await fetchBalance();
    }
    
    return closed;
  } catch (e) {
    console.error('checkTPSL error:', e);
    return [];
  }
}
