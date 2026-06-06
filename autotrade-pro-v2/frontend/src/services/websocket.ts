// websocket.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ

type PriceCallback = (symbol: string, price: number) => void

class BinanceWebSocket {
  private ws: WebSocket | null = null
  private callbacks: Map<string, PriceCallback[]> = new Map()
  private prices: Map<string, number> = new Map()
  private connected: boolean = false
  private reconnectAttempts: number = 0

  connect() {
    if (this.ws && this.connected) return

    const symbols = [
      'btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt',
      'dogeusdt', 'adausdt', 'avaxusdt', 'dotusdt', 'maticusdt',
      'linkusdt', 'uniusdt', 'atomusdt', 'ltcusdt', 'nearusdt'
    ]
    
    const streams = symbols.map(s => `${s}@ticker`).join('/')
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`

    this.ws = new WebSocket(wsUrl)
    
    this.ws.onopen = () => {
      console.log('✅ Binance WebSocket подключен')
      this.connected = true
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const ticker = data.data
        
        if (ticker && ticker.s && ticker.c) {
          const symbol = ticker.s.toUpperCase()
          const price = parseFloat(ticker.c)
          
          this.prices.set(symbol, price)
          
          const callbacks = this.callbacks.get(symbol)
          if (callbacks) {
            callbacks.forEach(cb => cb(symbol, price))
          }
        }
      } catch (e) {
        // тихо игнорируем ошибки парсинга
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket ошибка:', error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket отключен, переподключение...')
      this.connected = false
      setTimeout(() => this.connect(), 5000)
    }
  }

  subscribe(symbol: string, callback: PriceCallback) {
    const upperSymbol = symbol.toUpperCase()
    if (!this.callbacks.has(upperSymbol)) {
      this.callbacks.set(upperSymbol, [])
    }
    this.callbacks.get(upperSymbol)!.push(callback)
    
    if (this.prices.has(upperSymbol)) {
      callback(upperSymbol, this.prices.get(upperSymbol)!)
    }
  }

  unsubscribe(symbol: string, callback: PriceCallback) {
    const upperSymbol = symbol.toUpperCase()
    const callbacks = this.callbacks.get(upperSymbol)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index !== -1) callbacks.splice(index, 1)
    }
  }

  getPrice(symbol: string): number | null {
    return this.prices.get(symbol.toUpperCase()) || null
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
  }
}

export const binanceWS = new BinanceWebSocket()
