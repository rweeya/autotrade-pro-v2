import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import SignalHistory from './components/SignalHistory';
import News from './components/News';
import TopMovers from './components/TopMovers';
import Watchlist from './components/Watchlist';
import { createWebSocketManager, PriceData } from './services/websocket';
import { BybitTestnet, OrderSide, OrderType, TimeInForce, PositionInfo } from './services/bybitTestnet';

// ==================== 300+ АКТИВОВ ====================
const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'NEAR/USDT',
  'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'INJ/USDT',
  'SUI/USDT', 'IMX/USDT', 'HBAR/USDT', 'VET/USDT', 'GRT/USDT',
  'RNDR/USDT', 'MKR/USDT', 'AAVE/USDT', 'SNX/USDT', 'CRV/USDT',
  'ALGO/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT',
  'AXS/USDT', 'ENJ/USDT', 'CHZ/USDT', 'THETA/USDT', 'EOS/USDT',
  'XTZ/USDT', 'KSM/USDT', 'ZEC/USDT', 'DASH/USDT', 'COMP/USDT',
  'ZIL/USDT', 'BAT/USDT', 'ZRX/USDT', 'OMG/USDT', 'QTUM/USDT',
  'ICP/USDT', 'STX/USDT', 'KAS/USDT', 'RUNE/USDT', 'EGLD/USDT',
  'FLOW/USDT', 'WAVES/USDT', 'NEO/USDT', 'IOTA/USDT', 'XDC/USDT',
  'ONE/USDT', 'HOT/USDT', 'CRO/USDT', 'OKB/USDT', 'LEO/USDT',
  'CELO/USDT', 'ROSE/USDT', 'KLAY/USDT', 'CKB/USDT', 'ERG/USDT',
  'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'FLOKI/USDT', 'SHIB/USDT',
  'SEI/USDT', 'TIA/USDT', 'PYTH/USDT', 'JUP/USDT', 'ONDO/USDT',
  'STRK/USDT', 'WLD/USDT', 'AGIX/USDT', 'OCEAN/USDT', 'FET/USDT',
  'LDO/USDT', 'BLUR/USDT', 'RDNT/USDT', 'MAGIC/USDT', 'GNS/USDT',
  'SSV/USDT', 'RPL/USDT', 'DGB/USDT', 'DCR/USDT', 'BTG/USDT',
  'NMR/USDT', 'STORJ/USDT', 'ANKR/USDT', 'REEF/USDT', 'COTI/USDT',
  'WIN/USDT', 'ALICE/USDT', 'TLM/USDT', 'MBOX/USDT', 'DAR/USDT',
  'RACA/USDT', 'HIGH/USDT', 'STG/USDT', 'LQTY/USDT', 'TRU/USDT',
  'BOND/USDT', 'MDX/USDT', 'FORTH/USDT', 'BAKE/USDT', 'BURGER/USDT',
  'CAKE/USDT', 'XVS/USDT', 'ALPACA/USDT', 'BETA/USDT', 'LAZIO/USDT',
  'SANTOS/USDT', 'PORTO/USDT', 'ACM/USDT', 'BAR/USDT', 'CITY/USDT',
  'PSG/USDT', 'JUV/USDT', 'ATM/USDT', 'INTER/USDT', '1INCH/USDT',
  'ABT/USDT', 'ACH/USDT', 'ADX/USDT', 'AEVO/USDT',
  'AGLD/USDT', 'ALCX/USDT', 'ALPHA/USDT', 'ALPINE/USDT', 'AMB/USDT',
  'AMP/USDT', 'ANC/USDT', 'ANT/USDT', 'APE/USDT', 'API3/USDT',
  'ARK/USDT', 'ARPA/USDT', 'AST/USDT', 'ASTR/USDT', 'ATA/USDT',
  'AUCTION/USDT', 'AUDIO/USDT', 'AURA/USDT', 'AXL/USDT', 'BADGER/USDT',
  'BAL/USDT', 'BAND/USDT', 'BEL/USDT', 'BICO/USDT', 'BNX/USDT'
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
  side: 'Buy' | 'Sell';
  price: number;
  quantity: number;
  timestamp: number;
  tpPrice?: number;
  slPrice?: number;
  profit?: number;
  status: 'open' | 'closed';
}

interface MACDValues {
  macd: number;
  signal: number;
  histogram: number;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('signals');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [balance, setBalance] = useState(10000);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);
  const [maxRiskPercent, setMaxRiskPercent] = useState(5);
  const [positions, setPositions] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [prices, setPrices] = useState<Map<string, number>>(new Map());

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const macdHistoryRef = useRef<Map<string, MACDValues[]>>(new Map());
  const wsManagerRef = useRef<any>(null);
  const bybitRef = useRef<BybitTestnet | null>(null);

  const STOP_LOSS_PERCENT = 2;
  const TAKE_PROFIT_PERCENT = 3;

  const maxPositionAmount = balance * (maxRiskPercent / 100);
  const buys = signals.filter(s => s.action === 'buy').length;
  const sells = signals.filter(s => s.action === 'sell').length;
  const formattedCurrentTime = currentTime.toLocaleTimeString('ru-RU');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedKeys = localStorage.getItem('bybit_api_keys');
    if (savedKeys) {
      const { key, secret } = JSON.parse(savedKeys);
      setApiKey(key);
      setApiSecret(secret);
      setApiConfigured(true);
    }
  }, []);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const bybit = BybitTestnet.getInstance();
        bybitRef.current = bybit;
        const bal = await bybit.getBalance();
        setBalance(bal);
      } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
      }
    };
    loadBalance();
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('trades');
    if (saved) {
      const parsed = JSON.parse(saved);
      setPositions(parsed.filter((t: Trade) => t.status === 'open'));
      setTradeHistory(parsed.filter((t: Trade) => t.status === 'closed'));
    }
  }, []);

  useEffect(() => {
    const allTrades = [...positions, ...tradeHistory];
    localStorage.setItem('trades', JSON.stringify(allTrades));
  }, [positions, tradeHistory]);

  const saveApiKeys = () => {
    if (apiKey && apiSecret) {
      localStorage.setItem('bybit_api_keys', JSON.stringify({ key: apiKey, secret: apiSecret }));
      setApiConfigured(true);
      alert('API ключи сохранены!');
    }
  };

  const resetAccount = () => {
    if (window.confirm('Сбросить счет до $10,000?')) {
      setBalance(10000);
      setPositions([]);
      setTradeHistory([]);
      localStorage.removeItem('trades');
      localStorage.removeItem('bybit_api_keys');
      setApiConfigured(false);
      setAutoTradeEnabled(false);
      alert('Счет сброшен!');
    }
  };

  const closeAllPositions = async () => {
    if (window.confirm('Закрыть все позиции?')) {
      for (const pos of positions) {
        await closePosition(pos);
      }
    }
  };

  const closePosition = async (trade: Trade) => {
    try {
      const currentPrice = prices.get(trade.symbol) || trade.price;
      const pnl = trade.side === 'Buy' 
        ? (currentPrice - trade.price) * trade.quantity
        : (trade.price - currentPrice) * trade.quantity;
      
      const closedTrade = { ...trade, status: 'closed' as const, profit: pnl };
      setPositions(prev => prev.filter(p => p.id !== trade.id));
      setTradeHistory(prev => [closedTrade, ...prev]);
      
      console.log(`📉 Позиция ${trade.symbol} закрыта. PnL: $${pnl.toFixed(2)}`);
    } catch (error) {
      console.error('Ошибка закрытия позиции:', error);
    }
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

  const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDValues => {
    if (prices.length < slowPeriod + signalPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
    
    const calculateEMAArray = (data: number[], period: number): number[] => {
      const ema: number[] = [];
      const multiplier = 2 / (period + 1);
      
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          ema.push(data[i]);
        } else {
          ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]);
        }
      }
      return ema;
    };
    
    const fastEMA = calculateEMAArray(prices, fastPeriod);
    const slowEMA = calculateEMAArray(prices, slowPeriod);
    
    const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1];
    
    const macdValues: number[] = [];
    for (let i = 0; i < fastEMA.length; i++) {
      macdValues.push(fastEMA[i] - slowEMA[i]);
    }
    
    const signalLineEMA = calculateEMAArray(macdValues, signalPeriod);
    const signalLine = signalLineEMA[signalLineEMA.length - 1];
    const histogram = macdLine - signalLine;
    
    return { macd: macdLine, signal: signalLine, histogram };
  };

  const generateSignal = (symbol: string, currentPrice: number): Signal | null => {
    const priceHistory = priceHistoryRef.current.get(symbol);
    if (!priceHistory || priceHistory.length < 50) return null;
    
    const rsi = calculateRSI(priceHistory, 14);
    const macd = calculateMACD(priceHistory, 12, 26, 9);
    const ema20 = calculateEMA(priceHistory, 20);
    const ema50 = calculateEMA(priceHistory, 50);
    
    let action: 'buy' | 'sell' | null = null;
    const reasons: string[] = [];
    
    // BUY: RSI < 30 + MACD бычий + EMA20 > EMA50
    if (rsi < 30) {
      const isMacdBullish = macd.macd > 0 || macd.histogram > 0;
      if ((isMacdBullish) && ema20 > ema50) {
        action = 'buy';
        reasons.push(`RSI ${rsi.toFixed(1)} < 30`);
        reasons.push(`MACD бычий (${macd.macd > 0 ? '+' : ''}${macd.macd.toFixed(2)})`);
        reasons.push(`EMA20(${ema20.toFixed(0)}) > EMA50(${ema50.toFixed(0)})`);
      }
    }
    
    // SELL: RSI > 70 + MACD медвежий + EMA20 < EMA50
    if (rsi > 70) {
      const isMacdBearish = macd.macd < 0 || macd.histogram < 0;
      if ((isMacdBearish) && ema20 < ema50) {
        action = 'sell';
        reasons.push(`RSI ${rsi.toFixed(1)} > 70`);
        reasons.push(`MACD медвежий (${macd.macd > 0 ? '+' : ''}${macd.macd.toFixed(2)})`);
        reasons.push(`EMA20(${ema20.toFixed(0)}) < EMA50(${ema50.toFixed(0)})`);
      }
    }
    
    if (!action) return null;
    
    let strength = 1;
    if (rsi < 20 || rsi > 80) strength = 3;
    else if (rsi < 25 || rsi > 75) strength = 2;
    
    console.log(`📊 ${action.toUpperCase()} ${symbol} | RSI=${rsi.toFixed(1)}`);
    
    return {
      id: `${symbol}_${Date.now()}`,
      symbol,
      action,
      price: currentPrice,
      timestamp: Date.now(),
      strength,
      indicators: { rsi, macd: macd.macd, ema20, ema50 },
      reasons
    };
  };

  const executeTrade = async (signal: Signal) => {
    if (!autoTradeEnabled) return;
    if (!bybitRef.current) return;
    
    const existingPosition = positions.find(p => p.symbol === signal.symbol);
    if (existingPosition) {
      console.log(`🚫 Позиция по ${signal.symbol} уже открыта`);
      return;
    }
    
    try {
      const bybit = bybitRef.current;
      const currentBalance = await bybit.getBalance();
      const riskAmount = currentBalance * (maxRiskPercent / 100);
      const quantity = riskAmount / signal.price;
      const roundedQty = Math.floor(quantity * 1000) / 1000;
      
      if (roundedQty <= 0) return;
      
      const tpPrice = signal.action === 'buy' ? signal.price * (1 + TAKE_PROFIT_PERCENT / 100) : signal.price * (1 - TAKE_PROFIT_PERCENT / 100);
      const slPrice = signal.action === 'buy' ? signal.price * (1 - STOP_LOSS_PERCENT / 100) : signal.price * (1 + STOP_LOSS_PERCENT / 100);
      
      const orderSide = signal.action === 'buy' ? OrderSide.BUY : OrderSide.SELL;
      
      const orderResult = await bybit.placeOrder({
        symbol: signal.symbol,
        side: orderSide,
        orderType: OrderType.MARKET,
        quantity: roundedQty,
        timeInForce: TimeInForce.IOC
      });
      
      if (orderResult && orderResult.orderId) {
        await bybit.setTradingStop({
          symbol: signal.symbol,
          side: orderSide,
          takeProfit: tpPrice,
          stopLoss: slPrice
        });
        
        const newTrade: Trade = {
          id: orderResult.orderId,
          symbol: signal.symbol,
          side: signal.action === 'buy' ? 'Buy' : 'Sell',
          price: signal.price,
          quantity: roundedQty,
          timestamp: Date.now(),
          tpPrice,
          slPrice,
          status: 'open'
        };
        
        setPositions(prev => [...prev, newTrade]);
        console.log(`✅ ОТКРЫТА: ${signal.action.toUpperCase()} ${signal.symbol} | TP: $${tpPrice.toFixed(4)} | SL: $${slPrice.toFixed(4)}`);
      }
    } catch (error) {
      console.error('Ошибка открытия позиции:', error);
    }
  };

  const updatePriceHistory = useCallback((symbol: string, price: number) => {
    setPrices(prev => new Map(prev).set(symbol, price));
    
    let history = priceHistoryRef.current.get(symbol) || [];
    history.push(price);
    if (history.length > 200) history = history.slice(-200);
    priceHistoryRef.current.set(symbol, history);
    
    if (history.length >= 50) {
      const macd = calculateMACD(history, 12, 26, 9);
      let macdHistory = macdHistoryRef.current.get(symbol) || [];
      macdHistory.push(macd);
      if (macdHistory.length > 50) macdHistory = macdHistory.slice(-50);
      macdHistoryRef.current.set(symbol, macdHistory);
    }
    
    const signal = generateSignal(symbol, price);
    if (signal) {
      setSignals(prev => [signal, ...prev].slice(0, 200));
      if (autoTradeEnabled && apiConfigured) {
        executeTrade(signal);
      }
    }
    
    const openPosition = positions.find(p => p.symbol === symbol);
    if (openPosition) {
      if (openPosition.side === 'Buy') {
        if (price >= (openPosition.tpPrice || 0)) {
          console.log(`🎯 TP достигнут для ${symbol}`);
          closePosition(openPosition);
        } else if (price <= (openPosition.slPrice || 0)) {
          console.log(`🛑 SL достигнут для ${symbol}`);
          closePosition(openPosition);
        }
      } else {
        if (price <= (openPosition.tpPrice || 0)) {
          console.log(`🎯 TP достигнут для ${symbol}`);
          closePosition(openPosition);
        } else if (price >= (openPosition.slPrice || 0)) {
          console.log(`🛑 SL достигнут для ${symbol}`);
          closePosition(openPosition);
        }
      }
    }
  }, [autoTradeEnabled, apiConfigured, positions, maxRiskPercent]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-black">
      <header className="border-b border-red-500/30 bg-black/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">💀 AUTO TRADE PRO | {SYMBOLS.length} активов</h1>
          <div className="flex gap-4 items-center">
            <div className="text-sm text-gray-400 font-mono">{formattedCurrentTime}</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/60 rounded-2xl p-5 border border-red-500/30"><div className="text-3xl font-bold text-red-400">{signals.length}</div><div className="text-gray-400 text-sm">Активных сигналов</div></div>
          <div className="bg-black/60 rounded-2xl p-5 border border-green-500/30"><div className="text-3xl font-bold text-green-500">{buys}</div><div className="text-gray-400 text-sm">BUY сигналов</div></div>
          <div className="bg-black/60 rounded-2xl p-5 border border-red-500/30"><div className="text-3xl font-bold text-red-500">{sells}</div><div className="text-gray-400 text-sm">SELL сигналов</div></div>
          <div className="bg-black/60 rounded-2xl p-5 border border-yellow-500/30"><div className="text-3xl font-bold text-yellow-500">🔥</div><div className="text-gray-400 text-sm">ЖЁСТКИЙ РЕЖИМ</div></div>
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
              {SYMBOLS.slice(0, 50).map(s => <option key={s} value={s}>{s}</option>)}
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
            
            {!apiConfigured ? (
              <div className="space-y-4">
                <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" className="w-full bg-black/50 border border-red-500/50 rounded-lg p-3 text-white" />
                <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="API Secret" className="w-full bg-black/50 border border-red-500/50 rounded-lg p-3 text-white" />
                <button onClick={saveApiKeys} className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg font-bold">Сохранить ключи</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4 flex-wrap mb-6">
                  <div className="text-green-400">✅ API ключи настроены</div>
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
                  </div>
                )}
                
                <div className="mb-6">
                  <label className="block text-gray-400 text-sm mb-2">Риск на сделку: {maxRiskPercent}%</label>
                  <input type="range" min="1" max="10" step="0.5" value={maxRiskPercent} onChange={(e) => setMaxRiskPercent(parseFloat(e.target.value))} className="w-full accent-red-500" />
                  <div className="mt-4 p-3 bg-red-950/30 rounded-lg">
                    <div className="flex justify-between"><span className="text-gray-400">Баланс:</span><span className="text-white font-bold">${balance.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Сумма на сделку:</span><span className="text-yellow-400 font-bold">${maxPositionAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Stop Loss (2%):</span><span className="text-red-400">${(maxPositionAmount * 0.02).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Take Profit (3%):</span><span className="text-green-400">${(maxPositionAmount * 0.03).toLocaleString()}</span></div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-red-400 mb-3">📊 ОТКРЫТЫЕ ПОЗИЦИИ ({positions.length})</h3>
                  {positions.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">Нет открытых позиций</div>
                  ) : (
                    <div className="space-y-2">
                      {positions.map((pos, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-red-900/20 to-black rounded-lg p-3 border-l-4 border-yellow-500">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{pos.side === 'Buy' ? '🟢' : '🔴'}</span>
                              <span className="font-bold text-white">{pos.symbol}</span>
                            </div>
                            <div className="text-yellow-400 font-mono">${pos.price.toFixed(4)}</div>
                          </div>
                          <div className="flex justify-between mt-2 text-xs">
                            <span className="text-green-400">TP: ${pos.tpPrice?.toFixed(4)}</span>
                            <span className="text-red-400">SL: ${pos.slPrice?.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-red-400 mb-3">📜 ИСТОРИЯ СДЕЛОК</h3>
                  <div className="max-h-[200px] overflow-y-auto">
                    {tradeHistory.length === 0 ? <div className="text-gray-500 text-center py-4">Нет сделок</div> : tradeHistory.slice(0, 20).map((trade, idx) => (
                      <div key={idx} className="border-b border-red-500/20 py-2 flex justify-between items-center">
                        <span>{trade.side === 'Buy' ? '🟢' : '🔴'} {trade.symbol}</span>
                        <span>${trade.price.toFixed(4)}</span>
                        <span className={trade.profit && trade.profit > 0 ? 'text-green-400' : trade.profit && trade.profit < 0 ? 'text-red-400' : 'text-gray-400'}>
                          {trade.profit ? `${trade.profit > 0 ? '+' : ''}$${trade.profit.toFixed(2)}` : '—'}
                        </span>
                        <span className="text-gray-500 text-xs">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="bg-black/40 rounded-xl border border-red-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-red-950/30 border-b border-red-500/30">
              <div className="text-sm font-semibold text-red-300">🎯 ЖЁСТКИЙ РЕЖИМ: RSI&lt;30 BUY / RSI&gt;70 SELL + MACD + EMA20&gt;EMA50</div>
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
                        <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">RSI</div><div className={`font-bold ${signal.indicators.rsi < 30 ? 'text-green-400' : 'text-red-400'}`}>{signal.indicators.rsi.toFixed(1)}</div></div>
                        <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">MACD</div><div className="font-mono text-white">{signal.indicators.macd > 0 ? '+' : ''}{signal.indicators.macd.toFixed(4)}</div></div>
                        <div className="bg-black/40 rounded-lg p-2 text-center"><div className="text-gray-500">EMA20/50</div><div className={`text-white text-xs ${signal.indicators.ema20 > signal.indicators.ema50 ? 'text-green-400' : 'text-red-400'}`}>{signal.indicators.ema20.toFixed(0)}/{signal.indicators.ema50.toFixed(0)}</div></div>
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
