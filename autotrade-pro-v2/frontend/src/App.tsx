import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import SignalHistory from './components/SignalHistory';
import News from './components/News';
import { createWebSocketManager, PriceData } from './services/websocket';

const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT',
  'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'LTC/USDT', 'UNI/USDT', 'ATOM/USDT',
  'ETC/USDT', 'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'NEAR/USDT',
  'INJ/USDT', 'IMX/USDT', 'HBAR/USDT', 'VET/USDT', 'GRT/USDT', 'RNDR/USDT', 'MKR/USDT',
  'AAVE/USDT', 'ALGO/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT', 'AXS/USDT',
  'CHZ/USDT', 'EOS/USDT', 'KSM/USDT', 'ZEC/USDT', 'COMP/USDT', 'ICP/USDT', 'STX/USDT',
  'KAS/USDT', 'RUNE/USDT', 'EGLD/USDT', 'FLOW/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT',
  'SHIB/USDT', 'SEI/USDT', 'WLD/USDT', 'TIA/USDT', 'JUP/USDT', 'PYTH/USDT',
  'ENA/USDT', 'FET/USDT', 'BEAM/USDT', 'BLUR/USDT', 'ORDI/USDT', 'PENDLE/USDT',
  'ENS/USDT', 'LDO/USDT', 'TON/USDT', 'NOT/USDT', 'MEW/USDT', 'POPCAT/USDT',
  'RAY/USDT', 'JTO/USDT', 'TRX/USDT', 'XLM/USDT'
];

interface Signal {
  id: string;
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  timestamp: number;
  strength: 1 | 2 | 3;
  rsi: number;
  stochK: number;
  macd: number;
  ema20: number;
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('autotrade');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [balance, setBalance] = useState(10000);
  const [totalProfit, setTotalProfit] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [autoTrade, setAutoTrade] = useState(false);
  const [riskPercent, setRiskPercent] = useState(() => {
    const saved = localStorage.getItem('riskPercent');
    return saved ? parseFloat(saved) : 5;
  });
  const [aggressiveMode, setAggressiveMode] = useState(() => localStorage.getItem('aggressiveMode') === 'true');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnectedCount, setWsConnectedCount] = useState(0);
  const [totalUnrealizedPnL, setTotalUnrealizedPnL] = useState(0);

  const TP_PERCENT = aggressiveMode ? 2.5 : 1.8;
  const SL_PERCENT = aggressiveMode ? 1.0 : 0.7;
  const RSI_BUY_MAX = aggressiveMode ? 22 : 28;
  const RSI_SELL_MIN = aggressiveMode ? 78 : 72;
  const STOCH_BUY_MAX = aggressiveMode ? 12 : 18;
  const STOCH_SELL_MIN = aggressiveMode ? 88 : 82;
  const ADX_MIN = aggressiveMode ? 30 : 25;
  const ATR_MIN_PERCENT = 0.25;
  const COOLDOWN_MS = aggressiveMode ? 45000 : 90000;

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

  useEffect(() => { localStorage.setItem('aggressiveMode', aggressiveMode.toString()); }, [aggressiveMode]);
  useEffect(() => { localStorage.setItem('riskPercent', riskPercent.toString()); }, [riskPercent]);

  useEffect(() => {
    const interval = setInterval(() => {
      let totalPnl = 0;
      for (const t of trades.filter(t => t.status === 'open')) {
        const cp = prices.get(t.symbol) || t.entryPrice;
        const pnl = t.side === 'buy' ? (cp - t.entryPrice) * t.quantity : (t.entryPrice - cp) * t.quantity;
        totalPnl += pnl;
      }
      setTotalUnrealizedPnL(totalPnl);
    }, 1000);
    return () => clearInterval(interval);
  }, [trades, prices]);

  const formatNumber = (n: number) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
  const formatPrice = (p: number) => p ? (p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6)) : '0.0000';
  const formatTime = (t: number) => t ? new Date(t).toLocaleTimeString() : '--:--:--';

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const closed = trades.filter(t => t.status === 'closed' && t.profit !== null);
    setWinRate(closed.length ? (closed.filter(t => (t.profit || 0) > 0).length / closed.length) * 100 : 0);
  }, [trades]);

  const calcRSI = (p: number[], per = 14) => {
    if (!p || p.length < per + 1) return 50;
    let g = 0, l = 0;
    for (let i = p.length - per; i < p.length; i++) { const d = p[i] - p[i - 1]; if (d >= 0) g += d; else l -= d; }
    if (l === 0) return 100;
    return Math.round(100 - 100 / (1 + (g / per) / (l / per)));
  };
  const calcEMA = (p: number[], per: number) => {
    if (!p || p.length < per) return p?.[p.length - 1] || 0;
    const k = 2 / (per + 1); let e = p[0];
    for (let i = 1; i < p.length; i++) e = (p[i] - e) * k + e;
    return e;
  };
  const calcMACD = (p: number[]) => p?.length >= 35 ? parseFloat((calcEMA(p, 12) - calcEMA(p, 26)).toFixed(4)) : 0;
  const calcADX = (p: number[], per = 14) => {
    if (!p || p.length < per * 2) return 0;
    const tr: number[] = [], pDM: number[] = [], mDM: number[] = [];
    for (let i = 1; i < p.length; i++) {
      const h = Math.max(p[i], p[i - 1]), l = Math.min(p[i], p[i - 1]);
      const pH = Math.max(p[i - 1], p[i - 2] || p[i - 1]), pL = Math.min(p[i - 1], p[i - 2] || p[i - 1]);
      tr.push(Math.max(h - l, Math.abs(h - p[i - 1]), Math.abs(l - p[i - 1])));
      pDM.push(h - pH > 0 && h - pH > pL - l ? h - pH : 0);
      mDM.push(pL - l > 0 && pL - l > h - pH ? pL - l : 0);
    }
    const smooth = (d: number[]) => { const k = 2 / (per + 1); let e = d[0]; for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k); return e; };
    const atr = smooth(tr); if (!atr) return 0;
    return Math.abs(smooth(pDM) - smooth(mDM)) / (smooth(pDM) + smooth(mDM)) * 100;
  };
  const calcATR = (p: number[], per = 14) => {
    if (!p || p.length < per + 1) return (p?.[p.length - 1] || 1) * 0.01;
    const tr = p.slice(1).map((v, i) => Math.abs(v - p[i]));
    let atr = tr.slice(0, per).reduce((a, b) => a + b, 0) / per;
    for (let i = per; i < tr.length; i++) atr = (atr * (per - 1) + tr[i]) / per;
    return atr;
  };
  const calcStochastic = (p: number[], per = 14) => {
    if (!p || p.length < per) return 50;
    const slice = p.slice(-per);
    const h = Math.max(...slice), l = Math.min(...slice);
    if (h === l) return 50;
    return ((p[p.length - 1] - l) / (h - l)) * 100;
  };

  const generateSignal = (symbol: string, price: number): Signal | null => {
    if (!price || price <= 0) return null;
    const h = priceHistoryRef.current.get(symbol);
    if (!h || h.length < 60) return null;
    
    const lastSig = lastSignalTimeForSymbol.current.get(symbol);
    if (lastSig && Date.now() - lastSig < COOLDOWN_MS) return null;

    const rsi = calcRSI(h);
    const stoch = calcStochastic(h);
    const macd = calcMACD(h);
    const ema20 = calcEMA(h, 20);
    const adx = calcADX(h);
    const atr = calcATR(h);

    if (atr / price * 100 < ATR_MIN_PERCENT) return null;
    if (adx < ADX_MIN) return null;

    const buyCondition = rsi < RSI_BUY_MAX && stoch < STOCH_BUY_MAX && macd > 0 && price > ema20;
    const sellCondition = rsi > RSI_SELL_MIN && stoch > STOCH_SELL_MIN && macd < 0 && price < ema20;

    if (!buyCondition && !sellCondition) return null;

    const action = buyCondition ? 'buy' : 'sell';
    const reasons = [
      `RSI:${rsi}`, `Stoch:${stoch.toFixed(0)}`, `ADX:${adx.toFixed(0)}`,
      `MACD:${macd > 0 ? '↑' : '↓'}`, `ATR:${(atr / price * 100).toFixed(2)}%`
    ];

    lastSignalTimeForSymbol.current.set(symbol, Date.now());
    const strength = (rsi < 15 || rsi > 85) ? 3 : (rsi < 20 || rsi > 80) ? 2 : 1;

    return {
      id: `${symbol}_${Date.now()}`, symbol, action: action as 'buy' | 'sell', price,
      timestamp: Date.now(), strength: strength as 1 | 2 | 3,
      rsi, stochK: stoch, macd, ema20, adx, atr, reasons
    };
  };

  const executeTrade = useCallback((s: Signal) => {
    if (!autoTradeRef.current || !s?.price) return;
    if (tradesRef.current.find(t => t.symbol === s.symbol && t.status === 'open')) return;
    
    const lastTrade = lastTradeTimeForSymbol.current.get(s.symbol);
    if (lastTrade && Date.now() - lastTrade < COOLDOWN_MS) return;

    const amt = balanceRef.current * riskPercentRef.current / 100;
    if (amt <= 0 || amt > balanceRef.current) return;
    const qty = Math.floor(amt / s.price * 1000) / 1000;
    if (!qty) return;

    const tp = s.action === 'buy' ? s.price * (1 + TP_PERCENT / 100) : s.price * (1 - TP_PERCENT / 100);
    const sl = s.action === 'buy' ? s.price * (1 - SL_PERCENT / 100) : s.price * (1 + SL_PERCENT / 100);

    lastTradeTimeForSymbol.current.set(s.symbol, Date.now());
    setBalance(p => p - amt);
    setTrades(p => [...p, {
      id: `${s.symbol}_${Date.now()}`, symbol: s.symbol, side: s.action,
      entryPrice: s.price, exitPrice: null, quantity: qty, invested: amt,
      entryTime: Date.now(), exitTime: null, profit: null, profitPercent: null,
      status: 'open' as const, tpPrice: +tp.toFixed(4), slPrice: +sl.toFixed(4),
      breakevenActivated: false
    }]);
  }, [TP_PERCENT, SL_PERCENT, COOLDOWN_MS]);

  const closeTrade = useCallback((t: Trade, cp: number, reason: string) => {
    if (!t || !cp) return;
    const inv = t.entryPrice * t.quantity;
    const prof = t.side === 'buy' ? (cp - t.entryPrice) * t.quantity : (t.entryPrice - cp) * t.quantity;
    const pPct = t.side === 'buy' ? (cp - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - cp) / t.entryPrice * 100;
    setBalance(p => p + inv + prof);
    setTotalProfit(p => p + prof);
    setTrades(p => p.map(x => x.id === t.id ? { ...x, status: 'closed' as const, exitPrice: cp, exitTime: Date.now(), profit: prof, profitPercent: pPct } : x));
  }, []);

  useEffect(() => {
    const check = () => {
      for (const t of trades.filter(t => t.status === 'open')) {
        const cp = prices.get(t.symbol);
        if (!cp) continue;
        if ((t.side === 'buy' && cp >= t.tpPrice) || (t.side === 'sell' && cp <= t.tpPrice)) { closeTrade(t, cp, 'TP'); continue; }
        if ((t.side === 'buy' && cp <= t.slPrice) || (t.side === 'sell' && cp >= t.slPrice)) { closeTrade(t, cp, 'SL'); continue; }
        if (!t.breakevenActivated) {
          const pPct = t.side === 'buy' ? (cp - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - cp) / t.entryPrice * 100;
          if (pPct >= TP_PERCENT * 0.6) {
            setTrades(p => p.map(x => x.id === t.id ? { ...x, slPrice: x.entryPrice, breakevenActivated: true } : x));
          }
        }
      }
    };
    const i = setInterval(check, 3000);
    return () => clearInterval(i);
  }, [trades, prices, closeTrade, TP_PERCENT]);

  const updatePrice = useCallback((data: PriceData) => {
    if (!data?.symbol || !data.price || data.price <= 0) return;
    const { symbol, price } = data;
    setPrices(p => new Map(p).set(symbol, price));
    let h = priceHistoryRef.current.get(symbol) || [];
    h.push(price);
    if (h.length > 200) h = h.slice(-200);
    priceHistoryRef.current.set(symbol, h);

    const sig = generateSignal(symbol, price);
    if (sig) {
      setSignals(p => [sig, ...p].slice(0, 100));
      if (autoTradeRef.current) executeTrade(sig);
    }
  }, [executeTrade]);

  useEffect(() => {
    const w = createWebSocketManager();
    wsRef.current = w;
    w.subscribe(SYMBOLS, (d: PriceData) => {
      if (d?.symbol && d.price) {
        if (!connectedRef.current.has(d.symbol)) {
          connectedRef.current.add(d.symbol);
          setWsConnectedCount(p => p + 1);
        }
        if (!wsConnected) setWsConnected(true);
        updatePrice(d);
      }
    });
    return () => w.disconnect();
  }, [updatePrice, wsConnected]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  const equity = balance + totalUnrealizedPnL;

  return (
    <div className="min-h-screen bg-black text-white relative">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_25%,#000_45%,#0a0015_65%,transparent_100%)] shadow-[0_0_250px_100px_rgba(50,0,100,0.25)] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(100,0,180,0.2),rgba(180,0,80,0.15),transparent)] blur-3xl animate-spin" style={{ animationDuration: '35s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-[0_0_60px_30px_rgba(255,255,255,0.7)] animate-pulse" style={{ animationDuration: '4s' }} />
        </div>
      </div>

      <header className="relative z-20 border-b border-purple-500/30 bg-black/90 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">🌌</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className="text-xs text-gray-500">{SYMBOLS.length} активов | RSI {RSI_BUY_MAX}/{RSI_SELL_MIN} | ADX {ADX_MIN}+</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right"><div className="text-xs text-gray-500">Баланс</div><div className="text-lg font-bold text-green-400">${formatNumber(balance)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-500">Equity</div><div className={`text-lg font-bold ${equity >= 10000 ? 'text-green-400' : 'text-red-400'}`}>${formatNumber(equity)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-500">Общий P&L</div><div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit >= 0 ? '+' : ''}{formatNumber(totalProfit)}</div></div>
              <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${wsConnectedCount >= SYMBOLS.length ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} /><span className="text-xs text-gray-500">{wsConnectedCount}/{SYMBOLS.length}</span></div>
              <span className="text-sm text-gray-600">{currentTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="rounded-xl p-4 mb-4 border border-purple-500/20 bg-black/60">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">📊 Нереализованная прибыль</span>
            <span className={`text-xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalUnrealizedPnL >= 0 ? '+' : ''}${formatNumber(totalUnrealizedPnL)}</span>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-2 text-xs text-gray-500">
            <div>Открыто: <span className="text-yellow-400 font-bold">{openTrades.length}</span></div>
            <div>Закрыто: <span className="text-blue-400 font-bold">{closedTrades.length}</span></div>
            <div>Винрейт: <span className="text-green-400 font-bold">{winRate.toFixed(1)}%</span></div>
            <div>Режим: <span className={aggressiveMode ? 'text-orange-400 font-bold' : 'text-gray-400 font-bold'}>{aggressiveMode ? '⚡АГРО' : '🐢НОРМ'}</span></div>
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-purple-500/30 overflow-x-auto">
          {[{ k: 'signals', i: '🎯', l: 'Сигналы' }, { k: 'trading', i: '📈', l: 'График' }, { k: 'autotrade', i: '🤖', l: 'Торговля' }, { k: 'news', i: '📰', l: 'Новости' }, { k: 'history', i: '📜', l: 'История' }].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)} className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${activeTab === t.k ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t.i} {t.l}</button>
          ))}
        </div>

        {activeTab === 'trading' && (
          <div className="rounded-xl p-3 border border-purple-500/20 bg-black/40">
            <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)} className="border border-purple-500/50 rounded-lg px-3 py-1.5 text-sm mb-3 w-full bg-black/60 text-white">{SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <TradingChart symbol={selectedSymbol} />
          </div>
        )}
        {activeTab === 'history' && <SignalHistory />}
        {activeTab === 'news' && <News />}

        {activeTab === 'autotrade' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 border border-purple-500/20 bg-black/40">
              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={() => setAutoTrade(!autoTrade)} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${autoTrade ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>{autoTrade ? '🔴 СТОП' : '🟢 ЗАПУСТИТЬ'}</button>
                <button onClick={() => { setAggressiveMode(!aggressiveMode); setRiskPercent(!aggressiveMode ? 10 : 5); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${aggressiveMode ? 'bg-orange-600' : 'bg-gray-700'}`}>{aggressiveMode ? '⚡ АГРЕССИВНЫЙ' : '🐢 ОБЫЧНЫЙ'}</button>
                <button onClick={() => { setBalance(10000); setTotalProfit(0); setTrades([]); setSignals([]); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-all">🔄 Сбросить</button>
                {openTrades.length > 0 && <button onClick={() => openTrades.forEach(t => { const cp = prices.get(t.symbol) || t.entryPrice; closeTrade(t, cp, 'manual'); })} className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm transition-all">🔒 Закрыть всё ({openTrades.length})</button>}
              </div>
              {autoTrade && (
                <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
                  <p className="text-purple-300 text-sm">✅ АВТОТОРГОВЛЯ | TP +{TP_PERCENT}% | SL -{SL_PERCENT}% | {aggressiveMode ? '⚡АГРО' : '🐢НОРМ'}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 border border-purple-500/20 bg-black/40">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Риск на сделку</span>
                <span className="text-white font-bold">{riskPercent}%</span>
              </div>
              <input type="range" min="1" max={aggressiveMode ? "15" : "10"} step="0.5" value={riskPercent} onChange={e => setRiskPercent(+e.target.value)} className="w-full accent-purple-500 mt-2" />
            </div>

            <div className="rounded-xl border border-purple-500/20 overflow-hidden bg-black/40">
              <div className="px-4 py-3 bg-purple-950/30 border-b border-purple-500/30 flex justify-between items-center">
                <h3 className="font-bold text-purple-300 text-sm">📊 ОТКРЫТЫЕ ПОЗИЦИИ ({openTrades.length})</h3>
                <span className={`text-sm font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalUnrealizedPnL >= 0 ? '+' : ''}${formatNumber(totalUnrealizedPnL)}</span>
              </div>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
                {!openTrades.length ? <div className="p-6 text-center text-sm text-gray-500">Нет открытых позиций</div> : openTrades.map(t => {
                  const cp = prices.get(t.symbol) || t.entryPrice;
                  const pnl = t.side === 'buy' ? (cp - t.entryPrice) * t.quantity : (t.entryPrice - cp) * t.quantity;
                  const pPct = t.side === 'buy' ? (cp - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - cp) / t.entryPrice * 100;
                  return (
                    <div key={t.id} className={`p-3 hover:bg-white/5 transition-colors ${pnl >= 0 ? 'bg-green-500/3' : 'bg-red-500/3'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">{t.side === 'buy' ? '🟢' : '🔴'} {t.symbol} {t.breakevenActivated && <span className="text-xs text-blue-400 ml-1">BE</span>}</span>
                        <span className={`font-bold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${formatNumber(pnl)} ({pPct >= 0 ? '+' : ''}{pPct.toFixed(2)}%)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-400">
                        <div>Вход <span className="text-white">${formatPrice(t.entryPrice)}</span></div>
                        <div>TP <span className="text-green-400">${formatPrice(t.tpPrice)}</span></div>
                        <div>SL <span className={t.breakevenActivated ? 'text-blue-400' : 'text-red-400'}>${formatPrice(t.slPrice)}</span></div>
                      </div>
                      <button onClick={() => closeTrade(t, cp, 'manual')} className="mt-2 w-full bg-red-900/50 hover:bg-red-800/50 text-xs py-1 rounded transition-colors">Закрыть</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-2">
            {!signals.length ? (
              <div className="rounded-xl p-12 text-center bg-black/40 border border-purple-500/20">
                <div className="text-6xl mb-4">🌌</div>
                <div className="text-gray-500 text-lg">Ожидание сигналов...</div>
                <div className="text-gray-600 text-sm mt-2">RSI {RSI_BUY_MAX}/{RSI_SELL_MIN} | Stoch {STOCH_BUY_MAX}/{STOCH_SELL_MIN} | ADX {ADX_MIN}+</div>
              </div>
            ) : signals.filter(s => s?.price).map((s, i) => (
              <div key={i} className="rounded-lg p-4 border border-purple-500/20 bg-gradient-to-r from-black/80 to-purple-950/30 hover:border-purple-400/40 transition-all cursor-pointer">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">{s.symbol}</span>
                  <span className={`px-3 py-1 rounded text-xs font-bold ${s.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action.toUpperCase()} @ ${formatPrice(s.price)}</span>
                  <span className="text-yellow-400 text-xs">{'★'.repeat(s.strength)}{'☆'.repeat(3 - s.strength)}</span>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap text-xs">
                  {(s.reasons || []).map((r, j) => <span key={j} className="bg-purple-950/50 px-2 py-1 rounded text-purple-300">{r}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
