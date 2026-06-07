export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

class WebSocketManager {
  private sockets: Map<string, WebSocket> = new Map();
  private subscribers: Map<string, Set<(data: PriceData) => void>> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private baseUrl = 'wss://stream.binance.com:9443/ws';

  subscribe(symbol: string, callback: (data: PriceData) => void) {
    // Форматируем символ для Binance (BTCUSDT вместо BTC/USDT)
    const wsSymbol = symbol.replace('/', '').toLowerCase();
    const streamName = `${wsSymbol}@ticker`;
    const wsUrl = `${this.baseUrl}/${streamName}`;

    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);

    if (!this.sockets.has(symbol)) {
      this.connect(symbol, wsUrl);
    }
  }

  private connect(symbol: string, wsUrl: string) {
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`WebSocket подключен для ${symbol}`);
      this.reconnectAttempts.set(symbol, 0);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const priceData: PriceData = {
          symbol: symbol,
          price: parseFloat(data.c),
          change24h: parseFloat(data.P),
          volume24h: parseFloat(data.v),
          high24h: parseFloat(data.h),
          low24h: parseFloat(data.l),
          timestamp: Date.now()
        };
        
        this.subscribers.get(symbol)?.forEach(callback => callback(priceData));
      } catch (error) {
        console.error(`Ошибка обработки данных для ${symbol}:`, error);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket ошибка для ${symbol}:`, error);
    };

    ws.onclose = () => {
      console.log(`WebSocket закрыт для ${symbol}, переподключение...`);
      const attempts = this.reconnectAttempts.get(symbol) || 0;
      if (attempts < 5) {
        setTimeout(() => {
          this.reconnectAttempts.set(symbol, attempts + 1);
          this.connect(symbol, wsUrl);
        }, 5000 * Math.pow(2, attempts));
      }
    };

    this.sockets.set(symbol, ws);
  }

  unsubscribe(symbol: string, callback?: (data: PriceData) => void) {
    if (callback) {
      this.subscribers.get(symbol)?.delete(callback);
    }
    
    if (!callback || this.subscribers.get(symbol)?.size === 0) {
      const ws = this.sockets.get(symbol);
      if (ws) {
        ws.close();
        this.sockets.delete(symbol);
        this.subscribers.delete(symbol);
      }
    }
  }

  disconnect() {
    this.sockets.forEach(ws => ws.close());
    this.sockets.clear();
    this.subscribers.clear();
  }
}

export const createWebSocketManager = () => new WebSocketManager();
