// server/index.js
const { createBybitWebSocket } = require('./bybit');
const { generateSignal } = require('./signals');
const fetch = require('node-fetch');

// Конфигурация
const CONFIG = {
  RSI_BUY: 30, RSI_SELL: 70,
  STOCH_BUY: 20, STOCH_SELL: 80,
  ADX_MIN: 25,
  TP_PERCENT: 4.0, SL_PERCENT: 1.5,
  MAX_POSITIONS: 10,
  COOLDOWN: 120000,
  RISK_PERCENT: 3
};

// Хранилище цен и истории
const priceHistory = new Map();
const prices = new Map();
const lastSignalTime = new Map();
const lastTradeTime = new Map();
const openTrades = [];

// Загрузка списка активов с Bybit
async function getSymbols() {
  try {
    const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
    const data = await res.json();
    if (data.retCode !== 0) return [];
    return data.result.list
      .filter(t => t.symbol.endsWith('USDT'))
      .map(t => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        volume: parseFloat(t.volume24h)
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 200)
      .map(t => t.symbol);
  } catch (e) {
    console.error('Ошибка получения списка активов:', e);
    return [];
  }
}

// Обновление цены из WebSocket
function updatePrice(symbol, price) {
  prices.set(symbol, price);
  
  let history = priceHistory.get(symbol) || [];
  history.push(price);
  if (history.length > 200) history = history.slice(-200);
  priceHistory.set(symbol, history);
  
  // Генерация сигнала
  if (history.length >= 60) {
    const signal = generateSignal(symbol, price, history, CONFIG, lastSignalTime);
    if (signal) {
      console.log(`🎯 СИГНАЛ: ${signal.action.toUpperCase()} ${symbol} @ ${price}`);
      executeTrade(signal);
    }
  }
}

// Открытие сделки
function executeTrade(signal) {
  if (openTrades.length >= CONFIG.MAX_POSITIONS) {
    console.log(`⏸️ Максимум позиций (${CONFIG.MAX_POSITIONS})`);
    return;
  }
  
  if (openTrades.find(t => t.symbol === signal.symbol)) {
    return;
  }
  
  const lastTrade = lastTradeTime.get(signal.symbol);
  if (lastTrade && Date.now() - lastTrade < CONFIG.COOLDOWN) {
    return;
  }
  
  const tp = signal.action === 'buy' 
    ? signal.price * (1 + CONFIG.TP_PERCENT / 100) 
    : signal.price * (1 - CONFIG.TP_PERCENT / 100);
  const sl = signal.action === 'buy' 
    ? signal.price * (1 - CONFIG.SL_PERCENT / 100) 
    : signal.price * (1 + CONFIG.SL_PERCENT / 100);
  
  lastTradeTime.set(signal.symbol, Date.now());
  
  const trade = {
    id: `${signal.symbol}_${Date.now()}`,
    symbol: signal.symbol,
    side: signal.action,
    entryPrice: signal.price,
    quantity: 1,
    invested: signal.price,
    tpPrice: tp,
    slPrice: sl,
    entryTime: Date.now(),
    breakevenActivated: false
  };
  
  openTrades.push(trade);
  console.log(`✅ СДЕЛКА: ${signal.action.toUpperCase()} ${signal.symbol} | TP: ${tp} | SL: ${sl}`);
}

// Проверка TP/SL
function checkTPSL() {
  const now = Date.now();
  for (let i = openTrades.length - 1; i >= 0; i--) {
    const t = openTrades[i];
    const cp = prices.get(t.symbol);
    if (!cp) continue;
    
    let shouldClose = false;
    let reason = '';
    
    if (t.side === 'buy') {
      if (cp >= t.tpPrice) { shouldClose = true; reason = 'TP'; }
      else if (cp <= t.slPrice) { shouldClose = true; reason = 'SL'; }
      else if (!t.breakevenActivated && cp >= t.entryPrice * (1 + CONFIG.TP_PERCENT * 0.4 / 100)) {
        t.slPrice = t.entryPrice;
        t.breakevenActivated = true;
        console.log(`🔒 Безубыток: ${t.symbol}`);
      }
    } else {
      if (cp <= t.tpPrice) { shouldClose = true; reason = 'TP'; }
      else if (cp >= t.slPrice) { shouldClose = true; reason = 'SL'; }
      else if (!t.breakevenActivated && cp <= t.entryPrice * (1 - CONFIG.TP_PERCENT * 0.4 / 100)) {
        t.slPrice = t.entryPrice;
        t.breakevenActivated = true;
        console.log(`🔒 Безубыток: ${t.symbol}`);
      }
    }
    
    if (shouldClose) {
      const pnl = t.side === 'buy' ? (cp - t.entryPrice) * t.quantity : (t.entryPrice - cp) * t.quantity;
      console.log(`📉 ЗАКРЫТА: ${t.symbol} | ${reason} | PnL: ${pnl.toFixed(2)}`);
      openTrades.splice(i, 1);
    }
  }
}

// HTTP сервер для отдачи статистики
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({
    status: 'online',
    symbols: prices.size,
    trades: openTrades.length,
    prices: Object.fromEntries(prices),
    openTrades: openTrades
  }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Сервер запущен на порту ${PORT}`);
});

// Запуск
(async () => {
  const symbols = await getSymbols();
  console.log(`📊 Загружено ${symbols.length} активов с Bybit`);
  
  const ws = createBybitWebSocket(symbols, (symbol, price) => {
    updatePrice(symbol, price);
  });
  
  // Проверка TP/SL каждые 5 секунд
  setInterval(checkTPSL, 5000);
  
  console.log('🤖 Сервер готов к торговле 24/7');
})();
