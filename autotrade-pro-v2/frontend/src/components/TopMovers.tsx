import React, { useState, useEffect } from 'react'

interface Coin {
  symbol: string
  price: number
  change24h: number
  volume: number
}

const TopMovers: React.FC = () => {
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'gainers' | 'losers'>('gainers')

  useEffect(() => {
    fetchTopCoins()
    const interval = setInterval(fetchTopCoins, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchTopCoins = async () => {
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT']
      
      const promises = symbols.map(async (symbol) => {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
        const data = await response.json()
        return {
          symbol: symbol.replace('USDT', ''),
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.quoteVolume)
        }
      })
      
      const results = await Promise.all(promises)
      setCoins(results)
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedCoins = [...coins].sort((a, b) => 
    sortBy === 'gainers' ? b.change24h - a.change24h : a.change24h - b.change24h
  )

  return (
    <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="text-purple-400 font-bold">📊 ТОП МОНЕТ</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('gainers')}
            className={`px-3 py-1 rounded-lg text-sm transition ${sortBy === 'gainers' ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            📈 Рост
          </button>
          <button
            onClick={() => setSortBy('losers')}
            className={`px-3 py-1 rounded-lg text-sm transition ${sortBy === 'losers' ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            📉 Падение
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Загрузка данных...</div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sortedCoins.map((coin, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 items-center text-sm py-2 border-b border-gray-800/50 hover:bg-purple-900/20 transition cursor-pointer">
              <div className="font-bold">{coin.symbol}</div>
              <div className="text-right">${coin.price.toLocaleString()}</div>
              <div className={`text-right font-bold ${coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {coin.change24h >= 0 ? '+' : ''}{coin.change24h}%
              </div>
              <div className="text-right text-gray-400 text-xs">${(coin.volume / 1000000).toFixed(0)}M</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TopMovers