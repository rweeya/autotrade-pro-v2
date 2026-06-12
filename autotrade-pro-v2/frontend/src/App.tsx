import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import SignalHistory from './components/SignalHistory';
import News from './components/News';
import TopMovers from './components/TopMovers';
import Watchlist from './components/Watchlist';
import { createWebSocketManager, PriceData } from './services/websocket';

// ==================== 150+ РЕАЛЬНЫХ АКТИВОВ ====================
const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 
  'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'LTC/USDT', 'UNI/USDT', 'ATOM/USDT',
  'ETC/USDT', 'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'NEAR/USDT',
  'INJ/USDT', 'IMX/USDT', 'HBAR/USDT', 'VET/USDT', 'GRT/USDT', 'RNDR/USDT', 'MKR/USDT',
  'AAVE/USDT', 'SNX/USDT', 'CRV/USDT', 'ALGO/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT',
  'GALA/USDT', 'AXS/USDT', 'ENJ/USDT', 'CHZ/USDT', 'THETA/USDT', 'EOS/USDT', 'XTZ/USDT',
  'KSM/USDT', 'ZEC/USDT', 'DASH/USDT', 'COMP/USDT', 'ZIL/USDT', 'BAT/USDT', 'ZRX/USDT',
  'ICP/USDT', 'STX/USDT', 'KAS/USDT', 'RUNE/USDT', 'EGLD/USDT', 'FLOW/USDT', 'WAVES/USDT',
  'NEO/USDT', 'IOTA/USDT', 'ONE/USDT', 'HOT/USDT', 'CRO/USDT', 'CELO/USDT', 'ROSE/USDT',
  'KLAY/USDT', 'CKB/USDT', 'ERG/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'FLOKI/USDT',
  'SHIB/USDT', 'SEI/USDT', 'TIA/USDT', 'PYTH/USDT', 'JUP/USDT', 'ONDO/USDT', 'WLD/USDT',
  'FET/USDT', 'LDO/USDT', 'BLUR/USDT', 'CAKE/USDT', 'XVS/USDT'
];

interface Signal {
  id: string;
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  timestamp: number;
  strength: 1 | 2 | 3;
  rsi: number;
  macd: number;
  ema20: number;
  ema50: number;
  reasons: string[];
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryTime: number;
  exitTime: number | null;
  profit: number | null;
  profitPercent: number | null;
  status: 'open' | 'closed';
  tpPrice: number;
  slPrice: number;
}

const App: React.FC = () => {
  // ==================== СОСТОЯНИЯ ====================
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'signals');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('balance');
    return saved ? parseFloat(saved) : 10000;
  });
  const [totalProfit, setTotalProfit] = useState(() => {
    const saved = localStorage.getItem('totalProfit');
    return saved ? parseFloat(saved) : 0;
  });
  const [winRate, setWinRate] = useState(0);
  const [autoTrade, setAutoTrade] = useState(() => localStorage.getItem('autoTrade') === 'true');
  const [riskPercent, setRiskPercent] = useState(() => {
    const saved = localStorage.getItem('riskPercent');
    return saved ? parseFloat(saved) : 5;
  });
  const [signals, setSignals] = useState<Signal[]>(() => {
    const saved = localStorage.getItem('signals');
    return saved ? JSON.parse(saved) : [];
  });
  const [trades, setTrades] = useState<Trade[]>(() => {
    const saved = localStorage.getItem('trades');
    return saved ? JSON.parse(saved) : [];
  });
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wsConnectedCount, setWsConnectedCount] = useState(0);
  const [lastSignalTime, setLastSignalTime] = useState<Map<string, number>>(new Map());

  // Refs
  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const wsRef = useRef<any>(null);
  const connectedRef = useRef<Set<string>>(new Set());
  const processingTradeRef = useRef<Set<string>>(new Set());

  // ==================== ХЕЛПЕРЫ ====================
  const formatNumber = (num: number) => num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPrice = (price: number) => price.toFixed(4);
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  // Сохранение в localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('balance', balance.toString());
  }, [balance]);

  useEffect(() => {
    localStorage.setItem('totalProfit', totalProfit.toString());
  }, [totalProfit]);

  useEffect(() => {
    localStorage.setItem('autoTrade', autoTrade.toString());
  }, [autoTrade]);

  useEffect(() => {
    localStorage.setItem('riskPercent', riskPercent.toString());
  }, [riskPercent]);

  useEffect(() => {
    localStorage.setItem('signals', JSON.stringify(signals.slice(0, 100)));
  }, [signals]);

  useEffect(() => {
    localStorage.setItem('trades', JSON.stringify(trades));
  }, [trades]);

  // Расчёт винрейта
  useEffect(() => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.profit !== null);
    if (closedTrades.length === 0) {
      setWinRate(0);
      return;
    }
    const wins = closedTrades.filter(t => (t.profit || 0) > 0).length;
    setWinRate((wins / closedTrades.length) * 100);
  }, [trades]);

  // Таймер
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== ТЕХНИЧЕСКИЕ ИНДИКАТОРЫ ====================
  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    const recentPrices = prices.slice(-period - 1);
    
    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i] - recentPrices[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const calculateEMA = (prices: number[], period: number): number => {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  };

  const calculateMACD = (prices: number[]): number => {
    if (prices.length < 26) return 0;
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    return ema12 - ema26;
  };

  // ==================== ГЕНЕРАЦИЯ СИГНАЛОВ ====================
  const generateSignal = (symbol: string, currentPrice: number): Signal | null => {
    const history = priceHistoryRef.current.get(symbol);
    if (!history || history.length < 50) return null;
    
    const rsi = calculateRSI(history);
    const macd = calculateMACD(history);
    const ema20 = calculateEMA(history, 20);
    const ema50 = calculateEMA(history, 50);
    
    // Проверка на слишком частые сигналы (раз в 3 минуты)
    const lastSignal = lastSignalTime.get(symbol);
    if (lastSignal && Date.now() - lastSignal < 180000) return null;
    
    // ЖЁСТКИЕ УСЛОВИЯ ДЛЯ BUY
    if (rsi < 30 && macd > 0 && ema20 > ema50) {
      setLastSignalTime(prev => new Map(prev).set(symbol, Date.now()));
      return {
        id: `${symbol}_${Date.now()}`,
        symbol,
        action: 'buy',
        price: currentPrice,
        timestamp: Date.now(),
        strength: rsi < 20 ? 3 : 2,
        rsi,
        macd,
        ema20,
        ema50,
        reasons: [`RSI ${rsi.toFixed(1)} < 30`, `MACD бычий`, `EMA20 > EMA50`]
      };
    }
    
    // ЖЁСТКИЕ УСЛОВИЯ ДЛЯ SELL
    if (rsi > 70 && macd < 0 && ema20 < ema50) {
      setLastSignalTime(prev => new Map(prev).set(symbol, Date.now()));
      return {
        id: `${symbol}_${Date.now()}`,
        symbol,
        action: 'sell',
        price: currentPrice,
        timestamp: Date.now(),
        strength: rsi > 80 ? 3 : 2,
        rsi,
        macd,
        ema20,
        ema50,
        reasons: [`RSI ${rsi.toFixed(1)} > 70`, `MACD медвежий`, `EMA20 < EMA50`]
      };
    }
    
    return null;
  };

  // ==================== ИСПОЛНЕНИЕ СДЕЛКИ ====================
  const executeTrade = (signal: Signal) => {
    if (!autoTrade) return;
    
    // Защита от дублей
    if (processingTradeRef.current.has(signal.symbol)) return;
    processingTradeRef.current.add(signal.symbol);
    
    try {
      // Проверка на уже открытую позицию
      const openTrade = trades.find(t => t.symbol === signal.symbol && t.status === 'open');
      if (openTrade) {
        processingTradeRef.current.delete(signal.symbol);
        return;
      }
      
      // Расчёт размера позиции
      const riskAmount = Math.min(balance * (riskPercent / 100), balance);
      if (riskAmount <= 0 || riskAmount > balance) {
        processingTradeRef.current.delete(signal.symbol);
        return;
      }
      
      const quantity = riskAmount / signal.price;
      const roundedQty = Math.floor(quantity * 1000) / 1000;
      
      if (roundedQty <= 0) {
        processingTradeRef.current.delete(signal.symbol);
        return;
      }
      
      // Расчёт TP/SL
      const tpPercent = 3;
      const slPercent = 2;
      const tpPrice = signal.action === 'buy' ? signal.price * (1 + tpPercent / 100) : signal.price * (1 - tpPercent / 100);
      const slPrice = signal.action === 'buy' ? signal.price * (1 - slPercent / 100) : signal.price * (1 + slPercent / 100);
      
      // Создаём сделку
      const newTrade: Trade = {
        id: `${signal.symbol}_${Date.now()}`,
        symbol: signal.symbol,
        side: signal.action,
        entryPrice: signal.price,
        exitPrice: null,
        quantity: roundedQty,
        entryTime: Date.now(),
        exitTime: null,
        profit: null,
        profitPercent: null,
        status: 'open',
        tpPrice,
        slPrice
      };
      
      setTrades(prev => [...prev, newTrade]);
      
      console.log(`✅ ОТКРЫТА: ${signal.action.toUpperCase()} ${signal.symbol} | ${roundedQty} @ $${signal.price}`);
    } finally {
      setTimeout(() => {
        processingTradeRef.current.delete(signal.symbol);
      }, 1000);
    }
  };

  // ==================== ЗАКРЫТИЕ СДЕЛКИ ====================
  const closeTrade = (trade: Trade, currentPrice: number, reason: 'TP' | 'SL' | 'manual') => {
    // Расчёт прибыли
    let profit = 0;
    let profitPercent = 0;
    const investedAmount = trade.entryPrice * trade.quantity;
    
    if (trade.side === 'buy') {
      profit = (currentPrice - trade.entryPrice) * trade.quantity;
      profitPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
    } else {
      profit = (trade.entryPrice - currentPrice) * trade.quantity;
      profitPercent = ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
    }
    
    // Обновляем баланс (возвращаем инвестированную сумму + прибыль)
    const newBalance = balance + investedAmount + profit;
    const newTotalProfit = totalProfit + profit;
    
    setBalance(newBalance);
    setTotalProfit(newTotalProfit);
    
    // Обновляем сделку
    setTrades(prev => prev.map(t => 
      t.id === trade.id 
        ? { ...t, status: 'closed', exitPrice: currentPrice, exitTime: Date.now(), profit, profitPercent }
        : t
    ));
    
    console.log(`📉 ЗАКРЫТА: ${trade.symbol} | ${reason} | PnL: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`);
  };

  // ==================== МОНИТОРИНГ TP/SL ====================
  useEffect(() => {
    const checkTPandSL = () => {
      const openTrades = trades.filter(t => t.status === 'open');
      
      for (const trade of openTrades) {
        const currentPrice = prices.get(trade.symbol);
        if (!currentPrice) continue;
        
        if (trade.side === 'buy') {
          if (currentPrice >= trade.tpPrice) {
            closeTrade(trade, currentPrice, 'TP');
          } else if (currentPrice <= trade.slPrice) {
            closeTrade(trade, currentPrice, 'SL');
          }
        } else {
          if (currentPrice <= trade.tpPrice) {
            closeTrade(trade, currentPrice, 'TP');
          } else if (currentPrice >= trade.slPrice) {
            closeTrade(trade, currentPrice, 'SL');
          }
        }
      }
    };
    
    const interval = setInterval(checkTPandSL, 1000);
    return () => clearInterval(interval);
  }, [trades, prices, balance, totalProfit]);

  // ==================== ОБНОВЛЕНИЕ ЦЕН ====================
  const updatePrice = useCallback((symbol: string, price: number) => {
    setPrices(prev => new Map(prev).set(symbol, price));
    
    // Обновляем историю
    let history = priceHistoryRef.current.get(symbol) || [];
    history.push(price);
    if (history.length > 200) history = history.slice(-200);
    priceHistoryRef.current.set(symbol, history);
    
    // Генерируем сигнал
    const signal = generateSignal(symbol, price);
    if (signal) {
      setSignals(prev => [signal, ...prev].slice(0, 100));
      if (autoTrade) {
        executeTrade(signal);
      }
    }
  }, [autoTrade]);

  // ==================== WEBSOCKET ====================
  useEffect(() => {
    console.log(`🚀 Запуск WebSocket для ${SYMBOLS.length} символов...`);
    const wsManager = createWebSocketManager();
    wsRef.current = wsManager;
    
    let connected = 0;
    SYMBOLS.forEach(symbol => {
      wsManager.subscribe(symbol, (data: PriceData) => {
        if (!connectedRef.current.has(symbol)) {
          connectedRef.current.add(symbol);
          connected++;
          setWsConnectedCount(connected);
        }
        updatePrice(symbol, data.price);
      });
    });
    
    return () => {
      wsManager.disconnect();
    };
  }, [updatePrice]);

  // ==================== СТАТИСТИКА ====================
  const closedTrades = trades.filter(t => t.status === 'closed');
  const openTrades = trades.filter(t => t.status === 'open');
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0).length;
  const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0).length;
  const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.profit || 0)) : 0;
  const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.profit || 0)) : 0;
  const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

  // ==================== ОЧИСТКА ИСТОРИИ ====================
  const clearHistory = () => {
    if (window.confirm('Очистить всю историю сделок и сигналов?')) {
      setTrades([]);
      setSignals([]);
      setTotalProfit(0);
      localStorage.removeItem('trades');
      localStorage.removeItem('signals');
      alert('✅ История очищена');
    }
  };

  const resetBalance = () => {
    if (window.confirm('Сбросить баланс до $10,000?')) {
      setBalance(10000);
      setTotalProfit(0);
      setTrades([]);
      setSignals([]);
      localStorage.removeItem('trades');
      localStorage.removeItem('signals');
      alert('✅ Баланс сброшен до $10,000');
    }
  };

  // ==================== ОТКРЫТИЕ BYBIT (КОПИРОВАНИЕ СИМВОЛА) ====================
  const openBybit = (symbol: string) => {
    const cleanSymbol = symbol.replace('/', '');
    navigator.clipboard.writeText(cleanSymbol);
    
    // Показываем уведомление
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse';
    notification.innerHTML = `✅ ${cleanSymbol} скопирован! Вставь в поиск Bybit (Ctrl+V)`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
    
    // Открываем Bybit в новой вкладке
    window.open('https://www.bybit.com', '_blank');
  };

  // ==================== РЕНДЕР ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/30 to-black">
      <header className="relative z-20 border-b border-red-500/30 bg-black/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">💀</div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className="text-xs text-gray-500">{SYMBOLS.length} активов | RSI 30/70 | TP 3% | SL 2%</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-gray-400">Баланс</div>
                <div className="text-xl font-bold text-green-400">${formatNumber(balance)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Общий PnL</div>
                <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalProfit >= 0 ? '+' : ''}{formatNumber(totalProfit)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Винрейт</div>
                <div className="text-xl font-bold text-yellow-400">{winRate.toFixed(1)}%</div>
              </div>
              <div className="w-px h-10 bg-red-500/30" />
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnectedCount === SYMBOLS.length ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-xs text-gray-400">WebSocket: {wsConnectedCount}/{SYMBOLS.length}</span>
              </div>
              <div className="text-sm text-gray-500 font-mono">{currentTime.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-6 py-6">
        {/* СТАТИСТИКА */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-black/60 backdrop-blur rounded-2xl p-4 border border-red-500/30">
            <div className="text-gray-400 text-sm">Всего сигналов</div>
            <div className="text-2xl font-bold text-red-400">{signals.length}</div>
          </div>
          <div className="bg-black/60 backdrop-blur rounded-2xl p-4 border border-green-500/30">
            <div className="text-gray-400 text-sm">BUY сигналов</div>
            <div className="text-2xl font-bold text-green-400">{signals.filter(s => s.action === 'buy').length}</div>
          </div>
          <div className="bg-black/60 backdrop-blur rounded-2xl p-4 border border-red-500/30">
            <div className="text-gray-400 text-sm">SELL сигналов</div>
            <div className="text-2xl font-bold text-red-400">{signals.filter(s => s.action === 'sell').length}</div>
          </div>
          <div className="bg-black/60 backdrop-blur rounded-2xl p-4 border border-yellow-500/30">
            <div className="text-gray-400 text-sm">Открытых позиций</div>
            <div className="text-2xl font-bold text-yellow-400">{openTrades.length}</div>
          </div>
          <div className="bg-black/60 backdrop-blur rounded-2xl p-4 border border-blue-500/30">
            <div className="text-gray-400 text-sm">Закрытых сделок</div>
            <div className="text-2xl font-bold text-blue-400">{totalTrades}</div>
          </div>
        </div>

        {/* РАСШИРЕННАЯ СТАТИСТИКА */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 backdrop-blur rounded-xl p-3 border border-gray-700">
            <div className="text-gray-500 text-xs">Побед / Поражений</div>
            <div className="text-lg font-bold">
              <span className="text-green-400">{winningTrades}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-red-400">{losingTrades}</span>
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur rounded-xl p-3 border border-gray-700">
            <div className="text-gray-500 text-xs">Лучшая / Худшая сделка</div>
            <div className="text-lg font-bold">
              <span className="text-green-400">+${formatNumber(bestTrade)}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-red-400">${formatNumber(worstTrade)}</span>
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur rounded-xl p-3 border border-gray-700">
            <div className="text-gray-500 text-xs">Средний профит</div>
            <div className={`text-lg font-bold ${avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {avgProfit >= 0 ? '+' : ''}{formatNumber(avgProfit)}
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur rounded-xl p-3 border border-gray-700">
            <div className="text-gray-500 text-xs">Риск на сделку</div>
            <div className="text-lg font-bold text-yellow-400">{riskPercent}%</div>
          </div>
        </div>

        {/* ТАБЫ */}
        <div className="flex gap-1 mb-6 border-b border-red-500/30 overflow-x-auto">
          <button onClick={() => setActiveTab('signals')} className={`px-5 py-2.5 font-medium rounded-t-lg transition ${activeTab === 'signals' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>🎯 Сигналы</button>
          <button onClick={() => setActiveTab('trading')} className={`px-5 py-2.5 font-medium rounded-t-lg transition ${activeTab === 'trading' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📈 График</button>
          <button onClick={() => setActiveTab('positions')} className={`px-5 py-2.5 font-medium rounded-t-lg transition ${activeTab === 'positions' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📊 Позиции</button>
          <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 font-medium rounded-t-lg transition ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📜 История</button>
          <button onClick={() => setActiveTab('settings')} className={`px-5 py-2.5 font-medium rounded-t-lg transition ${activeTab === 'settings' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>⚙️ Настройки</button>
        </div>

        {/* ВКЛАДКА ТОРГОВЛИ */}
        {activeTab === 'trading' && (
          <div className="bg-black/40 backdrop-blur rounded-xl p-4 border border-red-500/20">
            <div className="flex gap-4 mb-4">
              <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-black/60 border border-red-500/50 rounded-lg px-4 py-2 text-white">
                {SYMBOLS.slice(0, 50).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="text-right ml-auto">
                <div className="text-xs text-gray-500">Текущая цена</div>
                <div className="text-2xl font-bold text-green-400">${formatPrice(prices.get(selectedSymbol) || 0)}</div>
              </div>
            </div>
            <TradingChart symbol={selectedSymbol} />
          </div>
        )}

        {/* ВКЛАДКА ПОЗИЦИЙ */}
        {activeTab === 'positions' && (
          <div className="bg-black/40 backdrop-blur rounded-xl border border-red-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-red-950/30 border-b border-red-500/30">
              <h3 className="font-bold text-red-400">📊 ОТКРЫТЫЕ ПОЗИЦИИ ({openTrades.length})</h3>
            </div>
            <div className="overflow-x-auto">
              {openTrades.length === 0 ? (
                <div className="text-center text-gray-500 py-12">Нет открытых позиций</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-black/40 text-gray-400">
                    <tr>
                      <th className="text-left p-3">МОНЕТА</th>
                      <th className="text-left p-3">ТИП</th>
                      <th className="text-right p-3">ЦЕНА ВХ.</th>
                      <th className="text-right p-3">КОЛ-ВО</th>
                      <th className="text-right p-3">TP (3%)</th>
                      <th className="text-right p-3">SL (2%)</th>
                      <th className="text-right p-3">ТЕКУЩИЙ P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openTrades.map(trade => {
                      const currentPrice = prices.get(trade.symbol) || trade.entryPrice;
                      const currentPnL = trade.side === 'buy' 
                        ? (currentPrice - trade.entryPrice) * trade.quantity
                        : (trade.entryPrice - currentPrice) * trade.quantity;
                      const currentPnLPercent = (currentPnL / (trade.entryPrice * trade.quantity)) * 100;
                      return (
                        <tr key={trade.id} className="border-b border-gray-800 hover:bg-red-900/10">
                          <td className="p-3 font-bold">{trade.symbol}</td>
                          <td className={`p-3 ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{trade.side === 'buy' ? 'BUY' : 'SELL'}</td>
                          <td className="p-3 text-right">${formatPrice(trade.entryPrice)}</td>
                          <td className="p-3 text-right">{trade.quantity.toFixed(4)}</td>
                          <td className="p-3 text-right text-green-400">${formatPrice(trade.tpPrice)}</td>
                          <td className="p-3 text-right text-red-400">${formatPrice(trade.slPrice)}</td>
                          <td className={`p-3 text-right font-bold ${currentPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {currentPnL >= 0 ? '+' : ''}{formatNumber(currentPnL)} ({currentPnLPercent.toFixed(2)}%)
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ВКЛАДКА ИСТОРИИ */}
        {activeTab === 'history' && (
          <div className="bg-black/40 backdrop-blur rounded-xl border border-red-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-red-950/30 border-b border-red-500/30 flex justify-between items-center">
              <h3 className="font-bold text-red-400">📜 ИСТОРИЯ СДЕЛОК ({totalTrades})</h3>
              <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300">Очистить историю</button>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              {totalTrades === 0 ? (
                <div className="text-center text-gray-500 py-12">Нет закрытых сделок</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-black/40 text-gray-400 sticky top-0">
                    <tr>
                      <th className="text-left p-3">МОНЕТА</th>
                      <th className="text-left p-3">ТИП</th>
                      <th className="text-right p-3">ЦЕНА ВХ.</th>
                      <th className="text-right p-3">ЦЕНА ВЫХ.</th>
                      <th className="text-right p-3">PnL</th>
                      <th className="text-right p-3">%</th>
                      <th className="text-right p-3">ВРЕМЯ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedTrades.slice().reverse().map(trade => (
                      <tr key={trade.id} className="border-b border-gray-800 hover:bg-red-900/10">
                        <td className="p-3 font-bold">{trade.symbol}</td>
                        <td className={`p-3 ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{trade.side === 'buy' ? 'BUY' : 'SELL'}</td>
                        <td className="p-3 text-right">${formatPrice(trade.entryPrice)}</td>
                        <td className="p-3 text-right">${formatPrice(trade.exitPrice || 0)}</td>
                        <td className={`p-3 text-right font-bold ${(trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(trade.profit || 0) >= 0 ? '+' : ''}{formatNumber(trade.profit || 0)}
                        </td>
                        <td className={`p-3 text-right ${(trade.profitPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(trade.profitPercent || 0) >= 0 ? '+' : ''}{(trade.profitPercent || 0).toFixed(2)}%
                        </td>
                        <td className="p-3 text-right text-gray-500 text-xs">{formatTime(trade.entryTime)}</td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ВКЛАДКА НАСТРОЕК */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/40 backdrop-blur rounded-xl p-6 border border-red-500/20">
              <h3 className="text-lg font-bold text-red-400 mb-4">🤖 АВТОТОРГОВЛЯ</h3>
              <button onClick={() => setAutoTrade(!autoTrade)} className={`w-full px-4 py-3 rounded-lg font-bold transition ${autoTrade ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {autoTrade ? '🔴 ОСТАНОВИТЬ АВТОТОРГОВЛЮ' : '🟢 ЗАПУСТИТЬ АВТОТОРГОВЛЮ'}
              </button>
              {autoTrade && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <p className="text-green-400 font-bold text-sm">✅ АВТОТОРГОВЛЯ АКТИВНА</p>
                  <p className="text-gray-400 text-xs mt-1">RSI &lt; 30 → BUY | RSI &gt; 70 → SELL | TP 3% / SL 2%</p>
                </div>
              )}
            </div>

            <div className="bg-black/40 backdrop-blur rounded-xl p-6 border border-red-500/20">
              <h3 className="text-lg font-bold text-red-400 mb-4">💰 УПРАВЛЕНИЕ РИСКАМИ</h3>
              <label className="block text-sm text-gray-400 mb-2">Риск на сделку: {riskPercent}%</label>
              <input type="range" min="1" max="10" step="0.5" value={riskPercent} onChange={(e) => setRiskPercent(parseFloat(e.target.value))} className="w-full accent-red-500" />
              <div className="mt-4 p-3 bg-red-950/30 rounded-lg text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Баланс:</span><span className="text-white">${formatNumber(balance)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Макс. сумма на сделку:</span><span className="text-yellow-400">${formatNumber(balance * riskPercent / 100)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Stop Loss (2%):</span><span className="text-red-400">${formatNumber(balance * riskPercent / 100 * 0.02)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Take Profit (3%):</span><span className="text-green-400">${formatNumber(balance * riskPercent / 100 * 0.03)}</span></div>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur rounded-xl p-6 border border-red-500/20">
              <h3 className="text-lg font-bold text-red-400 mb-4">⚙️ УПРАВЛЕНИЕ СЧЕТОМ</h3>
              <button onClick={resetBalance} className="w-full px-4 py-2 bg-yellow-600/50 hover:bg-yellow-600 rounded-lg transition mb-3">🔄 Сбросить баланс до $10,000</button>
              <button onClick={clearHistory} className="w-full px-4 py-2 bg-red-600/50 hover:bg-red-600 rounded-lg transition">🗑️ Очистить историю сделок</button>
            </div>

            <div className="bg-black/40 backdrop-blur rounded-xl p-6 border border-red-500/20">
              <h3 className="text-lg font-bold text-red-400 mb-4">ℹ️ СТАТУС</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">WebSocket:</span><span className={wsConnectedCount === SYMBOLS.length ? 'text-green-400' : 'text-yellow-400'}>{wsConnectedCount}/{SYMBOLS.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Открыто позиций:</span><span className="text-yellow-400">{openTrades.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Сигналов за сессию:</span><span className="text-red-400">{signals.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Винрейт:</span><span className="text-green-400">{winRate.toFixed(1)}%</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА СИГНАЛОВ */}
        {activeTab === 'signals' && (
          <div className="space-y-3">
            {signals.length === 0 ? (
              <div className="bg-black/40 backdrop-blur rounded-xl p-12 text-center border border-red-500/20">
                <div className="text-6xl mb-4">⏳</div>
                <div className="text-gray-400">Нет сигналов. Ожидаем условия RSI &lt; 30 или RSI &gt; 70...</div>
                <div className="text-xs text-gray-600 mt-2">WebSocket подключен к {wsConnectedCount} из {SYMBOLS.length} активов</div>
              </div>
            ) : (
              signals.map((signal, idx) => {
                const stars = '★'.repeat(signal.strength) + '☆'.repeat(3 - signal.strength);
                return (
                  <div key={idx} onClick={() => openBybit(signal.symbol)} className="bg-gradient-to-r from-black/60 to-red-900/20 backdrop-blur rounded-xl p-4 border border-red-500/30 hover:border-red-500/50 cursor-pointer transition group">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{signal.action === 'buy' ? '🟢' : '🔴'}</span>
                        <div>
                          <div className="font-bold text-lg">{signal.symbol}</div>
                          <div className="text-xs text-gray-500">{formatTime(signal.timestamp)}</div>
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-lg text-sm font-bold ${signal.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {signal.action === 'buy' ? 'BUY' : 'SELL'} @ ${formatPrice(signal.price)}
                      </div>
                      <div className="text-yellow-400 text-sm group-hover:scale-110 transition">{stars}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                      <div className="bg-black/50 rounded-lg p-2 text-center">
                        <div className="text-gray-500">RSI</div>
                        <div className={`font-bold ${signal.rsi < 30 ? 'text-green-400' : signal.rsi > 70 ? 'text-red-400' : 'text-white'}`}>{signal.rsi.toFixed(1)}</div>
                      </div>
                      <div className="bg-black/50 rounded-lg p-2 text-center">
                        <div className="text-gray-500">MACD</div>
                        <div className={`font-mono ${signal.macd > 0 ? 'text-green-400' : 'text-red-400'}`}>{signal.macd > 0 ? '+' : ''}{signal.macd.toFixed(4)}</div>
                      </div>
                      <div className="bg-black/50 rounded-lg p-2 text-center">
                        <div className="text-gray-500">EMA 20/50</div>
                        <div className={`font-mono text-xs ${signal.ema20 > signal.ema50 ? 'text-green-400' : 'text-red-400'}`}>{signal.ema20.toFixed(0)} / {signal.ema50.toFixed(0)}</div>
                      </div>
                      <div className="bg-black/50 rounded-lg p-2 text-center">
                        <div className="text-gray-500">Сила</div>
                        <div className="text-yellow-400">{stars}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-red-400 flex gap-2 flex-wrap">
                      {signal.reasons.map((reason, i) => (
                        <span key={i} className="bg-red-950/30 px-2 py-0.5 rounded">🎯 {reason}</span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
