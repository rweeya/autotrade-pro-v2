import React, { useState, useEffect } from 'react'

interface Position {
  id: number
  symbol: string
  type: 'buy' | 'sell'
  entryPrice: number
  amount: number
  usdtAmount: number
  openTime: string
}

interface Trade {
  id: number
  symbol: string
  type: 'buy' | 'sell'
  entryPrice: number
  exitPrice: number
  amount: number
  profit: number
  profitPercent: number
  closeTime: string
}

const VirtualWallet: React.FC = () => {
  const [balance, setBalance] = useState(10000)
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT')
  const [amount, setAmount] = useState(100)
  const [prices, setPrices] = useState<Record<string, number>>({})

  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT']

  useEffect(() => {
    const saved = localStorage.getItem('virtual_wallet')
    if (saved) {
      const data = JSON.parse(saved)
      setBalance(data.balance)
      setPositions(data.positions || [])
      setTrades(data.trades || [])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('virtual_wallet', JSON.stringify({ balance, positions, trades }))
  }, [balance, positions, trades])

  useEffect(() => {
    const fetchPrices = async () => {
      const newPrices: Record<string, number> = {}
      for (const symbol of symbols) {
        try {
          const cleanSymbol = symbol.replace('/USDT', '')
          const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}USDT`)
          const data = await response.json()
          newPrices[symbol] = parseFloat(data.price)
        } catch (e) {
          newPrices[symbol] = 0
        }
      }
      setPrices(newPrices)
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 5000)
    return () => clearInterval(interval)
  }, [])

  const openPosition = (type: 'buy' | 'sell') => {
    const price = prices[selectedSymbol]
    if (!price || price === 0) {
      alert('Цена не загружена')
      return
    }

    const usdtAmount = amount
    if (usdtAmount > balance) {
      alert(`Недостаточно средств! Баланс: $${balance.toFixed(2)}`)
      return
    }

    const positionAmount = usdtAmount / price

    const newPosition: Position = {
      id: Date.now(),
      symbol: selectedSymbol,
      type,
      entryPrice: price,
      amount: positionAmount,
      usdtAmount: usdtAmount,
      openTime: new Date().toLocaleString()
    }

    setPositions([...positions, newPosition])
    setBalance(balance - usdtAmount)
  }

  const closePosition = (position: Position) => {
    const currentPrice = prices[position.symbol]
    if (!currentPrice) return

    let profit = 0
    if (position.type === 'buy') {
      profit = (currentPrice - position.entryPrice) * position.amount
    } else {
      profit = (position.entryPrice - currentPrice) * position.amount
    }

    const newBalance = balance + position.usdtAmount + profit
    setBalance(newBalance)

    const trade: Trade = {
      id: Date.now(),
      symbol: position.symbol,
      type: position.type,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      amount: position.amount,
      profit: profit,
      profitPercent: (profit / position.usdtAmount) * 100,
      closeTime: new Date().toLocaleString()
    }

    setTrades([trade, ...trades])
    setPositions(positions.filter(p => p.id !== position.id))
  }

  const totalEquity = balance + positions.reduce((sum, p) => {
    const currentPrice = prices[p.symbol] || p.entryPrice
    if (p.type === 'buy') {
      return sum + (currentPrice - p.entryPrice) * p.amount + p.usdtAmount
    } else {
      return sum + (p.entryPrice - currentPrice) * p.amount + p.usdtAmount
    }
  }, 0)

  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0)

  return (
    <div className="space-y-6">
      {/* Баланс */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
          <div className="text-gray-400 text-sm">💰 БАЛАНС</div>
          <div className="text-2xl font-bold text-green-400">${balance.toFixed(2)}</div>
        </div>
        <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
          <div className="text-gray-400 text-sm">💎 ЭКВИТИ</div>
          <div className="text-2xl font-bold text-purple-400">${totalEquity.toFixed(2)}</div>
        </div>
        <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
          <div className="text-gray-400 text-sm">📈 ОБЩАЯ ПРИБЫЛЬ</div>
          <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USD
          </div>
        </div>
      </div>

      {/* Открыть позицию */}
      <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
        <h3 className="text-purple-400 font-bold mb-4">📊 ОТКРЫТЬ ПОЗИЦИЮ</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <div className="text-gray-400 text-sm mb-1">МОНЕТА</div>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="bg-black/50 border border-purple-500/50 rounded-lg px-3 py-2 text-white"
            >
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">СУММА (USDT)</div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={10}
              step={10}
              className="bg-black/50 border border-purple-500/50 rounded-lg px-3 py-2 text-white w-32"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openPosition('buy')}
              className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold transition"
            >
              🟢 BUY
            </button>
            <button
              onClick={() => openPosition('sell')}
              className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg font-bold transition"
            >
              🔴 SELL
            </button>
          </div>
        </div>
        <div className="text-gray-500 text-xs mt-3">
          Текущая цена {selectedSymbol}: ${prices[selectedSymbol]?.toLocaleString() || '...'}
        </div>
      </div>

      {/* Открытые позиции */}
      {positions.length > 0 && (
        <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
          <h3 className="text-purple-400 font-bold mb-4">🏃‍♂️ ОТКРЫТЫЕ ПОЗИЦИИ</h3>
          <div className="space-y-2">
            {positions.map(pos => {
              const currentPrice = prices[pos.symbol] || pos.entryPrice
              const profit = pos.type === 'buy' 
                ? (currentPrice - pos.entryPrice) * pos.amount
                : (pos.entryPrice - currentPrice) * pos.amount
              const profitPercent = (profit / pos.usdtAmount) * 100
              
              return (
                <div key={pos.id} className="border-b border-gray-800 pb-3 flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <div className="font-bold">{pos.symbol}</div>
                    <div className="text-xs text-gray-400">{pos.type === 'buy' ? '🟢 LONG' : '🔴 SHORT'}</div>
                  </div>
                  <div className="text-right">
                    <div>Вход: ${pos.entryPrice.toLocaleString()}</div>
                    <div>Текущая: ${currentPrice.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {profit >= 0 ? '+' : ''}{profit.toFixed(2)} USD
                    </div>
                    <div className={`text-xs ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                    </div>
                  </div>
                  <button
                    onClick={() => closePosition(pos)}
                    className="bg-yellow-600 hover:bg-yellow-500 px-4 py-1 rounded-lg text-sm transition"
                  >
                    Закрыть
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* История сделок */}
      {trades.length > 0 && (
        <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
          <h3 className="text-purple-400 font-bold mb-4">📜 ИСТОРИЯ СДЕЛОК</h3>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {trades.slice(0, 20).map(trade => (
              <div key={trade.id} className="border-b border-gray-800 pb-2 text-sm flex justify-between items-center flex-wrap gap-2">
                <div>
                  <span className="font-bold">{trade.symbol}</span>
                  <span className={`ml-2 text-xs ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.type === 'buy' ? 'LONG' : 'SHORT'}
                  </span>
                </div>
                <div className="text-gray-400 text-xs">
                  {trade.entryPrice} → {trade.exitPrice}
                </div>
                <div className={trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)} USD ({trade.profitPercent.toFixed(2)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default VirtualWallet