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
  'CHZ/USDT', 'EOS/USDT', 'KSM/USDT', 'ZEC/USDT', 'COMP/USDT', 'ZIL/USDT', 'BAT/USDT',
  'ICP/USDT', 'STX/USDT', 'KAS/USDT', 'RUNE/USDT', 'EGLD/USDT', 'FLOW/USDT', 'WAVES/USDT',
  'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'FLOKI/USDT', 'SHIB/USDT',
  'SEI/USDT', 'WLD/USDT', 'STRK/USDT', 'TIA/USDT', 'JUP/USDT', 'PYTH/USDT',
  'ENA/USDT', 'FET/USDT', 'BEAM/USDT', 'BLUR/USDT', 'ORDI/USDT', 'PENDLE/USDT',
  'ENS/USDT', 'LDO/USDT', 'GMX/USDT', 'MINA/USDT', 'ROSE/USDT', 'CFX/USDT',
  'TON/USDT', 'NOT/USDT', 'TURBO/USDT', 'MEW/USDT', 'BRETT/USDT', 'POPCAT/USDT',
  'RAY/USDT', 'JTO/USDT', 'HNT/USDT', 'IOTA/USDT', 'NEO/USDT', 'TRX/USDT',
  'XLM/USDT', 'XTZ/USDT', 'CAKE/USDT', '1INCH/USDT', 'SNX/USDT', 'CRV/USDT',
  'ZRO/USDT', 'ZK/USDT', 'ALT/USDT', 'PORTAL/USDT', 'XAI/USDT', 'ACE/USDT',
  'NFP/USDT', 'AI/USDT', 'PIXEL/USDT', 'SAGA/USDT', 'DYM/USDT', 'BOME/USDT'
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('signals');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [balance, setBalance] = useState(10000);
  const [totalProfit, setTotalProfit] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [autoTrade, setAutoTrade] = useState(false);
  const [riskPercent, setRiskPercent] = useState(5);
  const [aggressiveMode, setAggressiveMode] = useState(() => localStorage.getItem('aggressiveMode') === 'true');
  const [useHTFFilter, setUseHTFFilter] = useState(() => localStorage.getItem('useHTFFilter') === 'true');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wsConnectedCount, setWsConnectedCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  const TP_PERCENT = aggressiveMode ? 2.0 : 1.5;
  const SL_PERCENT = aggressiveMode ? 1.0 : 0.8;
  const BREAKEVEN_TRIGGER = aggressiveMode ? 1.0 : 1.0;
  const RSI_BUY_MAX = aggressiveMode ? 30 : 35;
  const RSI_SELL_MIN = aggressiveMode ? 70 : 65;
  const ADX_MIN = aggressiveMode ? 20 : 25;
  const COOLDOWN_MS = aggressiveMode ? 30000 : 60000;

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const wsRef = useRef<any>(null);
  const connectedRef = useRef<Set<string>>(new Set());
  const lastTradeTimeForSymbol = useRef<Map<string, number>>(new Map());
  const lastSignalTimeForSymbol = useRef<Map<string, number>>(new Map());
  const autoTradeRef = useRef(autoTrade);
  const balanceRef = useRef(balance);
  const riskPercentRef = useRef(riskPercent);
  const tradesRef = useRef(trades);
  const htfRef = useRef(useHTFFilter);

  useEffect(() => { autoTradeRef.current = autoTrade; }, [autoTrade]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { riskPercentRef.current = riskPercent; }, [riskPercent]);
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { htfRef.current = useHTFFilter; }, [useHTFFilter]);

  useEffect(() => { localStorage.setItem('aggressiveMode', aggressiveMode.toString()); }, [aggressiveMode]);
  useEffect(() => { localStorage.setItem('useHTFFilter', useHTFFilter.toString()); }, [useHTFFilter]);

  const formatNumber = (n: number) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
  const formatPrice = (p: number) => p ? (p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6)) : '0.0000';
  const formatTime = (t: number) => t ? new Date(t).toLocaleTimeString() : '--:--:--';

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const closed = trades.filter(t => t.status === 'closed' && t.profit !== null);
    setWinRate(closed.length ? (closed.filter(t => (t.profit || 0) > 0).length / closed.length) * 100 : 0);
  }, [trades]);

  // ==================== ИНДИКАТОРЫ ====================
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

  // ==================== СИГНАЛЫ ====================
  const generateSignal = (symbol: string, price: number): Signal | null => {
    if (!price || price <= 0) return null;
    const h = priceHistoryRef.current.get(symbol);
    if (!h || h.length < 50) return null;
    if (lastSignalTimeForSymbol.current.get(symbol) && Date.now() - lastSignalTimeForSymbol.current.get(symbol)! < COOLDOWN_MS) return null;

    const rsi = calcRSI(h), macd = calcMACD(h), ema20 = calcEMA(h, 20), ema50 = calcEMA(h, 50);
    const adx = calcADX(h);
    if (adx < ADX_MIN) return null;

    const buy = rsi < RSI_BUY_MAX && macd > 0 && ema20 > ema50;
    const sell = rsi > RSI_SELL_MIN && macd < 0 && ema20 < ema50;

    let action: 'buy' | 'sell' | null = null;
    let reasons: string[] = [];

    if (buy) {
      // HTF фильтр (5m тренд)
      if (htfRef.current) {
        const ema50_5m = calcEMA(h.slice(-75), 50);
        if (price < ema50_5m) return null;
      }
      action = 'buy';
      reasons = [`RSI ${rsi}<${RSI_BUY_MAX}`, `ADX ${adx.toFixed(0)}`, `MACD↑`, `EMA20>EMA50`];
    } else if (sell) {
      if (htfRef.current) {
        const ema50_5m = calcEMA(h.slice(-75), 50);
        if (price > ema50_5m) return null;
      }
      action = 'sell';
      reasons = [`RSI ${rsi}>${RSI_SELL_MIN}`, `ADX ${adx.toFixed(0)}`, `MACD↓`, `EMA20<EMA50`];
    }
    if (!action) return null;

    lastSignalTimeForSymbol.current.set(symbol, Date.now());
    const strength = (rsi < 20 || rsi > 80) ? 3 : (rsi < 25 || rsi > 75) ? 2 : 1;
    return { id: `${symbol}_${Date.now()}`, symbol, action, price, timestamp: Date.now(), strength: strength as 1 | 2 | 3, rsi, macd, ema20, ema50, adx, atr: 0, reasons };
  };

  // ==================== ТОРГОВЛЯ ====================
  const executeTrade = useCallback((s: Signal) => {
    if (!autoTradeRef.current || !s?.price) return;
    if (tradesRef.current.find(t => t.symbol === s.symbol && t.status === 'open')) return;
    if (lastTradeTimeForSymbol.current.get(s.symbol) && Date.now() - lastTradeTimeForSymbol.current.get(s.symbol)! < COOLDOWN_MS) return;
    const amt = balanceRef.current * riskPercentRef.current / 100;
    if (amt <= 0 || amt > balanceRef.current) return;
    const qty = Math.floor(amt / s.price * 1000) / 1000;
    if (!qty) return;
    const tp = s.action === 'buy' ? s.price * (1 + TP_PERCENT / 100) : s.price * (1 - TP_PERCENT / 100);
    const sl = s.action === 'buy' ? s.price * (1 - SL_PERCENT / 100) : s.price * (1 + SL_PERCENT / 100);
    lastTradeTimeForSymbol.current.set(s.symbol, Date.now());
    setBalance(p => p - amt);
    setTrades(p => [...p, { id: `${s.symbol}_${Date.now()}`, symbol: s.symbol, side: s.action, entryPrice: s.price, exitPrice: null, quantity: qty, invested: amt, entryTime: Date.now(), exitTime: null, profit: null, profitPercent: null, status: 'open' as const, tpPrice: +tp.toFixed(4), slPrice: +sl.toFixed(4), breakevenActivated: false }]);
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
        const cp = prices.get(t.symbol); if (!cp) continue;
        if ((t.side === 'buy' && cp >= t.tpPrice) || (t.side === 'sell' && cp <= t.tpPrice)) { closeTrade(t, cp, 'TP'); continue; }
        if ((t.side === 'buy' && cp <= t.slPrice) || (t.side === 'sell' && cp >= t.slPrice)) { closeTrade(t, cp, 'SL'); continue; }
        if (!t.breakevenActivated) {
          const pPct = t.side === 'buy' ? (cp - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - cp) / t.entryPrice * 100;
          if (pPct >= BREAKEVEN_TRIGGER) setTrades(p => p.map(x => x.id === t.id ? { ...x, slPrice: x.entryPrice, breakevenActivated: true } : x));
        }
      }
    };
    const i = setInterval(check, 3000); return () => clearInterval(i);
  }, [trades, prices, closeTrade, BREAKEVEN_TRIGGER]);

  const updatePrice = useCallback((data: PriceData) => {
    if (!data?.symbol || !data.price || data.price <= 0) return;
    const { symbol, price } = data;
    setPrices(p => new Map(p).set(symbol, price));
    let h = priceHistoryRef.current.get(symbol) || []; h.push(price); if (h.length > 200) h = h.slice(-200);
    priceHistoryRef.current.set(symbol, h);
    const sig = generateSignal(symbol, price);
    if (sig) { setSignals(p => [sig, ...p].slice(0, 100)); if (autoTradeRef.current) executeTrade(sig); }
  }, [executeTrade]);

  useEffect(() => {
    const w = createWebSocketManager(); wsRef.current = w;
    w.subscribe(SYMBOLS, (d: PriceData) => {
      if (d?.symbol && d.price) {
        if (!connectedRef.current.has(d.symbol)) { connectedRef.current.add(d.symbol); setWsConnectedCount(p => p + 1); }
        if (!wsConnected) setWsConnected(true);
        updatePrice(d);
      }
    });
    return () => w.disconnect();
  }, [updatePrice, wsConnected]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Чёрная дыра фон */}
      <div className="black-hole-container">
        <div className="black-hole" />
        <div className="accretion-disk" />
        <div className="accretion-disk-2" />
        <div className="particles" />
      </div>

      <header className="relative z-20 border-b border-red-500/30 bg-black/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">{aggressiveMode ? '⚡' : '💀'}</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2{aggressiveMode && '⚡'}</h1>
                <p className="text-xs text-gray-500">{SYMBOLS.length} акт. | TP +{TP_PERCENT}% SL -{SL_PERCENT}% | HTF:{useHTFFilter ? '✅' : '❌'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right"><div className="text-xs text-gray-400">Баланс</div><div className="text-lg font-bold text-green-400">${formatNumber(balance)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">PnL</div><div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit >= 0 ? '+' : ''}{formatNumber(totalProfit)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">WR</div><div className="text-lg font-bold text-yellow-400">{winRate.toFixed(1)}%</div></div>
              <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${wsConnectedCount >= SYMBOLS.length ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} /><span className="text-xs text-gray-400">{wsConnectedCount}/{SYMBOLS.length}</span></div>
              <span className="text-sm text-gray-500">{currentTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[{ l: 'Сигналов', v: signals.length, c: 'red' }, { l: 'BUY', v: signals.filter(s => s.action === 'buy').length, c: 'green' }, { l: 'SELL', v: signals.filter(s => s.action === 'sell').length, c: 'red' }, { l: 'Открыто', v: openTrades.length, c: 'yellow' }, { l: 'Закрыто', v: closedTrades.length, c: 'blue' }].map((s, i) => (
            <div key={i} className="rounded-xl p-3 border border-red-500/30 bg-black/60"><div className="text-xs text-gray-400">{s.l}</div><div className={`text-2xl font-bold text-${s.c}-400`}>{s.v}</div></div>
          ))}
        </div>

        <div className="flex gap-1 mb-4 border-b border-red-500/30 overflow-x-auto">
          {[
            { k: 'signals', i: '🎯', l: 'Сигналы' },
            { k: 'trading', i: '📈', l: 'График' },
            { k: 'autotrade', i: '🤖', l: 'Автоторговля' },
            { k: 'news', i: '📰', l: 'Новости' },
            { k: 'history', i: '📜', l: 'История' }
          ].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)} className={`px-4 py-2 text-sm rounded-t-lg ${activeTab === t.k ? 'bg-red-600 text-white' : 'text-gray-400'}`}>{t.i} {t.l}</button>
          ))}
        </div>

        {activeTab === 'trading' && (
          <div className="rounded-xl p-3 border border-red-500/20 bg-black/40">
            <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)} className="border border-red-500/50 rounded-lg px-3 py-1.5 text-sm mb-3 w-full bg-black/60 text-white">{SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <TradingChart symbol={selectedSymbol} />
          </div>
        )}

        {activeTab === 'history' && <SignalHistory />}
        {activeTab === 'news' && <News />}

        {activeTab === 'autotrade' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 border border-red-500/20 bg-black/40">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setAutoTrade(!autoTrade)} className={`px-4 py-2 rounded-lg font-bold ${autoTrade ? 'bg-red-600' : 'bg-green-600'}`}>{autoTrade ? '🔴 СТОП' : '🟢 ПУСК'}</button>
                <button onClick={() => { setAggressiveMode(!aggressiveMode); setRiskPercent(!aggressiveMode ? 10 : 5); }} className={`px-3 py-2 rounded-lg text-sm font-bold ${aggressiveMode ? 'bg-orange-600 animate-pulse' : 'bg-gray-600'}`}>{aggressiveMode ? '⚡АГРО' : '🐢НОРМ'}</button>
                <button onClick={() => setUseHTFFilter(!useHTFFilter)} className={`px-3 py-2 rounded-lg text-sm ${useHTFFilter ? 'bg-cyan-600' : 'bg-gray-600'}`}>📈HTF</button>
                <button onClick={() => { setBalance(10000); setTotalProfit(0); setTrades([]); setSignals([]); }} className="px-3 py-2 bg-yellow-600/50 rounded-lg text-sm">🔄</button>
                {openTrades.length > 0 && <button onClick={() => openTrades.forEach(t => { const cp = prices.get(t.symbol) || t.entryPrice; closeTrade(t, cp, 'manual'); })} className="px-3 py-2 bg-red-700/80 rounded-lg text-sm">🔒Все({openTrades.length})</button>}
              </div>
              {autoTrade && <div className={`mt-2 p-2 rounded-lg text-center text-sm ${aggressiveMode ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>✅ АВТО | TP +{TP_PERCENT}% SL -{SL_PERCENT}% BE +{BREAKEVEN_TRIGGER}% | HTF:{useHTFFilter ? '✅' : '❌'}</div>}
            </div>
            <div className="rounded-xl p-4 border border-red-500/20 bg-black/40">
              <label className="text-sm text-gray-400">Риск: {riskPercent}%</label>
              <input type="range" min="1" max={aggressiveMode ? "20" : "10"} step="0.5" value={riskPercent} onChange={e => setRiskPercent(+e.target.value)} className="w-full accent-red-500 mt-1" />
            </div>
            <div className="rounded-xl border border-red-500/20 overflow-hidden bg-black/40">
              <div className="px-4 py-2 bg-red-950/30 border-b border-red-500/30"><h3 className="font-bold text-red-400 text-sm">📊 ПОЗИЦИИ ({openTrades.length})</h3></div>
              <div className="divide-y divide-gray-800">
                {!openTrades.length ? <div className="p-4 text-center text-sm text-gray-500">Нет позиций</div> : openTrades.map(t => {
                  const cp = prices.get(t.symbol) || t.entryPrice;
                  const pPct = t.side === 'buy' ? (cp - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - cp) / t.entryPrice * 100;
                  return (
                    <div key={t.id} className={`p-3 ${pPct >= 0 ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                      <div className="flex justify-between text-sm font-bold"><span>{t.side === 'buy' ? '🟢' : '🔴'} {t.symbol}{t.breakevenActivated && ' 🔒BE'}</span><span className={pPct >= 0 ? 'text-green-400' : 'text-red-400'}>{pPct >= 0 ? '+' : ''}{pPct.toFixed(2)}%</span></div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs">
                        <span className="text-gray-400">Вход:</span><span className="text-right">${formatPrice(t.entryPrice)}</span>
                        <span className="text-gray-400">Тек:</span><span className="text-right">${formatPrice(cp)}</span>
                        <span className="text-gray-400">TP:</span><span className="text-right text-green-400">${formatPrice(t.tpPrice)}</span>
                        <span className="text-gray-400">SL:</span><span className={`text-right ${t.breakevenActivated ? 'text-blue-400' : 'text-red-400'}`}>${formatPrice(t.slPrice)}</span>
                      </div>
                      <button onClick={() => closeTrade(t, cp, 'manual')} className="mt-2 w-full bg-red-700/50 hover:bg-red-600 text-xs py-1 rounded">🔒 Закрыть</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-2">
            {!signals.length ? <div className="rounded-xl p-8 text-center bg-black/40"><div className="text-5xl mb-3">⏳</div><div className="text-gray-400">Ждём сигналы...</div></div> :
              signals.filter(s => s?.price).map((s, i) => (
                <div key={i} className="rounded-lg p-3 border border-red-500/30 cursor-pointer bg-gradient-to-r from-black/60 to-red-900/20">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{s.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action.toUpperCase()} @ ${formatPrice(s.price)}</span>
                    <span className="text-yellow-400 text-xs">{'★'.repeat(s.strength)}</span>
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap text-xs text-red-400">{(s.reasons || []).map((r, j) => <span key={j} className="bg-red-950/30 px-1.5 py-0.5 rounded">🎯 {r}</span>)}</div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
