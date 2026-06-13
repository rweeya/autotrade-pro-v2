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
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: PriceData) => void>> = new Map();
  private reconnectAttempts = 0;
  private symbols: string[] = [];
  private isConnecting = false;

  subscribe(symbols: string | string[], callback: (data: PriceData) => void) {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    this.symbols = symbolArray;
    
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
    
    const streams = this.symbols.map(s => `${s.replace('/', '').toLowerCase()}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    console.log(`🚀 Подключение к ${this.symbols.length} символам`);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log(`✅ WebSocket подключен (${this.symbols.length} символов)`);
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.data && data.stream) {
          const streamName = data.stream;
          const symbolRaw = streamName.split('@')[0].toUpperCase();
          const symbol = this.symbols.find(s => s.replace('/', '') === symbolRaw);
          if (!symbol) return;
          
          const ticker = data.data;
          const priceData: PriceData = {
            symbol: symbol,
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
    };
    
    this.ws.onclose = () => {
      console.log(`WebSocket закрыт, переподключение...`);
      this.isConnecting = false;
      this.ws = null;
      
      if (this.reconnectAttempts < 10) {
        const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const createWebSocketManager = () => new WebSocketManager();
