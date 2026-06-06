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
  profitPercent?: number
  closedAt?: string
  closeReason?: string
}

interface Position {
  symbol: string
  side: string
  price: number
  qty: number
  cost: number
  entryPrice: number
  openTime: number
}

const TAKE_PROFIT_PERCENT = 3
const STOP_LOSS_PERCENT = 2
const MAX_HOLD_TIME_MINUTES = 60

class BybitTestnetTrading {
  private config: { apiKey: string; apiSecret: string; testnet: boolean } | null = null
  private balance: number = 10000
  private positions: Position[] = []
  private checkInterval: any = null

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
    this.startPositionCheck()
  }

  private startPositionCheck() {
    if (this.checkInterval) clearInterval(this.checkInterval)
    this.checkInterval = setInterval(() => this.checkPositions(), 30000)
  }

  private async checkPositions() {
    if (this.positions.length === 0) return
    const currentPrices = await this.getCurrentPrices()
    for (const position of this.positions) {
      const currentPrice = currentPrices[position.symbol]
      if (!currentPrice) continue
      const profitPercent = position.side === 'Buy' 
        ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - currentPrice) / position.entryPrice) * 100
      const holdTimeMinutes = (Date.now() - position.openTime) / 1000 / 60
      let shouldClose = false
      let closeReason = ''
      if (profitPercent >= TAKE_PROFIT_PERCENT) {
        shouldClose = true
        closeReason = `Take profit (${profitPercent.toFixed(1)}%)`
      } else if (profitPercent <= -STOP_LOSS_PERCENT) {
        shouldClose = true
        closeReason = `Stop loss (${profitPercent.toFixed(1)}%)`
      } else if (holdTimeMinutes >= MAX_HOLD_TIME_MINUTES) {
        shouldClose = true
        closeReason = `Time expired (${Math.floor(holdTimeMinutes)} min)`
      }
      if (shouldClose) {
        await this.closePosition(position.symbol, currentPrice, closeReason)
      }
    }
  }

  private async getCurrentPrices(): Promise<Record<string, number>> {
    const prices: Record<string, number> = {}
    for (const pos of this.positions) {
      const savedPrice = localStorage.getItem(`price_${pos.symbol}`)
      if (savedPrice) {
        prices[pos.symbol] = parseFloat(savedPrice)
      } else {
        prices[pos.symbol] = pos.entryPrice * (1 + (Math.random() - 0.5) * 0.02)
      }
    }
    return prices
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

  updatePrice(symbol: string, price: number) {
    localStorage.setItem(`price_${symbol}`, price.toString())
  }

  async closeByReverseSignal(symbol: string, signalSide: string): Promise<boolean> {
    const positionIndex = this.positions.findIndex(p => p.symbol === symbol)
    if (positionIndex === -1) return false
    
    const position = this.positions[positionIndex]
    
    if ((position.side === 'Buy' && signalSide === 'Sell') ||
        (position.side === 'Sell' && signalSide === 'Buy')) {
      const currentPrice = parseFloat(localStorage.getItem(`price_${symbol}`) || position.entryPrice.toString())
      await this.closePosition(symbol, currentPrice, 'Reverse signal')
      return true
    }
    return false
  }

  async placeOrder(params: OrderParams): Promise<Order> {
    if (!this.config) {
      throw new Error('API ключи не настроены')
    }

    if (this.balance < 50) {
      throw new Error(`❌ Баланс слишком низкий ($${this.balance.toFixed(2)}). Минимальный порог $50. Сбросьте счёт.`)
    }

    const cost = params.qty * (params.price || 0)
    
    if (cost > this.balance) {
      throw new Error(`❌ Сумма сделки $${cost.toFixed(2)} превышает баланс ($${this.balance.toFixed(2)})`)
    }

    if (this.balance - cost < 10) {
      throw new Error(`❌ После сделки баланс будет $${(this.balance - cost).toFixed(2)} (минимальный порог $10)`)
    }

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
          entryPrice: params.price || 0,
          openTime: Date.now()
        })
        console.log(`🟢 Открыта позиция ${params.symbol} (${params.side}) по $${params.price}, сумма: $${cost.toFixed(2)}`)
        this.emitBalanceUpdate()
      } else {
        throw new Error(`Недостаточно средств. Баланс: $${this.balance}, нужно: $${cost}`)
      }
    } else {
      const positionIndex = this.positions.findIndex(p => p.symbol === params.symbol)
      if (positionIndex !== -1) {
        const position = this.positions[positionIndex]
        const profit = (params.price! - position.entryPrice) * params.qty
        const profitPercent = (profit / position.cost) * 100
        this.balance = this.balance + position.cost + profit
        this.positions.splice(positionIndex, 1)
        order.profit = profit
        order.profitPercent = profitPercent
        console.log(`🔴 Закрыта позиция ${params.symbol} по $${params.price}, прибыль: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`)
        this.emitBalanceUpdate()
      } else {
        throw new Error(`Позиция ${params.symbol} не найдена`)
      }
    }

    localStorage.setItem('bybit_testnet_balance', JSON.stringify(this.balance))
    localStorage.setItem('bybit_testnet_positions', JSON.stringify(this.positions))
    
    const history: Order[] = JSON.parse(localStorage.getItem('bybit_testnet_history') || '[]')
    history.unshift(order)
    localStorage.setItem('bybit_testnet_history', JSON.stringify(history.slice(0, 200)))
    
    return order
  }

  private emitBalanceUpdate() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('balance-updated'))
    }
  }

  async closePosition(symbol: string, price: number, reason: string): Promise<Order> {
    const positionIndex = this.positions.findIndex(p => p.symbol === symbol)
    if (positionIndex === -1) {
      throw new Error(`Позиция ${symbol} не найдена для закрытия`)
    }
    const position = this.positions[positionIndex]
    console.log(`🔒 Закрытие ${symbol}: ${reason}`)
    const order = await this.placeOrder({ 
      symbol, 
      side: 'Sell', 
      qty: position.qty, 
      price 
    })
    order.closedAt = new Date().toISOString()
    order.closeReason = reason
    return order
  }

  getPositions(): Position[] {
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

  getWinRate(): number {
    const history = this.getHistory()
    const closedTrades = history.filter(t => t.profit !== undefined)
    if (closedTrades.length === 0) return 0
    const wins = closedTrades.filter(t => t.profit && t.profit > 0).length
    return (wins / closedTrades.length) * 100
  }

  resetAccount() {
    this.balance = 10000
    this.positions = []
    localStorage.setItem('bybit_testnet_balance', JSON.stringify(this.balance))
    localStorage.setItem('bybit_testnet_positions', JSON.stringify(this.positions))
    localStorage.setItem('bybit_testnet_history', JSON.stringify([]))
    console.log('🔄 Счёт сброшен до $10,000')
    this.emitBalanceUpdate()
  }
}

export const bybitTestnet = new BybitTestnetTrading()
