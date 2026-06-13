import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import { createWebSocketManager, PriceData } from './services/websocket';

// ==================== 60+ АКТИВОВ ====================
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
  strength: number;
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
  amount: number;
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
  const [wsConnected, setWsConnected] = useState(false);

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const lastSignalTimeRef = useRef<Map<string, number>>(new Map());
  const lastTradeTimeRef = useRef<Map<string, number>>(new Map());

  const formatNumber = (num: number) => num?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0';
  const formatPrice = (price: number) => price?.toFixed(4) || '0';
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (!prices || prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
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

  const generateSignal = (symbol: string, currentPrice: number): Signal | null => {
    const history = priceHistoryRef.current.get(symbol);
    if (!history || history.length < 50) return null;
    
    const lastSignal = lastSignalTimeRef.current.get(symbol);
    if (lastSignal && Date.now() - lastSignal < 30000) return null;
    
    const rsi = calculateRSI(history);
    const macd = calculateEMA(history, 12) - calculateEMA(history, 26);
    const ema20 = calculateEMA(history, 20);
    const ema50 = calculateEMA(history, 50);
    
    let action: 'buy' | 'sell' | null = null;
    let reasons: string[] = [];
    
    if (rsi < 30 && macd > 0 && ema20 > ema50) {
      action = 'buy';
      reasons = [`RSI ${rsi} < 30`, `MACD бычий`, `EMA20 > EMA50`];
    } else if (rsi > 70 && macd < 0 && ema20 < ema50) {
      action = 'sell';
      reasons = [`RSI ${rsi} > 70`, `MACD медвежий`, `EMA20 < EMA50`];
    }
    
    if (!action) return null;
    
    lastSignalTimeRef.current.set(symbol, Date.now());
    
    return {
      id: `${symbol}_${Date.now()}`,
      symbol,
      action,
      price: currentPrice,
      timestamp: Date.now(),
      strength: (rsi < 20 || rsi > 80) ? 3 : 2,
      rsi: rsi || 0,
      macd: macd || 0,
      ema20: ema20 || 0,
      ema50: ema50 || 0,
      reasons
    };
  };

  const executeTrade = (signal: Signal) => {
    if (!autoTrade) {
      console.log('⏸️ Автоторговля выключена');
      return;
    }
    
    const lastTrade = lastTradeTimeRef.current.get(signal.symbol);
    if (lastTrade && Date.now() - lastTrade < 120000) {
      console.log(`⏸️ Пропуск ${signal.symbol} - интервал 120 сек`);
      return;
    }
    
    const openTrade = trades.find(t => t.symbol === signal.symbol && t.status === 'open');
    if (openTrade) {
      console.log(`🚫 Позиция по ${signal.symbol} уже открыта`);
      return;
    }
    
    const riskAmount = balance * (riskPercent / 100);
    const amount = riskAmount / signal.price;
    const roundedAmount = Math.floor(amount * 1000) / 1000;
    if (roundedAmount <= 0) return;
    
    const tpPrice = signal.action === 'buy' ? signal.price * 1.03 : signal.price * 0.97;
    const slPrice = signal.action === 'buy' ? signal.price * 0.98 : signal.price * 1.02;
    
    lastTradeTimeRef.current.set(signal.symbol, Date.now());
    setBalance(prev => prev - riskAmount);
    
    const newTrade: Trade = {
      id: `${signal.symbol}_${Date.now()}`,
      symbol: signal.symbol,
      side: signal.action,
      entryPrice: signal.price,
      exitPrice: null,
      amount: roundedAmount,
      invested: riskAmount,
      entryTime: Date.now(),
      exitTime: null,
      profit: null,
      profitPercent: null,
      status: 'open',
      tpPrice,
      slPrice
    };
    
    setTrades(prev => [...prev, newTrade]);
    console.log(`✅ ОТКРЫТА: ${signal.action.toUpperCase()} ${signal.symbol} | TP: $${tpPrice.toFixed(4)} | SL: $${slPrice.toFixed(4)}`);
  };

  // Мониторинг TP/SL
  useEffect(() => {
    const interval = setInterval(() => {
      trades.forEach(trade => {
        if (trade.status !== 'open') return;
        
        const currentPrice = prices.get(trade.symbol);
        if (!currentPrice) return;
        
        let shouldClose = false;
        let exitPrice = 0;
        let reason = '';
        
        if (trade.side === 'buy') {
          if (currentPrice >= trade.tpPrice) {
            shouldClose = true;
            exitPrice = trade.tpPrice;
            reason = 'TP';
          } else if (currentPrice <= trade.slPrice) {
            shouldClose = true;
            exitPrice = trade.slPrice;
            reason = 'SL';
          }
        } else {
          if (currentPrice <= trade.tpPrice) {
            shouldClose = true;
            exitPrice = trade.tpPrice;
            reason = 'TP';
          } else if (currentPrice >= trade.slPrice) {
            shouldClose = true;
            exitPrice = trade.slPrice;
            reason = 'SL';
          }
        }
        
        if (shouldClose) {
          const profit = trade.side === 'buy' 
            ? (exitPrice - trade.entryPrice) * trade.amount
            : (trade.entryPrice - exitPrice) * trade.amount;
          const profitPercent = (profit / trade.invested) * 100;
          
          setBalance(prev => prev + trade.invested + profit);
          setTotalProfit(prev => prev + profit);
          setTrades(prev => prev.map(t => 
            t.id === trade.id 
              ? { ...t, status: 'closed', exitPrice, exitTime: Date.now(), profit, profitPercent }
              : t
          ));
          console.log(`🎯 ${reason} ${trade.symbol}: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`);
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [trades, prices]);

  const updatePrice = useCallback((symbol: string, price: number) => {
    setPrices(prev => new Map(prev).set(symbol, price));
    
    let history = priceHistoryRef.current.get(symbol) || [];
    history.push(price);
    if (history.length > 200) history = history.slice(-200);
    priceHistoryRef.current.set(symbol, history);
    
    const signal = generateSignal(symbol, price);
    if (signal) {
      setSignals(prev => [signal, ...prev].slice(0, 100));
      if (autoTrade) {
        executeTrade(signal);
      }
    }
  }, [autoTrade]);

  // WebSocket - передаем МАССИВ символов
  useEffect(() => {
    const wsManager = createWebSocketManager();
    
    wsManager.subscribe(SYMBOLS, (data: PriceData) => {
      if (!wsConnected) setWsConnected(true);
      updatePrice(data.symbol, data.price);
    });
    
    return () => {
      wsManager.disconnect();
    };
  }, [updatePrice]);

  // Статистика
  useEffect(() => {
    const closed = trades.filter(t => t.status === 'closed' && t.profit !== null);
    const wins = closed.filter(t => (t.profit || 0) > 0).length;
    setWinRate(closed.length ? (wins / closed.length) * 100 : 0);
  }, [trades]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  const totalTrades = closedTrades.length;

  const openBybit = (symbol: string) => {
    const [base] = symbol.split('/');
    window.open(`https://www.bybit.com/trade/spot/${base}/USDT`, '_blank');
  };

  const resetBalance = () => {
    if (window.confirm('Сбросить баланс до $10,000?')) {
      setBalance(10000);
      setTotalProfit(0);
      setTrades([]);
      setSignals([]);
      lastTradeTimeRef.current.clear();
      lastSignalTimeRef.current.clear();
    }
  };

  const clearHistory = () => {
    if (window.confirm('Очистить историю?')) {
      setTrades([]);
      setSignals([]);
      setTotalProfit(0);
    }
  };

  const closeAllPositions = () => {
    if (window.confirm(`Закрыть все ${openTrades.length} позиций?`)) {
      openTrades.forEach(trade => {
        setBalance(prev => prev + trade.invested);
        setTrades(prev => prev.map(t => 
          t.id === trade.id 
            ? { ...t, status: 'closed', exitPrice: prices.get(trade.symbol) || trade.entryPrice, exitTime: Date.now(), profit: 0, profitPercent: 0 }
            : t
        ));
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/30 to-black">
      <header className="border-b border-red-500/30 bg-black/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">💀</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className="text-xs text-gray-500">{SYMBOLS.length} активов | RSI 30/70</p>
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
                <div className="text-xl font-bold text-yellow-400">{winRate.toFixed(0)}%</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-400">{wsConnected ? 'Online' : 'Offline'}</span>
              </div>
              <div className="text-sm text-gray-500 font-mono">{currentTime.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
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
          <button onClick={() => setActiveTab('autotrade')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'autotrade' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>🤖 Автоторговля</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📜 История</button>
        </div>

        {activeTab === 'trading' && (
          <div className="bg-black/40 rounded-xl p-3 border border-red-500/20">
            <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-black/60 border border-red-500/50 rounded-lg px-3 py-1.5 text-sm text-white mb-3 w-full">
              {SYMBOLS.slice(0, 20).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <TradingChart symbol={selectedSymbol} />
          </div>
        )}

        {activeTab === 'autotrade' && (
          <div className="space-y-4">
            <div className="bg-black/40 rounded-xl p-4 border border-red-500/20">
              <div className="flex flex-wrap gap-3 mb-3">
                <button onClick={() => setAutoTrade(!autoTrade)} className={`px-5 py-2 rounded-lg font-bold ${autoTrade ? 'bg-red-600' : 'bg-green-600'}`}>
                  {autoTrade ? '🔴 ОСТАНОВИТЬ' : '🟢 ЗАПУСТИТЬ'}
                </button>
                <button onClick={resetBalance} className="px-4 py-2 bg-yellow-600/50 rounded-lg text-sm">🔄 Сбросить счет</button>
                {openTrades.length > 0 && (
                  <button onClick={closeAllPositions} className="px-4 py-2 bg-red-700/80 rounded-lg text-sm">🔒 ЗАКРЫТЬ ВСЕ ({openTrades.length})</button>
                )}
              </div>
              {autoTrade && (
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <p className="text-green-400 font-bold text-sm">✅ АВТОТОРГОВЛЯ АКТИВНА</p>
                  <p className="text-gray-400 text-xs">RSI &lt; 30 BUY | RSI &gt; 70 SELL | TP 3% / SL 2%</p>
                </div>
              )}
            </div>

            <div className="bg-black/40 rounded-xl p-4 border border-red-500/20">
              <label className="text-sm text-gray-400">Риск на сделку: {riskPercent}%</label>
              <input type="range" min="1" max="10" step="0.5" value={riskPercent} onChange={(e) => setRiskPercent(parseFloat(e.target.value))} className="w-full accent-red-500 mt-1" />
              <div className="mt-3 p-3 bg-red-950/30 rounded-lg text-sm grid grid-cols-2 gap-2">
                <div className="flex justify-between"><span className="text-gray-400">Баланс:</span><span>${formatNumber(balance)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">На сделку:</span><span className="text-yellow-400">${formatNumber(balance * riskPercent / 100)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">SL (2%):</span><span className="text-red-400">${formatNumber(balance * riskPercent / 100 * 0.02)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">TP (3%):</span><span className="text-green-400">${formatNumber(balance * riskPercent / 100 * 0.03)}</span></div>
              </div>
            </div>

            <div className="bg-black/40 rounded-xl border border-red-500/20 overflow-hidden">
              <div className="px-4 py-2 bg-red-950/30 border-b border-red-500/30">
                <h3 className="font-bold text-red-400 text-sm">📊 ОТКРЫТЫЕ ПОЗИЦИИ ({openTrades.length})</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {openTrades.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Нет открытых позиций</div>
                ) : (
                  openTrades.map(trade => (
                    <div key={trade.id} className="p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="font-bold">{trade.symbol}</span>
                        <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>{trade.side === 'buy' ? 'BUY' : 'SELL'}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Вход: ${trade.entryPrice}</span>
                        <span>TP: ${trade.tpPrice.toFixed(4)}</span>
                        <span>SL: ${trade.slPrice.toFixed(4)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-black/40 rounded-xl p-4 border border-red-500/20">
            <div className="max-h-[400px] overflow-y-auto">
              {closedTrades.length === 0 ? (
                <div className="text-center text-gray-500 py-4">Нет закрытых сделок</div>
              ) : (
                closedTrades.slice().reverse().map(trade => (
                  <div key={trade.id} className="border-b border-gray-800 py-2 flex justify-between text-sm">
                    <span className="w-20">{trade.symbol}</span>
                    <span className={trade.side === 'buy' ? 'text-green-400 w-12' : 'text-red-400 w-12'}>{trade.side === 'buy' ? 'BUY' : 'SELL'}</span>
                    <span className="w-32">${trade.entryPrice} → ${trade.exitPrice}</span>
                    <span className={trade.profit && trade.profit > 0 ? 'text-green-400' : 'text-red-400'}>
                      {trade.profit && trade.profit > 0 ? '+' : ''}{trade.profit?.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
            {closedTrades.length > 0 && (
              <button onClick={clearHistory} className="mt-3 text-xs text-red-400 w-full py-2 border-t border-red-500/30">Очистить историю</button>
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-2">
            {signals.length === 0 ? (
              <div className="bg-black/40 rounded-xl p-8 text-center">
                <div className="text-5xl mb-3">⏳</div>
                <div className="text-gray-400 text-sm">Нет сигналов. Ожидаем RSI &lt; 30 или RSI &gt; 70...</div>
                <div className="text-xs text-gray-600 mt-1">WebSocket: {wsConnected ? '✅ Подключен' : '⏳ Подключение...'}</div>
              </div>
            ) : (
              signals.map((signal, idx) => (
                <div key={idx} onClick={() => openBybit(signal.symbol)} className="bg-gradient-to-r from-black/60 to-red-900/20 rounded-lg p-3 border border-red-500/30 hover:border-red-500/50 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{signal.action === 'buy' ? '🟢' : '🔴'}</span>
                      <span className="font-bold">{signal.symbol}</span>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold ${signal.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {signal.action === 'buy' ? 'BUY' : 'SELL'} @ ${formatPrice(signal.price)}
                    </div>
                    <div className="text-yellow-400 text-xs">{'★'.repeat(signal.strength)}{'☆'.repeat(3 - signal.strength)}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                    <div className="bg-black/50 rounded p-1 text-center"><div className="text-gray-500">RSI</div><div className="font-bold">{signal.rsi}</div></div>
                    <div className="bg-black/50 rounded p-1 text-center"><div className="text-gray-500">MACD</div><div className="font-mono">{signal.macd > 0 ? '+' : ''}{signal.macd.toFixed(4)}</div></div>
                    <div className="bg-black/50 rounded p-1 text-center"><div className="text-gray-500">EMA</div><div className="text-xs">{Math.round(signal.ema20)}/{Math.round(signal.ema50)}</div></div>
                    <div className="bg-black/50 rounded p-1 text-center"><div className="text-gray-500">Сила</div><div className="text-yellow-400">{'★'.repeat(signal.strength)}{'☆'.repeat(3 - signal.strength)}</div></div>
                  </div>
                  <div className="mt-1 text-xs text-red-400 flex gap-1 flex-wrap">
                    {signal.reasons.map((r, i) => <span key={i} className="bg-red-950/30 px-1.5 py-0.5 rounded">🎯 {r}</span>)}
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
