// frontend/src/services/websocket.ts

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
  private failedSymbols: Set<string> = new Set();

  subscribe(symbol: string, callback: (data: PriceData) => void) {
    // Пропускаем уже failed символы
    if (this.failedSymbols.has(symbol)) {
      console.log(`⏭️ Пропуск ${symbol} - ранее не удалось подключиться`);
      return;
    }

    const wsSymbol = symbol.replace('/', '').toLowerCase();
    const streamName = `${wsSymbol}@ticker`;
    const wsUrl = `${this.baseUrl}/${streamName}`;

    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);

    if (!this.sockets.has(symbol)) {
      this.connect(symbol, wsUrl, wsSymbol);
    }
  }

  private connect(symbol: string, wsUrl: string, wsSymbol: string) {
    const ws = new WebSocket(wsUrl);
    let connectionTimeout = setTimeout(() => {
      console.log(`⚠️ Таймаут подключения для ${symbol}`);
      ws.close();
    }, 10000);
    
    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log(`✅ WebSocket подключен для ${symbol}`);
      this.reconnectAttempts.set(symbol, 0);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Проверяем, что это ticker данные
        if (data.c && data.P) {
          const priceData: PriceData = {
            symbol: symbol,
            price: parseFloat(data.c),
            change24h: parseFloat(data.P),
            volume24h: parseFloat(data.v) || 0,
            high24h: parseFloat(data.h) || 0,
            low24h: parseFloat(data.l) || 0,
            timestamp: Date.now()
          };
          
          this.subscribers.get(symbol)?.forEach(callback => callback(priceData));
        }
      } catch (error) {
        // Игнорируем ошибки парсинга
      }
    };

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.log(`⚠️ WebSocket ошибка для ${symbol}`);
      this.failedSymbols.add(symbol);
    };

    ws.onclose = () => {
      clearTimeout(connectionTimeout);
      console.log(`WebSocket закрыт для ${symbol}`);
      const attempts = this.reconnectAttempts.get(symbol) || 0;
      if (attempts < 3 && !this.failedSymbols.has(symbol)) {
        setTimeout(() => {
          this.reconnectAttempts.set(symbol, attempts + 1);
          this.connect(symbol, wsUrl, wsSymbol);
        }, 5000 * Math.pow(2, attempts));
      } else if (attempts >= 3) {
        this.failedSymbols.add(symbol);
        console.log(`❌ Отключаем ${symbol} после ${attempts} попыток`);
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
