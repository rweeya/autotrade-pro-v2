import React, { useState, useEffect, useRef, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import SignalHistory from './components/SignalHistory';
import News from './components/News';
import { createPriceManager, ServerData, TradeData } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('autotrade');
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [serverData, setServerData] = useState<ServerData>({ status: 'offline', symbols: 0, trades: 0, openTrades: [] });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  const apiRef = useRef<any>(null);

  useEffect(() => {
    const manager = createPriceManager();
    apiRef.current = manager;
    manager.subscribe((data: ServerData) => {
      setServerData(data);
    });
    return () => manager.disconnect();
  }, []);

  const formatNumber = (n: number) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
  const formatPrice = (p: number) => p ? (p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6)) : '0.0000';
  const formatTime = (t: number) => t ? new Date(t).toLocaleTimeString() : '--:--:--';

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const openTrades = serverData.openTrades || [];
  const symbolsCount = serverData.symbols || 0;
  const isOnline = serverData.status === 'online';

  // Расчёт общего P&L
  let totalUnrealizedPnL = 0;
  for (const t of openTrades) {
    const pnl = t.side === 'buy' ? 0 : 0; // Цены нет в данных сервера, нужно будет добавить
    totalUnrealizedPnL += pnl;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/30 to-black text-white flex flex-col">
      <header className="relative z-20 border-b border-red-500/30 bg-black/80 backdrop-blur-xl sticky top-0 shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-2xl">💀</div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">AUTO TRADE PRO V2</h1>
                <p className="text-xs text-gray-500">Сервер: {isOnline ? '🟢 Онлайн' : '🔴 Офлайн'} | Активов: {symbolsCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-400">Позиций</div>
                <div className="text-lg font-bold text-yellow-400">{openTrades.length}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Статус</div>
                <div className={`text-lg font-bold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>{isOnline ? 'Онлайн' : 'Офлайн'}</div>
              </div>
              <span className="text-sm text-gray-500">{currentTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0 relative z-10 container mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 border-b border-red-500/30 overflow-x-auto shrink-0">
          {[
            { k: 'autotrade', i: '🤖', l: 'Позиции' },
            { k: 'trading', i: '📈', l: 'График' },
            { k: 'history', i: '📜', l: 'История' },
            { k: 'news', i: '📰', l: 'Новости' }
          ].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)} className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${activeTab === t.k ? 'bg-red-600 text-white' : 'text-gray-400'}`}>{t.i} {t.l}</button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
          {activeTab === 'trading' && (
            <div className="rounded-xl p-3 border border-red-500/20 bg-black/40">
              <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)} className="border border-red-500/50 rounded-lg px-3 py-1.5 text-sm mb-3 w-full bg-black/60 text-white">
                {openTrades.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                {!openTrades.length && <option value="BTCUSDT">BTCUSDT</option>}
              </select>
              <TradingChart symbol={selectedSymbol} />
            </div>
          )}

          {activeTab === 'history' && <SignalHistory />}
          {activeTab === 'news' && <News />}

          {activeTab === 'autotrade' && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 border border-red-500/20 bg-black/40">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-red-400">📊 ПОЗИЦИИ НА СЕРВЕРЕ ({openTrades.length})</h3>
                  <span className={`px-3 py-1 rounded text-xs font-bold ${isOnline ? 'bg-green-600' : 'bg-red-600'}`}>
                    {isOnline ? '🟢 СЕРВЕР ОНЛАЙН' : '🔴 СЕРВЕР ОФЛАЙН'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">TP +2.0% | SL -0.5% | 150 активов | 24/7</p>
              </div>

              <div className="rounded-xl border border-red-500/20 overflow-hidden bg-black/40">
                <div className="divide-y divide-gray-800" style={{ maxHeight: '500px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                  {!openTrades.length ? (
                    <div className="p-6 text-center text-sm text-gray-500">
                      {isOnline ? 'Нет открытых позиций. Сервер мониторит рынок...' : 'Подключение к серверу...'}
                    </div>
                  ) : openTrades.map(t => {
                    const isExpanded = expandedTrade === t.id;
                    const pnl = 0; // Сервер пока не отдаёт текущую цену
                    return (
                      <div key={t.id} className={`p-3 ${t.side === 'buy' ? 'bg-green-500/3' : 'bg-red-500/3'}`}>
                        <div className="flex justify-between text-sm font-bold cursor-pointer" onClick={() => setExpandedTrade(isExpanded ? null : t.id)}>
                          <span>{t.side === 'buy' ? '🟢' : '🔴'} {t.symbol}{t.breakevenActivated && ' BE'}</span>
                          <div className="flex items-center gap-2">
                            <span className={t.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                              ${formatNumber(t.invested)}
                            </span>
                            <span className={`text-gray-400 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-400">
                          <div>Вход <span className="text-white">${formatPrice(t.entryPrice)}</span></div>
                          <div>TP <span className="text-green-400">${formatPrice(t.tpPrice)}</span></div>
                          <div>SL <span className={t.breakevenActivated ? 'text-blue-400' : 'text-red-400'}>${formatPrice(t.slPrice)}</span></div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Открыт: {formatTime(t.entryTime)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
