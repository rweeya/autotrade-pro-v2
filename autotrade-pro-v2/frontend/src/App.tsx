import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';

const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT',
  'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 'LTC/USDT', 'UNI/USDT', 'ATOM/USDT',
  'ETC/USDT', 'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'NEAR/USDT',
  'INJ/USDT', 'IMX/USDT', 'HBAR/USDT', 'VET/USDT', 'GRT/USDT', 'RNDR/USDT', 'MKR/USDT',
  'AAVE/USDT', 'ALGO/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT', 'AXS/USDT',
  'CHZ/USDT', 'EOS/USDT', 'ZEC/USDT', 'COMP/USDT', 'ICP/USDT', 'STX/USDT', 'KAS/USDT',
  'RUNE/USDT', 'EGLD/USDT', 'FLOW/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'SHIB/USDT',
  'SEI/USDT', 'WLD/USDT', 'TIA/USDT', 'JUP/USDT', 'PYTH/USDT', 'ENA/USDT', 'FET/USDT',
  'BEAM/USDT', 'BLUR/USDT', 'ORDI/USDT', 'PENDLE/USDT', 'ENS/USDT', 'LDO/USDT',
  'TON/USDT', 'NOT/USDT', 'MEW/USDT', 'POPCAT/USDT', 'RAY/USDT', 'JTO/USDT',
  'TRX/USDT', 'XLM/USDT', 'XTZ/USDT', 'CAKE/USDT', '1INCH/USDT', 'SNX/USDT', 'CRV/USDT',
  'ZRO/USDT', 'ZK/USDT', 'ALT/USDT', 'PORTAL/USDT', 'AI/USDT', 'BOME/USDT',
  'TURBO/USDT', 'MEME/USDT', 'BANANA/USDT', 'RARE/USDT', 'BB/USDT', 'IO/USDT',
  'PIXEL/USDT', 'SAGA/USDT', 'DYM/USDT', 'OMNI/USDT', 'REZ/USDT', 'ETHFI/USDT',
  'STRK/USDT', 'GMX/USDT', 'LRC/USDT', 'SUPER/USDT', 'MINA/USDT', 'YGG/USDT',
  'CKB/USDT', 'SUSHI/USDT', 'THETA/USDT', 'APE/USDT', 'BAL/USDT', 'ENJ/USDT',
  'HOT/USDT', 'JASMY/USDT', 'KDA/USDT', 'MAGIC/USDT', 'OCEAN/USDT', 'QNT/USDT',
  'RVN/USDT', 'SKL/USDT', 'STORJ/USDT', 'UMA/USDT', 'WOO/USDT', 'ZIL/USDT',
  'ZRX/USDT', 'ANKR/USDT', 'ASTR/USDT', 'BAND/USDT', 'CELR/USDT', 'DENT/USDT',
  'DYDX/USDT', 'GLMR/USDT', 'ICX/USDT', 'IOST/USDT', 'IOTX/USDT', 'JOE/USDT',
  'KNC/USDT', 'LINA/USDT', 'LPT/USDT', 'MOVR/USDT', 'NKN/USDT', 'OGN/USDT',
  'OM/USDT', 'ONT/USDT', 'PERP/USDT', 'POWR/USDT', 'REN/USDT', 'ROSE/USDT',
  'SFP/USDT', 'SPELL/USDT', 'SSV/USDT', 'SXP/USDT', 'TRB/USDT', 'TRU/USDT',
  'VRA/USDT', 'WAXP/USDT'
];

interface Signal {
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  strength: 1 | 2 | 3;
  probability: number;
  rsi: number;
  stoch: number;
  adx: number;
  macd: number;
  ema20: number;
  atr: number;
  tp: number;
  sl: number;
  aiVerdict?: string;
  timeframe: string;
}

type Timeframe = '15m' | '1h' | '4h';

const AI_TOKEN = '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';

const App: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [minProbability, setMinProbability] = useState(40);
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const [totalScanned, setTotalScanned] = useState(0);
  const priceCache = useRef<Map<string, number[]>>(new Map());

  const formatPrice = (p: number) => p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);

  const openBybit = (symbol: string) => {
    const base = symbol.split('/')[0];
    window.open(`https://www.bybit.com/trade/spot/${base}/USDT`, '_blank');
  };

  // Индикаторы
  const calcRSI = (p: number[], per = 14) => {
    if (p.length < per + 1) return 50;
    let g = 0, l = 0;
    for (let i = p.length - per; i < p.length; i++) { const d = p[i] - p[i - 1]; if (d >= 0) g += d; else l -= d; }
    if (l === 0) return 100;
    return Math.round(100 - 100 / (1 + (g / per) / (l / per)));
  };

  const calcEMA = (p: number[], per: number) => {
    if (p.length < per) return p[p.length - 1] || 0;
    const k = 2 / (per + 1); let e = p[0];
    for (let i = 1; i < p.length; i++) e = (p[i] - e) * k + e;
    return e;
  };

  const calcMACD = (p: number[]) => p.length >= 35 ? parseFloat((calcEMA(p, 12) - calcEMA(p, 26)).toFixed(4)) : 0;

  const calcADX = (p: number[], per = 14) => {
    if (p.length < per * 2) return 0;
    const tr: number[] = [], pDM: number[] = [], mDM: number[] = [];
    for (let i = 1; i < p.length; i++) {
      const h = Math.max(p[i], p[i - 1]), l = Math.min(p[i], p[i - 1]);
      tr.push(Math.max(h - l, Math.abs(h - p[i - 1]), Math.abs(l - p[i - 1])));
      pDM.push(h - Math.max(p[i - 1], p[i - 2] || p[i - 1]) > 0 && h - Math.max(p[i - 1], p[i - 2] || p[i - 1]) > Math.min(p[i - 1], p[i - 2] || p[i - 1]) - l ? h - Math.max(p[i - 1], p[i - 2] || p[i - 1]) : 0);
      mDM.push(Math.min(p[i - 1], p[i - 2] || p[i - 1]) - l > 0 && Math.min(p[i - 1], p[i - 2] || p[i - 1]) - l > h - Math.max(p[i - 1], p[i - 2] || p[i - 1]) ? Math.min(p[i - 1], p[i - 2] || p[i - 1]) - l : 0);
    }
    const smooth = (d: number[]) => { const k = 2 / (per + 1); let e = d[0]; for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k); return e; };
    const atrVal = smooth(tr); if (!atrVal) return 0;
    return Math.abs(smooth(pDM) - smooth(mDM)) / (smooth(pDM) + smooth(mDM)) * 100;
  };

  const calcStochastic = (p: number[], per = 14) => {
    if (p.length < per) return 50;
    const slice = p.slice(-per);
    const h = Math.max(...slice), l = Math.min(...slice);
    return h === l ? 50 : ((p[p.length - 1] - l) / (h - l)) * 100;
  };

  const calcATR = (p: number[], per = 14) => {
    if (!p || p.length < per + 1) return 0;
    const tr = p.slice(1).map((v, i) => Math.abs(v - p[i]));
    let atr = tr.slice(0, per).reduce((a, b) => a + b, 0) / per;
    for (let i = per; i < tr.length; i++) atr = (atr * (per - 1) + tr[i]) / per;
    return atr;
  };

  const getAI = async (symbol: string, action: string, rsi: number, stoch: number, adx: number): Promise<string> => {
    if (!AI_TOKEN) return '';
    try {
      const res = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-small', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AI_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: `${symbol} ${action} RSI=${rsi} Stoch=${stoch} ADX=${adx}. Will price go ${action === 'BUY' ? 'up' : 'down'} in ${timeframe}? Answer YES or NO.`,
          parameters: { max_new_tokens: 5, temperature: 0.1 }
        })
      });
      const data = await res.json();
      const text = data?.[0]?.generated_text?.toUpperCase() || '';
      if (text.includes('YES')) return '✅ AI: вход';
      if (text.includes('NO')) return '❌ AI: пропуск';
      return '⚠️ AI: неясно';
    } catch { return ''; }
  };

  const scan = useCallback(async () => {
    setScanning(true);
    const newSignals: Signal[] = [];

    try {
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
      const data = await res.json();
      if (data.retCode !== 0 || !data.result?.list) { setScanning(false); return; }

      const tickers = data.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
        .slice(0, 100);

      let scannedCount = 0;

      for (const ticker of tickers) {
        const sym = ticker.symbol.replace('USDT', '/USDT');
        if (!SYMBOLS.includes(sym)) continue;

        const price = parseFloat(ticker.lastPrice);
        if (!price) continue;

        let history = priceCache.current.get(sym) || [];
        history.push(price);
        if (history.length > 200) history = history.slice(-200);
        priceCache.current.set(sym, history);

        if (history.length < 50) continue;

        const rsi = calcRSI(history);
        const stoch = calcStochastic(history);
        const adx = calcADX(history);
        const macd = calcMACD(history);
        const ema20 = calcEMA(history, 20);
        const atr = calcATR(history);

        if (atr / price < 0.001) continue;
        scannedCount++;

        if (rsi < 45 && stoch < 35 && macd > 0 && price > ema20 && adx > 18) {
          const strength: 1 | 2 | 3 = rsi < 28 && stoch < 18 ? 3 : rsi < 35 ? 2 : 1;
          newSignals.push({
            symbol: sym, action: 'BUY', price, strength, probability: strength === 3 ? 75 : 60,
            rsi, stoch: Math.round(stoch), adx: Math.round(adx), macd, ema20, atr,
            tp: price * 1.01, sl: price * 0.997, timeframe
          });
        } else if (rsi > 55 && stoch > 65 && macd < 0 && price < ema20 && adx > 18) {
          const strength: 1 | 2 | 3 = rsi > 72 && stoch > 82 ? 3 : rsi > 65 ? 2 : 1;
          newSignals.push({
            symbol: sym, action: 'SELL', price, strength, probability: strength === 3 ? 75 : 60,
            rsi, stoch: Math.round(stoch), adx: Math.round(adx), macd, ema20, atr,
            tp: price * 0.99, sl: price * 1.003, timeframe
          });
        }
      }

      const sorted = newSignals.sort((a, b) => b.probability - a.probability);

      // AI для топ-5
      for (let i = 0; i < Math.min(5, sorted.length); i++) {
        sorted[i].aiVerdict = await getAI(sorted[i].symbol, sorted[i].action, sorted[i].rsi, sorted[i].stoch, sorted[i].adx);
      }

      setTotalScanned(scannedCount);
      setSignals(sorted);
    } catch (e) {
      console.error('Ошибка:', e);
    }
    setScanning(false);
  }, [timeframe]);

  useEffect(() => {
    scan();
    const interval = setInterval(scan, 60000);
    return () => clearInterval(interval);
  }, [scan]);

  const filteredSignals = signals
    .filter(s => filter === 'ALL' || s.action === filter)
    .filter(s => s.probability >= minProbability);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/30 to-black text-white">
      <header className="border-b border-red-500/30 bg-black/80 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">SIGNAL SCANNER PRO</h1>
              <p className="text-xs text-gray-500">{SYMBOLS.length} активов | Bybit API | AI | {timeframe}</p>
            </div>
            <div className="flex items-center gap-3">
              {scanning && <span className="text-sm text-red-400 animate-pulse">Сканирую...</span>}
              <button onClick={scan} disabled={scanning} className={`px-4 py-2 rounded-lg font-bold text-sm ${scanning ? 'bg-gray-700' : 'bg-red-600 hover:bg-red-500'}`}>
                {scanning ? '...' : '🔄 Обновить'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-1 bg-black/40 rounded-lg p-1">
            {(['ALL', 'BUY', 'SELL'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-sm ${filter === f ? 'bg-red-600 text-white' : 'text-gray-400'}`}>{f === 'ALL' ? 'Все' : f}</button>
            ))}
          </div>
          <div className="flex gap-1 bg-black/40 rounded-lg p-1">
            {(['15m', '1h', '4h'] as Timeframe[]).map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-1.5 rounded text-sm ${timeframe === tf ? 'bg-red-600 text-white' : 'text-gray-400'}`}>{tf}</button>
            ))}
          </div>
          <select value={minProbability} onChange={e => setMinProbability(+e.target.value)} className="bg-black/40 border border-gray-700 rounded-lg px-3 py-1.5 text-sm">
            <option value={0}>Все %</option>
            <option value={50}>≥ 50%</option>
            <option value={60}>≥ 60%</option>
          </select>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Просканировано: {totalScanned} | Сигналов: {signals.length} | BUY: {signals.filter(s => s.action === 'BUY').length} | SELL: {signals.filter(s => s.action === 'SELL').length}
        </div>

        <div className="space-y-3">
          {filteredSignals.map((s, i) => {
            const isExpanded = expandedSignal === s.symbol;
            return (
              <div key={i} className={`rounded-xl border ${s.action === 'BUY' ? 'bg-gradient-to-r from-black/80 to-green-950/20 border-green-500/20' : 'bg-gradient-to-r from-black/80 to-red-950/20 border-red-500/20'}`}>
                <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setExpandedSignal(isExpanded ? null : s.symbol)}>
                  <div>
                    <span className="font-bold text-lg">{s.symbol}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${s.action === 'BUY' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${s.probability >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>{s.probability}%</div>
                      <div className="text-[10px] text-gray-500">{'★'.repeat(s.strength)}</div>
                    </div>
                    <span className={`text-gray-400 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                  </div>
                </div>

                <div className="px-4 pb-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-black/40 rounded p-2 text-center"><div className="text-gray-500">Цена</div><div className="text-white font-bold">${formatPrice(s.price)}</div></div>
                  <div className="bg-black/40 rounded p-2 text-center"><div className="text-gray-500">TP (+1%)</div><div className="text-green-400 font-bold">${formatPrice(s.tp)}</div></div>
                  <div className="bg-black/40 rounded p-2 text-center"><div className="text-gray-500">SL (-0.3%)</div><div className="text-red-400 font-bold">${formatPrice(s.sl)}</div></div>
                </div>

                {s.aiVerdict && (
                  <div className="px-4 pb-2">
                    <span className={`text-xs px-2 py-1 rounded ${s.aiVerdict.includes('✅') ? 'bg-green-500/10 text-green-400' : s.aiVerdict.includes('❌') ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{s.aiVerdict}</span>
                  </div>
                )}

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">RSI</div><div className={s.rsi < 30 ? 'text-green-400' : s.rsi > 70 ? 'text-red-400' : 'text-white'}>{s.rsi}</div></div>
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">STOCH</div><div className={s.stoch < 20 ? 'text-green-400' : s.stoch > 80 ? 'text-red-400' : 'text-white'}>{s.stoch}</div></div>
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">ADX</div><div className="text-white">{s.adx}</div></div>
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">MACD</div><div className={s.macd > 0 ? 'text-green-400' : 'text-red-400'}>{s.macd.toFixed(4)}</div></div>
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">ATR</div><div className="text-white">{s.atr.toFixed(4)}</div></div>
                    </div>
                    <div className="h-[300px] rounded-lg overflow-hidden border border-gray-700">
                      <TradingChart symbol={s.symbol} />
                    </div>
                    <button onClick={() => openBybit(s.symbol)} className="mt-2 w-full bg-red-600 hover:bg-red-500 text-xs py-2 rounded font-bold">🔗 Открыть на Bybit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;
