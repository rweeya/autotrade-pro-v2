import React, { useState, useEffect, useRef } from 'react';

// @ts-ignore
import { createChart, ColorType } from 'lightweight-charts';

import { 
  Activity, TrendingUp, TrendingDown, Zap, Shield, Droplets, Sparkles, 
  Volume2, Timer, Target, Rocket, Brain, Gauge, Coins, BarChart3, 
  Clock, Percent, Wallet, History, Bot, Power, PowerOff, TriangleAlert, 
  CheckCircle2, XCircle, Loader2, Disc, Settings, DollarSign, 
  BarChart, LineChart, PieChart, RefreshCw, Award, Flame 
} from 'lucide-react';

// ==============================================
// 1. ТИПЫ
// ==============================================
interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Signal {
  id: string;
  asset: string;
  type: 'BUY' | 'SELL';
  price: number;
  timestamp: number;
  reason: string;
  rsi: number;
  macd: number;
  ema: number;
  strength: number;
}

interface Position {
  id: string;
  asset: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  amount: number;
  size: number;
  timestamp: number;
  tp: number;
  sl: number;
  status: 'open' | 'closed';
  closePrice?: number;
  pnl?: number;
  pnlPercent?: number;
  closeReason?: 'tp' | 'sl' | 'manual';
}

interface TradeHistory {
  id: string;
  asset: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  amount: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  openTime: number;
  closeTime: number;
  closeReason: 'tp' | 'sl' | 'manual';
}

// ==============================================
// 2. КОНФИГУРАЦИЯ
// ==============================================
const ASSETS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT', 'NEARUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT',
  'SUIUSDT', 'IMXUSDT', 'HBARUSDT', 'VETUSDT', 'GRTUSDT', 'RNDRUSDT', 'MKRUSDT', 'AAVEUSDT', 'SNXUSDT', 'CRVUSDT',
  'ALGOUSDT', 'FTMUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'AXSUSDT', 'ENJUSDT', 'CHZUSDT', 'THETAUSDT', 'EOSUSDT',
  'XTZUSDT', 'KSMUSDT', 'ZECUSDT', 'DASHUSDT', 'COMPUSDT', 'ZILUSDT', 'BATUSDT', 'ZRXUSDT', 'OMGUSDT', 'QTUMUSDT',
  'ICPUSDT', 'STXUSDT', 'KASUSDT', 'RUNEUSDT', 'EGLDUSDT', 'FLOWUSDT', 'WAVESUSDT', 'NEOUSDT', 'IOTAUSDT', 'XDCUSDT',
  'ONEUSDT', 'HOTUSDT', 'CROUSDT', 'OKBUSDT', 'LEOUSDT', 'CELOUSDT', 'ROSEUSDT', 'KLAYUSDT', 'CKBUSDT', 'ERGUSDT'
];

const DEFAULT_CONFIG = {
  rsiBuyThreshold: 55,
  rsiSellThreshold: 45,
  cooldownMinutes: 1.5,
  takeProfitPercent: 2.0,
  stopLossPercent: 1.5,
  maxConcurrentPositions: 8,
  updateIntervalMs: 1000,
  riskPercent: 5,
  useBybit: false,
};

// ==============================================
// 3. ТЕХНИЧЕСКИЕ ИНДИКАТОРЫ
// ==============================================
class TechnicalIndicators {
  static calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  static calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } | null {
    if (prices.length < 26) return null;
    
    const calculateEMA = (data: number[], period: number): number => {
      const k = 2 / (period + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
      }
      return ema;
    };
    
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    
    const macdValues: number[] = [];
    for (let i = 25; i < prices.length; i++) {
      const e12 = calculateEMA(prices.slice(0, i + 1), 12);
      const e26 = calculateEMA(prices.slice(0, i + 1), 26);
      macdValues.push(e12 - e26);
    }
    
    const signalLine = calculateEMA(macdValues, 9);
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }
  
  static calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }
}

// ==============================================
// 4. ВЕБСОКЕТ МЕНЕДЖЕР
// ==============================================
class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private isConnecting = false;
  private assets: string[];

  constructor(assets: string[]) {
    this.assets = assets;
    this.connect();
  }

  private connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const streams = this.assets.map(asset => `${asset.toLowerCase()}@kline_1m`).join('/');
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.data?.k) {
            const kline = data.data.k;
            const symbol = kline.s;
            const candle = {
              time: kline.t / 1000,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v),
            };
            this.notify(symbol, candle);
          }
        } catch (err) {
          console.error('WebSocket parse error:', err);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(() => this.connect(), 3000);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      setTimeout(() => this.connect(), 3000);
    }
  }

  private notify(symbol: string, data: any) {
    const handlers = this.subscribers.get(symbol);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  subscribe(symbol: string, callback: (data: any) => void) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);
    
    return () => {
      this.subscribers.get(symbol)?.delete(callback);
    };
  }
}

// ==============================================
// 5. ОСНОВНОЙ КОМПОНЕНТ APP
// ==============================================
function App() {
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');
  const [marketData, setMarketData] = useState<Map<string, KlineData[]>>(new Map());
  const [signals, setSignals] = useState<Signal[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [autoTrade, setAutoTrade] = useState(true);
  const [balance, setBalance] = useState(10000);
  const [initialBalance] = useState(10000);
  const [lastSignalTime, setLastSignalTime] = useState<Map<string, number>>(new Map());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeTab, setActiveTab] = useState<'signals' | 'positions' | 'history' | 'settings'>('signals');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  
  // Инициализация WebSocket
  useEffect(() => {
    wsManagerRef.current = new WebSocketManager(ASSETS);
    return () => {
      if (wsManagerRef.current) {
        // cleanup
      }
    };
  }, []);
  
  // Подписка на данные
  useEffect(() => {
    if (!wsManagerRef.current) return;
    
    const unsubscribe = wsManagerRef.current.subscribe(selectedAsset, (candle: KlineData) => {
      setMarketData(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(selectedAsset) || [];
        const lastCandle = existing[existing.length - 1];
        
        if (lastCandle && lastCandle.time === candle.time) {
          existing[existing.length - 1] = candle;
          newMap.set(selectedAsset, [...existing]);
        } else {
          newMap.set(selectedAsset, [...existing, candle].slice(-100));
        }
        return newMap;
      });
    });
    
    return () => unsubscribe();
  }, [selectedAsset]);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // Расчет размера позиции на основе риска
  const calculatePositionSize = (entryPrice: number, stopLossPrice: number): number => {
    const riskAmount = balance * (config.riskPercent / 100);
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
    if (riskPerUnit === 0) return 0;
    const positionSize = riskAmount / riskPerUnit;
    return Math.min(positionSize, balance / entryPrice);
  };
  
  // Генерация сигналов
  const generateSignals = () => {
    const newSignals: Signal[] = [];
    
    for (const asset of ASSETS) {
      const data = marketData.get(asset);
      if (!data || data.length < 30) continue;
      
      const prices = data.map(d => d.close);
      const rsi = TechnicalIndicators.calculateRSI(prices, 14);
      const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
      const ema50 = TechnicalIndicators.calculateEMA(prices, 50);
      const macdData = TechnicalIndicators.calculateMACD(prices);
      
      if (rsi === null || ema20 === null || ema50 === null || macdData === null) continue;
      
      const currentPrice = prices[prices.length - 1];
      
      const buyCondition = rsi < config.rsiBuyThreshold && macdData.histogram > 0 && ema20 > ema50;
      const sellCondition = rsi > config.rsiSellThreshold && macdData.histogram < 0 && ema20 < ema50;
      
      const lastSignal = lastSignalTime.get(asset) || 0;
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      
      const signalStrength = Math.min(100, Math.abs(50 - rsi) * 2 + Math.abs(macdData.histogram) * 10);
      
      if (buyCondition && Date.now() - lastSignal > cooldownMs) {
        newSignals.push({
          id: `${asset}_${Date.now()}`,
          asset,
          type: 'BUY',
          price: currentPrice,
          timestamp: Date.now(),
          reason: `RSI:${rsi.toFixed(1)} | MACD:${macdData.histogram.toFixed(2)}`,
          rsi,
          macd: macdData.histogram,
          ema: ema20,
          strength: signalStrength
        });
        setLastSignalTime(prev => new Map(prev).set(asset, Date.now()));
      }
      
      if (sellCondition && Date.now() - lastSignal > cooldownMs) {
        newSignals.push({
          id: `${asset}_${Date.now()}`,
          asset,
          type: 'SELL',
          price: currentPrice,
          timestamp: Date.now(),
          reason: `RSI:${rsi.toFixed(1)} | MACD:${macdData.histogram.toFixed(2)}`,
          rsi,
          macd: macdData.histogram,
          ema: ema50,
          strength: signalStrength
        });
        setLastSignalTime(prev => new Map(prev).set(asset, Date.now()));
      }
    }
    
    if (newSignals.length > 0) {
      setSignals(prev => [...newSignals, ...prev].slice(0, 100));
      showToast(`🔔 ${newSignals.length} новых сигналов!`, 'success');
      
      if (autoTrade) {
        executeAutoTrade(newSignals);
      }
    }
  };
  
  // Автоматическое исполнение сделок
  const executeAutoTrade = (newSignals: Signal[]) => {
    const openPositionsCount = positions.filter(p => p.status === 'open').length;
    
    if (openPositionsCount >= config.maxConcurrentPositions) {
      return;
    }
    
    for (const signal of newSignals) {
      const existingPosition = positions.find(p => p.asset === signal.asset && p.status === 'open');
      if (existingPosition) continue;
      
      const entryPrice = signal.price;
      const slPrice = signal.type === 'BUY'
        ? entryPrice * (1 - config.stopLossPercent / 100)
        : entryPrice * (1 + config.stopLossPercent / 100);
      const tpPrice = signal.type === 'BUY'
        ? entryPrice * (1 + config.takeProfitPercent / 100)
        : entryPrice * (1 - config.takeProfitPercent / 100);
      
      const positionSize = calculatePositionSize(entryPrice, slPrice);
      if (positionSize <= 0) continue;
      
      const positionAmount = positionSize * entryPrice;
      
      const newPosition: Position = {
        id: `${signal.asset}_${Date.now()}`,
        asset: signal.asset,
        type: signal.type,
        entryPrice,
        amount: positionAmount,
        size: positionSize,
        timestamp: Date.now(),
        tp: tpPrice,
        sl: slPrice,
        status: 'open'
      };
      
      setPositions(prev => [...prev, newPosition]);
      setBalance(prev => prev - positionAmount);
      showToast(`✅ ${signal.type} ${signal.asset} @ ${entryPrice.toFixed(2)} (${positionSize.toFixed(4)} units)`, 'success');
    }
  };
  
  // Проверка TP/SL
  const checkTP_SL = () => {
    const updatedPositions = [...positions];
    let positionsChanged = false;
    
    for (let i = 0; i < updatedPositions.length; i++) {
      const position = updatedPositions[i];
      if (position.status !== 'open') continue;
      
      const currentData = marketData.get(position.asset);
      if (!currentData || currentData.length === 0) continue;
      
      const currentPrice = currentData[currentData.length - 1].close;
      
      let shouldClose = false;
      let closeReason: 'tp' | 'sl' | 'manual' = 'manual';
      let exitPrice = currentPrice;
      
      if (position.type === 'BUY') {
        if (currentPrice >= position.tp) {
          shouldClose = true;
          closeReason = 'tp';
          exitPrice = position.tp;
        } else if (currentPrice <= position.sl) {
          shouldClose = true;
          closeReason = 'sl';
          exitPrice = position.sl;
        }
      } else {
        if (currentPrice <= position.tp) {
          shouldClose = true;
          closeReason = 'tp';
          exitPrice = position.tp;
        } else if (currentPrice >= position.sl) {
          shouldClose = true;
          closeReason = 'sl';
          exitPrice = position.sl;
        }
      }
      
      if (shouldClose) {
        const pnl = position.type === 'BUY'
          ? (exitPrice - position.entryPrice) * position.size
          : (position.entryPrice - exitPrice) * position.size;
        
        const pnlPercent = position.type === 'BUY'
          ? (exitPrice - position.entryPrice) / position.entryPrice * 100
          : (position.entryPrice - exitPrice) / position.entryPrice * 100;
        
        updatedPositions[i] = {
          ...position,
          status: 'closed',
          closePrice: exitPrice,
          pnl: pnl,
          pnlPercent: pnlPercent,
          closeReason: closeReason
        };
        
        setBalance(prev => prev + position.amount + pnl);
        
        const historyItem: TradeHistory = {
          id: position.id,
          asset: position.asset,
          type: position.type,
          entryPrice: position.entryPrice,
          exitPrice: exitPrice,
          amount: position.amount,
          size: position.size,
          pnl: pnl,
          pnlPercent: pnlPercent,
          openTime: position.timestamp,
          closeTime: Date.now(),
          closeReason: closeReason
        };
        
        setTradeHistory(prev => [historyItem, ...prev].slice(0, 500));
        showToast(`🎯 ${closeReason.toUpperCase()} ${position.asset} | ${pnlPercent.toFixed(2)}%`, pnlPercent > 0 ? 'success' : 'error');
        
        positionsChanged = true;
      }
    }
    
    if (positionsChanged) {
      setPositions(updatedPositions);
    }
  };
  
  // Автоматическое обновление
  useEffect(() => {
    const interval = setInterval(() => {
      generateSignals();
      checkTP_SL();
      setLastUpdateTime(Date.now());
    }, config.updateIntervalMs);
    
    return () => clearInterval(interval);
  }, [marketData, positions, autoTrade, config]);
  
  // Обновление графика
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    if (chartRef.current) {
      chartRef.current.remove();
    }
    
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0f' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1a1a2a' },
        horzLines: { color: '#1a1a2a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
    });
    
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ff3366',
      downColor: '#00cc88',
      borderVisible: false,
      wickUpColor: '#ff3366',
      wickDownColor: '#00cc88',
    });
    
    const data = marketData.get(selectedAsset) || [];
    const chartData = data.map(d => ({
      time: d.time as any,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    
    candlestickSeries.setData(chartData);
    chart.timeScale().fitContent();
    
    chartRef.current = chart;
    
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [selectedAsset, marketData]);
  
  const getWinRate = () => {
    if (tradeHistory.length === 0) return 0;
    const wins = tradeHistory.filter(t => t.pnl > 0).length;
    return (wins / tradeHistory.length * 100).toFixed(1);
  };
  
  const getTotalPnL = () => {
    return tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
  };
  
  const getTotalPnLPercent = () => {
    return (getTotalPnL() / initialBalance * 100).toFixed(1);
  };
  
  const getBestTrade = () => {
    if (tradeHistory.length === 0) return 0;
    return Math.max(...tradeHistory.map(t => t.pnlPercent));
  };
  
  const getWorstTrade = () => {
    if (tradeHistory.length === 0) return 0;
    return Math.min(...tradeHistory.map(t => t.pnlPercent));
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] text-gray-200">
      {/* Кровавый эффект */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-[15%] text-6xl opacity-10 animate-pulse">🩸</div>
        <div className="absolute bottom-20 right-[20%] text-7xl opacity-10 animate-pulse" style={{ animationDelay: '1s' }}>💧</div>
        <div className="absolute top-1/3 right-[10%] text-5xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}>🩸</div>
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                Auto Trade Pro V2
              </h1>
              <p className="text-xs text-gray-400">
                Scalping Terminal • {ASSETS.length}+ Assets • Auto-Refresh 1s
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black/40 rounded-lg px-4 py-2 border border-red-900/30">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${lastUpdateTime % 2000 < 1000 ? 'animate-spin' : ''}`} />
              <span className="text-sm text-gray-300">{config.updateIntervalMs}ms</span>
            </div>
            
            <div className="flex items-center gap-2 bg-black/40 rounded-lg px-4 py-2 border border-red-900/30">
              <Wallet className="w-4 h-4 text-red-400" />
              <span className="text-lg font-bold text-green-400">${balance.toFixed(2)}</span>
              <span className={`text-xs ${getTotalPnL() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({getTotalPnLPercent()}%)
              </span>
            </div>
            
            <button
              onClick={() => setAutoTrade(!autoTrade)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                autoTrade 
                  ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-lg shadow-red-900/30' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {autoTrade ? <Bot className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              {autoTrade ? 'Auto Trade ON' : 'Auto Trade OFF'}
            </button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <div className="bg-black/40 rounded-lg p-3 border border-red-900/30">
            <p className="text-[10px] text-gray-400">Win Rate</p>
            <p className="text-xl font-bold text-green-400">{getWinRate()}%</p>
          </div>
          
          <div className="bg-black/40 rounded-lg p-3 border border-red-900/30">
            <p className="text-[10px] text-gray-400">Total P/L</p>
            <p className={`text-xl font-bold ${getTotalPnL() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${getTotalPnL().toFixed(2)}
            </p>
          </div>
          
          <div className="bg-black/40 rounded-lg p-3 border border-red-900/30">
            <p className="text-[10px] text-gray-400">Open Pos</p>
            <p className="text-xl font-bold text-yellow-400">{positions.filter(p => p.status === 'open').length}</p>
          </div>
          
          <div className="bg-black/40 rounded-lg p-3 border border-red-900/30">
            <p className="text-[10px] text-gray-400">Total Trades</p>
            <p className="text-xl font-bold text-blue-400">{tradeHistory.length}</p>
          </div>
          
          <div className="bg-black/40 rounded-lg p-3 border border-red-900/30">
            <p className="text-[10px] text-gray-400">Best Trade</p>
            <p className="text-xl font-bold text-green-400">+{getBestTrade().toFixed(1)}%</p>
          </div>
          
          <div className="bg-black/40 rounded-lg p-3 border border-red-900/30">
            <p className="text-[10px] text-gray-400">Risk/Trade</p>
            <p className="text-xl font-bold text-orange-400">{config.riskPercent}%</p>
          </div>
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 bg-black/40 rounded-lg border border-red-900/30 p-4">
            <div className="flex justify-between items-center mb-4">
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="bg-black/60 border border-red-800 rounded-lg px-3 py-1.5 text-sm font-mono text-red-300"
              >
                {ASSETS.map(asset => (
                  <option key={asset} value={asset}>{asset}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live</span>
                <span>•</span>
                <span>1m candles</span>
              </div>
            </div>
            <div ref={chartContainerRef} className="w-full" style={{ height: '450px' }} />
          </div>
          
          {/* Tabs */}
          <div className="bg-black/40 rounded-lg border border-red-900/30 overflow-hidden">
            <div className="flex border-b border-red-900/30">
              {[
                { id: 'signals', label: 'Сигналы', icon: <Zap className="w-4 h-4" /> },
                { id: 'positions', label: 'Позиции', icon: <Activity className="w-4 h-4" /> },
                { id: 'history', label: 'История', icon: <History className="w-4 h-4" /> },
                { id: 'settings', label: 'Настройки', icon: <Settings className="w-4 h-4" /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-red-600/20 text-red-400 border-b-2 border-red-500'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="p-4 h-[500px] overflow-y-auto">
              {/* Signals */}
              {activeTab === 'signals' && (
                <div className="space-y-2">
                  {signals.slice(0, 50).map(signal => (
                    <div key={signal.id} className={`p-3 rounded-lg border-l-4 ${
                      signal.type === 'BUY' ? 'border-l-green-500 bg-green-900/10' : 'border-l-red-500 bg-red-900/10'
                    } bg-black/40`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold">{signal.asset}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              signal.type === 'BUY' ? 'bg-green-600/30 text-green-300' : 'bg-red-600/30 text-red-300'
                            }`}>{signal.type}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            RSI: {signal.rsi.toFixed(1)} | Price: ${signal.price.toFixed(4)}
                          </div>
                          <div className="text-[10px] text-gray-500">{signal.reason}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-gray-500">{new Date(signal.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {signals.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Brain className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      Ожидание сигналов...
                    </div>
                  )}
                </div>
              )}
              
              {/* Positions */}
              {activeTab === 'positions' && (
                <div className="space-y-2">
                  {positions.filter(p => p.status === 'open').map(pos => {
                    const currentData = marketData.get(pos.asset);
                    const currentPrice = currentData?.[currentData.length - 1]?.close || pos.entryPrice;
                    const unrealizedPnLPercent = pos.type === 'BUY'
                      ? (currentPrice - pos.entryPrice) / pos.entryPrice * 100
                      : (pos.entryPrice - currentPrice) / pos.entryPrice * 100;
                    
                    return (
                      <div key={pos.id} className="p-3 rounded-lg bg-black/40 border border-gray-700">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold">{pos.asset}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                pos.type === 'BUY' ? 'bg-green-600/30 text-green-300' : 'bg-red-600/30 text-red-300'
                              }`}>{pos.type}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Entry: ${pos.entryPrice.toFixed(4)} | Size: {pos.size.toFixed(4)}
                            </div>
                            <div className={`text-xs mt-1 ${unrealizedPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {unrealizedPnLPercent >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%
                            </div>
                          </div>
                          <div className="text-right text-xs text-gray-400">
                            <div>TP: ${pos.tp.toFixed(4)}</div>
                            <div>SL: ${pos.sl.toFixed(4)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {positions.filter(p => p.status === 'open').length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      Нет открытых позиций
                    </div>
                  )}
                </div>
              )}
              
              {/* History */}
              {activeTab === 'history' && (
                <div className="space-y-2">
                  {tradeHistory.slice(0, 100).map(trade => (
                    <div key={trade.id} className="p-2 rounded-lg bg-black/40 border border-gray-700">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{trade.asset}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            trade.type === 'BUY' ? 'bg-green-600/30 text-green-300' : 'bg-red-600/30 text-red-300'
                          }`}>{trade.type}</span>
                          <span className={`text-xs font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(trade.closeTime).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {tradeHistory.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      История пуста
                    </div>
                  )}
                </div>
              )}
              
              {/* Settings */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">
                      Риск на сделку: <span className="text-orange-400">{config.riskPercent}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={config.riskPercent}
                      onChange={(e) => setConfig({ ...config, riskPercent: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">
                      RSI для BUY: <span className="text-green-400">&lt; {config.rsiBuyThreshold}</span>
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="70"
                      value={config.rsiBuyThreshold}
                      onChange={(e) => setConfig({ ...config, rsiBuyThreshold: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">
                      RSI для SELL: <span className="text-red-400">&gt; {config.rsiSellThreshold}</span>
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="70"
                      value={config.rsiSellThreshold}
                      onChange={(e) => setConfig({ ...config, rsiSellThreshold: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">
                      Интервал обновления: <span className="text-purple-400">{config.updateIntervalMs}ms</span>
                    </label>
                    <input
                      type="range"
                      min="500"
                      max="5000"
                      step="100"
                      value={config.updateIntervalMs}
                      onChange={(e) => setConfig({ ...config, updateIntervalMs: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5" />}
            {toast.type === 'info' && <Loader2 className="w-5 h-5" />}
            <span className="text-sm">{toast.message}</span>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default App;
