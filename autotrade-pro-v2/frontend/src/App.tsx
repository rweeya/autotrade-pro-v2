// websocket.ts - оптимизирован для скальпинга
export class WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;
  private assets: string[] = [];

  constructor(assets: string[]) {
    this.assets = assets;
    this.connect();
  }

  private connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      // Binance WebSocket для всех активов одной подпиской
      const streams = this.assets.map(asset => `${asset.toLowerCase()}@kline_1m`).join('/');
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.data?.k) {
            const kline = data.data.k;
            const symbol = kline.s;
            const candle = {
              time: kline.t / 1000,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v),
            };
            this.notify(symbol, candle);
          }
        } catch (err) {
          console.error('WebSocket parse error:', err);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        this.reconnect();
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, 3000);
  }

  private notify(symbol: string, data: any) {
    const handlers = this.subscribers.get(symbol);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  subscribe(symbol: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);
    
    return () => {
      this.subscribers.get(symbol)?.delete(callback);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
