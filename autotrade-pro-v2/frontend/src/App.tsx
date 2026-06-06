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

// ========== АКТИВЫ (НЕ ТРОГАТЬ) ==========
const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'NEAR/USDT'
]

let realPrices: Record<string, number> = {}
let priceHistory: Record<string, number[]> = {}
let macdHistory: Record<string, { macd: number; signal: number; histogram: number }[]> = {}

const formatTime = (date: Date): string => {
  return date.toLocaleString('ru-RU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

function calculateRSI(prices: number[], period: number = 10): number {
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

function calculateMACD(prices: number[], fast = 8, slow = 17, signal = 5): { macd: number; signal: number; histogram: number } {
  if (prices.length < slow + signal) {
    return { macd: 0, signal: 0, histogram: 0 }
  }
  const emaFast = calculateEMA(prices, fast)
  const emaSlow = calculateEMA(prices, slow)
  const macdLine = emaFast - emaSlow
  return { macd: macdLine, signal: 0, histogram: macdLine }
}

function generatePriceHistory(currentPrice: number): number[] {
  const history: number[] = []
  let price = currentPrice * 0.95
  for (let i = 0; i < 50; i++) {
    const change = (Math.random() - 0.5) * 0.015
    price = price * (1 + change)
    history.push(price)
  }
  return history
}

function checkMacdCross(prevMacd: number, currMacd: number): 'bullish' | 'bearish' | null {
  if (prevMacd <= 0 && currMacd > 0) return 'bullish'
  if (prevMacd >= 0 && currMacd < 0) return 'bearish'
  return null
}

function analyzeIndicators(symbol: string, currentPrice: number, isScalping: boolean): Signal | null {
  if (!priceHistory[symbol]) {
    priceHistory[symbol] = generatePriceHistory(currentPrice)
  }
  priceHistory[symbol].push(currentPrice)
  if (priceHistory[symbol].length > 50) priceHistory[symbol].shift()
  
  const prices = priceHistory[symbol]
  const rsi = calculateRSI(prices, 10)
  const ema20 = calculateEMA(prices, 20)
  const ema50 = calculateEMA(prices, 50)
  
  const macdData = calculateMACD(prices)
  
  if (!macdHistory[symbol]) macdHistory[symbol] = []
  macdHistory[symbol].push(macdData)
  if (macdHistory[symbol].length > 5) macdHistory[symbol].shift()
  
  const prevMacd = macdHistory[symbol].length >= 2 ? macdHistory[symbol][macdHistory[symbol].length - 2].macd : 0
  const currMacd = macdData.macd
  const macdCross = checkMacdCross(prevMacd, currMacd)
  
  let allBuyConditions = false
  let allSellConditions = false
  let strength = 0
  let reasons: string[] = []
  
  if (isScalping) {
    const buyScalping = rsi < 60 && (macdCross === 'bullish' || currMacd > -0.2)
    const sellScalping = rsi > 40 && (macdCross === 'bearish' || currMacd < 0.2)
    if (buyScalping) {
      allBuyConditions = true
      strength = 2
      reasons.push(`RSI:${Math.round(rsi)} (<60)`, `MACD бычий`)
    } else if (sellScalping) {
      allSellConditions = true
      strength = 2
      reasons.push(`RSI:${Math.round(rsi)} (>40)`, `MACD медвежий`)
    }
  } else {
    const buySwing = rsi < 45 && macdCross === 'bullish' && currentPrice > ema20
    const sellSwing = rsi > 55 && macdCross === 'bearish' && currentPrice < ema20
    if (buySwing) {
      allBuyConditions = true
      strength = 3
      reasons.push(`RSI:${Math.round(rsi)} (<45)`, `MACD бычий`, `Цена выше EMA20`)
    } else if (sellSwing) {
      allSellConditions = true
      strength = 3
      reasons.push(`RSI:${Math.round(rsi)} (>55)`, `MACD медвежий`, `Цена ниже EMA20`)
    }
  }
  
  if (allBuyConditions) {
    return {
      symbol, action: 'buy', price: currentPrice, strength,
      reasons,
      timestamp: new Date(),
      indicators: {
        rsi: Math.round(rsi), macd: currMacd, macdSignal: 0,
        macdHistogram: 0, ema20, ema50
      }
    }
  }
  
  if (allSellConditions) {
    return {
      symbol, action: 'sell', price: currentPrice, strength,
      reasons,
      timestamp: new Date(),
      indicators: {
        rsi: Math.round(rsi), macd: currMacd, macdSignal: 0,
        macdHistogram: 0, ema20, ema50
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
  const [scalpingMode, setScalpingMode] = useState(() => {
    const saved = localStorage.getItem('scalping_mode')
    return saved === 'true'
  })
  
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(() => {
    const saved = localStorage.getItem('auto_trade_enabled')
    return saved === 'true'
  })
  const [apiConfigured, setApiConfigured] = useState(false)
  const [balance, setBalance] = useState(10000)
  const [positions, setPositions] = useState<any[]>([])
  const [tradeHistory, setTradeHistory] = useState<any[]>([])
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [maxRiskPercent, setMaxRiskPercent] = useState(() => {
    const saved = localStorage.getItem('max_risk_percent')
    return saved ? parseFloat(saved) : 10
  })
  const STOP_LOSS_PERCENT = scalpingMode ? 0.5 : 2

  useEffect(() => {
    localStorage.setItem('auto_trade_enabled', String(autoTradeEnabled))
  }, [autoTradeEnabled])

  useEffect(() => {
    const handleBalanceUpdate = () => {
      setBalance(bybitTestnet.getBalance())
      setPositions(bybitTestnet.getPositions())
      setTradeHistory(bybitTestnet.getHistory())
    }
    window.addEventListener('balance-updated', handleBalanceUpdate)
    return () => window.removeEventListener('balance-updated', handleBalanceUpdate)
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

  const toggleScalpingMode = () => {
    const newMode = !scalpingMode
    setScalpingMode(newMode)
    localStorage.setItem('scalping_mode', String(newMode))
    window.location.reload()
  }

  const saveApiKeys = () => {
    if (apiKey && apiSecret) {
      bybitTestnet.setConfig(apiKey, apiSecret)
      setApiConfigured(true)
      alert('API ключи сохранены!')
    }
  }

  const resetAccount = () => {
    bybitTestnet.resetAccount()
    alert('Счет сброшен до $10,000')
  }

  const closeAllPositions = async () => {
    if (positions.length === 0) {
      alert('Нет открытых позиций')
      return
    }
    if (confirm(`Закрыть ${positions.length} позиций?`)) {
      for (const pos of positions) {
        try {
          await bybitTestnet.closePosition(pos.symbol, realPrices[`${pos.symbol}/USDT`] || pos.price, 'Ручное закрытие')
        } catch (e) {
          console.error('Ошибка закрытия:', e)
        }
      }
    }
  }

  const updateSignals = () => {
    const newSignals: Signal[] = []
    for (const symbol of SYMBOLS) {
      const price = realPrices[symbol]
      if (price) {
        const signal = analyzeIndicators(symbol, price, scalpingMode)
        if (signal) newSignals.push(signal)
      }
    }
    newSignals.sort((a, b) => b.strength - a.strength)
    setSignals(newSignals)
    if (newSignals.length) console.log(`✅ Сигналов: ${newSignals.length} из ${SYMBOLS.length}`)
  }

  useEffect(() => {
    const updatePrice = (symbol: string, price: number) => {
      const formattedSymbol = symbol === 'BTCUSDT' ? 'BTC/USDT' :
                              symbol === 'ETHUSDT' ? 'ETH/USDT' :
                              symbol === 'SOLUSDT' ? 'SOL/USDT' :
                              symbol === 'BNBUSDT' ? 'BNB/USDT' :
                              symbol === 'XRPUSDT' ? 'XRP/USDT' :
                              symbol === 'DOGEUSDT' ? 'DOGE/USDT' :
                              symbol === 'ADAUSDT' ? 'ADA/USDT' :
                              symbol === 'AVAXUSDT' ? 'AVAX/USDT' :
                              symbol === 'DOTUSDT' ? 'DOT/USDT' :
                              symbol === 'MATICUSDT' ? 'MATIC/USDT' :
                              symbol === 'LINKUSDT' ? 'LINK/USDT' :
                              symbol === 'UNIUSDT' ? 'UNI/USDT' :
                              symbol === 'ATOMUSDT' ? 'ATOM/USDT' :
                              symbol === 'LTCUSDT' ? 'LTC/USDT' :
                              symbol === 'NEARUSDT' ? 'NEAR/USDT' : symbol
      
      if (formattedSymbol && price) {
        realPrices[formattedSymbol] = price
        updateSignals()
      }
    }
    
    binanceWS.connect()
    const symbolsToSubscribe = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT', 'NEARUSDT']
    symbolsToSubscribe.forEach(sym => binanceWS.subscribe(sym, updatePrice))
    
    console.log(`🌐 WebSocket запущен, отслеживается ${symbolsToSubscribe.length} символов`)
    
    return () => {
      symbolsToSubscribe.forEach(sym => binanceWS.unsubscribe(sym, updatePrice))
    }
  }, [scalpingMode])

  useEffect(() => {
    if (autoTradeEnabled && apiConfigured && signals.length > 0) {
      const executeTrades = async () => {
        for (const signal of signals) {
          const cleanSymbol = signal.symbol.replace('/USDT', '')
          const existingPosition = positions.find(p => p.symbol === cleanSymbol)
          if (existingPosition) continue
          
          const maxPositionAmount = balance * (maxRiskPercent / 100)
          if (maxPositionAmount < 10) continue
          
          const qty = maxPositionAmount / signal.price
          const side = signal.action === 'buy' ? 'Buy' : 'Sell'
          
          try {
            const order = await bybitTestnet.placeOrder({
              symbol: cleanSymbol,
              side,
              qty: parseFloat(qty.toFixed(6)),
              price: signal.price
            })
            console.log(`✅ Ордер: ${side} ${signal.symbol}`)
          } catch (error: any) {
            console.error('❌ Ошибка:', error.message)
          }
        }
      }
      executeTrades()
    }
  }, [signals, autoTradeEnabled, apiConfigured, balance, maxRiskPercent, positions])

  const buys = signals.filter(s => s.action === 'buy').length
  const sells = signals.filter(s => s.action === 'sell').length
  const formattedCurrentTime = formatTime(currentTime)
  const maxPositionAmount = balance * (maxRiskPercent / 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-black">
      <header className="border-b border-red-500/30 bg-black/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">💀 AUTO TRADE PRO | {SYMBOLS.length} активов</h1>
          <div className="flex gap-4 items-center">
            <button onClick={toggleScalpingMode} className={`px-3 py-1 rounded-lg text-xs font-bold ${scalpingMode ? 'bg-yellow-600 text-black' : 'bg-gray-700 text-gray-300'}`}>
              {scalpingMode ? '⚡ СКАЛЬПИНГ' : '📈 СВИНГ'}
            </button>
            <div className="text-sm text-gray-400 font-mono">{formattedCurrentTime}</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/60 rounded-2xl p-5 border border-red-500/30"><div className="text-3xl font-bold text-red-400">{signals.length}</div><div className="text-gray-400 text-sm">Активных сигналов</div></div>
          <div className="bg-black/60 rounded-2xl p-5 border border-green-500/30"><div className="text-3xl font-bold text-green-500">{buys}</div><div className="text-gray-400 text-sm">BUY сигналов</div></div>
          <div className="bg-black/60 rounded-2xl p-5 border border-red-500/30"><div className="text-3xl font-bold text-red-500">{sells}</div><div className="text-gray-400 text-sm">SELL сигналов</div></div>
          <div className="bg-black/60 rounded-2xl p-5 border border-yellow-500/30"><div className="text-3xl font-bold text-yellow-500">{scalpingMode ? '⚡' : '📈'}</div><div className="text-gray-400 text-sm">Режим</div></div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-red-500/30 overflow-x-auto pb-0">
          <button onClick={() => setActiveTab('signals')} className={`px-5 py-2.5 font-medium rounded-t-lg ${activeTab === 'signals' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>🎯 Сигналы</button>
          <button onClick={() => setActiveTab('trading')} className={`px-5 py-2.5 font-medium rounded-t-lg ${activeTab === 'trading' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📈 График</button>
          <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 font-medium rounded-t-lg ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📜 История</button>
          <button onClick={() => setActiveTab('news')} className={`px-5 py-2.5 font-medium rounded-t-lg ${activeTab === 'news' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📰 Новости</button>
          <button onClick={() => setActiveTab('topmovers')} className={`px-5 py-2.5 font-medium rounded-t-lg ${activeTab === 'topmovers' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📊 Топ монет</button>
          <button onClick={() => setActiveTab('watchlist')} className={`px-5 py-2.5 font-medium rounded-t-lg ${activeTab === 'watchlist' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>⭐ Избранное</button>
          <button onClick={() => setActiveTab('autotrade')} className={`px-5 py-2.5 font-medium rounded-t-lg ${activeTab === 'autotrade' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>🤖 Автоторговля</button>
        </div>

        {activeTab === 'trading' && (
          <>
            <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-black/60 border border-red-500/50 rounded-lg px-4 py-2 text-white mb-4">
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <TradingChart symbol={selectedSymbol} />
          </>
        )}

        {activeTab === 'history' && <SignalHistory />}
        {activeTab === 'news' && <News />}
        {activeTab === 'topmovers' && <TopMovers />}
        {activeTab === 'watchlist' && <Watchlist />}

        {activeTab === 'autotrade' && (
          <div className="space-y-6">
            <div className="bg-black/60 rounded-2xl p-6 border border-red-500/30">
              <h3 className="text-xl font-bold text-red-400 mb-4">🤖 НАСТРОЙКА АВТОТОРГОВЛИ</h3>
              {!apiConfigured ? (
                <div className="space-y-4">
                  <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" className="w-full bg-black/50 border border-red-500/50 rounded-lg p-3 text-white" />
                  <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="API Secret" className="w-full bg-black/50 border border-red-500/50 rounded-lg p-3 text-white" />
                  <button onClick={saveApiKeys} className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg font-bold">Сохранить ключи</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-green-400">✅ API ключи настроены</div>
                    <button onClick={() => setAutoTradeEnabled(!autoTradeEnabled)} className={`px-4 py-2 rounded-lg font-bold ${autoTradeEnabled ? 'bg-red-600' : 'bg-green-600'}`}>
                      {autoTradeEnabled ? '🔴 ОСТАНОВИТЬ' : '🟢 ВКЛЮЧИТЬ'}
                    </button>
                    <button onClick={resetAccount} className="bg-yellow-600/50 px-4 py-2 rounded-lg">🔄 Сбросить счет</button>
                    {positions.length > 0 && <button onClick={closeAllPositions} className="bg-red-700/80 px-4 py-2 rounded-lg">🔒 ЗАКРЫТЬ ВСЕ ({positions.length})</button>}
                  </div>
                  {autoTradeEnabled && <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4"><p className="text-green-400 font-bold">🟢 АВТОТОРГОВЛЯ АКТИВНА!</p></div>}
                </div>
              )}
            </div>

            <div className="bg-black/60 rounded-2xl p-6 border border-red-500/30">
              <h3 className="text-lg font-bold text-red-400 mb-4">💰 НАСТРОЙКИ РИСКА</h3>
              <label className="block text-gray-400 text-sm mb-2">Максимальный процент на сделку: {maxRiskPercent}%</label>
              <input type="range" min="1" max="100" step="1" value={maxRiskPercent} onChange={(e) => {
                const val = parseFloat(e.target.value)
                setMaxRiskPercent(val)
                localStorage.setItem('max_risk_percent', val.toString())
              }} className="w-full accent-red-500" />
              <div className="mt-4 p-3 bg-red-950/30 rounded-lg">
                <div className="flex justify-between"><span className="text-gray-400">Баланс:</span><span className="text-white font-bold">${balance.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Макс. сумма на сделку:</span><span className="text-yellow-400 font-bold">${maxPositionAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Макс. риск (SL):</span><span className="text-red-400">${(maxPositionAmount * STOP_LOSS_PERCENT / 100).toLocaleString()}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-black/60 rounded-2xl p-6 border border-red-500/30"><h3 className="text-lg font-bold text-red-400 mb-3">💰 БАЛАНС</h3><div className="text-3xl font-bold text-white">${balance.toLocaleString()}</div></div>
              <div className="bg-black/60 rounded-2xl p-6 border border-red-500/30"><h3 className="text-lg font-bold text-red-400 mb-3">📊 ОТКРЫТЫЕ ПОЗИЦИИ</h3>{positions.length === 0 ? <div className="text-gray-500">Нет позиций</div> : positions.map((pos, idx) => (<div key={idx} className="border-b border-red-500/20 py-2">{pos.side} {pos.symbol} ${pos.price}</div>))}</div>
            </div>

            <div className="bg-black/60 rounded-2xl p-6 border border-red-500/30">
              <h3 className="text-lg font-bold text-red-400 mb-3">📜 ИСТОРИЯ СДЕЛОК</h3>
              <div className="max-h-[200px] overflow-y-auto">
                {tradeHistory.length === 0 ? <div className="text-gray-500 text-center py-4">Нет сделок</div> : tradeHistory.map((trade, idx) => (
                  <div key={idx} className="border-b border-red-500/20 py-2 flex justify-between items-center">
                    <span>{trade.side === 'Buy' ? '🟢' : '🔴'} {trade.symbol}</span>
                    <span>${trade.price}</span>
                    <span className={trade.profit && trade.profit > 0 ? 'text-green-400' : trade.profit && trade.profit < 0 ? 'text-red-400' : 'text-gray-400'}>
                      {trade.profit ? `${trade.profit > 0 ? '+' : ''}$${trade.profit.toFixed(2)}` : '—'}
                    </span>
                    <span className="text-gray-500 text-xs">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
              {tradeHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-red-500/30 grid grid-cols-3 gap-3 text-center">
                  <div><div className="text-gray-500 text-xs">Всего</div><div className="text-white font-bold text-lg">{tradeHistory.length}</div></div>
                  <div><div className="text-gray-500 text-xs">Профит</div><div className={`font-bold text-lg ${bybitTestnet.getTotalProfit() >= 0 ? 'text-green-400' : 'text-red-400'}`}>${bybitTestnet.getTotalProfit().toFixed(2)}</div></div>
                  <div><div className="text-gray-500 text-xs">Винрейт</div><div className="text-yellow-400 font-bold text-lg">{bybitTestnet.getWinRate().toFixed(1)}%</div></div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="bg-black/40 rounded-xl border border-red-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-red-950/30 border-b border-red-500/30">
              <div className="text-sm font-semibold text-red-300">🎯 {scalpingMode ? '⚡ СКАЛЬПИНГ' : '📈 СВИНГ'} | {SYMBOLS.length} активов</div>
            </div>
            <div className="divide-y divide-red-900/20">
              {signals.length === 0 ? (<div className="text-center text-gray-500 py-16">⏳ Нет сигналов</div>) : (signals.map((signal, idx) => {
                const stars = '★'.repeat(signal.strength) + '☆'.repeat(3 - signal.strength)
                return (
                  <div key={idx} className="p-5 hover:bg-red-900/10 cursor-pointer" onClick={() => openBybit(signal.symbol)}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xl">💰 {signal.symbol}</span>
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${signal.action === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {signal.action === 'buy' ? '🔥 BUY' : '💀 SELL'}
                      </span>
                      <span className="text-yellow-400">⚡ {stars}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-4 text-xs">
                      <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">RSI</div><div className="font-bold">{signal.indicators.rsi}</div></div>
                      <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">MACD</div><div className="text-white">{signal.indicators.macd > 0 ? '+' : ''}{signal.indicators.macd.toFixed(2)}</div></div>
                      <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">EMA20/50</div><div className="text-white text-xs">${signal.indicators.ema20.toFixed(0)}/${signal.indicators.ema50.toFixed(0)}</div></div>
                      <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">Цена</div><div className="text-white">${signal.price.toLocaleString()}</div></div>
                    </div>
                    <div className="mt-3 text-xs text-red-300">🎯 {signal.reasons.join(' • ')}</div>
                  </div>
                )
              }))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
