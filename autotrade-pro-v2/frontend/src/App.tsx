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
}

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

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const wsRef = useRef<any>(null);
  const connectedRef = useRef<Set<string>>(new Set());
  const lastTradeTimeForSymbol = useRef<Map<string, number>>(new Map());
  const lastSignalTimeForSymbol = useRef<Map<string, number>>(new Map());

  const formatNumber = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatPrice = (price: number) => {
    if (price === undefined || price === null || isNaN(price)) return '0.0000';
    return price.toFixed(4);
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
    return atr;
  };

  // ==================== ГЕНЕРАЦИЯ СИГНАЛОВ ====================
  const generateSignal = (symbol: string, currentPrice: number): Signal | null => {
    if (!currentPrice || currentPrice <= 0) return null;
    
    const history = priceHistoryRef.current.get(symbol);
    if (!history || history.length < 50) return null;

    const lastSignal = lastSignalTimeForSymbol.current.get(symbol);
    if (lastSignal && Date.now() - lastSignal < 120000) return null;

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
  const executeTrade = (signal: Signal) => {
    if (!autoTrade) return;
    if (!signal || !signal.price) return;

    const openTrade = trades.find(t => t.symbol === signal.symbol && t.status === 'open');
    if (openTrade) return;

    const lastTrade = lastTradeTimeForSymbol.current.get(signal.symbol);
    if (lastTrade && Date.now() - lastTrade < 120000) return;

    const riskAmount = balance * (riskPercent / 100);
    if (riskAmount <= 0 || riskAmount > balance) return;

    const quantity = riskAmount / signal.price;
    const roundedQty = Math.floor(quantity * 1000) / 1000;
    if (roundedQty <= 0) return;

    const tpPrice = signal.action === 'buy'
      ? signal.price + signal.atr * 2.5
      : signal.price - signal.atr * 2.5;
    const slPrice = signal.action === 'buy'
      ? signal.price - signal.atr * 1.5
      : signal.price + signal.atr * 1.5;

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
      status: 'open',
      tpPrice: Math.round(tpPrice * 10000) / 10000,
      slPrice: Math.round(slPrice * 10000) / 10000
    };

    setTrades(prev => [...prev, newTrade]);
    console.log(`✅ ОТКРЫТА: ${signal.action.toUpperCase()} ${signal.symbol} @ ${signal.price}`);
  };

  const closeTrade = (trade: Trade, currentPrice: number, reason: 'TP' | 'SL' | 'manual') => {
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
        ? { ...t, status: 'closed', exitPrice: currentPrice, exitTime: Date.now(), profit, profitPercent }
        : t
    ));
  };

  // Мониторинг TP/SL
  useEffect(() => {
    const checkTPandSL = () => {
      const openTrades = trades.filter(t => t.status === 'open');
      for (const trade of openTrades) {
        const currentPrice = prices.get(trade.symbol);
        if (!currentPrice) continue;

        if (trade.side === 'buy') {
          if (currentPrice >= trade.tpPrice) closeTrade(trade, currentPrice, 'TP');
          else if (currentPrice <= trade.slPrice) closeTrade(trade, currentPrice, 'SL');
        } else {
          if (currentPrice <= trade.tpPrice) closeTrade(trade, currentPrice, 'TP');
          else if (currentPrice >= trade.slPrice) closeTrade(trade, currentPrice, 'SL');
        }
      }
    };
    const interval = setInterval(checkTPandSL, 3000);
    return () => clearInterval(interval);
  }, [trades, prices]);

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
      if (autoTrade) executeTrade(signal);
    }
  }, [autoTrade]);

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
  }, []);

  const closedTrades = trades.filter(t => t.status === 'closed');
  const openTrades = trades.filter(t => t.status === 'open');
  const totalTrades = closedTrades.length;

  const clearHistory = () => {
    setTrades([]);
    setSignals([]);
    setTotalProfit(0);
    lastTradeTimeForSymbol.current.clear();
    lastSignalTimeForSymbol.current.clear();
  };

  const resetBalance = () => {
    setBalance(10000);
    setTotalProfit(0);
    setTrades([]);
    setSignals([]);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/30 to-black">
      <header className="relative z-20 border-b border-red-500/30 bg-black/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">💀</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className="text-xs text-gray-500">{SYMBOLS.length} активов | RSI 35/65 | ADX 25+</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-400">Баланс</div>
                <div className="text-xl font-bold text-green-400">${formatNumber(balance)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">PnL</div>
                <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalProfit >= 0 ? '+' : ''}{formatNumber(totalProfit)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">WR</div>
                <div className="text-xl font-bold text-yellow-400">{winRate.toFixed(1)}%</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnectedCount >= SYMBOLS.length ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-xs text-gray-400">{wsConnectedCount}/{SYMBOLS.length}</span>
              </div>
              <div className="text-sm text-gray-500 font-mono">{currentTime.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-black/60 rounded-xl p-3 border border-red-500/30">
            <div className="text-gray-400 text-xs">Сигналов</div>
            <div className="text-2xl font-bold text-red-400">{signals.length}</div>
          </div>
          <div className="bg-black/60 rounded-xl p-3 border border-green-500/30">
            <div className="text-gray-400 text-xs">BUY</div>
            <div className="text-2xl font-bold text-green-400">{signals.filter(s => s.action === 'buy').length}</div>
          </div>
          <div className="bg-black/60 rounded-xl p-3 border border-red-500/30">
            <div className="text-gray-400 text-xs">SELL</div>
            <div className="text-2xl font-bold text-red-400">{signals.filter(s => s.action === 'sell').length}</div>
          </div>
          <div className="bg-black/60 rounded-xl p-3 border border-yellow-500/30">
            <div className="text-gray-400 text-xs">Открыто</div>
            <div className="text-2xl font-bold text-yellow-400">{openTrades.length}</div>
          </div>
          <div className="bg-black/60 rounded-xl p-3 border border-blue-500/30">
            <div className="text-gray-400 text-xs">Закрыто</div>
            <div className="text-2xl font-bold text-blue-400">{totalTrades}</div>
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-red-500/30 overflow-x-auto">
          <button onClick={() => setActiveTab('signals')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'signals' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>🎯 Сигналы</button>
          <button onClick={() => setActiveTab('trading')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'trading' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📈 График</button>
          <button onClick={() => setActiveTab('positions')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'positions' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📊 Позиции</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📜 История</button>
          <button onClick={() => setActiveTab('news')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'news' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📰 Новости</button>
          <button onClick={() => setActiveTab('topmovers')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'topmovers' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📊 Топ монет</button>
          <button onClick={() => setActiveTab('watchlist')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'watchlist' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>⭐ Избранное</button>
          <button onClick={() => setActiveTab('autotrade')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'autotrade' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>🤖 Автоторговля</button>
        </div>

        {activeTab === 'trading' && (
          <div className="bg-black/40 rounded-xl p-3 border border-red-500/20">
            <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-black/60 border border-red-500/50 rounded-lg px-3 py-1.5 text-sm text-white mb-3 w-full">
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
            <div className="bg-black/40 rounded-xl p-4 border border-red-500/20">
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
                  <p className="text-green-400 text-sm">✅ АВТОТОРГОВЛЯ АКТИВНА — СКАЛЬПИНГ</p>
                </div>
              )}
            </div>

            <div className="bg-black/40 rounded-xl p-4 border border-red-500/20">
              <label className="text-sm text-gray-400">Риск на сделку: {riskPercent}%</label>
              <input type="range" min="1" max="10" step="0.5" value={riskPercent} onChange={(e) => setRiskPercent(parseFloat(e.target.value))} className="w-full accent-red-500 mt-1" />
            </div>

            <div className="bg-black/40 rounded-xl border border-red-500/20 overflow-hidden">
              <div className="px-4 py-2 bg-red-950/30 border-b border-red-500/30">
                <h3 className="font-bold text-red-400 text-sm">📊 ОТКРЫТЫЕ ПОЗИЦИИ ({openTrades.length})</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {openTrades.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Нет открытых позиций</div>
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
                          </span>
                          <span className={`font-bold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs">
                          <span className="text-gray-400">Вход:</span>
                          <span className="text-right">${formatPrice(trade.entryPrice)}</span>
                          <span className="text-gray-400">Текущая:</span>
                          <span className="text-right">${formatPrice(currentPrice)}</span>
                          <span className="text-gray-400">TP:</span>
                          <span className="text-right text-green-400">${formatPrice(trade.tpPrice)}</span>
                          <span className="text-gray-400">SL:</span>
                          <span className="text-right text-red-400">${formatPrice(trade.slPrice)}</span>
                          <span className="text-gray-400">Время:</span>
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
              <div className="bg-black/40 rounded-xl p-8 text-center">
                <div className="text-5xl mb-3">⏳</div>
                <div className="text-gray-400">Нет сигналов. Ожидаем RSI &lt; 35 или RSI &gt; 65 с ADX &gt; 25...</div>
              </div>
            ) : (
              signals.filter(s => s && s.price).map((signal, idx) => (
                <div key={idx} onClick={() => openBybit(signal.symbol)} className="bg-gradient-to-r from-black/60 to-red-900/20 rounded-lg p-3 border border-red-500/30 cursor-pointer hover:border-red-400/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{signal.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${signal.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {signal.action === 'buy' ? 'BUY' : 'SELL'} @ ${formatPrice(signal.price)}
                    </span>
                    <span className="text-yellow-400 text-xs">{'★'.repeat(signal.strength)}{'☆'.repeat(3 - signal.strength)}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-2 text-xs">
                    <div className="bg-black/50 rounded p-1 text-center">RSI: {signal.rsi}</div>
                    <div className="bg-black/50 rounded p-1 text-center">ADX: {signal.adx?.toFixed(0) || '--'}</div>
                    <div className="bg-black/50 rounded p-1 text-center">MACD: {signal.macd?.toFixed(4) || '--'}</div>
                    <div className="bg-black/50 rounded p-1 text-center">EMA: {Math.round(signal.ema20)}</div>
                    <div className="bg-black/50 rounded p-1 text-center">Сила: {signal.strength}/3</div>
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
