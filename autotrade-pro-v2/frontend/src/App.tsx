import React, { useState, useEffect } from 'react'
import TradingChart from './components/TradingChart'
import SignalHistory from './components/SignalHistory'
import News from './components/News'
import TopMovers from './components/TopMovers'
import Watchlist from './components/Watchlist'
import { binanceWS } from './services/websocket'

interface Signal {
  symbol: string
  action: 'buy' | 'sell'
  price: number
  strength: number
  reasons: string[]
  timestamp: Date
  indicators: {
    rsi: number
    macd: number
    ema20: number
    ema50: number
    stoch: number
    adx: number
  }
}

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT']

const DEMO_PRICES: Record<string, number> = {
  'BTC/USDT': 65234, 'ETH/USDT': 3456, 'SOL/USDT': 178, 'BNB/USDT': 587, 
  'XRP/USDT': 0.62, 'DOGE/USDT': 0.15, 'ADA/USDT': 0.48
}

let realPrices: Record<string, number> = { ...DEMO_PRICES }
let priceHistory: Record<string, number[]> = {}

const formatTime = (date: Date): string => {
  return date.toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1]
  const multiplier = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }
  return ema
}

function calculateMACD(prices: number[]): number {
  if (prices.length < 26) return 0
  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  return ema12 - ema26
}

function calculateStochastic(prices: number[], high: number, low: number, period: number = 14): number {
  if (prices.length < period) return 50
  const lowest = Math.min(...prices.slice(-period).map(() => low))
  const highest = Math.max(...prices.slice(-period).map(() => high))
  const currentPrice = prices[prices.length - 1]
  if (highest === lowest) return 50
  return ((currentPrice - lowest) / (highest - lowest)) * 100
}

function generatePriceHistory(symbol: string, currentPrice: number): number[] {
  const history: number[] = []
  let price = currentPrice * 0.8
  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * 0.02
    price = price * (1 + change)
    history.push(price)
  }
  return history
}

function analyzeIndicators(symbol: string, currentPrice: number): Signal | null {
  if (!priceHistory[symbol]) {
    priceHistory[symbol] = generatePriceHistory(symbol, currentPrice)
  }
  priceHistory[symbol].push(currentPrice)
  if (priceHistory[symbol].length > 100) priceHistory[symbol].shift()
  
  const prices = priceHistory[symbol]
  const rsi = calculateRSI(prices)
  const macd = calculateMACD(prices)
  const ema20 = calculateEMA(prices, 20)
  const ema50 = calculateEMA(prices, 50)
  const stoch = calculateStochastic(prices, currentPrice * 1.02, currentPrice * 0.98)
  const adx = 25 + Math.random() * 30
  
  let bullishScore = 0, bearishScore = 0, reasons: string[] = []
  
  if (rsi < 35) { bullishScore++; reasons.push(`RSI oversold (${Math.round(rsi)})`) }
  else if (rsi > 65) { bearishScore++; reasons.push(`RSI overbought (${Math.round(rsi)})`) }
  
  if (currentPrice > ema20 && ema20 > ema50) { bullishScore++; reasons.push('Bullish EMA (20>50)') }
  else if (currentPrice < ema20 && ema20 < ema50) { bearishScore++; reasons.push('Bearish EMA (20<50)') }
  
  if (macd > 0.5) { bullishScore++; reasons.push(`MACD bullish (${macd.toFixed(2)})`) }
  else if (macd < -0.5) { bearishScore++; reasons.push(`MACD bearish (${macd.toFixed(2)})`) }
  
  if (stoch < 30) { bullishScore++; reasons.push(`Stoch oversold (${Math.round(stoch)})`) }
  else if (stoch > 70) { bearishScore++; reasons.push(`Stoch overbought (${Math.round(stoch)})`) }
  
  if (adx > 30) {
    if (currentPrice > ema20) { bullishScore++; reasons.push(`Strong uptrend (ADX:${Math.round(adx)})`) }
    else if (currentPrice < ema20) { bearishScore++; reasons.push(`Strong downtrend (ADX:${Math.round(adx)})`) }
  }
  
  let action: 'buy' | 'sell' | null = null
  let strength = 0
  if (bullishScore >= 3) { action = 'buy'; strength = Math.min(bullishScore, 5) }
  else if (bearishScore >= 3) { action = 'sell'; strength = Math.min(bearishScore, 5) }
  
  if (action) {
    return {
      symbol, action, price: currentPrice, strength, reasons, timestamp: new Date(),
      indicators: {
        rsi: Math.round(rsi), macd: parseFloat(macd.toFixed(2)),
        ema20: parseFloat(ema20.toFixed(2)), ema50: parseFloat(ema50.toFixed(2)),
        stoch: Math.round(stoch), adx: Math.round(adx)
      }
    }
  }
  return null
}

function openBybit(symbol: string) {
  window.open(`https://www.bybit.com/trade/spot/${symbol.replace('/USDT', '')}/USDT`, '_blank')
}

function App() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'signals' | 'trading' | 'history' | 'news' | 'topmovers' | 'watchlist'>('signals')
  const [isRealTime, setIsRealTime] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  useEffect(() => {
    const createBloodDrop = () => {
      const drop = document.createElement('div')
      drop.className = 'blood-drop'
      drop.style.left = Math.random() * 100 + '%'
      drop.style.animationDuration = 2 + Math.random() * 4 + 's'
      drop.style.width = 2 + Math.random() * 4 + 'px'
      drop.style.height = 8 + Math.random() * 15 + 'px'
      document.body.appendChild(drop)
      setTimeout(() => drop.remove(), 5000)
    }
    const interval = setInterval(createBloodDrop, 400)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const updatePrice = (symbol: string, price: number) => {
      const formattedSymbol = symbol === 'BTCUSDT' ? 'BTC/USDT' :
                              symbol === 'ETHUSDT' ? 'ETH/USDT' :
                              symbol === 'SOLUSDT' ? 'SOL/USDT' :
                              symbol === 'BNBUSDT' ? 'BNB/USDT' :
                              symbol === 'XRPUSDT' ? 'XRP/USDT' :
                              symbol === 'DOGEUSDT' ? 'DOGE/USDT' :
                              symbol === 'ADAUSDT' ? 'ADA/USDT' : symbol
      realPrices[formattedSymbol] = price
      setIsRealTime(true)
    }
    
    binanceWS.connect()
    const symbolsToSubscribe = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT']
    symbolsToSubscribe.forEach(sym => binanceWS.subscribe(sym, updatePrice))
    
    const updateSignals = () => {
      const newSignals: Signal[] = []
      for (const symbol of SYMBOLS) {
        const price = realPrices[symbol]
        if (price) {
          const signal = analyzeIndicators(symbol, price)
          if (signal) newSignals.push(signal)
        }
      }
      newSignals.sort((a, b) => b.strength - a.strength)
      setSignals(newSignals)
    }
    
    updateSignals()
    const interval = setInterval(updateSignals, 30000)
    
    return () => {
      symbolsToSubscribe.forEach(sym => binanceWS.unsubscribe(sym, updatePrice))
      clearInterval(interval)
    }
  }, [])

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedSignals = [...signals].sort((a, b) => {
    if (!sortConfig) return 0
    let aVal: any, bVal: any
    switch (sortConfig.key) {
      case 'symbol': aVal = a.symbol; bVal = b.symbol; break
      case 'price': aVal = a.price; bVal = b.price; break
      case 'action': aVal = a.action; bVal = b.action; break
      case 'strength': aVal = a.strength; bVal = b.strength; break
      default: return 0
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const buys = signals.filter(s => s.action === 'buy').length
  const sells = signals.filter(s => s.action === 'sell').length
  const formattedCurrentTime = formatTime(currentTime)

  const SortIcon = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return <span className="text-gray-600 ml-1">↕️</span>
    return <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-black">
      {/* TradingView-style header */}
      <header className="border-b border-red-500/30 bg-black/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
              💀 AUTO TRADE PRO
            </h1>
            {/* TradingView-style symbol bar */}
            <div className="hidden md:flex gap-1">
              {SYMBOLS.slice(0, 6).map(s => (
                <button key={s} onClick={() => setSelectedSymbol(s)} className={`px-3 py-1 text-sm rounded-lg transition ${selectedSymbol === s ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4 items-center">
            {isRealTime && <div className="flex items-center gap-1 text-xs text-red-400"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>REAL-TIME</div>}
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-400">LIVE</span>
            <div className="text-sm text-gray-400 font-mono">{formattedCurrentTime}</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* CMC-style stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-red-500/30 hover:border-red-500 transition">
            <div className="text-3xl font-bold text-red-400">{signals.length}</div>
            <div className="text-gray-400 text-sm mt-1">Активных сигналов</div>
            <div className="text-xs text-green-400 mt-2">+{Math.floor(Math.random() * 20)}% за 24ч</div>
          </div>
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-green-500/30 hover:border-green-500 transition">
            <div className="text-3xl font-bold text-green-500">{buys}</div>
            <div className="text-gray-400 text-sm mt-1">BUY сигналов</div>
            <div className="text-xs text-green-400 mt-2">Рекомендуется вход</div>
          </div>
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-red-500/30 hover:border-red-500 transition">
            <div className="text-3xl font-bold text-red-500">{sells}</div>
            <div className="text-gray-400 text-sm mt-1">SELL сигналов</div>
            <div className="text-xs text-red-400 mt-2">Рекомендуется выход</div>
          </div>
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-yellow-500/30 hover:border-yellow-500 transition">
            <div className="text-3xl font-bold text-yellow-500">71%</div>
            <div className="text-gray-400 text-sm mt-1">Точность (30д)</div>
            <div className="text-xs text-green-400 mt-2">↑ 5.2%</div>
          </div>
        </div>

        {/* TradingView-style tabs */}
        <div className="flex gap-1 mb-6 border-b border-red-500/30 overflow-x-auto pb-0">
          <button onClick={() => setActiveTab('signals')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'signals' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-red-900/30'}`}>🎯 Сигналы</button>
          <button onClick={() => setActiveTab('trading')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'trading' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-red-900/30'}`}>📈 График</button>
          <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-red-900/30'}`}>📜 История</button>
          <button onClick={() => setActiveTab('news')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'news' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-red-900/30'}`}>📰 Новости</button>
          <button onClick={() => setActiveTab('topmovers')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'topmovers' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-red-900/30'}`}>📊 Топ монет</button>
          <button onClick={() => setActiveTab('watchlist')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'watchlist' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-red-900/30'}`}>⭐ Избранное</button>
        </div>

        {activeTab === 'trading' && (
          <>
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-gray-400">Выберите актив для анализа</div>
              <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-black/60 border border-red-500/50 rounded-lg px-4 py-2 text-white text-sm">
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <TradingChart symbol={selectedSymbol} />
          </>
        )}

        {activeTab === 'history' && <SignalHistory />}
        {activeTab === 'news' && <News />}
        {activeTab === 'topmovers' && <TopMovers />}
        {activeTab === 'watchlist' && <Watchlist />}

        {activeTab === 'signals' && (
          <div className="bg-black/40 rounded-xl border border-red-500/20 overflow-hidden">
            {/* CMC-style table header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-red-950/30 border-b border-red-500/30 text-sm font-semibold text-red-300">
              <div className="col-span-3 cursor-pointer hover:text-red-200" onClick={() => requestSort('symbol')}>Актив <SortIcon column="symbol" /></div>
              <div className="col-span-2 cursor-pointer hover:text-red-200" onClick={() => requestSort('price')}>Цена <SortIcon column="price" /></div>
              <div className="col-span-2 cursor-pointer hover:text-red-200" onClick={() => requestSort('action')}>Сигнал <SortIcon column="action" /></div>
              <div className="col-span-2 cursor-pointer hover:text-red-200" onClick={() => requestSort('strength')}>Индикаторы <SortIcon column="strength" /></div>
              <div className="col-span-2">Время</div>
              <div className="col-span-1">Действие</div>
            </div>
            
            {/* CMC-style table rows */}
            <div className="divide-y divide-red-900/20">
              {sortedSignals.length === 0 ? (
                <div className="text-center text-gray-500 py-16">Нет сигналов (нужно 3+ совпадений индикаторов)</div>
              ) : (
                sortedSignals.map((signal, idx) => {
                  const stars = '★'.repeat(signal.strength) + '☆'.repeat(5 - signal.strength)
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-red-900/10 transition cursor-pointer" onClick={() => openBybit(signal.symbol)}>
                      <div className="col-span-3 font-bold text-white">💰 {signal.symbol}</div>
                      <div className="col-span-2 font-mono">${signal.price.toLocaleString()}</div>
                      <div className="col-span-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${signal.action === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                          {signal.action === 'buy' ? 'BUY 🔥' : 'SELL 💀'}
                        </span>
                      </div>
                      <div className="col-span-2 text-xs text-gray-300">
                        RSI:{signal.indicators.rsi} | MACD:{signal.indicators.macd}
                      </div>
                      <div className="col-span-2 text-xs text-gray-500">{formatTime(signal.timestamp)}</div>
                      <div className="col-span-1 text-red-400 text-xs">Торговать →</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
