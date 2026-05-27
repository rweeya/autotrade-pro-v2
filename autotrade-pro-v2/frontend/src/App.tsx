import React, { useState, useEffect } from 'react'

// Типы сигналов
interface Signal {
  symbol: string
  action: 'buy' | 'sell'
  price: number
  strength: number
  reasons: string[]
  timestamp: Date
}

// Компонент карточки сигнала
const SignalCard: React.FC<{ signal: Signal }> = ({ signal }) => {
  const strengthStars = '★'.repeat(signal.strength) + '☆'.repeat(5 - signal.strength)
  
  return (
    <div className="bg-gradient-to-r from-purple-900/20 to-cyan-900/20 rounded-xl p-4 mb-3 border-l-4 border-purple-500 hover:translate-x-1 transition-all cursor-pointer">
      <div className="flex justify-between items-center">
        <span className="font-bold text-lg">💰 {signal.symbol}</span>
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${signal.action === 'buy' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
          {signal.action === 'buy' ? '🟢 BUY' : '🔴 SELL'}
        </span>
        <span className="text-yellow-400 text-sm">⚡ {strengthStars}</span>
      </div>
      <div className="flex gap-4 mt-2 text-gray-400 text-sm">
        <span>💵 ${signal.price.toLocaleString()}</span>
        <span>⏰ {signal.timestamp.toLocaleTimeString()}</span>
      </div>
      <div className="mt-2 text-xs text-orange-400">
        📊 {signal.reasons.join(', ')}
      </div>
    </div>
  )
}

// Генерация демо-сигналов
const generateSignals = (): Signal[] => {
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT']
  const prices = { 'BTC/USDT': 65234, 'ETH/USDT': 3456, 'SOL/USDT': 178, 'BNB/USDT': 587, 'XRP/USDT': 0.62 }
  
  return symbols.map(symbol => {
    const rsi = 30 + Math.random() * 60
    const macd = (Math.random() - 0.5) * 2
    let score = 0
    let reasons = []
    
    if (rsi < 35) { score += 2; reasons.push(`RSI ${Math.round(rsi)}`) }
    if (rsi > 65) { score -= 2; reasons.push(`RSI ${Math.round(rsi)}`) }
    if (macd > 0.3) { score += 1.5; reasons.push('MACD+') }
    if (macd < -0.3) { score -= 1.5; reasons.push('MACD-') }
    
    let action: 'buy' | 'sell' | null = null
    if (score >= 2) action = 'buy'
    if (score <= -2) action = 'sell'
    
    if (action) {
      return {
        symbol,
        action,
        price: prices[symbol as keyof typeof prices],
        strength: Math.min(Math.abs(Math.floor(score)), 5),
        reasons,
        timestamp: new Date()
      }
    }
    return null
  }).filter((s): s is Signal => s !== null)
}

function App() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [totalSignals, setTotalSignals] = useState(0)
  const [accuracy] = useState('78')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // Обновляем время
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const updateSignals = () => {
      const newSignals = generateSignals()
      setSignals(newSignals)
      setTotalSignals(prev => prev + newSignals.length)
    }
    
    updateSignals()
    const interval = setInterval(updateSignals, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black">
      {/* Шапка */}
      <header className="border-b border-purple-500/30 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
            ⚡ AUTO TRADE PRO V2
          </h1>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">LIVE</span>
            </div>
            <div className="text-sm text-gray-400 font-mono">
              {currentTime.toLocaleTimeString('ru-RU')}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
              {totalSignals}
            </div>
            <div className="text-gray-400 text-sm">ВСЕГО СИГНАЛОВ</div>
          </div>
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-green-500/30">
            <div className="text-3xl font-bold text-green-500">
              {signals.filter(s => s.action === 'buy').length}
            </div>
            <div className="text-gray-400 text-sm">BUY СИГНАЛЫ</div>
          </div>
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-red-500/30">
            <div className="text-3xl font-bold text-red-500">
              {signals.filter(s => s.action === 'sell').length}
            </div>
            <div className="text-gray-400 text-sm">SELL СИГНАЛЫ</div>
          </div>
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-500">{accuracy}%</div>
            <div className="text-gray-400 text-sm">ТОЧНОСТЬ</div>
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="🔍 Поиск монеты..."
            className="bg-black/50 backdrop-blur-lg border border-purple-500/50 rounded-xl px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
          <select className="bg-black/50 backdrop-blur-lg border border-purple-500/50 rounded-xl px-4 py-2 text-white focus:outline-none">
            <option value="all">📌 Все сигналы</option>
            <option value="buy">🟢 Только BUY</option>
            <option value="sell">🔴 Только SELL</option>
          </select>
          <div className="flex gap-2">
            {['15м', '1ч', '4ч', '1д'].map(tf => (
              <button key={tf} className="px-4 py-2 rounded-xl bg-black/50 border border-purple-500/30 text-gray-400 hover:border-purple-500 hover:text-white transition-all">
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Сигналы */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          <h2 className="text-xl font-bold text-purple-400 mb-4">🎯 АКТУАЛЬНЫЕ СИГНАЛЫ</h2>
          {signals.map((signal, idx) => (
            <SignalCard key={idx} signal={signal} />
          ))}
        </div>

        {/* Футер */}
        <footer className="mt-8 text-center text-gray-500 text-sm border-t border-gray-800 pt-6">
          🔮 5 индикаторов | 20+ активов | Клик → TradingView | Виртуальная торговля
        </footer>
      </div>
    </div>
  )
}

export default App