// server/bybit.js
const WebSocket = require('ws');

function createBybitWebSocket(symbols, onPrice) {
  // Bybit WebSocket для спотовых тикеров
  const wsUrl = 'wss://stream.bybit.com/v5/public/spot';
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log(`✅ Bybit WebSocket подключен`);
    
    // Подписываемся на все тикеры
    const subscribeMsg = JSON.stringify({
      op: 'subscribe',
      args: symbols.map(s => `tickers.${s}`)
    });
    ws.send(subscribeMsg);
    console.log(`📡 Подписка на ${symbols.length} активов`);
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.topic && msg.topic.startsWith('tickers.')) {
        const symbol = msg.topic.replace('tickers.', '');
        const ticker = msg.data;
        
        if (ticker && ticker.lastPrice) {
          const price = parseFloat(ticker.lastPrice);
          onPrice(symbol, price);
        }
      }
    } catch (e) {
      // Игнорируем ошибки парсинга
    }
  });
  
  ws.on('error', (err) => {
    console.error('⚠️ WebSocket ошибка:', err.message);
  });
  
  ws.on('close', () => {
    console.log('🔄 WebSocket закрыт, переподключение через 5 сек...');
    setTimeout(() => {
      createBybitWebSocket(symbols, onPrice);
    }, 5000);
  });
  
  return ws;
}

module.exports = { createBybitWebSocket };
