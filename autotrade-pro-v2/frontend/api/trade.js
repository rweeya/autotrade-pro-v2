// api/trade.js
export const maxDuration = 30;

const REDIS_URL = 'https://trusted-skylark-162178.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAnmCAAIgcDIxZDcxZjE2YWI3OWI0ZmI4YWJmMDgyMmI2ZjViNjlmZQ';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { 'Authorization': `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });
}

function calcRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const avgGain = gains / period, avgLoss = losses / period;
  return Math.round(100 - 100 / (1 + avgGain / avgLoss));
}

function calcEMA(prices, period) {
  if (!prices || prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) ema = (prices[i] - ema) * k + ema;
  return ema;
}

function calcMACD(prices) {
  if (!prices || prices.length < 35) return 0;
  return parseFloat((calcEMA(prices, 12) - calcEMA(prices, 26)).toFixed(4));
}

function calcADX(prices, period = 14) {
  if (!prices || prices.length < period * 2) return 0;
  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < prices.length; i++) {
    const h = Math.max(prices[i], prices[i - 1]), l = Math.min(prices[i], prices[i - 1]);
    const pH = Math.max(prices[i - 1], prices[i - 2] || prices[i - 1]);
    const pL = Math.min(prices[i - 1], prices[i - 2] || prices[i - 1]);
    tr.push(Math.max(h - l, Math.abs(h - prices[i - 1]), Math.abs(l - prices[i - 1])));
    plusDM.push(h - pH > 0 && h - pH > pL - l ? h - pH : 0);
    minusDM.push(pL - l > 0 && pL - l > h - pH ? pL - l : 0);
  }
  const smooth = (d) => { const k = 2 / (period + 1); let e = d[0]; for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k); return e; };
  const atr = smooth(tr);
  if (!atr) return 0;
  return Math.abs(smooth(plusDM) - smooth(minusDM)) / (smooth(plusDM) + smooth(minusDM)) * 100;
}

function calcStochastic(prices, period = 14) {
  if (!prices || prices.length < period) return 50;
  const slice = prices.slice(-period);
  const h = Math.max(...slice), l = Math.min(...slice);
  if (h === l) return 50;
  return ((prices[prices.length - 1] - l) / (h - l)) * 100;
}

const CONFIG = {
  RSI_BUY: 30, RSI_SELL: 70,
  STOCH_BUY: 20, STOCH_SELL: 80,
  ADX_MIN: 25,
  TP_PERCENT: 2.0, SL_PERCENT: 0.5,
  COOLDOWN: 120000
};

export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price');
    const tickers = await response.json();
    
    const volumeRes = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const volumeData = await volumeRes.json();
    const topSymbols = volumeData
      .filter(t => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, 150)
      .map(t => t.symbol.replace('USDT', '/USDT'));
    
    let signals = [];
    
    for (const symbol of topSymbols) {
      const binanceSymbol = symbol.replace('/', '');
      const ticker = tickers.find(t => t.symbol === binanceSymbol);
      if (!ticker) continue;
      
      const price = parseFloat(ticker.price);
      
      const historyKey = `price:${symbol}`;
      let history = JSON.parse(await redisGet(historyKey) || '[]');
      history.push(price);
      if (history.length > 200) history = history.slice(-200);
      await redisSet(historyKey, JSON.stringify(history));
      
      if (history.length < 60) continue;
      
      const lastSignalKey = `lastsignal:${symbol}`;
      const lastSignal = await redisGet(lastSignalKey);
      if (lastSignal && Date.now() - parseInt(lastSignal) < CONFIG.COOLDOWN) continue;
      
      const rsi = calcRSI(history);
      const stoch = calcStochastic(history);
      const macd = calcMACD(history);
      const ema20 = calcEMA(history, 20);
      const adx = calcADX(history);
      
      if (adx < CONFIG.ADX_MIN) continue;
      
      const buy = rsi < CONFIG.RSI_BUY && stoch < CONFIG.STOCH_BUY && macd > 0 && price > ema20;
      const sell = rsi > CONFIG.RSI_SELL && stoch > CONFIG.STOCH_SELL && macd < 0 && price < ema20;
      
      if (buy || sell) {
        const action = buy ? 'BUY' : 'SELL';
        const tp = buy ? price * (1 + CONFIG.TP_PERCENT / 100) : price * (1 - CONFIG.TP_PERCENT / 100);
        const sl = buy ? price * (1 - CONFIG.SL_PERCENT / 100) : price * (1 + CONFIG.SL_PERCENT / 100);
        
        await redisSet(lastSignalKey, Date.now().toString());
        
        signals.push({
          symbol, action, price,
          rsi, stoch: Math.round(stoch), adx: Math.round(adx),
          tp: +tp.toFixed(4), sl: +sl.toFixed(4)
        });
      }
    }
    
    res.status(200).json({
      status: 'ok',
      symbols: topSymbols.length,
      signals: signals.length,
      list: signals.slice(0, 10),
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
