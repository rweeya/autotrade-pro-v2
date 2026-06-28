// src/services/SignalEngine.ts
// Движок генерации сигналов v2 — скальпинг с жёсткими фильтрами

export interface Signal {
  id: string;
  asset: string;
  type: 'BUY' | 'SELL';
  price: number;
  timestamp: number;
  reason: string;
  rsi: number;
  adx: number;
  atr: number;
  macd: number;
  strength: number;
  tp: number;
  sl: number;
}

export interface SignalConfig {
  rsiBuyThreshold: number;    // теперь 35
  rsiSellThreshold: number;   // теперь 65
  adxMinThreshold: number;    // новое: 25
  cooldownMinutes: number;    // 3
  takeProfitPercent: number;
  stopLossPercent: number;
  maxConcurrentPositions: number;
  updateIntervalMs: number;
  riskPercent: number;
  atrMultiplierTP: number;    // новое: 2.5
  atrMultiplierSL: number;    // новое: 1.5
}

export class SignalEngine {
  private lastSignalTime: Map<string, number> = new Map();
  private config: SignalConfig;

  constructor(config: SignalConfig) {
    this.config = config;
  }

  generateSignals(
    marketData: Map<string, any[]>,
    currentPositions: any[]
  ): Signal[] {
    const newSignals: Signal[] = [];
    const openPositions = currentPositions.filter(p => p.status === 'open');
    const assetsWithOpenPositions = new Set(openPositions.map(p => p.asset));

    for (const [asset, data] of marketData) {
      if (assetsWithOpenPositions.has(asset)) continue;
      if (!data || data.length < 50) continue; // нужно больше данных для ADX

      const prices = data.map((d: any) => d.close);
      const highs = data.map((d: any) => d.high);
      const lows = data.map((d: any) => d.low);
      const currentPrice = prices[prices.length - 1];

      const rsi = this.calculateRSI(prices, 14);
      const adx = this.calculateADX(highs, lows, prices, 14);
      const atr = this.calculateATR(highs, lows, prices, 14);
      const macdData = this.calculateMACD(prices);

      if (rsi === null || adx === null || atr === null || macdData === null) continue;

      // Кулдаун
      const lastSignal = this.lastSignalTime.get(asset) || 0;
      const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
      if (Date.now() - lastSignal < cooldownMs) continue;

      // ФИЛЬТР 1: ADX должен быть > 25 (есть тренд)
      if (adx < this.config.adxMinThreshold) continue;

      // ФИЛЬТР 2: ATR должен быть > 0
      if (atr <= 0) continue;

      // Динамические TP/SL
      const tpBuy = currentPrice + atr * this.config.atrMultiplierTP;
      const slBuy = currentPrice - atr * this.config.atrMultiplierSL;
      const tpSell = currentPrice - atr * this.config.atrMultiplierTP;
      const slSell = currentPrice + atr * this.config.atrMultiplierSL;

      // BUY: RSI < 35 + MACD histogram > 0 + EMA20 > EMA50
      const ema20 = this.calculateEMA(prices, 20);
      const ema50 = this.calculateEMA(prices, 50);
      const buyCondition =
        rsi < this.config.rsiBuyThreshold &&
        macdData.histogram > 0 &&
        ema20 !== null && ema50 !== null &&
        ema20 > ema50;

      // SELL: RSI > 65 + MACD histogram < 0 + EMA20 < EMA50
      const sellCondition =
        rsi > this.config.rsiSellThreshold &&
        macdData.histogram < 0 &&
        ema20 !== null && ema50 !== null &&
        ema20 < ema50;

      if (buyCondition) {
        const strength = this.calculateStrength(rsi, adx, macdData.histogram);
        newSignals.push({
          id: `${asset}_${Date.now()}`,
          asset,
          type: 'BUY',
          price: currentPrice,
          timestamp: Date.now(),
          reason: `RSI:${rsi.toFixed(1)} ADX:${adx.toFixed(1)} MACD↑`,
          rsi,
          adx,
          atr,
          macd: macdData.histogram,
          strength,
          tp: Math.round(tpBuy * 10000) / 10000,
          sl: Math.round(slBuy * 10000) / 10000,
        });
        this.lastSignalTime.set(asset, Date.now());
      }

      if (sellCondition) {
        const strength = this.calculateStrength(rsi, adx, macdData.histogram);
        newSignals.push({
          id: `${asset}_${Date.now()}`,
          asset,
          type: 'SELL',
          price: currentPrice,
          timestamp: Date.now(),
          reason: `RSI:${rsi.toFixed(1)} ADX:${adx.toFixed(1)} MACD↓`,
          rsi,
          adx,
          atr,
          macd: macdData.histogram,
          strength,
          tp: Math.round(tpSell * 10000) / 10000,
          sl: Math.round(slSell * 10000) / 10000,
        });
        this.lastSignalTime.set(asset, Date.now());
      }
    }

    return newSignals;
  }

  private calculateStrength(rsi: number, adx: number, macdHistogram: number): number {
    const rsiStrength = Math.abs(50 - rsi) * 1.5;
    const adxStrength = Math.min(adx, 50) * 0.8;
    const macdStrength = Math.abs(macdHistogram) * 8;
    return Math.min(100, rsiStrength + adxStrength + macdStrength);
  }

  // ADX — сила тренда
  private calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number | null {
    if (highs.length < period * 2) return null;

    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const h = highs[i], l = lows[i];
      const pH = highs[i - 1], pL = lows[i - 1], pC = closes[i - 1];
      tr.push(Math.max(h - l, Math.abs(h - pC), Math.abs(l - pC)));
      const up = h - pH, down = pL - l;
      plusDM.push(up > down && up > 0 ? up : 0);
      minusDM.push(down > up && down > 0 ? down : 0);
    }

    const atr = this.smooth(tr, period);
    const smoothedPlusDM = this.smooth(plusDM, period);
    const smoothedMinusDM = this.smooth(minusDM, period);
    const lastATR = atr[atr.length - 1];
    if (lastATR === 0) return null;

    const plusDI = (smoothedPlusDM[smoothedPlusDM.length - 1] / lastATR) * 100;
    const minusDI = (smoothedMinusDM[smoothedMinusDM.length - 1] / lastATR) * 100;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

    return this.smooth([dx], period)[0] || dx;
  }

  // ATR — волатильность
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number | null {
    if (highs.length < period + 1) return null;
    const tr: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));
    }
    const atrValues = this.smooth(tr, period);
    return atrValues[atrValues.length - 1];
  }

  private smooth(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }

  private calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    return 100 - (100 / (1 + (gains / period) / (losses / period)));
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } | null {
    if (prices.length < 26) return null;
    const calcEMA = (data: number[], period: number): number => {
      const k = 2 / (period + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
      return ema;
    };
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const macdLine = ema12 - ema26;
    const macdValues = prices.slice(25).map((_, i) => {
      const slice = prices.slice(0, i + 26);
      return calcEMA(slice, 12) - calcEMA(slice, 26);
    });
    const signalLine = calcEMA(macdValues, 9);
    return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
  }

  private calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
    return ema;
  }

  updateConfig(newConfig: Partial<SignalConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SignalConfig {
    return { ...this.config };
  }
}

export default SignalEngine;
