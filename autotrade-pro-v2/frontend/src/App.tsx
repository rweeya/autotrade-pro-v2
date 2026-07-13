import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import SignalHistory from './components/SignalHistory';
import News from './components/News';
import { createPriceManager, PriceData } from './services/api';

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
  'RAY/USDT', 'JTO/USDT', 'TRX/USDT', 'XLM/USDT', 'XTZ/USDT', 'CAKE/USDT',
  '1INCH/USDT', 'SNX/USDT', 'CRV/USDT', 'ZRO/USDT', 'ZK/USDT', 'ALT/USDT',
  'PORTAL/USDT', 'AI/USDT', 'BOME/USDT', 'SLERF/USDT', 'MYRO/USDT', 'SAMO/USDT',
  'TURBO/USDT', 'DEGEN/USDT', 'ANDY/USDT', 'MICHI/USDT', 'MOTHER/USDT', 'BOB/USDT',
  'PONKE/USDT', 'MANEKI/USDT', 'BUBBLE/USDT', 'NPC/USDT', 'MAGA/USDT', 'TRUMPWIN/USDT',
  'HMSTR/USDT', 'CATI/USDT', 'NEIRO/USDT', 'DOGS/USDT', 'MAJOR/USDT',
  'MEME/USDT', 'BANANA/USDT', 'RARE/USDT', 'LISTA/USDT', 'BB/USDT', 'IO/USDT',
  'NFP/USDT', 'PIXEL/USDT', 'SAGA/USDT', 'DYM/USDT', 'TNSR/USDT', 'W/USDT',
  'OMNI/USDT', 'REZ/USDT', 'ETHFI/USDT', 'STRK/USDT', 'RONIN/USDT',
  'AXL/USDT', 'METIS/USDT', 'CANTO/USDT', 'KAVA/USDT', 'OSMO/USDT',
  'GMX/USDT', 'GNS/USDT', 'LRC/USDT', 'ANKR/USDT', 'RPL/USDT',
  'SUPER/USDT', 'HIGH/USDT', 'MC/USDT', 'COTI/USDT', 'ONE/USDT',
  'ROSE/USDT', 'MINA/USDT', 'YGG/USDT', 'CKB/USDT',
  // Дополнительные Bybit пары
  'AGLD/USDT', 'ALICE/USDT', 'ALPHA/USDT', 'AMP/USDT', 'ANKR/USDT',
  'ANT/USDT', 'APE/USDT', 'API3/USDT', 'AR/USDT', 'ASTR/USDT',
  'BAL/USDT', 'BAND/USDT', 'BICO/USDT', 'BLZ/USDT', 'BNT/USDT',
  'CELR/USDT', 'CHR/USDT', 'CLV/USDT', 'CTK/USDT', 'CTSI/USDT',
  'CVC/USDT', 'DENT/USDT', 'DGB/USDT', 'DIA/USDT', 'DODO/USDT',
  'DUSK/USDT', 'EDU/USDT', 'ENJ/USDT', 'ERN/USDT', 'FLM/USDT',
  'FORTH/USDT', 'FUN/USDT', 'GLM/USDT', 'GLMR/USDT', 'HOT/USDT',
  'ICX/USDT', 'ID/USDT', 'ILV/USDT', 'IOST/USDT', 'IOTX/USDT',
  'JASMY/USDT', 'JOE/USDT', 'KDA/USDT', 'KNC/USDT', 'KSM/USDT',
  'LINA/USDT', 'LIT/USDT', 'LOOM/USDT', 'LPT/USDT', 'LQTY/USDT',
  'MAGIC/USDT', 'MDT/USDT', 'MOVR/USDT', 'MTL/USDT', 'MULTI/USDT',
  'NKN/USDT', 'NMR/USDT', 'OCEAN/USDT', 'OGN/USDT', 'OM/USDT',
  'OMG/USDT', 'ONT/USDT', 'OXT/USDT', 'PERP/USDT', 'POLS/USDT',
  'POWR/USDT', 'PROM/USDT', 'QNT/USDT', 'RAD/USDT', 'RARE/USDT',
  'REEF/USDT', 'REN/USDT', 'REQ/USDT', 'RLC/USDT', 'RVN/USDT',
  'SFP/USDT', 'SKL/USDT', 'SLP/USDT', 'SNT/USDT', 'SPELL/USDT',
  'SSV/USDT', 'STEEM/USDT', 'STORJ/USDT', 'STRAX/USDT', 'SUN/USDT',
  'SUSHI/USDT', 'SXP/USDT', 'THETA/USDT', 'TLM/USDT', 'TOMI/USDT',
  'TRB/USDT', 'TRU/USDT', 'TWT/USDT', 'UMA/USDT', 'UNFI/USDT',
  'USDC/USDT', 'USTC/USDT', 'UTK/USDT', 'VRA/USDT', 'VTHO/USDT',
  'WAXP/USDT', 'WOO/USDT', 'WRX/USDT', 'XVG/USDT', 'XVS/USDT',
  'ZEN/USDT', 'ZIL/USDT', 'ZRX/USDT'
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
  adx: number;
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
  const [riskPercent, setRiskPercent] = useState(3);
  const [maxPositions, setMaxPositions] = useState(10);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [apiConnectedCount, setApiConnectedCount] = useState(0);
  const [totalUnrealizedPnL, setTotalUnrealizedPnL] = useState(0);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);

  const RSI_BUY = 30, RSI_SELL = 70;
  const STOCH_BUY = 20, STOCH_SELL = 80;
  const ADX_MIN = 25;
  const TP_PERCENT = 4.0, SL_PERCENT = 1.5;
  const COOLDOWN = 120000;

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const apiRef = useRef<any>(null);
  const connectedRef = useRef<Set<string>>(new Set());
  const lastTradeTimeForSymbol = useRef<Map<string, number>>(new Map());
  const lastSignalTimeForSymbol = useRef<Map<string, number>>(new Map());
  const autoTradeRef = useRef(autoTrade);
  const balanceRef = useRef(balance);
  const riskPercentRef = useRef(riskPercent);
  const tradesRef = useRef(trades);
  const maxPositionsRef = useRef(maxPositions);

  useEffect(() => { autoTradeRef.current = autoTrade; }, [autoTrade]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { riskPercentRef.current = riskPercent; }, [riskPercent]);
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { maxPositionsRef.current = maxPositions; }, [maxPositions]);

  useEffect(() => {
    const interval = setInterval(() => {
      let totalPnl = 0;
      for (const t of trades.filter(t => t.status === 'open')) {
        const cp = prices.get(t.symbol) || t.entryPrice;
        totalPnl += t.side === 'buy' ? (cp - t.entryPrice) * t.quantity : (t.entryPrice - cp) * t.quantity;
      }
      setTotalUnrealizedPnL(totalPnl);
    }, 1000);
    return () => clearInterval(interval);
  }, [trades, prices]);

  const formatNumber = (n: number) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
  const formatPrice = (p: number) => p ? (p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6)) : '0.0000';

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
  const calcStochastic = (p: number[], per = 14) => {
    if (!p || p.length < per) return 50;
    const slice = p.slice(-per);
    const h = Math.max(...slice), l = Math.min(...slice);
    return h === l ? 50 : ((p[p.length - 1] - l) / (h - l)) * 100;
  };

  const generateSignal = (symbol: string, price: number): Signal | null => {
    if (!price || price <= 0) return null;
    const h = priceHistoryRef.current.get(symbol);
    if (!h || h.length < 60) return null;
    if (lastSignalTimeForSymbol.current.get(symbol) && Date.now() - lastSignalTimeForSymbol.current.get(symbol)! < COOLDOWN) return null;

    const rsi = calcRSI(h), stoch = calcStochastic(h), macd = calcMACD(h), ema20 = calcEMA(h, 20), adx = calcADX(h);
    if (adx < ADX_MIN) return null;

    const buy = rsi < RSI_BUY && stoch < STOCH_BUY && macd > 0 && price > ema20;
    const sell = rsi > RSI_SELL && stoch > STOCH_SELL && macd < 0 && price < ema20;
    if (!buy && !sell) return null;

    const action = buy ? 'buy' : 'sell';
    lastSignalTimeForSymbol.current.set(symbol, Date.now());
    return {
      id: `${symbol}_${Date.now()}`, symbol, action: action as 'buy' | 'sell', price,
      timestamp: Date.now(), strength: (rsi < 20 || rsi > 80) ? 3 : 2 as 1 | 2 | 3,
      rsi, stochK: Math.round(stoch), macd, adx,
      reasons: [`RSI:${rsi}`, `Stoch:${Math.round(stoch)}`, `ADX:${Math.round(adx)}`, `MACD:${macd > 0 ? '↑' : '↓'}`]
    };
  };

  const executeTrade = useCallback((s: Signal) => {
    if (!autoTradeRef.current || !s?.price) return;
    const current = tradesRef.current.filter(t => t.status === 'open');
    if (maxPositionsRef.current > 0 && current.length >= maxPositionsRef.current) return;
    if (current.find(t => t.symbol === s.symbol)) return;
    if (lastTradeTimeForSymbol.current.get(s.symbol) && Date.now() - lastTradeTimeForSymbol.current.get(s.symbol)! < COOLDOWN) return;

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
      status: 'open' as const, tpPrice: +tp.toFixed(4), slPrice: +sl.toFixed(4), breakevenActivated: false
    }]);
  }, []);

  const closeTrade = useCallback((t: Trade, cp: number, reason: string) => {
    if (!t || !cp) return;
    const inv = t.entryPrice * t.quantity;
    const prof = t.side === 'buy' ? (cp - t.entryPrice) * t.quantity : (t.entryPrice - cp) * t.quantity;
    setBalance(p => p + inv + prof);
    setTotalProfit(p => p + prof);
    setTrades(p => p.map(x => x.id === t.id ? { ...x, status: 'closed' as const, exitPrice: cp, exitTime: Date.now(), profit: prof, profitPercent: t.side === 'buy' ? (cp - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - cp) / t.entryPrice * 100 } : x));
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
          if (pPct >= TP_PERCENT * 0.4) setTrades(p => p.map(x => x.id === t.id ? { ...x, slPrice: x.entryPrice, breakevenActivated: true } : x));
        }
      }
    };
    const i = setInterval(check, 5000);
    return () => clearInterval(i);
  }, [trades, prices, closeTrade]);

  const updatePrice = useCallback((data: PriceData) => {
    if (!data?.symbol || !data.price || data.price <= 0) return;
    const { symbol, price } = data;
    setPrices(p => new Map(p).set(symbol, price));
    let h = priceHistoryRef.current.get(symbol) || [];
    h.push(price);
    if (h.length > 200) h = h.slice(-200);
    priceHistoryRef.current.set(symbol, h);
    const sig = generateSignal(symbol, price);
    if (sig) { setSignals(p => [sig, ...p].slice(0, 100)); if (autoTradeRef.current) executeTrade(sig); }
  }, [executeTrade]);

  useEffect(() => {
    const manager = createPriceManager();
    apiRef.current = manager;
    manager.subscribe(SYMBOLS, (d: PriceData) => {
      if (d?.symbol && d.price) {
        if (!connectedRef.current.has(d.symbol)) { connectedRef.current.add(d.symbol); setApiConnectedCount(p => p + 1); }
        updatePrice(d);
      }
    });
    return () => manager.disconnect();
  }, [updatePrice]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  const equity = balance + totalUnrealizedPnL;
  const maxPosLabel = maxPositions === 0 ? '∞' : maxPositions.toString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/30 to-black text-white">
      <header className="relative z-20 border-b border-red-500/30 bg-black/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">💀</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className="text-xs text-gray-500">{SYMBOLS.length} активов | 15m | RSI {RSI_BUY}/{RSI_SELL} | ADX {ADX_MIN}+</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right"><div className="text-xs text-gray-400">Баланс</div><div className="text-lg font-bold text-green-400">${formatNumber(balance)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">Equity</div><div className={`text-lg font-bold ${equity >= 10000 ? 'text-green-400' : 'text-red-400'}`}>${formatNumber(equity)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">P&L</div><div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit >= 0 ? '+' : ''}{formatNumber(totalProfit)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">WR</div><div className="text-lg font-bold text-yellow-400">{winRate.toFixed(1)}%</div></div>
              <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${apiConnectedCount >= SYMBOLS.length ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} /><span className="text-xs text-gray-400">{apiConnectedCount}/{SYMBOLS.length}</span></div>
              <span className="text-sm text-gray-500">{currentTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="rounded-xl p-4 mb-4 border border-red-500/20 bg-black/60">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">📊 Нереализованная прибыль</span>
            <span className={`text-xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalUnrealizedPnL >= 0 ? '+' : ''}${formatNumber(totalUnrealizedPnL)}</span>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-2 text-xs text-gray-500">
            <div>Открыто: <span className="text-yellow-400 font-bold">{openTrades.length}/{maxPosLabel}</span></div>
            <div>Закрыто: <span className="text-blue-400 font-bold">{closedTrades.length}</span></div>
            <div>Винрейт: <span className="text-green-400 font-bold">{winRate.toFixed(1)}%</span></div>
            <div>Сигналов: <span className="text-red-400 font-bold">{signals.length}</span></div>
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-red-500/30 overflow-x-auto">
          {[{ k: 'signals', i: '🎯', l: 'Сигналы' }, { k: 'trading', i: '📈', l: 'График' }, { k: 'autotrade', i: '🤖', l: 'Торговля' }, { k: 'news', i: '📰', l: 'Новости' }, { k: 'history', i: '📜', l: 'История' }].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)} className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${activeTab === t.k ? 'bg-red-600 text-white' : 'text-gray-400'}`}>{t.i} {t.l}</button>
          ))}
        </div>

        {activeTab === 'trading' && (
          <div className="rounded-xl p-3 border border-red-500/20 bg-black/40">
            <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)} className="border border-red-500/50 rounded-lg px-3 py-1.5 text-sm mb-3 w-full bg-black/60 text-white">{SYMBOLS.slice(0, 50).map(s => <option key={s} value={s}>{s}</option>)}</select>
            <TradingChart symbol={selectedSymbol.replace('/', '')} />
          </div>
        )}
        {activeTab === 'history' && <SignalHistory />}
        {activeTab === 'news' && <News />}

        {activeTab === 'autotrade' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 border border-red-500/20 bg-black/40">
              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={() => setAutoTrade(!autoTrade)} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${autoTrade ? 'bg-red-600' : 'bg-green-600'}`}>{autoTrade ? '🔴 СТОП' : '🟢 ПУСК'}</button>
                <button onClick={() => { setBalance(10000); setTotalProfit(0); setTrades([]); setSignals([]); }} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">🔄 Сбросить</button>
                {openTrades.length > 0 && <button onClick={() => openTrades.forEach(t => { const cp = prices.get(t.symbol) || t.entryPrice; closeTrade(t, cp, 'manual'); })} className="px-4 py-2 bg-red-800 rounded-lg text-sm">🔒 Закрыть всё ({openTrades.length})</button>}
              </div>
              {autoTrade && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                  <p className="text-red-300 text-sm">✅ АВТОТОРГОВЛЯ 15m | TP +{TP_PERCENT}% SL -{SL_PERCENT}% | Макс {maxPosLabel} поз.</p>
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 border border-red-500/20 bg-black/40 space-y-4">
              <div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Риск на сделку</span><span className="text-white font-bold">{riskPercent}%</span></div>
                <input type="range" min="1" max="10" step="0.5" value={riskPercent} onChange={e => setRiskPercent(+e.target.value)} className="w-full accent-red-500 mt-1" />
              </div>
              <div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Макс. позиций</span><span className="text-white font-bold">{maxPosLabel}</span></div>
                <input type="range" min="0" max="20" step="1" value={maxPositions} onChange={e => setMaxPositions(+e.target.value)} className="w-full accent-red-500 mt-1" />
                <div className="text-xs text-gray-500 mt-1">0 = без ограничений (∞)</div>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/20 overflow-hidden bg-black/40">
              <div className="px-4 py-3 bg-red-950/30 border-b border-red-500/30 flex justify-between items-center">
                <h3 className="font-bold text-red-400 text-sm">📊 ПОЗИЦИИ ({openTrades.length}/{maxPosLabel})</h3>
                <span className={`text-sm font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalUnrealizedPnL >= 0 ? '+' : ''}${formatNumber(totalUnrealizedPnL)}</span>
              </div>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
                {!openTrades.length ? <div className="p-6 text-center text-sm text-gray-500">Нет открытых позиций</div> : openTrades.map(t => {
                  const cp = prices.get(t.symbol) || t.entryPrice;
                  const pnl = t.side === 'buy' ? (cp - t.entryPrice) * t.quantity : (t.entryPrice - cp) * t.quantity;
                  const pPct = t.side === 'buy' ? (cp - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - cp) / t.entryPrice * 100;
                  return (
                    <div key={t.id} className={`p-3 ${pnl >= 0 ? 'bg-green-500/3' : 'bg-red-500/3'}`}>
                      <div className="flex justify-between text-sm font-bold"><span>{t.side === 'buy' ? '🟢' : '🔴'} {t.symbol}{t.breakevenActivated && ' BE'}</span><span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>${formatNumber(pnl)} ({pPct >= 0 ? '+' : ''}{pPct.toFixed(2)}%)</span></div>
                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-400">
                        <div>Вход <span className="text-white">${formatPrice(t.entryPrice)}</span></div>
                        <div>TP <span className="text-green-400">${formatPrice(t.tpPrice)}</span></div>
                        <div>SL <span className={t.breakevenActivated ? 'text-blue-400' : 'text-red-400'}>${formatPrice(t.slPrice)}</span></div>
                      </div>
                      <button onClick={() => closeTrade(t, cp, 'manual')} className="mt-2 w-full bg-red-900/50 hover:bg-red-800/50 text-xs py-1 rounded">Закрыть</button>
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
              <div className="rounded-xl p-12 text-center bg-black/40 border border-red-500/20">
                <div className="text-6xl mb-4">⏳</div>
                <div className="text-gray-400 text-lg">Ожидание сигналов...</div>
                <div className="text-gray-500 text-sm mt-2">15m | {SYMBOLS.length} активов | RSI {RSI_BUY}/{RSI_SELL} | ADX {ADX_MIN}+</div>
              </div>
            ) : signals.filter(s => s?.price).map((s) => {
              const isExpanded = expandedSignal === s.id;
              return (
                <div key={s.id} className={`rounded-lg border transition-all cursor-pointer bg-gradient-to-r from-black/80 ${s.action === 'buy' ? 'to-green-900/20 border-green-500/20' : 'to-red-900/20 border-red-500/20'}`}>
                  <div className="p-4 flex justify-between items-center" onClick={() => setExpandedSignal(isExpanded ? null : s.id)}>
                    <span className="font-bold text-base">{s.symbol}</span>
                    <span className={`px-3 py-1 rounded text-xs font-bold ${s.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action.toUpperCase()} @ ${formatPrice(s.price)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 text-xs">{'★'.repeat(s.strength)}</span>
                      <span className={`text-gray-400 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                        {(s.reasons || []).map((r, j) => <span key={j} className="bg-red-950/50 px-2 py-1 rounded text-red-300 text-center">{r}</span>)}
                      </div>
                      <div className="h-[300px] rounded-lg overflow-hidden border border-gray-700">
                        <TradingChart symbol={s.symbol.replace('/', '')} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
