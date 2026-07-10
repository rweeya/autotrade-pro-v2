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
  private allSymbolsCallback: Set<Callback> = new Set();
  private symbols: string[] = [];
  private reconnectAttempts = 0;
  private isConnecting = false;
  private symbolToStream: Map<string, string> = new Map();

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
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Переподключаемся с новым списком
      this.ws.close();
      this.connect();
    }
  }

  private connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    // Используем единый поток для всех тикеров
    const streamNames = this.symbols.map(s => s.replace('/', '').toLowerCase() + '@ticker');
    
    // Бьём на батчи по 50 символов (ограничение Binance)
    const batchSize = 50;
    const batches: string[][] = [];
    for (let i = 0; i < streamNames.length; i += batchSize) {
      batches.push(streamNames.slice(i, i + batchSize));
    }

    // Если символов <= 50 — один поток
    const streamsStr = batches.map(b => b.join('/')).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamsStr}`;

    console.log(`🚀 Подключение к ${this.symbols.length} символам (${batches.length} потоков)`);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log(`✅ WebSocket подключен (${this.symbols.length} символов)`);
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Обработка комбинированного стрима
        if (msg.data && msg.stream) {
          this.processTickerData(msg.data, msg.stream);
        }
        // Обработка одиночного стрима
        else if (msg.e === '24hrTicker') {
          this.processTickerData(msg, msg.s);
        }
      } catch (error) {}
    };

    this.ws.onerror = () => {
      console.log(`⚠️ WebSocket ошибка`);
      this.isConnecting = false;
    };

    this.ws.onclose = () => {
      console.log(`🔄 WebSocket закрыт, переподключение...`);
      this.isConnecting = false;
      this.ws = null;

      if (this.reconnectAttempts < 20) {
        const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };
  }

  private processTickerData(ticker: any, streamName?: string) {
    const symbolRaw = (ticker.s || streamName?.split('@')[0] || '').toUpperCase();
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
