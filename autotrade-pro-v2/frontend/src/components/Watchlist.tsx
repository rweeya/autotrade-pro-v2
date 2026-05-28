import React, { useState, useEffect } from 'react'

interface WatchlistItem {
  symbol: string
  price: number
  change24h: number
  addedAt: string
}

const Watchlist: React.FC = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [newSymbol, setNewSymbol] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('watchlist')
    if (saved) {
      setWatchlist(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('watchlist', JSON.stringify(watchlist))
    fetchPrices()
  }, [watchlist])

  const fetchPrices = async () => {
    if (watchlist.length === 0) return
    
    const updated = [...watchlist]
    for (let i = 0; i < updated.length; i++) {
      try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${updated[i].symbol}USDT`)
        const data = await response.json()
        updated[i].price = parseFloat(data.lastPrice)
        updated[i].change24h = parseFloat(data.priceChangePercent)
      } catch (error) {
        console.error('Ошибка загрузки цены')
      }
    }
    setWatchlist(updated)
  }

  const addToWatchlist = () => {
    if (!newSymbol) return
    const upperSymbol = newSymbol.toUpperCase()
    if (watchlist.some(item => item.symbol === upperSymbol)) {
      alert('Уже в избранном')
      return
    }
    setWatchlist([...watchlist, { symbol: upperSymbol, price: 0, change24h: 0, addedAt: new Date().toISOString() }])
    setNewSymbol('')
  }

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(item => item.symbol !== symbol))
  }

  return (
    <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
      <h3 className="text-purple-400 font-bold mb-4">⭐ ИЗБРАННОЕ</h3>
      
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="Например: BTC, ETH, SOL"
          className="flex-1 bg-black/50 border border-purple-500/50 rounded-lg px-3 py-2 text-white text-sm"
        />
        <button
          onClick={addToWatchlist}
          className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-bold transition"
        >
          Добавить
        </button>
      </div>

      {watchlist.length === 0 ? (
        <div className="text-center text-gray-500 py-8">Нет монет в избранном</div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {watchlist.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-800 hover:bg-purple-900/20 transition rounded-lg">
              <div className="font-bold">{item.symbol}/USDT</div>
              <div className="text-right">
                <div>${item.price.toLocaleString()}</div>
                <div className={`text-xs ${item.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {item.change24h >= 0 ? '+' : ''}{item.change24h}%
                </div>
              </div>
              <button
                onClick={() => removeFromWatchlist(item.symbol)}
                className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/20 transition"
              >
                ✖
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Watchlist