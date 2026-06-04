// Bybit Testnet API для автоторговли

interface OrderParams {
  symbol: string
  side: 'Buy' | 'Sell'
  qty: number
  price?: number
}

interface BybitConfig {
  apiKey: string
  apiSecret: string
  testnet: boolean
}

class BybitTestnetTrading {
  private config: BybitConfig | null = null
  private balance: number = 10000
  private positions: any[] = []

  constructor() {
    const saved = localStorage.getItem('bybit_testnet_config')
    if (saved) {
      this.config = JSON.parse(saved)
    }
    const savedPositions = localStorage.getItem('bybit_testnet_positions')
    if (savedPositions) {
      this.positions = JSON.parse(savedPositions)
    }
    const savedBalance = localStorage.getItem('bybit_testnet_balance')
    if (savedBalance) {
      this.balance = parseFloat(savedBalance)
    }
  }

  setConfig(apiKey: string, apiSecret: string) {
    this.config = { apiKey, apiSecret, testnet: true }
    localStorage.setItem('bybit_testnet_config', JSON.stringify(this.config))
  }

  isConfigured(): boolean {
    return this.config !== null
  }

  getBalance(): number {
    return this.balance
  }

  async placeOrder(params: OrderParams): Promise<any> {
    if (!this.config) {
      throw new Error('API ключи не настроены')
    }

    const cost = params.qty * (params.price || 0)
    
    const order = {
      id: Date.now().toString(),
      symbol: params.symbol,
      side: params.side,
      price: params.price || 0,
      qty: params.qty,
      cost: cost,
      status: 'Filled',
      timestamp: new Date().toISOString()
    }

    if (params.side === 'Buy') {
      if (this.balance >= cost) {
        this.balance = this.balance - cost
        this.positions.push({ ...order, entryPrice: params.price })
      } else {
        throw new Error('Недостаточно средств')
      }
    } else {
      const position = this.positions.find(p => p.symbol === params.symbol)
      if (position) {
        const profit = (params.price! - position.entryPrice) * params.qty
        this.balance = this.balance + position.cost + profit
        this.positions = this.positions.filter(p => p.symbol !== params.symbol)
        order.profit = profit
      }
    }

    localStorage.setItem('bybit_testnet_balance', JSON.stringify(this.balance))
    localStorage.setItem('bybit_testnet_positions', JSON.stringify(this.positions))
    
    const history = JSON.parse(localStorage.getItem('bybit_testnet_history') || '[]')
    history.unshift(order)
    localStorage.setItem('bybit_testnet_history', JSON.stringify(history.slice(0, 100)))
    
    return order
  }

  async closePosition(symbol: string, price: number): Promise<any> {
    const position = this.positions.find(p => p.symbol === symbol)
    if (!position) {
      throw new Error('Позиция не найдена')
    }
    return this.placeOrder({ symbol, side: 'Sell', qty: position.qty, price })
  }

  getPositions(): any[] {
    return this.positions
  }

  getHistory(): any[] {
    return JSON.parse(localStorage.getItem('bybit_testnet_history') || '[]')
  }

  getTotalProfit(): number {
    const history = this.getHistory()
    let total = 0
    for (const t of history) {
      total = total + (t.profit || 0)
    }
    return total
  }

  resetAccount() {
    this.balance = 10000
    this.positions = []
    localStorage.setItem('bybit_testnet_balance', JSON.stringify(this.balance))
    localStorage.setItem('bybit_testnet_positions', JSON.stringify(this.positions))
    localStorage.setItem('bybit_testnet_history', JSON.stringify([]))
  }
}

export const bybitTestnet = new BybitTestnetTrading()
