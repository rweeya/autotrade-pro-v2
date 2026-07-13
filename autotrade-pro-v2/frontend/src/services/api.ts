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

class PriceManager {
  private symbols: string[] = [];
  private subscribers: Map<string, Set<Callback>> = new Map();
  private intervalId: number | null = null;
  private isRunning = false;

  subscribe(symbols: string | string[], callback: Callback) {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    this.symbols = [...new Set([...this.symbols, ...symbolArray])];
    
    symbolArray.forEach(symbol => {
      if (!this.subscribers.has(symbol)) {
        this.subscribers.set(symbol, new Set());
      }
      this.subscribers.get(symbol)!.add(callback);
    });
    
    if (!this.isRunning) {
      this.start();
    }
  }

  private async fetchPrices() {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      if (!res.ok) return;
      const data = await res.json();
      
      for (const ticker of data) {
        const symbol = this.symbols.find(s => s.replace('/', '') === ticker.symbol);
        if (!symbol) continue;

        const priceData: PriceData = {
          symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.priceChangePercent),
          volume24h: parseFloat(ticker.volume),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          timestamp: Date.now()
        };

        this.subscribers.get(symbol)?.forEach(cb => cb(priceData));
      }
    } catch (error) {
      console.warn('⚠️ Ошибка запроса цен Binance');
    }
  }

  private start() {
    this.isRunning = true;
    console.log(`🚀 Binance API запущен (${this.symbols.length} активов)`);
    this.fetchPrices();
    this.intervalId = window.setInterval(() => this.fetchPrices(), 2000);
  }

  disconnect() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.subscribers.clear();
    this.symbols = [];
  }
}

export const createPriceManager = () => new PriceManager();
