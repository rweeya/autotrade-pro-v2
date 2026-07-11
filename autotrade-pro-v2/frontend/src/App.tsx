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
  'HMSTR/USDT', 'CATI/USDT', 'NEIRO/USDT', 'DOGS/USDT', 'NOT/USDT', 'MAJOR/USDT',
  'MEME/USDT', 'BANANA/USDT', 'RARE/USDT', 'LISTA/USDT', 'BB/USDT', 'IO/USDT',
  'ZRO/USDT', 'ZK/USDT', 'ALT/USDT', 'PORTAL/USDT', 'XAI/USDT', 'ACE/USDT',
  'NFP/USDT', 'PIXEL/USDT', 'SAGA/USDT', 'DYM/USDT', 'TNSR/USDT', 'W/USDT',
  'OMNI/USDT', 'REZ/USDT', 'ETHFI/USDT', 'ENA/USDT', 'STRK/USDT', 'RONIN/USDT',
  'AXL/USDT', 'WLD/USDT', 'TIA/USDT', 'SEI/USDT', 'SUI/USDT', 'APT/USDT',
  'ARB/USDT', 'OP/USDT', 'METIS/USDT', 'CANTO/USDT', 'KAVA/USDT', 'OSMO/USDT',
  'DYDX/USDT', 'GMX/USDT', 'GNS/USDT', 'SNX/USDT', 'CRV/USDT', 'CVX/USDT',
  'FXS/USDT', 'LDO/USDT', 'RPL/USDT', 'ANKR/USDT', 'LRC/USDT', 'IMX/USDT',
  'MINA/USDT', 'ROSE/USDT', 'ONE/USDT', 'COTI/USDT', 'CKB/USDT', 'YGG/USDT',
  'SUPER/USDT', 'HIGH/USDT', 'MC/USDT', 'GALA/USDT', 'SAND/USDT', 'MANA/USDT'
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
  aiConfirmed: boolean;
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

const MODES = {
  normal: { rsiBuy: 25, rsiSell: 75, stochBuy: 15, stochSell: 85, adx: 25, tp: 1.8, sl: 0.5, cooldown: 90000, maxPos: 8 },
  aggressive: { rsiBuy: 20, rsiSell: 80, stochBuy: 10, stochSell: 90, adx: 30, tp: 2.2, sl: 0.6, cooldown: 60000, maxPos: 6 },
  turbo: { rsiBuy: 15, rsiSell: 85, stochBuy: 5, stochSell: 95, adx: 35, tp: 3.0, sl: 0.7, cooldown: 45000, maxPos: 4 },
} as const;

type ModeKey = keyof typeof MODES;

// Hugging Face AI (бесплатный)
const AI_API_URL = 'https://api-inference.huggingface.co/models/bert-base-uncased';
const AI_TOKEN = ''; // Оставь пустым — работает без токена для простых моделей

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('autotrade');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [balance, setBalance] = useState(10000);
  const [totalProfit, setTotalProfit] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [autoTrade, setAutoTrade] = useState(false);
  const [riskPercent, setRiskPercent] = useState(3);
  const [mode, setMode] = useState<ModeKey>('normal');
  const [useAI, setUseAI] = useState(true);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [apiConnectedCount, setApiConnectedCount] = useState(0);
  const [totalUnrealizedPnL, setTotalUnrealizedPnL] = useState(0);
  const [aiPendingCount, setAiPendingCount] = useState(0);

  const cfg = MODES[mode];

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());
  const apiRef = useRef<any>(null);
  const connectedRef = useRef<Set<string>>(new Set());
  const lastTradeTimeForSymbol = useRef<Map<string, number>>(new Map());
  const lastSignalTimeForSymbol = useRef<Map<string, number>>(new Map());
  const autoTradeRef = useRef(autoTrade);
  const balanceRef = useRef(balance);
  const riskPercentRef = useRef(riskPercent);
  const tradesRef = useRef(trades);
  const modeRef = useRef(mode);
  const useAIRef = useRef(useAI);

  useEffect(() => { autoTradeRef.current = autoTrade; }, [autoTrade]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { riskPercentRef.current = riskPercent; }, [riskPercent]);
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { useAIRef.current = useAI; }, [useAI]);

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
    const highest = Math.max(...slice), lowest = Math.min(...slice);
    return highest === lowest ? 50 : ((p[p.length - 1] - lowest) / (highest - lowest)) * 100;
  };

  // AI проверка сигнала
  const checkWithAI = async (symbol: string, action: string, rsi: number, stoch: number, adx: number): Promise<boolean> => {
    if (!useAIRef.current) return true;
    try {
      setAiPendingCount(p => p + 1);
      // Бесплатная проверка через Hugging Face
      const res = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-small', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: `Crypto trading signal: ${symbol} ${action} RSI=${rsi} Stochastic=${stoch} ADX=${adx}. Should I ${action}? Answer YES or NO.`,
          parameters: { max_length: 5, temperature: 0.1 }
        })
      });
      const data = await res.json();
      const answer = data?.[0]?.generated_text?.toUpperCase() || 'NO';
      setAiPendingCount(p => p - 1);
      return answer.includes('YES');
    } catch {
      setAiPendingCount(p => p - 1);
      return true; // Если AI недоступен — пропускаем сигнал
    }
  };

  const generateSignal = (symbol: string, price: number): Signal | null => {
    if (!price || price <= 0) return null;
    const h = priceHistoryRef.current.get(symbol);
    if (!h || h.length < 60) return null;
    if (lastSignalTimeForSymbol.current.get(symbol) && Date.now() - lastSignalTimeForSymbol.current.get(symbol)! < cfg.cooldown) return null;

    const rsi = calcRSI(h), stoch = calcStochastic(h), macd = calcMACD(h), ema20 = calcEMA(h, 20), adx = calcADX(h);
    if (adx < cfg.adx) return null;

    const buyCondition = rsi < cfg.rsiBuy && stoch < cfg.stochBuy && macd > 0 && price > ema20;
    const sellCondition = rsi > cfg.rsiSell && stoch > cfg.stochSell && macd < 0 && price < ema20;
    if (!buyCondition && !sellCondition) return null;

    const action = buyCondition ? 'buy' : 'sell';
    lastSignalTimeForSymbol.current.set(symbol, Date.now());
    
    return {
      id: `${symbol}_${Date.now()}`, symbol, action: action as 'buy' | 'sell', price,
      timestamp: Date.now(), strength: (rsi < 12 || rsi > 88) ? 3 : 2 as 1 | 2 | 3,
      rsi, stochK: Math.round(stoch), macd, adx,
      reasons: [`RSI:${rsi}`, `Stoch:${Math.round(stoch)}`, `ADX:${Math.round(adx)}`, `MACD:${macd > 0 ? '↑' : '↓'}`],
      aiConfirmed: false
    };
  };

  const executeTrade = useCallback(async (s: Signal) => {
    if (!autoTradeRef.current || !s?.price) return;
    const currentTrades = tradesRef.current.filter(t => t.status === 'open');
    if (currentTrades.length >= cfg.maxPos) return;
    if (currentTrades.find(t => t.symbol === s.symbol)) return;
    if (lastTradeTimeForSymbol.current.get(s.symbol) && Date.now() - lastTradeTimeForSymbol.current.get(s.symbol)! < cfg.cooldown) return;

    // AI проверка
    if (useAIRef.current) {
      const aiOk = await checkWithAI(s.symbol, s.action, s.rsi, s.stochK, s.adx);
      if (!aiOk) return;
      s.aiConfirmed = true;
    }

    const amt = balanceRef.current * riskPercentRef.current / 100;
    if (amt <= 0 || amt > balanceRef.current) return;
    const qty = Math.floor(amt / s.price * 1000) / 1000;
    if (!qty) return;

    const tp = s.action === 'buy' ? s.price * (1 + cfg.tp / 100) : s.price * (1 - cfg.tp / 100);
    const sl = s.action === 'buy' ? s.price * (1 - cfg.sl / 100) : s.price * (1 + cfg.sl / 100);

    lastTradeTimeForSymbol.current.set(s.symbol, Date.now());
    setBalance(p => p - amt);
    setTrades(p => [...p, {
      id: `${s.symbol}_${Date.now()}`, symbol: s.symbol, side: s.action,
      entryPrice: s.price, exitPrice: null, quantity: qty, invested: amt,
      entryTime: Date.now(), exitTime: null, profit: null, profitPercent: null,
      status: 'open' as const, tpPrice: +tp.toFixed(4), slPrice: +sl.toFixed(4), breakevenActivated: false
    }]);
  }, [cfg]);

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
          if (pPct >= cfg.tp * 0.5) setTrades(p => p.map(x => x.id === t.id ? { ...x, slPrice: x.entryPrice, breakevenActivated: true } : x));
        }
      }
    };
    const i = setInterval(check, 3000);
    return () => clearInterval(i);
  }, [trades, prices, closeTrade, cfg]);

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
  }, [executeTrade, cfg]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/30 to-black text-white">
      <header className="relative z-20 border-b border-red-500/30 bg-black/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">💀</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className="text-xs text-gray-500">{SYMBOLS.length} активов | RSI {cfg.rsiBuy}/{cfg.rsiSell} | ADX {cfg.adx}+ | AI:{useAI ? '✅' : '❌'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right"><div className="text-xs text-gray-400">Баланс</div><div className="text-lg font-bold text-green-400">${formatNumber(balance)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">Equity</div><div className={`text-lg font-bold ${equity >= 10000 ? 'text-green-400' : 'text-red-400'}`}>${formatNumber(equity)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">P&L</div><div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit >= 0 ? '+' : ''}{formatNumber(totalProfit)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">WR</div><div className="text-lg font-bold text-yellow-400">{winRate.toFixed(1)}%</div></div>
              <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${apiConnectedCount >= SYMBOLS.length ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} /><span className="text-xs text-gray-400">{apiConnectedCount}/{SYMBOLS.length}</span></div>
              {aiPendingCount > 0 && <span className="text-xs text-purple-400">🤖AI:{aiPendingCount}</span>}
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
          <div className="grid grid-cols-5 gap-4 mt-2 text-xs text-gray-500">
            <div>Открыто: <span className="text-yellow-400 font-bold">{openTrades.length}/{cfg.maxPos}</span></div>
            <div>Закрыто: <span className="text-blue-400 font-bold">{closedTrades.length}</span></div>
            <div>Винрейт: <span className="text-green-400 font-bold">{winRate.toFixed(1)}%</span></div>
            <div>Сигналов: <span className="text-red-400 font-bold">{signals.length}</span></div>
            <div>AI: <span className={useAI ? 'text-purple-400 font-bold' : 'text-gray-500'}>{useAI ? 'Активен' : 'Выключен'}</span></div>
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
            <TradingChart symbol={selectedSymbol} />
          </div>
        )}
        {activeTab === 'history' && <SignalHistory />}
        {activeTab === 'news' && <News />}

        {activeTab === 'autotrade' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 border border-red-500/20 bg-black/40">
              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={() => setAutoTrade(!autoTrade)} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${autoTrade ? 'bg-red-600' : 'bg-green-600'}`}>{autoTrade ? '🔴 СТОП' : '🟢 ПУСК'}</button>
                <button onClick={() => setMode('normal')} className={`px-3 py-2 rounded-lg text-sm font-bold ${mode === 'normal' ? 'bg-gray-500 ring-1 ring-red-400' : 'bg-gray-800'}`}>🐢</button>
                <button onClick={() => setMode('aggressive')} className={`px-3 py-2 rounded-lg text-sm font-bold ${mode === 'aggressive' ? 'bg-yellow-600 ring-1 ring-yellow-400' : 'bg-gray-800'}`}>⚡</button>
                <button onClick={() => setMode('turbo')} className={`px-3 py-2 rounded-lg text-sm font-bold ${mode === 'turbo' ? 'bg-orange-600 ring-1 ring-orange-400 animate-pulse' : 'bg-gray-800'}`}>🔥</button>
                <button onClick={() => setUseAI(!useAI)} className={`px-3 py-2 rounded-lg text-sm font-bold ${useAI ? 'bg-purple-600' : 'bg-gray-800'}`}>🤖AI</button>
                <button onClick={() => { setBalance(10000); setTotalProfit(0); setTrades([]); setSignals([]); }} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">🔄 Сбросить</button>
                {openTrades.length > 0 && <button onClick={() => openTrades.forEach(t => { const cp = prices.get(t.symbol) || t.entryPrice; closeTrade(t, cp, 'manual'); })} className="px-4 py-2 bg-red-800 rounded-lg text-sm">🔒 Все({openTrades.length})</button>}
              </div>
              {autoTrade && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                  <p className="text-red-300 text-sm">✅ АВТО | TP +{cfg.tp}% SL -{cfg.sl}% | Макс {cfg.maxPos} поз. | AI:{useAI ? '✅' : '❌'}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 border border-red-500/20 bg-black/40">
              <div className="flex justify-between text-sm"><span className="text-gray-400">Риск на сделку</span><span className="text-white font-bold">{riskPercent}%</span></div>
              <input type="range" min="1" max="10" step="0.5" value={riskPercent} onChange={e => setRiskPercent(+e.target.value)} className="w-full accent-red-500 mt-2" />
            </div>

            <div className="rounded-xl border border-red-500/20 overflow-hidden bg-black/40">
              <div className="px-4 py-3 bg-red-950/30 border-b border-red-500/30 flex justify-between items-center">
                <h3 className="font-bold text-red-400 text-sm">📊 ПОЗИЦИИ ({openTrades.length}/{cfg.maxPos})</h3>
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
                <div className="text-gray-500 text-sm mt-2">{SYMBOLS.length} активов | RSI {cfg.rsiBuy}/{cfg.rsiSell} | ADX {cfg.adx}+</div>
              </div>
            ) : signals.filter(s => s?.price).map((s, i) => (
              <div key={i} className={`rounded-lg p-4 border transition-all cursor-pointer bg-gradient-to-r from-black/80 ${s.action === 'buy' ? 'to-green-900/20 border-green-500/20' : 'to-red-900/20 border-red-500/20'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">{s.symbol}</span>
                  <span className={`px-3 py-1 rounded text-xs font-bold ${s.action === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action.toUpperCase()} @ ${formatPrice(s.price)}</span>
                  <span className="text-yellow-400 text-xs">{'★'.repeat(s.strength)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                  {(s.reasons || []).map((r, j) => <span key={j} className="bg-red-950/50 px-2 py-1 rounded text-red-300 text-center">{r}</span>)}
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
