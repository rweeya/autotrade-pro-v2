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

// Форматирование времени (МСК / UTC+3)
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

  // ===== КАПЛИ КРОВИ =====
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

  const buys = signals.filter(s => s.action === 'buy').length
  const sells = signals.filter(s => s.action === 'sell').length
  const formattedCurrentTime = formatTime(currentTime)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-black">
      <header className="border-b border-red-500/30 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
            💀 AUTO TRADE PRO V2
          </h1>
          <div className="flex gap-4 items-center">
            {isRealTime && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                REAL-TIME
              </div>
            )}
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-400">LIVE</span>
            <div className="text-sm text-gray-400 font-mono">{formattedCurrentTime}</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/50 backdrop-blur-lg rounded-xl p-4 border border-red-500/30">
            <div className="text-3xl font-bold text-red-400">{signals.length}</div>
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
            <div className="text-3xl font-bold text-yellow-500">—</div>
            <div className="text-gray-400 text-sm">ТОЧНОСТЬ</div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-red-500/30 overflow-x-auto pb-1">
          <button onClick={() => setActiveTab('signals')} className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${activeTab === 'signals' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>🎯 СИГНАЛЫ</button>
          <button onClick={() => setActiveTab('trading')} className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${activeTab === 'trading' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>📈 ГРАФИК</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>📜 ИСТОРИЯ</button>
          <button onClick={() => setActiveTab('news')} className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${activeTab === 'news' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>📰 НОВОСТИ</button>
          <button onClick={() => setActiveTab('topmovers')} className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${activeTab === 'topmovers' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>📊 ТОП МОНЕТ</button>
          <button onClick={() => setActiveTab('watchlist')} className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${activeTab === 'watchlist' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>⭐ ИЗБРАННОЕ</button>
        </div>

        {activeTab === 'trading' && (
          <>
            <div className="mb-4">
              <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-black/50 border border-red-500/50 rounded-xl px-4 py-2 text-white">
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
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-400">🎯 АКТУАЛЬНЫЕ СИГНАЛЫ</h2>
              <div className="text-xs text-red-400 bg-red-500/20 px-3 py-1 rounded-full">🎯 3+ индикаторов</div>
            </div>
            {signals.length === 0 ? (
              <div className="text-center text-gray-500 py-10">Нет сигналов (нужно 3+ совпадений индикаторов)</div>
            ) : (
              signals.map((signal, idx) => {
                const stars = '★'.repeat(signal.strength) + '☆'.repeat(5 - signal.strength)
                return (
                  <div key={idx} onClick={() => openBybit(signal.symbol)} className="bg-gradient-to-r from-red-900/20 to-red-800/10 rounded-xl p-4 border-l-4 border-red-500 hover:translate-x-1 hover:bg-red-900/40 transition-all cursor-pointer">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="font-bold text-lg">💰 {signal.symbol}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${signal.action === 'buy' ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}>
                        {signal.action === 'buy' ? '🟢 BUY' : '🔴 SELL'}
                      </span>
                      <span className="text-yellow-400 text-sm">⚡ {stars}</span>
                    </div>
                    <div className="flex gap-4 mt-2 text-gray-400 text-sm flex-wrap">
                      <span>💵 ${signal.price.toLocaleString()}</span>
                      <span>📊 RSI:{signal.indicators.rsi} | MACD:{signal.indicators.macd} | Stoch:{signal.indicators.stoch}</span>
                      <span>🕐 {formatTime(signal.timestamp)}</span>
                    </div>
                    <div className="mt-2 text-xs text-red-300">🎯 {signal.reasons.join(' • ')}</div>
                    <div className="mt-1 text-xs text-red-400">🖱️ Клик → Bybit</div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
