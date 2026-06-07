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
  type: 'BUY' | 'SELL';
  price: number;
  timestamp: number;
  status: 'pending' | 'executed' | 'failed';
  rsi?: number;
  macd?: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  entryTime: number;
  exitTime?: number;
  pnl?: number;
  pnlPercent?: number;
  status: 'open' | 'closed';
  tpPrice?: number;
  slPrice?: number;
}

interface MACDValues {
  macd: number;
  signal: number;
  histogram: number;
}

const App: React.FC = () => {
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [signals, setSignals] = useState<Signal[]>(() => {
    const saved = localStorage.getItem('signals');
    return saved ? JSON.parse(saved) : [];
  });
  const [trades, setTrades] = useState<Trade[]>(() => {
    const saved = localStorage.getItem('trades');
    return saved ? JSON.parse(saved) : [];
  });
  const [balance, setBalance] = useState<number>(10000);
  const [totalPnL, setTotalPnL] = useState<number>(0);
  const [winRate, setWinRate] = useState<number>(0);
  const [autoTrade, setAutoTrade] = useState<boolean>(false);
  const [riskPercent, setRiskPercent] = useState<number>(5);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [lastTradeTime, setLastTradeTime] = useState<Map<string, number>>(new Map());
  const [isProcessing, setIsProcessing] = useState<Map<string, boolean>>(new Map());

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const macdHistoryRef = useRef<Map<string, MACDValues[]>>(new Map());
  const wsManagerRef = useRef<any>(null);
  const bybitRef = useRef<BybitTestnet | null>(null);

  // Загрузка баланса
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

  // Расчёт винрейта
  useEffect(() => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);
    if (closedTrades.length === 0) {
      setWinRate(0);
      setTotalPnL(0);
      return;
    }
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const totalPnLSum = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    setWinRate((wins / closedTrades.length) * 100);
    setTotalPnL(totalPnLSum);
  }, [trades]);

  // Сохранение в localStorage
  useEffect(() => {
    localStorage.setItem('signals', JSON.stringify(signals.slice(-500)));
  }, [signals]);

  useEffect(() => {
    localStorage.setItem('trades', JSON.stringify(trades));
  }, [trades]);

  // Расчёт RSI
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

  // Расчёт EMA
  const calculateEMA = (prices: number[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < prices.length; i++) {
      if (i === 0) {
        ema.push(prices[i]);
      } else {
        ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
      }
    }
    return ema;
  };

  // Расчёт MACD
  const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDValues => {
    if (prices.length < slowPeriod + signalPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
    
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    
    const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1];
    
    const macdValues: number[] = [];
    for (let i = 0; i < fastEMA.length; i++) {
      macdValues.push(fastEMA[i] - slowEMA[i]);
    }
    
    const signalLineEMA = calculateEMA(macdValues, signalPeriod);
    const signalLine = signalLineEMA[signalLineEMA.length - 1];
    const histogram = macdLine - signalLine;
    
    return { macd: macdLine, signal: signalLine, histogram };
  };

  // Генерация сигналов (мягкие условия)
  const generateSignal = (symbol: string, currentPrice: number): Signal | null => {
    const priceHistory = priceHistoryRef.current.get(symbol);
    if (!priceHistory || priceHistory.length < 50) return null;
    
    const rsi = calculateRSI(priceHistory, 14);
    const macd = calculateMACD(priceHistory, 12, 26, 9);
    
    // Мягкие условия для BUY
    let isBuySignal = false;
    if (rsi < 55) {
      const isMacdBullish = macd.macd > 0 || macd.histogram > 0;
      const macdHistory = macdHistoryRef.current.get(symbol);
      let isCrossOver = false;
      if (macdHistory && macdHistory.length >= 2) {
        const prevMacd = macdHistory[macdHistory.length - 2];
        isCrossOver = prevMacd.macd <= 0 && macd.macd > 0;
      }
      if (isMacdBullish || isCrossOver) {
        isBuySignal = true;
      }
    }
    
    // Мягкие условия для SELL
    let isSellSignal = false;
    if (rsi > 45) {
      const isMacdBearish = macd.macd < 0 || macd.histogram < 0;
      const macdHistory = macdHistoryRef.current.get(symbol);
      let isCrossUnder = false;
      if (macdHistory && macdHistory.length >= 2) {
        const prevMacd = macdHistory[macdHistory.length - 2];
        isCrossUnder = prevMacd.macd >= 0 && macd.macd < 0;
      }
      if (isMacdBearish || isCrossUnder) {
        isSellSignal = true;
      }
    }
    
    if (!isBuySignal && !isSellSignal) return null;
    
    const signalType = isBuySignal ? 'BUY' : 'SELL';
    console.log(`📊 Сигнал ${signalType} для ${symbol}: RSI=${rsi.toFixed(1)}, MACD=${macd.macd.toFixed(2)}`);
    
    return {
      id: `${symbol}_${Date.now()}_${Math.random()}`,
      symbol,
      type: signalType,
      price: currentPrice,
      timestamp: Date.now(),
      status: 'pending',
      rsi,
      macd: macd.macd
    };
  };

  // Исполнение сделки
  const executeTrade = async (signal: Signal) => {
    const { symbol, type, price } = signal;
    
    const lastTrade = lastTradeTime.get(symbol);
    if (lastTrade && Date.now() - lastTrade < 180000) {
      console.log(`⏰ Пропуск ${symbol}: слишком частая сделка`);
      return;
    }
    
    const openPosition = trades.find(t => t.symbol === symbol && t.status === 'open');
    if (openPosition) {
      console.log(`🚫 Позиция по ${symbol} уже открыта`);
      return;
    }
    
    if (isProcessing.get(symbol)) return;
    setIsProcessing(prev => new Map(prev).set(symbol, true));
    
    try {
      const bybit = bybitRef.current;
      if (!bybit) return;
      
      const currentBalance = await bybit.getBalance();
      const riskAmount = currentBalance * (riskPercent / 100);
      const quantity = riskAmount / price;
      const roundedQty = Math.floor(quantity * 1000) / 1000;
      
      if (roundedQty <= 0) return;
      
      const tpPrice = type === 'BUY' ? price * 1.03 : price * 0.97;
      const slPrice = type === 'BUY' ? price * 0.98 : price * 1.02;
      
      const orderResult = await bybit.placeOrder({
        symbol,
        side: type === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
        orderType: OrderType.MARKET,
        quantity: roundedQty,
        timeInForce: TimeInForce.IOC
      });
      
      if (orderResult && orderResult.orderId) {
        await bybit.setTradingStop({
          symbol,
          side: type === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
          takeProfit: tpPrice,
          stopLoss: slPrice
        });
        
        const newTrade: Trade = {
          id: orderResult.orderId,
          symbol,
          side: type,
          entryPrice: price,
          quantity: roundedQty,
          entryTime: Date.now(),
          status: 'open',
          tpPrice,
          slPrice
        };
        
        setTrades(prev => [...prev, newTrade]);
        setLastTradeTime(prev => new Map(prev).set(symbol, Date.now()));
        setSignals(prev => prev.map(s => s.id === signal.id ? { ...s, status: 'executed' } : s));
        
        console.log(`✅ Открыта ${type} позиция по ${symbol}`);
        const newBalance = await bybit.getBalance();
        setBalance(newBalance);
      }
    } catch (error) {
      console.error(error);
      setSignals(prev => prev.map(s => s.id === signal.id ? { ...s, status: 'failed' } : s));
    } finally {
      setIsProcessing(prev => {
        const newMap = new Map(prev);
        newMap.delete(symbol);
        return newMap;
      });
    }
  };

  // Обновление истории цен
  const updatePriceHistory = useCallback((symbol: string, price: number) => {
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
      setSignals(prev => [signal, ...prev]);
      if (autoTrade) {
        executeTrade(signal);
      }
    }
  }, [autoTrade]);

  // WebSocket подписка
  useEffect(() => {
    const wsManager = createWebSocketManager();
    wsManagerRef.current = wsManager;
    
    SYMBOLS.forEach(symbol => {
      wsManager.subscribe(symbol, (data: PriceData) => {
        setPrices(prev => new Map(prev).set(symbol, data));
        updatePriceHistory(symbol, data.price);
      });
    });
    
    return () => {
      wsManager.disconnect();
    };
  }, [updatePriceHistory]);

  // Мониторинг позиций
  useEffect(() => {
    const checkPositions = async () => {
      const bybit = bybitRef.current;
      if (!bybit) return;
      
      try {
        const positions = await bybit.getPositions();
        const openTrades = trades.filter(t => t.status === 'open');
        
        for (const trade of openTrades) {
          const position = positions.find((p: PositionInfo) => p.symbol === trade.symbol);
          
          if (!position || Math.abs(parseFloat(position.size)) < 0.0001) {
            const currentPrice = prices.get(trade.symbol)?.price || trade.entryPrice;
            const pnl = trade.side === 'BUY' 
              ? (currentPrice - trade.entryPrice) * trade.quantity
              : (trade.entryPrice - currentPrice) * trade.quantity;
            const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
            
            setTrades(prev => prev.map(t => 
              t.id === trade.id 
                ? { ...t, status: 'closed', exitPrice: currentPrice, exitTime: Date.now(), pnl, pnlPercent }
                : t
            ));
            
            const newBalance = await bybit.getBalance();
            setBalance(newBalance);
            console.log(`📉 Позиция ${trade.symbol} закрыта. PnL: $${pnl.toFixed(2)}`);
          }
        }
      } catch (error) {
        console.error('Ошибка проверки позиций:', error);
      }
    };
    
    const interval = setInterval(checkPositions, 5000);
    return () => clearInterval(interval);
  }, [trades, prices]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="blood-drop"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${4 + Math.random() * 6}s`
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6 bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
          <div>
            <h1 className="text-3xl font-bold text-red-500">💀 AUTO TRADE PRO V2 💀</h1>
            <p className="text-gray-400 text-sm">Скальпинг терминал | 300+ активов | Bybit Testnet</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">${balance.toFixed(2)}</div>
            <div className={`text-sm ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              PnL: ${totalPnL.toFixed(2)} | WR: {winRate.toFixed(1)}%
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <label className="text-gray-400 text-sm">🤖 АВТОТОРГОВЛЯ</label>
            <button
              onClick={() => setAutoTrade(!autoTrade)}
              className={`w-full mt-1 px-4 py-2 rounded font-bold transition ${
                autoTrade ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {autoTrade ? 'АКТИВНА 🔴' : 'ВЫКЛЮЧЕНА ⚫'}
            </button>
          </div>
          
          <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <label className="text-gray-400 text-sm">💰 РИСК НА СДЕЛКУ</label>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={riskPercent}
              onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <div className="text-center font-bold text-yellow-400">{riskPercent}%</div>
          </div>
          
          <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <label className="text-gray-400 text-sm">📊 ВЫБОР МОНЕТЫ</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full mt-1 bg-gray-800 border border-red-500/30 rounded px-2 py-1 text-white"
            >
              {SYMBOLS.slice(0, 50).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          
          <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <div className="text-gray-400 text-sm">📈 ТЕКУЩАЯ ЦЕНА</div>
            <div className="text-2xl font-bold text-green-400">
              ${prices.get(selectedSymbol)?.price?.toFixed(4) || '0'}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <TradingChart symbol={selectedSymbol} />
          </div>
          <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <Watchlist symbols={SYMBOLS} prices={prices} onSelect={setSelectedSymbol} />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <TopMovers symbols={SYMBOLS} prices={prices} />
          </div>
          <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
            <News />
          </div>
        </div>
        
        <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30 mb-6">
          <SignalHistory signals={signals} trades={trades} />
        </div>
        
        <div className="bg-black/50 backdrop-blur rounded-lg p-4 border border-red-500/30">
          <h2 className="text-xl font-bold text-red-400 mb-4">📋 ОТКРЫТЫЕ ПОЗИЦИИ</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-500/30 text-gray-400">
                  <th className="text-left py-2">МОНЕТА</th>
                  <th className="text-left py-2">ТИП</th>
                  <th className="text-right py-2">ЦЕНА ВХ.</th>
                  <th className="text-right py-2">TP</th>
                  <th className="text-right py-2">SL</th>
                  <th className="text-right py-2">ТЕКУЩИЙ P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.filter(t => t.status === 'open').map(trade => {
                  const currentPrice = prices.get(trade.symbol)?.price || trade.entryPrice;
                  const currentPnL = trade.side === 'BUY'
                    ? (currentPrice - trade.entryPrice) * trade.quantity
                    : (trade.entryPrice - currentPrice) * trade.quantity;
                  const currentPnLPercent = (currentPnL / (trade.entryPrice * trade.quantity)) * 100;
                  
                  return (
                    <tr key={trade.id} className="border-b border-gray-800">
                      <td className="py-2 font-bold">{trade.symbol}</td>
                      <td className={`py-2 ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.side}
                      </td>
                      <td className="text-right py-2">${trade.entryPrice.toFixed(4)}</td>
                      <td className="text-right py-2 text-green-400">${trade.tpPrice?.toFixed(4)}</td>
                      <td className="text-right py-2 text-red-400">${trade.slPrice?.toFixed(4)}</td>
                      <td className={`text-right py-2 ${currentPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${currentPnL.toFixed(2)} ({currentPnLPercent.toFixed(2)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
