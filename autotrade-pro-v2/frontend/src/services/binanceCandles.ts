// binanceCandles.ts - Получение 15-минутных свечей Binance

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

class BinanceCandles {
  private cache: Map<string, Candle[]> = new Map()
  private lastUpdate: Map<string, number> = new Map()

  async get15MinCandles(symbol: string, limit: number = 100): Promise<Candle[]> {
    const now = Date.now()
    const lastFetch = this.lastUpdate.get(symbol) || 0
    
    // Если кеш свежий (менее 1 минуты) — используем его
    if (this.cache.has(symbol) && now - lastFetch < 60000) {
      return this.cache.get(symbol)!
    }

    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=${limit}`
      const response = await fetch(url)
      const data = await response.json()
      
      const candles: Candle[] = data.map((candle: any) => ({
        time: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }))
      
      this.cache.set(symbol, candles)
      this.lastUpdate.set(symbol, now)
      return candles
    } catch (error) {
      console.error(`Ошибка получения свечей для ${symbol}:`, error)
      return this.cache.get(symbol) || []
    }
  }

  async getCurrentPriceFromCandles(symbol: string): Promise<number> {
    const candles = await this.get15MinCandles(symbol, 2)
    if (candles.length === 0) return 0
    return candles[candles.length - 1].close
  }
}

export const binanceCandles = new BinanceCandles()