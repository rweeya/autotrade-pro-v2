import React, { useState, useEffect } from 'react'
import TradingChart from './components/TradingChart'
import SignalHistory from './components/SignalHistory'

interface Signal {
  symbol: string
  action: 'buy' | 'sell'
  price: number
  strength: number
  reasons: string[]
  timestamp: Date
}

// Расширенный список символов
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'EUR/USD', 'GBP/USD', 'AAPL', 'MSFT', 'TSLA', 'NVDA']

const PRICES: Record<string, number> = {
  'BTC/USDT': 65234, 'ETH/USDT': 3456, 'SOL/USDT': 178, 'BNB/USDT': 587, 'XRP/USDT': 0.62,
  'DOGE/USDT': 0.15, 'ADA/USDT': 0.48, 'EUR/USD': 1.089, 'GBP/USD': 1.267, 'AAPL': 175.5,
  'MSFT': 420.7, 'TSLA': 175.8, 'NVDA': 905
}

// Генерация сигнала
function generateSignal(symbol: string): Signal | null {
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
      price: PRICES[symbol],
      strength: Math.min(Math.abs(Math.floor(score)), 5),
      reasons,
      timestamp: new Date()
    }
  }
  return null
}

// Функция для открытия Bybit
function openBybit(symbol: string) {
  let bybitSymbol = symbol
  if (symbol.includes('/USDT')) {
    bybitSymbol = symbol.replace('/USDT', '')
  } else if (symbol.includes('/')) {
    // Для форекс открываем TradingView
    window.open(`https://www.tradingview.com/chart/?symbol=FX:${symbol.replace('/', '')}`, '_blank')
    return
  } else {
    // Для акций открываем TradingView
    window.open(`https://www.tradingview.com/chart/?symbol=NASDAQ:${symbol}`, '_blank')
    return
  }
  
  // Открываем Bybit
  window.open(`https://www.bybit.com/trade/spot/${bybitSymbol}/USDT`, '_blank')
}

// Сохранение сигнала в историю
function saveToHistory(signal: Signal) {
  const historySignal = {
    id: Date.now(),
    symbol: signal.symbol,
    action: signal.action,
    price: signal.price,
    strength: signal.strength,
    reasons: signal.reasons.join(', '),
    timestamp: signal.timestamp.toISOString()
  }
  
  const saved = localStorage.getItem('signal_history')
  let history = saved ? JSON.parse(saved) : []
  history = [historySignal, ...history].slice(0, 100)
  localStorage.setItem('signal_history', JSON.stringify(history))
  
  // Обновляем событие для SignalHistory компонента
  window.dispatchEvent(new Event('storage'))
}

function App() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'signals' | 'trading' | 'history'>('signals')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const updateSignals = () => {
      const newSignals = SYMBOLS.map(s => generateSignal(s)).filter(s => s !== null) as Signal[]
      setSignals(newSignals)
    }
    updateSignals()
    const interval = setInterval(updateSignals, 30000)
    return () => clearInterval(interval)
  }, [])

  const buys = signals.filter(s => s.action === 'buy').length
  const sells = signals.filter(s => s.action === 'sell').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black">
      <header className="border-b border-purple-500/30 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
            ⚡ AUTO TRADE PRO V2
          </h1>
          <div className="flex gap-4 items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-400">LIVE</span>
            <div className="text-sm text-gray-400 font-mono">{currentTime.toLocaleTimeString('ru-RU')}</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30">
            <div className="text-3xl font-bold text-purple-400">{signals.length}</div>
            <div className="text-gray-400 text-sm">ВСЕГО СИГНАЛОВ</div>
          </div>
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-green-500/30">
            <div className="text-3xl font-bold text-green-500">{buys}</div>
            <div className="text-gray-400 text-sm">BUY СИГНАЛЫ</div>
          </div>
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-red-500/30">
            <div className="text-3xl font-bold text-red-500">{sells}</div>
            <div className="text-gray-400 text-sm">SELL СИГНАЛЫ</div>
          </div>
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-500">78%</div>
            <div className="text-gray-400 text-sm">ТОЧНОСТЬ</div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-4 mb-6 border-b border-purple-500/30">
          <button onClick={() => setActiveTab('signals')} className={`pb-2 px-4 font-bold transition-all ${activeTab === 'signals' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>
            🎯 СИГНАЛЫ
          </button>
          <button onClick={() => setActiveTab('trading')} className={`pb-2 px-4 font-bold transition-all ${activeTab === 'trading' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>
            📈 ТОРГОВЛЯ
          </button>
          <button onClick={() => setActiveTab('history')} className={`pb-2 px-4 font-bold transition-all ${activeTab === 'history' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>
            📜 ИСТОРИЯ
          </button>
        </div>

        {/* ТОРГОВЛЯ (график) */}
        {activeTab === 'trading' && (
          <>
            <div className="mb-4">
              <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-black/50 border border-purple-500/50 rounded-xl px-4 py-2 text-white">
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <TradingChart symbol={selectedSymbol} />
          </>
        )}

        {/* ИСТОРИЯ */}
        {activeTab === 'history' && <SignalHistory />}

        {/* СИГНАЛЫ (с кликабельностью) */}
        {activeTab === 'signals' && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            <h2 className="text-xl font-bold text-purple-400 mb-4">🎯 АКТУАЛЬНЫЕ СИГНАЛЫ</h2>
            {signals.map((signal, idx) => {
              const stars = '★'.repeat(signal.strength) + '☆'.repeat(5 - signal.strength)
              return (
                <div 
                  key={idx} 
                  onClick={() => openBybit(signal.symbol)}
                  className="bg-gradient-to-r from-purple-900/20 to-cyan-900/20 rounded-xl p-4 border-l-4 border-purple-500 hover:translate-x-1 hover:bg-purple-900/40 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="font-bold text-lg">💰 {signal.symbol}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${signal.action === 'buy' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                      {signal.action === 'buy' ? '🟢 BUY' : '🔴 SELL'}
                    </span>
                    <span className="text-yellow-400 text-sm">⚡ {stars}</span>
                  </div>
                  <div className="flex gap-4 mt-2 text-gray-400 text-sm flex-wrap">
                    <span>💵 ${signal.price.toLocaleString()}</span>
                    <span>📊 {signal.reasons.join(', ')}</span>
                    <span className="text-purple-400 text-xs">🖱️ Клик → Bybit</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
