import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import SignalHistory from './components/SignalHistory';
import News from './components/News';
import TopMovers from './components/TopMovers';
import Watchlist from './components/Watchlist';
import { createWebSocketManager, PriceData } from './services/websocket';

// ТОП-10 ГАРАНТИРОВАННО РАБОТАЮЩИХ СИМВОЛОВ
const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT'
];

interface Signal {
  id: string;
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  timestamp: number;
  strength: number;
  indicators: {
    rsi: number;
    macd: number;
    ema20: number;
    ema50: number;
  };
  reasons: string[];
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: number;
  tpPrice: number;
  slPrice: number;
  profit?: number;
  status: 'open' | 'closed';
  closedAt?: number;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'signals';
  });
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [signals, setSignals] = useState<Signal[]>(() => {
    const saved = localStorage.getItem('signals_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('balance_v2');
    return saved ? parseFloat(saved) : 10000;
  });
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(() => {
    return localStorage.getItem('autoTradeEnabled') === 'true';
  });
  const [maxRiskPercent, setMaxRiskPercent] = useState(() => {
    const saved = localStorage.getItem('maxRiskPercent');
    return saved ? parseFloat(saved) : 5;
  });
  const [positions, setPositions] = useState<Trade[]>(() => {
    const saved = localStorage.getItem('positions_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [tradeHistory, setTradeHistory] = useState<Trade[]>(() => {
    const saved = localStorage.getItem('tradeHistory_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [prices, setPrices] = useState<Map<string, number>>(new Map());

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const wsManagerRef = useRef<any>(null);
  const lastTradeTimeRef = useRef<Map<string, number>>(new Map());

  const STOP_LOSS_PERCENT = 2;
  const TAKE_PROFIT_PERCENT = 3;

  const maxPositionAmount = balance * (maxRiskPercent / 100);
  const buys = signals.filter(s => s.action === 'buy').length;
  const sells = signals.filter(s => s.action === 'sell').length;
  const formattedCurrentTime = currentTime.toLocaleTimeString('ru-RU');

  // Сохранение состояния
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('signals_v2', JSON.stringify(signals.slice(0, 100)));
  }, [signals]);

  useEffect(() => {
    localStorage.setItem('balance_v2', balance.toString());
  }, [balance]);

  useEffect(() => {
    localStorage.setItem('autoTradeEnabled', autoTradeEnabled.toString());
  }, [autoTradeEnabled]);

  useEffect(() => {
    localStorage.setItem('maxRiskPercent', maxRiskPercent.toString());
  }, [maxRiskPercent]);

  useEffect(() => {
    localStorage.setItem('positions_v2', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('tradeHistory_v2', JSON.stringify(tradeHistory.slice(0, 100)));
  }, [tradeHistory]);

  // Таймер
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetAccount = () => {
    if (window.confirm('Сбросить счет до $10,000?')) {
      setBalance(10000);
      setPositions([]);
      setTradeHistory([]);
      setAutoTradeEnabled(false);
      localStorage.removeItem('positions_v2');
      localStorage.removeItem('tradeHistory_v2');
      alert('✅ Счет сброшен!');
    }
  };

  const closeAllPositions = () => {
    if (window.confirm('Закрыть все позиции?')) {
      positions.forEach(pos => closePosition(pos, prices.get(pos.symbol) || pos.price));
    }
  };

  const closePosition = (trade: Trade, currentPrice: number) => {
    // Расчет PnL
    let profit = 0;
    if (trade.side === 'buy') {
      profit = (currentPrice - trade.price) * trade.quantity;
    } else {
      profit = (trade.price - currentPrice) * trade.quantity;
    }
    
    // Обновляем баланс
    const newBalance = balance + profit;
    setBalance(newBalance);
    
    // Перемещаем из открытых в историю
    const closedTrade = { 
      ...trade, 
      status: 'closed' as const, 
      profit, 
      closedAt: Date.now() 
    };
    setPositions(prev => prev.filter(p => p.id !== trade.id));
    setTradeHistory(prev => [closedTrade, ...prev]);
    
    console.log(`📉 ЗАКРЫТА: ${trade.symbol} | PnL: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)} | Баланс: $${newBalance.toFixed(2)}`);
  };

  const openBybit = (symbol: string) => {
    window.open(`https://testnet.bybit.com/trade/${symbol.replace('/', '')}`, '_blank');
  };

  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
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

  const generateSignal = (symbol: string, currentPrice: number): Signal | null => {
    const priceHistory = priceHistoryRef.current.get(symbol);
    if (!priceHistory || priceHistory.length < 50) return null;
    
    const rsi = calculateRSI(priceHistory, 14);
    const ema20 = calculateEMA(priceHistory, 20);
    const ema50 = calculateEMA(priceHistory, 50);
    
    let macd = 0;
    if (priceHistory.length >= 26) {
      const ema12 = calculateEMA(priceHistory, 12);
      const ema26 = calculateEMA(priceHistory, 26);
      macd = ema12 - ema26;
    }
    
    // ЖЁСТКИЕ УСЛОВИЯ
    if (rsi < 30 && macd > 0 && ema20 > ema50) {
      const reasons = [`RSI ${rsi.toFixed(1)} < 30`, `MACD бычий (${macd.toFixed(2)})`, `EMA20(${ema20.toFixed(0)}) > EMA50(${ema50.toFixed(0)})`];
      console.log(`🔴 BUY ${symbol}`);
      return {
        id: `${symbol}_${Date.now()}_${Math.random()}`,
        symbol,
        action: 'buy',
        price: currentPrice,
        timestamp: Date.now(),
        strength: rsi < 20 ? 3 : 2,
        indicators: { rsi, macd, ema20, ema50 },
        reasons
      };
    }
    
    if (rsi > 70 && macd < 0 && ema20 < ema50) {
      const reasons = [`RSI ${rsi.toFixed(1)} > 70`, `MACD медвежий (${macd.toFixed(2)})`, `EMA20(${ema20.toFixed(0)}) < EMA50(${ema50.toFixed(0)})`];
      console.log(`🔵 SELL ${symbol}`);
      return {
        id: `${symbol}_${Date.now()}_${Math.random()}`,
        symbol,
        action: 'sell',
        price: currentPrice,
        timestamp: Date.now(),
        strength: rsi > 80 ? 3 : 2,
        indicators: { rsi, macd, ema20, ema50 },
        reasons
      };
    }
    
    return null;
  };

  const executeTrade = (signal: Signal) => {
    if (!autoTradeEnabled) {
      console.log('⏸️ Автоторговля выключена');
      return;
    }
    
    // Проверка на частые сделки (не чаще 1 раза в 3 минуты на символ)
    const lastTradeTime = lastTradeTimeRef.current.get(signal.symbol);
    if (lastTradeTime && Date.now() - lastTradeTime < 180000) {
      console.log(`⏰ Пропуск ${signal.symbol}: слишком частая сделка (3 мин)`);
      return;
    }
    
    // Проверка на уже открытую позицию
    const existingPosition = positions.find(p => p.symbol === signal.symbol);
    if (existingPosition) {
      console.log(`🚫 Позиция по ${signal.symbol} уже открыта`);
      return;
    }
    
    // Расчет размера позиции
    const riskAmount = balance * (maxRiskPercent / 100);
    const quantity = riskAmount / signal.price;
    const roundedQty = Math.floor(quantity * 1000) / 1000;
    
    if (roundedQty <= 0) {
      console.log('❌ Некорректное количество');
      return;
    }
    
    // Расчет TP/SL
    const tpPrice = signal.action === 'buy' ? signal.price * (1 + TAKE_PROFIT_PERCENT / 100) : signal.price * (1 - TAKE_PROFIT_PERCENT / 100);
    const slPrice = signal.action === 'buy' ? signal.price * (1 - STOP_LOSS_PERCENT / 100) : signal.price * (1 + STOP_LOSS_PERCENT / 100);
    
    // Обновляем баланс (замораживаем средства)
    const newBalance = balance - riskAmount;
    setBalance(newBalance);
    
    const newTrade: Trade = {
      id: `${signal.symbol}_${Date.now()}_${Math.random()}`,
      symbol: signal.symbol,
      side: signal.action,
      price: signal.price,
      quantity: roundedQty,
      timestamp: Date.now(),
      tpPrice,
      slPrice,
      status: 'open'
    };
    
    setPositions(prev => [...prev, newTrade]);
    lastTradeTimeRef.current.set(signal.symbol, Date.now());
    
    console.log(`✅ ОТКРЫТА: ${signal.action.toUpperCase()} ${signal.symbol} | Кол-во: ${roundedQty} | Цена: $${signal.price} | TP: $${tpPrice.toFixed(4)} | SL: $${slPrice.toFixed(4)} | Баланс: $${newBalance.toFixed(2)}`);
  };

  const updatePriceHistory = useCallback((symbol: string, price: number) => {
    setPrices(prev => new Map(prev).set(symbol, price));
    
    let history = priceHistoryRef.current.get(symbol) || [];
    history.push(price);
    if (history.length > 200) history = history.slice(-200);
    priceHistoryRef.current.set(symbol, history);
    
    // Генерация сигналов
    const signal = generateSignal(symbol, price);
    if (signal) {
      setSignals(prev => [signal, ...prev].slice(0, 100));
      if (autoTradeEnabled) {
        executeTrade(signal);
      }
    }
    
    // ПРОВЕРКА TP/SL ДЛЯ ОТКРЫТЫХ ПОЗИЦИЙ
    const openPosition = positions.find(p => p.symbol === symbol);
    if (openPosition) {
      let shouldClose = false;
      let closeReason = '';
      
      if (openPosition.side === 'buy') {
        if (price >= openPosition.tpPrice) {
          shouldClose = true;
          closeReason = 'TP (Take Profit)';
        } else if (price <= openPosition.slPrice) {
          shouldClose = true;
          closeReason = 'SL (Stop Loss)';
        }
      } else {
        if (price <= openPosition.tpPrice) {
          shouldClose = true;
          closeReason = 'TP (Take Profit)';
        } else if (price >= openPosition.slPrice) {
          shouldClose = true;
          closeReason = 'SL (Stop Loss)';
        }
      }
      
      if (shouldClose) {
        console.log(`🎯 ${closeReason} достигнут для ${symbol} по цене $${price}`);
        closePosition(openPosition, price);
      }
    }
  }, [autoTradeEnabled, positions, balance, maxRiskPercent]);

  useEffect(() => {
    const wsManager = createWebSocketManager();
    wsManagerRef.current = wsManager;
    
    SYMBOLS.forEach(symbol => {
      wsManager.subscribe(symbol, (data: PriceData) => {
        updatePriceHistory(symbol, data.price);
      });
    });
    
    return () => {
      wsManager.disconnect();
    };
  }, [updatePriceHistory]);

  // Расчет статистики
  const totalProfit = tradeHistory.reduce((sum, t) => sum + (t.profit || 0), 0);
  const winRate = tradeHistory.length > 0 
    ? (tradeHistory.filter(t => (t.profit || 0) > 0).length / tradeHistory.length) * 100 
    : 0;
  const avgProfit = tradeHistory.length > 0 ? totalProfit / tradeHistory.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-black">
      <header className="border-b border-red-500/30 bg-black/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">💀 AUTO TRADE PRO V2 | {SYMBOLS.length} активов</h1>
          <div className="flex gap-4 items-center">
            <div className="text-sm text-gray-400 font-mono">💰 ${balance.toLocaleString()}</div>
            <div className="text-sm text-gray-400 font-mono">{formattedCurrentTime}</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* СТАТИСТИКА */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/60 rounded-2xl p-5 border border-red-500/30">
            <div className="text-3xl font-bold text-red-400">{signals.length}</div>
            <div className="text-gray-400 text-sm">Сигналов</div>
          </div>
          <div className="bg-black/60 rounded-2xl p-5 border border-green-500/30">
            <div className="text-3xl font-bold text-green-500">{buys}</div>
            <div className="text-gray-400 text-sm">BUY</div>
          </div>
          <div className="bg-black/60 rounded-2xl p-5 border border-red-500/30">
            <div className="text-3xl font-bold text-red-500">{sells}</div>
            <div className="text-gray-400 text-sm">SELL</div>
          </div>
          <div className="bg-black/60 rounded-2xl p-5 border border-yellow-500/30">
            <div className="text-2xl font-bold text-yellow-500">{winRate.toFixed(0)}%</div>
            <div className="text-gray-400 text-sm">Винрейт</div>
          </div>
        </div>

        {/* ДОПОЛНИТЕЛЬНАЯ СТАТИСТИКА */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-black/60 rounded-2xl p-5 border border-green-500/30">
            <div className="text-gray-400 text-sm">Общий PnL</div>
            <div className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USD
            </div>
          </div>
          <div className="bg-black/60 rounded-2xl p-5 border border-blue-500/30">
            <div className="text-gray-400 text-sm">Закрытых сделок</div>
            <div className="text-3xl font-bold text-blue-400">{tradeHistory.length}</div>
          </div>
          <div className="bg-black/60 rounded-2xl p-5 border border-purple-500/30">
            <div className="text-gray-400 text-sm">Средний профит</div>
            <div className={`text-3xl font-bold ${avgProfit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
              {avgProfit >= 0 ? '+' : ''}{avgProfit.toFixed(2)} USD
            </div>
          </div>
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
          <div className="bg-black/60 rounded-2xl p-6 border border-red-500/30">
            <h3 className="text-xl font-bold text-red-400 mb-4">🤖 АВТОТОРГОВЛЯ</h3>
            
            <div className="flex items-center gap-4 flex-wrap mb-6">
              <button onClick={() => setAutoTradeEnabled(!autoTradeEnabled)} className={`px-4 py-2 rounded-lg font-bold ${autoTradeEnabled ? 'bg-red-600' : 'bg-green-600'}`}>
                {autoTradeEnabled ? '🔴 ОСТАНОВИТЬ' : '🟢 ВКЛЮЧИТЬ'}
              </button>
              <button onClick={resetAccount} className="bg-yellow-600/50 px-4 py-2 rounded-lg">🔄 Сбросить счет</button>
              {positions.length > 0 && <button onClick={closeAllPositions} className="bg-red-700/80 px-4 py-2 rounded-lg">🔒 ЗАКРЫТЬ ВСЕ ({positions.length})</button>}
            </div>
            
            {autoTradeEnabled && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
                <p className="text-green-400 font-bold">🟢 АВТОТОРГОВЛЯ АКТИВНА!</p>
                <p className="text-gray-400 text-sm mt-1">Условия: RSI&lt;30 BUY / RSI&gt;70 SELL + MACD + EMA20&gt;EMA50</p>
                <p className="text-gray-400 text-sm">Stop Loss: {STOP_LOSS_PERCENT}% | Take Profit: {TAKE_PROFIT_PERCENT}%</p>
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-2">Риск на сделку: {maxRiskPercent}%</label>
              <input type="range" min="1" max="10" step="0.5" value={maxRiskPercent} onChange={(e) => setMaxRiskPercent(parseFloat(e.target.value))} className="w-full accent-red-500" />
              <div className="mt-4 p-3 bg-red-950/30 rounded-lg">
                <div className="flex justify-between"><span className="text-gray-400">Баланс:</span><span className="text-white font-bold">${balance.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Сумма на сделку:</span><span className="text-yellow-400 font-bold">${maxPositionAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Stop Loss (2%):</span><span className="text-red-400">${(maxPositionAmount * STOP_LOSS_PERCENT / 100).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Take Profit (3%):</span><span className="text-green-400">${(maxPositionAmount * TAKE_PROFIT_PERCENT / 100).toLocaleString()}</span></div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-bold text-red-400 mb-3">📊 ОТКРЫТЫЕ ПОЗИЦИИ ({positions.length})</h3>
              {positions.length === 0 ? (
                <div className="text-gray-500 text-center py-4">Нет открытых позиций</div>
              ) : (
                <div className="space-y-2">
                  {positions.map((pos, idx) => {
                    const currentPrice = prices.get(pos.symbol) || pos.price;
                    const currentPnL = pos.side === 'buy' 
                      ? (currentPrice - pos.price) * pos.quantity
                      : (pos.price - currentPrice) * pos.quantity;
                    const currentPnLPercent = (currentPnL / (pos.price * pos.quantity)) * 100;
                    return (
                      <div key={idx} className="bg-gradient-to-r from-red-900/20 to-black rounded-lg p-3 border-l-4 border-yellow-500">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{pos.side === 'buy' ? '🟢' : '🔴'}</span>
                            <span className="font-bold text-white">{pos.symbol}</span>
                          </div>
                          <div className="text-yellow-400 font-mono">${pos.price.toFixed(4)}</div>
                        </div>
                        <div className="flex justify-between mt-2 text-xs">
                          <span className="text-green-400">TP: ${pos.tpPrice.toFixed(4)}</span>
                          <span className="text-red-400">SL: ${pos.slPrice.toFixed(4)}</span>
                          <span className={currentPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                            PnL: ${currentPnL.toFixed(2)} ({currentPnLPercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-red-400 mb-3">📜 ИСТОРИЯ СДЕЛОК ({tradeHistory.length})</h3>
              <div className="max-h-[200px] overflow-y-auto">
                {tradeHistory.length === 0 ? <div className="text-gray-500 text-center py-4">Нет сделок</div> : tradeHistory.slice(0, 20).map((trade, idx) => (
                  <div key={idx} className="border-b border-red-500/20 py-2 flex justify-between items-center">
                    <span>{trade.side === 'buy' ? '🟢' : '🔴'} {trade.symbol}</span>
                    <span>${trade.price.toFixed(4)}</span>
                    <span className={trade.profit && trade.profit > 0 ? 'text-green-400' : 'text-red-400'}>
                      {trade.profit ? `${trade.profit > 0 ? '+' : ''}$${trade.profit.toFixed(2)}` : '—'}
                    </span>
                    <span className="text-gray-500 text-xs">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
                {tradeHistory.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-red-500/30 text-right">
                    <span className="text-gray-400">Общий PnL: </span>
                    <span className={totalProfit >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                      {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USD
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="bg-black/40 rounded-xl border border-red-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-red-950/30 border-b border-red-500/30">
              <div className="text-sm font-semibold text-red-300">🎯 ЖЁСТКИЙ РЕЖИМ: RSI&lt;30 BUY / RSI&gt;70 SELL + MACD + EMA20&gt;EMA50 | {SYMBOLS.length} активов</div>
            </div>
            <div className="divide-y divide-red-900/20">
              {signals.length === 0 ? (
                <div className="text-center text-gray-500 py-16">⏳ Нет сигналов. Ожидаем RSI&lt;30 или RSI&gt;70...</div>
              ) : (
                signals.map((signal, idx) => {
                  const stars = '★'.repeat(signal.strength) + '☆'.repeat(3 - signal.strength);
                  return (
                    <div key={idx} className="p-4 hover:bg-red-900/10 cursor-pointer transition" onClick={() => openBybit(signal.symbol)}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">💰 {signal.symbol}</span>
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${signal.action === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                          {signal.action === 'buy' ? '🔥 BUY' : '💀 SELL'}
                        </span>
                        <span className="text-yellow-400 text-sm">⚡ {stars}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                        <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">RSI</div><div className="font-bold text-white">{signal.indicators.rsi.toFixed(1)}</div></div>
                        <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">MACD</div><div className="font-mono text-white">{signal.indicators.macd > 0 ? '+' : ''}{signal.indicators.macd.toFixed(4)}</div></div>
                        <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">EMA20/50</div><div className="text-white text-xs">{signal.indicators.ema20.toFixed(0)}/{signal.indicators.ema50.toFixed(0)}</div></div>
                        <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">Цена</div><div className="font-mono text-white">${signal.price.toLocaleString()}</div></div>
                      </div>
                      <div className="mt-2 text-xs text-red-400">🎯 {signal.reasons.join(' • ')}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
