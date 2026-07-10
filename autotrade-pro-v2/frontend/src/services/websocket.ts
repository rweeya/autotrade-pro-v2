export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

type Callback = (data: PriceData) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<Callback>> = new Map();
  private symbols: string[] = [];
  private reconnectAttempts = 0;
  private isConnecting = false;

  subscribe(symbols: string | string[], callback: Callback) {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    this.symbols = [...new Set([...this.symbols, ...symbolArray])];
    
    symbolArray.forEach(symbol => {
      if (!this.subscribers.has(symbol)) {
        this.subscribers.set(symbol, new Set());
      }
      this.subscribers.get(symbol)!.add(callback);
    });
    
    if (!this.ws && !this.isConnecting) {
      this.connect();
    }
  }

  private connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    // Все символы в одном потоке
    const symbolsStr = JSON.stringify(this.symbols.map(s => s.replace('/', '').toLowerCase() + '@ticker'));
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${this.symbols.map(s => s.replace('/', '').toLowerCase() + '@ticker').join('/')}`;

    console.log(`🚀 Подключение к ${this.symbols.length} символам`);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log(`✅ WebSocket готов (${this.symbols.length} символов)`);
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data) {
          const ticker = msg.data;
          const symbolRaw = (ticker.s || msg.stream?.split('@')[0] || '').toUpperCase();
          const symbol = this.symbols.find(s => s.replace('/', '') === symbolRaw);
          if (!symbol) return;

          const priceData: PriceData = {
            symbol,
            price: parseFloat(ticker.c),
            change24h: parseFloat(ticker.P),
            volume24h: parseFloat(ticker.v) || 0,
            high24h: parseFloat(ticker.h) || 0,
            low24h: parseFloat(ticker.l) || 0,
            timestamp: Date.now()
          };

          this.subscribers.get(symbol)?.forEach(cb => cb(priceData));
        }
      } catch (error) {}
    };

    this.ws.onerror = () => {
      console.log(`⚠️ WebSocket ошибка`);
      this.isConnecting = false;
    };

    this.ws.onclose = () => {
      console.log(`🔄 Переподключение через 2 сек...`);
      this.isConnecting = false;
      this.ws = null;
      setTimeout(() => this.connect(), 2000);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers.clear();
    this.symbols = [];
  }
}

export const createWebSocketManager = () => new WebSocketManager();
