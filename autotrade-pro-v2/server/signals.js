// server/signals.js

// RSI
function calcRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const avgGain = gains / period;
  const avgLoss = losses / period;
  return Math.round(100 - 100 / (1 + avgGain / avgLoss));
}

// EMA
function calcEMA(prices, period) {
  if (!prices || prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * k + ema;
  }
  return ema;
}

// MACD
function calcMACD(prices) {
  if (!prices || prices.length < 35) return 0;
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  return parseFloat((ema12 - ema26).toFixed(4));
}

// ADX
function calcADX(prices, period = 14) {
  if (!prices || prices.length < period * 2) return 0;
  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < prices.length; i++) {
    const h = Math.max(prices[i], prices[i - 1]);
    const l = Math.min(prices[i], prices[i - 1]);
    const pH = Math.max(prices[i - 1], prices[i - 2] || prices[i - 1]);
    const pL = Math.min(prices[i - 1], prices[i - 2] || prices[i - 1]);
    tr.push(Math.max(h - l, Math.abs(h - prices[i - 1]), Math.abs(l - prices[i - 1])));
    plusDM.push(h - pH > 0 && h - pH > pL - l ? h - pH : 0);
    minusDM.push(pL - l > 0 && pL - l > h - pH ? pL - l : 0);
  }
  const smooth = (d) => {
    const k = 2 / (period + 1);
    let e = d[0];
    for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k);
    return e;
  };
  const atr = smooth(tr);
  if (!atr) return 0;
  return Math.abs(smooth(plusDM) - smooth(minusDM)) / (smooth(plusDM) + smooth(minusDM)) * 100;
}

// Stochastic
function calcStochastic(prices, period = 14) {
  if (!prices || prices.length < period) return 50;
  const slice = prices.slice(-period);
  const highest = Math.max(...slice);
  const lowest = Math.min(...slice);
  if (highest === lowest) return 50;
  return ((prices[prices.length - 1] - lowest) / (highest - lowest)) * 100;
}

// Генерация сигнала
function generateSignal(symbol, price, history, config, lastSignalTime) {
  if (!price || price <= 0) return null;
  if (history.length < 60) return null;
  
  const lastSig = lastSignalTime.get(symbol);
  if (lastSig && Date.now() - lastSig < config.COOLDOWN) return null;

  const rsi = calcRSI(history);
  const stoch = calcStochastic(history);
  const macd = calcMACD(history);
  const ema20 = calcEMA(history, 20);
  const adx = calcADX(history);

  if (adx < config.ADX_MIN) return null;

  const buy = rsi < config.RSI_BUY && stoch < config.STOCH_BUY && macd > 0 && price > ema20;
  const sell = rsi > config.RSI_SELL && stoch > config.STOCH_SELL && macd < 0 && price < ema20;
  
  if (!buy && !sell) return null;

  const action = buy ? 'buy' : 'sell';
  lastSignalTime.set(symbol, Date.now());

  return {
    id: `${symbol}_${Date.now()}`,
    symbol,
    action,
    price,
    timestamp: Date.now(),
    rsi,
    stochK: Math.round(stoch),
    macd,
    adx
  };
}

module.exports = { generateSignal };
