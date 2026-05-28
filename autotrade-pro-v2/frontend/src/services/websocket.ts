// WebSocket соединение с Binance для реальных цен

type PriceCallback = (symbol: string, price: number) => void

class BinanceWebSocket {
  private ws: WebSocket | null = null
  private callbacks: Map<string, PriceCallback[]> = new Map()
  private prices: Map<string, number> = new Map()
  private connected: boolean = false

  // Подписка на обновления цены
  subscribe(symbol: string, callback: PriceCallback) {
    if (!this.callbacks.has(symbol)) {
      this.callbacks.set(symbol, [])
    }
    this.callbacks.get(symbol)!.push(callback)
    
    // Если есть сохраненная цена, вызываем сразу
    if (this.prices.has(symbol)) {
      callback(symbol, this.prices.get(symbol)!)
    }
  }

  // Отписка
  unsubscribe(symbol: string, callback: PriceCallback) {
    const callbacks = this.callbacks.get(symbol)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index !== -1) callbacks.splice(index, 1)
    }
  }

  // Получить текущую цену
  getPrice(symbol: string): number | null {
    return this.prices.get(symbol) || null
  }

  // Подключиться к WebSocket
  connect() {
    if (this.ws && this.connected) return

    // Формируем стрим для всех нужных символов
    const symbols = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'dogeusdt', 'adausdt']
    const streams = symbols.map(s => `${s}@trade`).join('/')
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`

    this.ws = new WebSocket(wsUrl)
    
    this.ws.onopen = () => {
      console.log('✅ Binance WebSocket подключен')
      this.connected = true
    }

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const stream = data.stream
      const trade = data.data
      
      if (trade && trade.s && trade.p) {
        const symbol = trade.s.toUpperCase()
        const price = parseFloat(trade.p)
        
        this.prices.set(symbol, price)
        
        // Оповещаем подписчиков
        const callbacks = this.callbacks.get(symbol)
        if (callbacks) {
          callbacks.forEach(cb => cb(symbol, price))
        }
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket ошибка:', error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket отключен, переподключение через 5 секунд...')
      this.connected = false
      setTimeout(() => this.connect(), 5000)
    }
  }

  // Отключиться
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
  }
}

export const binanceWS = new BinanceWebSocket()