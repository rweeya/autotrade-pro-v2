import React, { useState, useEffect } from 'react'
import TradingChart from './components/TradingChart'
import SignalHistory from './components/SignalHistory'
import News from './components/News'
import TopMovers from './components/TopMovers'
import Watchlist from './components/Watchlist'
import { binanceWS } from './services/websocket'
import { bybitTestnet } from './services/bybitTestnet'

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
    macdSignal: number
    macdHistogram: number
    ema20: number
    ema50: number
  }
}

// ========== 60+ АКТИВОВ ==========
const SYMBOLS = [
  // Топ крипто (30)
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'NEAR/USDT',
  'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'INJ/USDT',
  'SUI/USDT', 'IMX/USDT', 'HBAR/USDT', 'VET/USDT', 'GRT/USDT',
  'RNDR/USDT', 'MKR/USDT', 'AAVE/USDT', 'SNX/USDT', 'CRV/USDT',
  // Мемы (5)
  'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'FLOKI/USDT', 'SHIB/USDT',
  // Альткоины (15)
  'ALGO/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT',
  'AXS/USDT', 'ENJ/USDT', 'CHZ/USDT', 'THETA/USDT', 'EOS/USDT',
  'XTZ/USDT', 'KSM/USDT', 'ZEC/USDT', 'DASH/USDT', 'COMP/USDT',
  // Новые (10)
  'SEI/USDT', 'TIA/USDT', 'PYTH/USDT', 'JUP/USDT', 'ONDO/USDT',
  'STRK/USDT', 'WLD/USDT', 'AGIX/USDT', 'OCEAN/USDT', 'FET/USDT'
]

const DEMO_PRICES: Record<string, number> = {
  'BTC/USDT': 65234, 'ETH/USDT': 3456, 'SOL/USDT': 178, 'BNB/USDT': 587,
  'XRP/USDT': 0.62, 'DOGE/USDT': 0.15, 'ADA/USDT': 0.48, 'AVAX/USDT': 42.5,
  'DOT/USDT': 8.75, 'MATIC/USDT': 0.95, 'LINK/USDT': 18.5, 'UNI/USDT': 12.3,
  'ATOM/USDT': 11.2, 'LTC/USDT': 98.5, 'NEAR/USDT': 7.8, 'FIL/USDT': 6.2,
  'APT/USDT': 11.5, 'ARB/USDT': 1.8, 'OP/USDT': 3.2, 'INJ/USDT': 32.5,
  'SUI/USDT': 1.4, 'IMX/USDT': 2.8, 'HBAR/USDT': 0.12, 'VET/USDT': 0.035,
  'GRT/USDT': 0.32, 'RNDR/USDT': 10.5, 'MKR/USDT': 2800, 'AAVE/USDT': 120,
  'SNX/USDT': 3.8, 'CRV/USDT': 0.65, 'PEPE/USDT': 0.000015, 'WIF/USDT': 3.2,
  'BONK/USDT': 0.000028, 'FLOKI/USDT': 0.00025, 'SHIB/USDT': 0.000025,
  'ALGO/USDT': 0.24, 'FTM/USDT': 0.55, 'SAND/USDT': 0.45, 'MANA/USDT': 0.52,
  'GALA/USDT': 0.032, 'AXS/USDT': 7.2, 'ENJ/USDT': 0.32, 'CHZ/USDT': 0.11,
  'THETA/USDT': 1.85, 'EOS/USDT': 0.85, 'XTZ/USDT': 1.05, 'KSM/USDT': 28.5,
  'ZEC/USDT': 28.5, 'DASH/USDT': 32.5, 'COMP/USDT': 48.5, 'SEI/USDT': 0.42,
  'TIA/USDT': 11.5, 'PYTH/USDT': 0.48, 'JUP/USDT': 0.95, 'ONDO/USDT': 1.15,
  'STRK/USDT': 1.85, 'WLD/USDT': 5.2, 'AGIX/USDT': 0.85, 'OCEAN/USDT': 0.72,
  'FET/USDT': 2.15
}

let realPrices: Record<string, number> = { ...DEMO_PRICES }
let priceHistory: Record<string, number[]> = {}
let macdHistory: Record<string, { macd: number; signal: number; histogram: number }[]> = {}

const formatTime = (date: Date): string => {
  return date.toLocaleString('ru-RU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
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

function calculateMACD(prices: number[], fast = 12, slow = 26, signal = 9): { macd: number; signal: number; histogram: number } {
  if (prices.length < slow + signal) {
    return { macd: 0, signal: 0, histogram: 0 }
  }
  const emaFast = calculateEMA(prices, fast)
  const emaSlow = calculateEMA(prices, slow)
  const macdLine = emaFast - emaSlow
  
  const macdValues = prices.map((_, i) => {
    if (i < slow) return 0
    const f = calculateEMA(prices.slice(0, i + 1), fast)
    const s = calculateEMA(prices.slice(0, i + 1), slow)
    return f - s
  }).filter(v => v !== 0)
  
  const signalLine = macdValues.length >= signal ? calculateEMA(macdValues.slice(-signal), signal) : 0
  const histogram = macdLine - signalLine
  
  return { macd: macdLine, signal: signalLine, histogram }
}

function generatePriceHistory(currentPrice: number): number[] {
  const history: number[] = []
  let price = currentPrice * 0.8
  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * 0.02
    price = price * (1 + change)
    history.push(price)
  }
  return history
}

function checkEmaCross(prevEma20: number, prevEma50: number, currEma20: number, currEma50: number): 'golden' | 'death' | null {
  if (prevEma20 <= prevEma50 && currEma20 > currEma50) return 'golden'
  if (prevEma20 >= prevEma50 && currEma20 < currEma50) return 'death'
  return null
}

function checkMacdCross(prevMacd: number, prevSignal: number, currMacd: number, currSignal: number): 'bullish' | 'bearish' | null {
  if (prevMacd <= prevSignal && currMacd > currSignal) return 'bullish'
  if (prevMacd >= prevSignal && currMacd < currSignal) return 'bearish'
  return null
}

// ДЕМО-РЕЖИМ: принудительная генерация сигналов для теста
const DEMO_MODE = true  // Включи для теста, выключи для реальных сигналов

function analyzeIndicators(symbol: string, currentPrice: number, currentHigh: number, currentLow: number): Signal | null {
  // ДЕМО-РЕЖИМ: генерируем тестовые сигналы
  if (DEMO_MODE) {
    // Генерируем сигналы для первых 10 активов для теста
    const testSymbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT']
    if (testSymbols.includes(symbol)) {
      const randomAction = Math.random() > 0.5 ? 'buy' : 'sell'
      return {
        symbol,
        action: randomAction,
        price: currentPrice,
        strength: 3,
        reasons: ['🔴 ДЕМО-СИГНАЛ', 'RSI:42', 'MACD пересечение', 'EMA↑'],
        timestamp: new Date(),
        indicators: {
          rsi: 42,
          macd: 0.15,
          macdSignal: 0.05,
          macdHistogram: 0.10,
          ema20: currentPrice * 0.98,
          ema50: currentPrice * 0.96
        }
      }
    }
    return null
  }

  // РЕАЛЬНЫЙ АНАЛИЗ (если DEMO_MODE = false)
  if (!priceHistory[symbol]) {
    priceHistory[symbol] = generatePriceHistory(currentPrice)
  }
  priceHistory[symbol].push(currentPrice)
  if (priceHistory[symbol].length > 100) priceHistory[symbol].shift()
  
  const prices = priceHistory[symbol]
  const rsi = calculateRSI(prices)
  const ema20 = calculateEMA(prices, 20)
  const ema50 = calculateEMA(prices, 50)
  
  const macdData = calculateMACD(prices)
  
  if (!macdHistory[symbol]) macdHistory[symbol] = []
  macdHistory[symbol].push(macdData)
  if (macdHistory[symbol].length > 5) macdHistory[symbol].shift()
  
  const prevMacd = macdHistory[symbol].length >= 2 ? macdHistory[symbol][macdHistory[symbol].length - 2] : macdData
  const currMacd = macdData
  
  const prevEma20 = prices.length >= 21 ? calculateEMA(prices.slice(0, -1), 20) : ema20
  const prevEma50 = prices.length >= 51 ? calculateEMA(prices.slice(0, -1), 50) : ema50
  const emaCross = checkEmaCross(prevEma20, prevEma50, ema20, ema50)
  const macdCross = checkMacdCross(prevMacd.macd, prevMacd.signal, currMacd.macd, currMacd.signal)
  
  let reasons: string[] = []
  
  const allBuyConditions = rsi < 45 && macdCross === 'bullish' && emaCross === 'golden'
  const allSellConditions = rsi > 55 && macdCross === 'bearish' && emaCross === 'death'
  
  if (allBuyConditions) {
    reasons.push(`RSI:${Math.round(rsi)} (<45)`, `MACD bullish`, `EMA↑`)
    return {
      symbol, action: 'buy', price: currentPrice, strength: 3,
      reasons,
      timestamp: new Date(),
      indicators: {
        rsi: Math.round(rsi), macd: currMacd.macd, macdSignal: currMacd.signal,
        macdHistogram: currMacd.histogram, ema20, ema50
      }
    }
  }
  
  if (allSellConditions) {
    reasons.push(`RSI:${Math.round(rsi)} (>55)`, `MACD bearish`, `EMA↓`)
    return {
      symbol, action: 'sell', price: currentPrice, strength: 3,
      reasons,
      timestamp: new Date(),
      indicators: {
        rsi: Math.round(rsi), macd: currMacd.macd, macdSignal: currMacd.signal,
        macdHistogram: currMacd.histogram, ema20, ema50
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
  const [activeTab, setActiveTab] = useState<'signals' | 'trading' | 'history' | 'news' | 'topmovers' | 'watchlist' | 'autotrade'>('signals')
  const [isRealTime, setIsRealTime] = useState(false)
  
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(false)
  const [balance, setBalance] = useState(10000)
  const [positions, setPositions] = useState<any[]>([])
  const [tradeHistory, setTradeHistory] = useState<any[]>([])
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')

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
    setApiConfigured(bybitTestnet.isConfigured())
    setBalance(bybitTestnet.getBalance())
    setPositions(bybitTestnet.getPositions())
    setTradeHistory(bybitTestnet.getHistory())
  }, [])

  useEffect(() => {
    if (!apiConfigured) return
    for (const signal of signals) {
      const cleanSymbol = signal.symbol.replace('/USDT', '')
      bybitTestnet.closeByReverseSignal(cleanSymbol, signal.action === 'buy' ? 'Buy' : 'Sell')
      setBalance(bybitTestnet.getBalance())
      setPositions(bybitTestnet.getPositions())
      setTradeHistory(bybitTestnet.getHistory())
    }
  }, [signals, apiConfigured])

  useEffect(() => {
    const updatePrice = (symbol: string, price: number) => {
      let formattedSymbol = symbol
      if (symbol === 'BTCUSDT') formattedSymbol = 'BTC/USDT'
      else if (symbol === 'ETHUSDT') formattedSymbol = 'ETH/USDT'
      else if (symbol === 'SOLUSDT') formattedSymbol = 'SOL/USDT'
      else if (symbol === 'BNBUSDT') formattedSymbol = 'BNB/USDT'
      else if (symbol === 'XRPUSDT') formattedSymbol = 'XRP/USDT'
      else if (symbol === 'DOGEUSDT') formattedSymbol = 'DOGE/USDT'
      else if (symbol === 'ADAUSDT') formattedSymbol = 'ADA/USDT'
      else if (symbol === 'AVAXUSDT') formattedSymbol = 'AVAX/USDT'
      else if (symbol === 'DOTUSDT') formattedSymbol = 'DOT/USDT'
      else if (symbol === 'MATICUSDT') formattedSymbol = 'MATIC/USDT'
      else if (symbol === 'LINKUSDT') formattedSymbol = 'LINK/USDT'
      else if (symbol === 'UNIUSDT') formattedSymbol = 'UNI/USDT'
      else if (symbol === 'ATOMUSDT') formattedSymbol = 'ATOM/USDT'
      else if (symbol === 'LTCUSDT') formattedSymbol = 'LTC/USDT'
      else if (symbol === 'NEARUSDT') formattedSymbol = 'NEAR/USDT'
      else formattedSymbol = symbol
      
      realPrices[formattedSymbol] = price
      setIsRealTime(true)
      bybitTestnet.updatePrice(formattedSymbol.replace('/USDT', ''), price)
    }
    
    binanceWS.connect()
    const symbolsToSubscribe = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT',
      'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT', 'NEARUSDT',
      'FILUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT', 'IMXUSDT', 'HBARUSDT',
      'VETUSDT', 'GRTUSDT', 'RNDRUSDT', 'MKRUSDT', 'AAVEUSDT', 'SNXUSDT', 'CRVUSDT',
      'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT', 'SHIBUSDT',
      'ALGOUSDT', 'FTMUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'AXSUSDT', 'ENJUSDT',
      'CHZUSDT', 'THETAUSDT', 'EOSUSDT', 'XTZUSDT', 'KSMUSDT', 'ZECUSDT', 'DASHUSDT', 'COMPUSDT'
    ]
    symbolsToSubscribe.forEach(sym => binanceWS.subscribe(sym, updatePrice))
    
    const updateSignals = () => {
      const newSignals: Signal[] = []
      for (const symbol of SYMBOLS) {
        const price = realPrices[symbol]
        if (price) {
          const high = price * 1.02
          const low = price * 0.98
          const signal = analyzeIndicators(symbol, price, high, low)
          if (signal) newSignals.push(signal)
        }
      }
      newSignals.sort((a, b) => b.strength - a.strength)
      setSignals(newSignals)
      console.log(`✅ Обновлено: ${newSignals.length} сигналов из ${SYMBOLS.length} активов`)
    }
    
    updateSignals()
    const interval = setInterval(updateSignals, 30000)
    
    return () => {
      symbolsToSubscribe.forEach(sym => binanceWS.unsubscribe(sym, updatePrice))
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (autoTradeEnabled && apiConfigured && signals.length > 0) {
      const executeTrades = async () => {
        for (const signal of signals) {
          const qty = (balance * 0.02) / signal.price
          const side = signal.action === 'buy' ? 'Buy' : 'Sell'
          try {
            const order = await bybitTestnet.placeOrder({
              symbol: signal.symbol.replace('/USDT', ''),
              side,
              qty: parseFloat(qty.toFixed(4)),
              price: signal.price
            })
            console.log('✅ Ордер открыт:', order)
            setBalance(bybitTestnet.getBalance())
            setPositions(bybitTestnet.getPositions())
            setTradeHistory(bybitTestnet.getHistory())
          } catch (error) {
            console.error('❌ Ошибка открытия ордера:', error)
          }
        }
      }
      executeTrades()
    }
  }, [signals, autoTradeEnabled, apiConfigured, balance])

  const saveApiKeys = () => {
    if (apiKey && apiSecret) {
      bybitTestnet.setConfig(apiKey, apiSecret)
      setApiConfigured(true)
      setBalance(bybitTestnet.getBalance())
      setPositions(bybitTestnet.getPositions())
      setTradeHistory(bybitTestnet.getHistory())
      alert('API ключи сохранены!')
    }
  }

  const resetAccount = () => {
    bybitTestnet.resetAccount()
    setBalance(10000)
    setPositions([])
    setTradeHistory([])
    alert('Счёт сброшен')
  }

  const buys = signals.filter(s => s.action === 'buy').length
  const sells = signals.filter(s => s.action === 'sell').length
  const formattedCurrentTime = formatTime(currentTime)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-black">
      <header className="border-b border-red-500/30 bg-black/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
              💀 AUTO TRADE PRO | {SYMBOLS.length} активов
            </h1>
            <div className="hidden md:flex gap-1">
              {SYMBOLS.slice(0, 6).map(s => (
                <button key={s} onClick={() => setSelectedSymbol(s)} className={`px-3 py-1 text-sm rounded-lg transition ${selectedSymbol === s ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {s}
                </button>
              ))}
              <span className="text-gray-600 text-sm px-2">+{SYMBOLS.length - 6}</span>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            {DEMO_MODE && <div className="flex items-center gap-1 text-xs text-yellow-400"><div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>DEMO-MODE</div>}
            {isRealTime && <div className="flex items-center gap-1 text-xs text-red-400"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>REAL-TIME</div>}
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-400">LIVE</span>
            <div className="text-sm text-gray-400 font-mono">{formattedCurrentTime}</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-red-500/30">
            <div className="text-3xl font-bold text-red-400">{signals.length}</div>
            <div className="text-gray-400 text-sm mt-1">Активных сигналов</div>
            <div className="text-xs text-green-400 mt-2">Из {SYMBOLS.length} активов</div>
          </div>
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-green-500/30">
            <div className="text-3xl font-bold text-green-500">{buys}</div>
            <div className="text-gray-400 text-sm mt-1">BUY сигналов</div>
            <div className="text-xs text-green-400 mt-2">RSI&lt;45</div>
          </div>
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-red-500/30">
            <div className="text-3xl font-bold text-red-500">{sells}</div>
            <div className="text-gray-400 text-sm mt-1">SELL сигналов</div>
            <div className="text-xs text-red-400 mt-2">RSI&gt;55</div>
          </div>
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-5 border border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-500">RSI/MACD/EMA</div>
            <div className="text-gray-400 text-sm mt-1">3 индикатора</div>
            <div className="text-xs text-green-400 mt-2">{DEMO_MODE ? 'ДЕМО-РЕЖИМ' : 'Реальные сигналы'}</div>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-red-500/30 overflow-x-auto pb-0">
          <button onClick={() => setActiveTab('signals')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'signals' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>🎯 Сигналы</button>
          <button onClick={() => setActiveTab('trading')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'trading' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📈 График</button>
          <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📜 История</button>
          <button onClick={() => setActiveTab('news')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'news' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📰 Новости</button>
          <button onClick={() => setActiveTab('topmovers')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'topmovers' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📊 Топ монет</button>
          <button onClick={() => setActiveTab('watchlist')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'watchlist' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>⭐ Избранное</button>
          <button onClick={() => setActiveTab('autotrade')} className={`px-5 py-2.5 font-medium transition-all rounded-t-lg ${activeTab === 'autotrade' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>🤖 Автоторговля</button>
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

        {activeTab === 'autotrade' && (
          <div className="space-y-6">
            <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-6 border border-red-500/30">
              <h3 className="text-xl font-bold text-red-400 mb-4">🤖 НАСТРОЙКА АВТОТОРГОВЛИ</h3>
              
              {!apiConfigured ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">API Key</label>
                    <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Введите API Key от Bybit Testnet" className="w-full bg-black/50 border border-red-500/50 rounded-lg p-3 text-white" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">API Secret</label>
                    <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Введите API Secret" className="w-full bg-black/50 border border-red-500/50 rounded-lg p-3 text-white" />
                  </div>
                  <button onClick={saveApiKeys} className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg font-bold transition">Сохранить ключи</button>
                  <div className="text-xs text-gray-500 mt-2">Ключи можно получить в Bybit Testnet: API Management → Create New Key</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-green-400 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>✅ API ключи настроены</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={autoTradeEnabled} onChange={(e) => setAutoTradeEnabled(e.target.checked)} className="w-5 h-5" />
                      <span className="text-white font-bold">🔓 Включить автоторговлю</span>
                    </label>
                    <button onClick={resetAccount} className="bg-yellow-600/50 hover:bg-yellow-600 px-4 py-1 rounded-lg text-sm transition">Сбросить счёт</button>
                  </div>
                  {autoTradeEnabled && (<div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4"><p className="text-green-400 font-bold">🟢 АВТОТОРГОВЛЯ АКТИВНА!</p><p className="text-gray-400 text-sm mt-1">При появлении сигналов сделки будут открываться автоматически</p></div>)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-6 border border-red-500/30">
                <h3 className="text-lg font-bold text-red-400 mb-3">💰 БАЛАНС</h3>
                <div className="text-3xl font-bold text-white">${balance.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">Демо-счёт Bybit Testnet</div>
              </div>
              <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-6 border border-red-500/30">
                <h3 className="text-lg font-bold text-red-400 mb-3">📊 ОТКРЫТЫЕ ПОЗИЦИИ</h3>
                {positions.length === 0 ? <div className="text-gray-500 text-sm">Нет открытых позиций</div> : positions.map((pos, idx) => (<div key={idx} className="border-b border-red-500/20 py-2 flex justify-between"><span>{pos.side} {pos.symbol}</span><span>${pos.price}</span><span className="text-xs">{pos.qty}</span></div>))}
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-6 border border-red-500/30">
              <h3 className="text-lg font-bold text-red-400 mb-3">📜 ИСТОРИЯ СДЕЛОК</h3>
              <div className="max-h-[200px] overflow-y-auto">
                {tradeHistory.length === 0 ? <div className="text-gray-500 text-sm text-center py-4">Нет сделок</div> : tradeHistory.map((trade, idx) => (<div key={idx} className="border-b border-red-500/20 py-2 flex justify-between text-sm"><span className={trade.side === 'Buy' ? 'text-green-400' : 'text-red-400'}>{trade.side}</span><span>{trade.symbol}</span><span>${trade.price}</span><span className="text-gray-500 text-xs">{new Date(trade.timestamp).toLocaleTimeString()}</span></div>))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="bg-black/40 rounded-xl border border-red-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-red-950/30 border-b border-red-500/30">
              <div className="text-sm font-semibold text-red-300">
                {DEMO_MODE ? '🔴 ДЕМО-РЕЖИМ: тестовые сигналы' : '🎯 Реальные сигналы — RSI (&lt;45 / &gt;55) + MACD + EMA'} | Мониторинг {SYMBOLS.length} активов
              </div>
            </div>
            <div className="divide-y divide-red-900/20">
              {signals.length === 0 ? (<div className="text-center text-gray-500 py-16">⏳ Нет сигналов<br/><span className="text-xs text-gray-600">Мониторим {SYMBOLS.length} активов</span></div>) : (signals.map((signal, idx) => {
                const stars = '★'.repeat(signal.strength) + '☆'.repeat(3 - signal.strength)
                return (<div key={idx} className="p-5 hover:bg-red-900/10 transition cursor-pointer" onClick={() => openBybit(signal.symbol)}>
                  <div className="flex justify-between items-start flex-wrap gap-3"><div className="flex items-center gap-3"><span className="font-bold text-xl text-white">💰 {signal.symbol}</span><span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${signal.action === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{signal.action === 'buy' ? '🔥 BUY' : '💀 SELL'}</span><span className="text-yellow-400 text-sm">⚡ {stars} (3/3)</span></div><div className="text-xs text-gray-500">{formatTime(signal.timestamp)}</div></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 text-xs">
                    <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">RSI</div><div className={`font-bold ${signal.indicators.rsi < 45 ? 'text-green-400' : signal.indicators.rsi > 55 ? 'text-red-400' : 'text-white'}`}>{signal.indicators.rsi}</div></div>
                    <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">MACD</div><div className="text-white text-xs">{signal.indicators.macd > 0 ? '+' : ''}{signal.indicators.macd.toFixed(2)}</div></div>
                    <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">EMA20/50</div><div className="text-white text-xs">${signal.indicators.ema20.toFixed(0)} / ${signal.indicators.ema50.toFixed(0)}</div></div>
                    <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">Цена</div><div className="text-white text-xs">${signal.price.toLocaleString()}</div></div>
                  </div>
                  <div className="mt-3 text-xs text-red-300">🎯 {signal.reasons.join(' • ')}</div>
                </div>)
              }))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
