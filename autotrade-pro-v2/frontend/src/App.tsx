import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import SignalHistory from './components/SignalHistory';
import News from './components/News';
import TopMovers from './components/TopMovers';
import Watchlist from './components/Watchlist';
import { createWebSocketManager, PriceData } from './services/websocket';

const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT',
  'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'LTC/USDT', 'UNI/USDT', 'ATOM/USDT',
  'ETC/USDT', 'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'NEAR/USDT',
  'INJ/USDT', 'IMX/USDT', 'HBAR/USDT', 'VET/USDT', 'GRT/USDT', 'RNDR/USDT', 'MKR/USDT',
  'AAVE/USDT', 'ALGO/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT', 'AXS/USDT',
  'CHZ/USDT', 'EOS/USDT', 'KSM/USDT', 'ZEC/USDT', 'COMP/USDT', 'ZIL/USDT', 'BAT/USDT',
  'ICP/USDT', 'STX/USDT', 'KAS/USDT', 'RUNE/USDT', 'EGLD/USDT', 'FLOW/USDT', 'WAVES/USDT',
  'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'FLOKI/USDT', 'SHIB/USDT', 'SEI/USDT', 'WLD/USDT'
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
  adx: number;
  atr: number;
  reasons: string[];
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  invested: number;
  entryTime: number;
  exitTime: number | null;
  profit: number | null;
  profitPercent: number | null;
  status: 'open' | 'closed';
  tpPrice: number;
  slPrice: number;
  breakevenActivated: boolean;
}

const TP_PERCENT = 1.5;
const SL_PERCENT = 0.8;
const BREAKEVEN_TRIGGER = 1.0;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('signals');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [balance, setBalance] = useState(10000);
  const [totalProfit, setTotalProfit] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [autoTrade, setAutoTrade] = useState(false);
  const [riskPercent, setRiskPercent] = useState(5);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wsConnectedCount, setWsConnectedCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [equityHistory, setEquityHistory] = useState<{ time: number; value: number }[]>(() => {
    const now = Date.now();
    return [{ time: now, value: 10000 }];
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? saved === 'true' : true;
  });

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const wsRef = useRef<any>(null);
  const connectedRef = useRef<Set<string>>(new Set());
  const lastTradeTimeForSymbol = useRef<Map<string, number>>(new Map());
  const lastSignalTimeForSymbol = useRef<Map<string, number>>(new Map());
  const autoTradeRef = useRef(autoTrade);
  const balanceRef = useRef(balance);
  const riskPercentRef = useRef(riskPercent);
  const tradesRef = useRef(trades);

  useEffect(() => { autoTradeRef.current = autoTrade; }, [autoTrade]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { riskPercentRef.current = riskPercent; }, [riskPercent]);
  useEffect(() => { tradesRef.current = trades; }, [trades]);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const currentEquity = balance + totalProfit;
    setEquityHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.value === currentEquity) return prev;
      const updated = [...prev, { time: Date.now(), value: currentEquity }];
      return updated.slice(-100);
    });
  }, [balance, totalProfit]);

  const formatNumber = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatPrice = (price: number) => {
    if (price === undefined || price === null || isNaN(price)) return '0.0000';
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };
  const formatTime = (timestamp: number) => {
    if (!timestamp) return '--:--:--';
    return new Date(timestamp).toLocaleTimeString();
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.profit !== null);
    if (closedTrades.length === 0) {
      setWinRate(0);
      return;
    }
    const wins = closedTrades.filter(t => (t.profit || 0) > 0).length;
    setWinRate((wins / closedTrades.length) * 100);
  }, [trades]);

  // ==================== ИНДИКАТОРЫ ====================
  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (!prices || prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    return Math.round(100 - (100 / (1 + avgGain / avgLoss)));
  };

  const calculateEMA = (prices: number[], period: number): number => {
    if (!prices || prices.length < period) return prices?.[prices.length - 1] || 0;
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  };

  const calculateMACD = (prices: number[]): number => {
    if (!prices || prices.length < 35) return 0;
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    return parseFloat((ema12 - ema26).toFixed(4));
  };

  const calculateADX = (prices: number[], period: number = 14): number => {
    if (!prices || prices.length < period * 2) return 0;
    const tr: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const h = Math.max(prices[i], prices[i - 1]);
      const l = Math.min(prices[i], prices[i - 1]);
      const pH = Math.max(prices[i - 1], prices[i - 2] || prices[i - 1]);
      const pL = Math.min(prices[i - 1], prices[i - 2] || prices[i - 1]);
      const pC = prices[i - 1];
      tr.push(Math.max(h - l, Math.abs(h - pC), Math.abs(l - pC)));
      const up = h - pH;
      const down = pL - l;
      plusDM.push(up > down && up > 0 ? up : 0);
      minusDM.push(down > up && down > 0 ? down : 0);
    }
    const smooth = (d: number[]): number => {
      const k = 2 / (period + 1);
      let e = d[0];
      for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k);
      return e;
    };
    const atrVal = smooth(tr);
    if (atrVal === 0) return 0;
    const plusDI = (smooth(plusDM) / atrVal) * 100;
    const minusDI = (smooth(minusDM) / atrVal) * 100;
    return Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  };

  const calculateATR = (prices: number[], period: number = 14): number => {
    if (!prices || prices.length < period + 1) return (prices?.[prices.length - 1] || 1) * 0.01;
    const tr: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      tr.push(Math.abs(prices[i] - prices[i - 1]));
    }
    let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < tr.length; i++) {
      atr = (atr * (period - 1) + tr[i]) / period;
    }
    const minATR = prices[prices.length - 1] * 0.01;
    return Math.max(atr, minATR);
  };

  // ==================== ГЕНЕРАЦИЯ СИГНАЛОВ ====================
  const generateSignal = (symbol: string, currentPrice: number): Signal | null => {
    if (!currentPrice || currentPrice <= 0) return null;
    
    const history = priceHistoryRef.current.get(symbol);
    if (!history || history.length < 50) return null;

    const lastSignal = lastSignalTimeForSymbol.current.get(symbol);
    if (lastSignal && Date.now() - lastSignal < 60000) return null;

    const rsi = calculateRSI(history);
    const macd = calculateMACD(history);
    const ema20 = calculateEMA(history, 20);
    const ema50 = calculateEMA(history, 50);
    const adx = calculateADX(history);
    const atr = calculateATR(history);

    if (adx < 25) return null;

    let action: 'buy' | 'sell' | null = null;
    let reasons: string[] = [];

    if (rsi < 35 && macd > 0 && ema20 > ema50) {
      action = 'buy';
      reasons = [`RSI ${rsi} < 35`, `ADX ${adx.toFixed(0)}`, `MACD↑`, `EMA20>EMA50`];
    } else if (rsi > 65 && macd < 0 && ema20 < ema50) {
      action = 'sell';
      reasons = [`RSI ${rsi} > 65`, `ADX ${adx.toFixed(0)}`, `MACD↓`, `EMA20<EMA50`];
    }

    if (!action) return null;

    lastSignalTimeForSymbol.current.set(symbol, Date.now());
    const strength = (rsi < 25 || rsi > 75) ? 3 : (rsi < 30 || rsi > 70) ? 2 : 1;

    return {
      id: `${symbol}_${Date.now()}_${Math.random()}`,
      symbol,
      action,
      price: currentPrice,
      timestamp: Date.now(),
      strength: strength as 1 | 2 | 3,
      rsi,
      macd,
      ema20,
      ema50,
      adx,
      atr,
      reasons
    };
  };

  // ==================== ТОРГОВЛЯ ====================
  const executeTrade = useCallback((signal: Signal) => {
    if (!autoTradeRef.current) return;
    if (!signal || !signal.price) return;

    const currentTrades = tradesRef.current;
    const currentBalance = balanceRef.current;
    const currentRiskPercent = riskPercentRef.current;

    const openTrade = currentTrades.find(t => t.symbol === signal.symbol && t.status === 'open');
    if (openTrade) {
      console.log(`⏭️ ${signal.symbol} уже в позиции`);
      return;
    }

    const lastTrade = lastTradeTimeForSymbol.current.get(signal.symbol);
    if (lastTrade && Date.now() - lastTrade < 60000) {
      console.log(`⏳ Кулдаун сделки для ${signal.symbol}`);
      return;
    }

    const riskAmount = currentBalance * (currentRiskPercent / 100);
    if (riskAmount <= 0 || riskAmount > currentBalance) {
      console.log(`⏸️ Недостаточно средств: нужно $${riskAmount.toFixed(2)}, есть $${currentBalance.toFixed(2)}`);
      return;
    }

    const quantity = riskAmount / signal.price;
    const roundedQty = Math.floor(quantity * 1000) / 1000;
    if (roundedQty <= 0) return;

    const tpPrice = signal.action === 'buy'
      ? signal.price * (1 + TP_PERCENT / 100)
      : signal.price * (1 - TP_PERCENT / 100);
    const slPrice = signal.action === 'buy'
      ? signal.price * (1 - SL_PERCENT / 100)
      : signal.price * (1 + SL_PERCENT / 100);

    lastTradeTimeForSymbol.current.set(signal.symbol, Date.now());
    setBalance(prev => prev - riskAmount);

    const newTrade: Trade = {
      id: `${signal.symbol}_${Date.now()}_${Math.random()}`,
      symbol: signal.symbol,
      side: signal.action,
      entryPrice: signal.price,
      exitPrice: null,
      quantity: roundedQty,
      invested: riskAmount,
      entryTime: Date.now(),
      exitTime: null,
      profit: null,
      profitPercent: null,
      status: 'open' as const,
      tpPrice: Math.round(tpPrice * 10000) / 10000,
      slPrice: Math.round(slPrice * 10000) / 10000,
      breakevenActivated: false
    };

    setTrades(prev => [...prev, newTrade]);
    console.log(`✅ СДЕЛКА: ${signal.action.toUpperCase()} ${signal.symbol} | Цена: $${signal.price.toFixed(4)} | TP(+${TP_PERCENT}%): $${tpPrice.toFixed(4)} | SL(-${SL_PERCENT}%): $${slPrice.toFixed(4)} | Сумма: $${riskAmount.toFixed(2)}`);
  }, []);

  const closeTrade = useCallback((trade: Trade, currentPrice: number, reason: 'TP' | 'SL' | 'manual') => {
    if (!trade || !currentPrice) return;
    
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

    setBalance(prev => prev + investedAmount + profit);
    setTotalProfit(prev => prev + profit);
    setTrades(prev => prev.map(t =>
      t.id === trade.id
        ? { ...t, status: 'closed' as const, exitPrice: currentPrice, exitTime: Date.now(), profit, profitPercent }
        : t
    ));
    console.log(`📉 ЗАКРЫТА: ${trade.symbol} | ${reason} | PnL: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`);
  }, []);

  // Мониторинг TP/SL с безубытком
  useEffect(() => {
    const checkTPSL = () => {
      const openTrades = trades.filter(t => t.status === 'open');
      
      for (const trade of openTrades) {
        const currentPrice = prices.get(trade.symbol);
        if (!currentPrice) continue;

        // Проверка TP
        let tpHit = false;
        if (trade.side === 'buy' && currentPrice >= trade.tpPrice) tpHit = true;
        if (trade.side === 'sell' && currentPrice <= trade.tpPrice) tpHit = true;
        if (tpHit) {
          closeTrade(trade, currentPrice, 'TP');
          continue;
        }

        // Проверка SL
        let slHit = false;
        if (trade.side === 'buy' && currentPrice <= trade.slPrice) slHit = true;
        if (trade.side === 'sell' && currentPrice >= trade.slPrice) slHit = true;
        if (slHit) {
          closeTrade(trade, currentPrice, 'SL');
          continue;
        }

        // Безубыток: если цена прошла +1.0%, подтягиваем SL к цене входа
        if (!trade.breakevenActivated) {
          const profitPercent = trade.side === 'buy'
            ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
            : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;

          if (profitPercent >= BREAKEVEN_TRIGGER) {
            setTrades(prev => prev.map(t =>
              t.id === trade.id
                ? { ...t, slPrice: t.entryPrice, breakevenActivated: true }
                : t
            ));
            console.log(`🔒 Безубыток: ${trade.symbol} | SL подтянут к цене входа`);
          }
        }
      }
    };
    const interval = setInterval(checkTPSL, 3000);
    return () => clearInterval(interval);
  }, [trades, prices, closeTrade]);

  const updatePrice = useCallback((symbol: string, price: number) => {
    if (!symbol || !price || price <= 0) return;
    
    setPrices(prev => new Map(prev).set(symbol, price));
    let history = priceHistoryRef.current.get(symbol) || [];
    history.push(price);
    if (history.length > 200) history = history.slice(-200);
    priceHistoryRef.current.set(symbol, history);

    const signal = generateSignal(symbol, price);
    if (signal) {
      setSignals(prev => [signal, ...prev].slice(0, 100));
      if (autoTradeRef.current) {
        executeTrade(signal);
      }
    }
  }, [executeTrade]);

  // WebSocket
  useEffect(() => {
    const wsManager = createWebSocketManager();
    wsRef.current = wsManager;
    wsManager.subscribe(SYMBOLS, (data: PriceData) => {
      if (data && data.symbol && data.price) {
        if (!connectedRef.current.has(data.symbol)) {
          connectedRef.current.add(data.symbol);
          setWsConnectedCount(prev => prev + 1);
        }
        if (!wsConnected) setWsConnected(true);
        updatePrice(data.symbol, data.price);
      }
    });
    return () => wsManager.disconnect();
  }, [updatePrice, wsConnected]);

  const closedTrades = trades.filter(t => t.status === 'closed');
  const openTrades = trades.filter(t => t.status === 'open');
  const totalTrades = closedTrades.length;

  const clearHistory = () => {
    setTrades([]);
    setSignals([]);
    setTotalProfit(0);
    setEquityHistory([{ time: Date.now(), value: balance }]);
    lastTradeTimeForSymbol.current.clear();
    lastSignalTimeForSymbol.current.clear();
  };

  const resetBalance = () => {
    setBalance(10000);
    setTotalProfit(0);
    setTrades([]);
    setSignals([]);
    setEquityHistory([{ time: Date.now(), value: 10000 }]);
    lastTradeTimeForSymbol.current.clear();
    lastSignalTimeForSymbol.current.clear();
  };

  const closeAllPositions = () => {
    openTrades.forEach(trade => {
      const currentPrice = prices.get(trade.symbol) || trade.entryPrice;
      closeTrade(trade, currentPrice, 'manual');
    });
  };

  const openBybit = (symbol: string) => {
    const [base] = symbol.split('/');
    window.open(`https://www.bybit.com/trade/spot/${base}/USDT`, '_blank');
  };

  const EquityChart: React.FC = () => {
    if (equityHistory.length < 2) return null;
    
    const width = 180;
    const height = 36;
    const padding = 2;
    const min = Math.min(...equityHistory.map(d => d.value));
    const max = Math.max(...equityHistory.map(d => d.value));
    const range = max - min || 1;
    
    const points = equityHistory.map((d, i) => {
      const x = padding + (i / (equityHistory.length - 1)) * (width - padding * 2);
      const y = padding + (height - padding * 2) - ((d.value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
    
    const isUp = equityHistory[equityHistory.length - 1].value >= equityHistory[0].value;
    
    return (
      <svg width={width} height={height} className="opacity-90">
        <polyline
          points={points}
          fill="none"
          stroke={isUp ? '#22c55e' : '#ef4444'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {equityHistory.length > 0 && (
          <circle
            cx={padding + (width - padding * 2)}
            cy={padding + (height - padding * 2) - ((equityHistory[equityHistory.length - 1].value - min) / range) * (height - padding * 2)}
            r="2"
            fill={isUp ? '#22c55e' : '#ef4444'}
          />
        )}
      </svg>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-gray-900 via-red-900/30 to-black' : 'bg-gradient-to-br from-gray-100 via-red-100/30 to-white'}`}>
      <header className={`relative z-20 border-b border-red-500/30 backdrop-blur-xl sticky top-0 ${darkMode ? 'bg-black/80' : 'bg-white/80'}`}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">💀</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>{SYMBOLS.length} активов | RSI 35/65 | ADX 25+ | TP +1.5% | SL -0.8% | BE +1%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden lg:block">
                <EquityChart />
              </div>
              <div className="text-right">
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Баланс</div>
                <div className="text-lg font-bold text-green-400">${formatNumber(balance)}</div>
              </div>
              <div className="text-right">
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>PnL</div>
                <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalProfit >= 0 ? '+' : ''}{formatNumber(totalProfit)}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>WR</div>
                <div className="text-lg font-bold text-yellow-400">{winRate.toFixed(1)}%</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnectedCount >= SYMBOLS.length ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{wsConnectedCount}/{SYMBOLS.length}</span>
              </div>
              <div className={`text-sm font-mono ${darkMode ? 'text-gray-500' : 'text-gray-700'}`}>{currentTime.toLocaleTimeString()}</div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg text-lg transition-colors ${darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                title={darkMode ? 'Светлая тема' : 'Тёмная тема'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className={`rounded-xl p-3 border border-red-500/30 ${darkMode ? 'bg-black/60' : 'bg-white/60'}`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Сигналов</div>
            <div className="text-2xl font-bold text-red-400">{signals.length}</div>
          </div>
          <div className={`rounded-xl p-3 border border-green-500/30 ${darkMode ? 'bg-black/60' : 'bg-white/60'}`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>BUY</div>
            <div className="text-2xl font-bold text-green-400">{signals.filter(s => s.action === 'buy').length}</div>
          </div>
          <div className={`rounded-xl p-3 border border-red-500/30 ${darkMode ? 'bg-black/60' : 'bg-white/60'}`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>SELL</div>
            <div className="text-2xl font-bold text-red-400">{signals.filter(s => s.action === 'sell').length}</div>
          </div>
          <div className={`rounded-xl p-3 border border-yellow-500/30 ${darkMode ? 'bg-black/60' : 'bg-white/60'}`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Открыто</div>
            <div className="text-2xl font-bold text-yellow-400">{openTrades.length}</div>
          </div>
          <div className={`rounded-xl p-3 border border-blue-500/30 ${darkMode ? 'bg-black/60' : 'bg-white/60'}`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Закрыто</div>
            <div className="text-2xl font-bold text-blue-400">{totalTrades}</div>
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-red-500/30 overflow-x-auto">
          {[
            { key: 'signals', icon: '🎯', label: 'Сигналы' },
            { key: 'trading', icon: '📈', label: 'График' },
            { key: 'positions', icon: '📊', label: 'Позиции' },
            { key: 'history', icon: '📜', label: 'История' },
            { key: 'news', icon: '📰', label: 'Новости' },
            { key: 'topmovers', icon: '📊', label: 'Топ монет' },
            { key: 'watchlist', icon: '⭐', label: 'Избранное' },
            { key: 'autotrade', icon: '🤖', label: 'Автоторговля' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-red-600 text-white'
                  : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'trading' && (
          <div className={`rounded-xl p-3 border border-red-500/20 ${darkMode ? 'bg-black/40' : 'bg-white/40'}`}>
            <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className={`border border-red-500/50 rounded-lg px-3 py-1.5 text-sm mb-3 w-full ${darkMode ? 'bg-black/60 text-white' : 'bg-white text-black'}`}>
              {SYMBOLS.slice(0, 30).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <TradingChart symbol={selectedSymbol} />
          </div>
        )}

        {activeTab === 'history' && <SignalHistory />}
        {activeTab === 'news' && <News />}
        {activeTab === 'topmovers' && <TopMovers />}
        {activeTab === 'watchlist' && <Watchlist />}

        {activeTab === 'autotrade' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 border border-red-500/20 ${darkMode ? 'bg-black/40' : 'bg-white/40'}`}>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setAutoTrade(!autoTrade)} className={`px-5 py-2 rounded-lg font-bold ${autoTrade ? 'bg-red-600' : 'bg-green-600'}`}>
                  {autoTrade ? '🔴 ОСТАНОВИТЬ' : '🟢 ЗАПУСТИТЬ'}
                </button>
                <button onClick={resetBalance} className="px-4 py-2 bg-yellow-600/50 rounded-lg text-sm">🔄 Сбросить счет</button>
                {openTrades.length > 0 && (
                  <button onClick={closeAllPositions} className="px-4 py-2 bg-red-700/80 rounded-lg text-sm">🔒 ЗАКРЫТЬ ВСЕ ({openTrades.length})</button>
                )}
              </div>
              {autoTrade && (
                <div className="mt-3 p-2 bg-green-500/20 rounded-lg text-center">
                  <p className="text-green-400 text-sm">✅ АВТОТОРГОВЛЯ | TP +1.5% | SL -0.8% | Безубыток +1%</p>
                </div>
              )}
            </div>

            <div className={`rounded-xl p-4 border border-red-500/20 ${darkMode ? 'bg-black/40' : 'bg-white/40'}`}>
              <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Риск на сделку: {riskPercent}%</label>
              <input type="range" min="1" max="10" step="0.5" value={riskPercent} onChange={(e) => setRiskPercent(parseFloat(e.target.value))} className="w-full accent-red-500 mt-1" />
            </div>

            <div className={`rounded-xl border border-red-500/20 overflow-hidden ${darkMode ? 'bg-black/40' : 'bg-white/40'}`}>
              <div className="px-4 py-2 bg-red-950/30 border-b border-red-500/30">
                <h3 className="font-bold text-red-400 text-sm">📊 ОТКРЫТЫЕ ПОЗИЦИИ ({openTrades.length})</h3>
              </div>
              <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {openTrades.length === 0 ? (
                  <div className={`p-4 text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>Нет открытых позиций</div>
                ) : (
                  openTrades.map(trade => {
                    const currentPrice = prices.get(trade.symbol) || trade.entryPrice;
                    const pnl = trade.side === 'buy'
                      ? (currentPrice - trade.entryPrice) * trade.quantity
                      : (trade.entryPrice - currentPrice) * trade.quantity;
                    const pnlPercent = trade.side === 'buy'
                      ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
                      : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;

                    return (
                      <div key={trade.id} className={`p-3 ${pnl >= 0 ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm">
                            {trade.side === 'buy' ? '🟢' : '🔴'} {trade.symbol}
                            {trade.breakevenActivated && <span className="ml-1 text-xs text-blue-400">🔒BE</span>}
                          </span>
                          <span className={`font-bold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs">
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Вход:</span>
                          <span className="text-right">${formatPrice(trade.entryPrice)}</span>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Текущая:</span>
                          <span className="text-right">${formatPrice(currentPrice)}</span>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>TP:</span>
                          <span className="text-right text-green-400">${formatPrice(trade.tpPrice)}</span>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>SL{ trade.breakevenActivated ? ' (BE)' : ''}:</span>
                          <span className={`text-right ${trade.breakevenActivated ? 'text-blue-400' : 'text-red-400'}`}>${formatPrice(trade.slPrice)}</span>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Время:</span>
                          <span className="text-right">{formatTime(trade.entryTime)}</span>
                        </div>
                        <button
                          onClick={() => closeTrade(trade, currentPrice, 'manual')}
                          className="mt-2 w-full bg-red-700/50 hover:bg-red-600 text-xs py-1 rounded"
                        >
                          🔒 Закрыть
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-2">
            {signals.length === 0 ? (
              <div className={`rounded-xl p-8 text-center ${darkMode ? 'bg-black/40' : 'bg-white/40'}`}>
                <div className="text-5xl mb-3">⏳</div>
                <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Нет сигналов. Ожидаем RSI &lt; 35 или RSI &gt; 65 с ADX &gt; 25...</div>
              </div>
            ) : (
              signals.filter(s => s && s.price).map((signal, idx) => (
                <div key={idx} onClick={() => openBybit(signal.symbol)} className={`rounded-lg p-3 border border-red-500/30 cursor-pointer hover:border-red-400/50 transition-colors ${darkMode ? 'bg-gradient-to-r from-black/60 to-red-900/20' : 'bg-gradient-to-r from-white to-red-100/50'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{signal.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${signal.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {signal.action === 'buy' ? 'BUY' : 'SELL'} @ ${formatPrice(signal.price)}
                    </span>
                    <span className="text-yellow-400 text-xs">{'★'.repeat(signal.strength)}{'☆'.repeat(3 - signal.strength)}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-2 text-xs">
                    <div className={`rounded p-1 text-center ${darkMode ? 'bg-black/50' : 'bg-gray-100'}`}>RSI: {signal.rsi}</div>
                    <div className={`rounded p-1 text-center ${darkMode ? 'bg-black/50' : 'bg-gray-100'}`}>ADX: {signal.adx?.toFixed(0) || '--'}</div>
                    <div className={`rounded p-1 text-center ${darkMode ? 'bg-black/50' : 'bg-gray-100'}`}>MACD: {signal.macd?.toFixed(4) || '--'}</div>
                    <div className={`rounded p-1 text-center ${darkMode ? 'bg-black/50' : 'bg-gray-100'}`}>EMA: {Math.round(signal.ema20)}</div>
                    <div className={`rounded p-1 text-center ${darkMode ? 'bg-black/50' : 'bg-gray-100'}`}>Сила: {signal.strength}/3</div>
                  </div>
                  <div className="mt-1 text-xs text-red-400 flex gap-1 flex-wrap">
                    {(signal.reasons || []).map((r, i) => <span key={i} className="bg-red-950/30 px-1.5 py-0.5 rounded">🎯 {r}</span>)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
