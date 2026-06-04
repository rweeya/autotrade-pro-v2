// Bybit Testnet API для автоторговли

interface OrderParams {
  symbol: string
  side: 'Buy' | 'Sell'
  qty: number
  price?: number
}

interface Order {
  id: string
  symbol: string
  side: string
  price: number
  qty: number
  cost: number
  status: string
  timestamp: string
  profit?: number
}

class BybitTestnetTrading {
  private config: { apiKey: string; apiSecret: string; testnet: boolean } | null = null
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

  async placeOrder(params: OrderParams): Promise<Order> {
    if (!this.config) {
      throw new Error('API ключи не настроены')
    }

    const cost = params.qty * (params.price || 0)
    
    const order: Order = {
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
        this.positions.push({
          symbol: params.symbol,
          side: params.side,
          price: params.price || 0,
          qty: params.qty,
          cost: cost,
          entryPrice: params.price || 0
        })
      } else {
        throw new Error('Недостаточно средств')
      }
    } else {
      const positionIndex = this.positions.findIndex(p => p.symbol === params.symbol)
      if (positionIndex !== -1) {
        const position = this.positions[positionIndex]
        const profit = (params.price! - position.entryPrice) * params.qty
        this.balance = this.balance + position.cost + profit
        this.positions.splice(positionIndex, 1)
        order.profit = profit
      } else {
        throw new Error('Позиция не найдена')
      }
    }

    localStorage.setItem('bybit_testnet_balance', JSON.stringify(this.balance))
    localStorage.setItem('bybit_testnet_positions', JSON.stringify(this.positions))
    
    const history: Order[] = JSON.parse(localStorage.getItem('bybit_testnet_history') || '[]')
    history.unshift(order)
    localStorage.setItem('bybit_testnet_history', JSON.stringify(history.slice(0, 100)))
    
    return order
  }

  async closePosition(symbol: string, price: number): Promise<Order> {
    const position = this.positions.find(p => p.symbol === symbol)
    if (!position) {
      throw new Error('Позиция не найдена')
    }
    return this.placeOrder({ symbol, side: 'Sell', qty: position.qty, price })
  }

  getPositions(): any[] {
    return this.positions
  }

  getHistory(): Order[] {
    return JSON.parse(localStorage.getItem('bybit_testnet_history') || '[]')
  }

  getTotalProfit(): number {
    const history = this.getHistory()
    let total = 0
    for (const t of history) {
      if (t.profit) {
        total = total + t.profit
      }
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
