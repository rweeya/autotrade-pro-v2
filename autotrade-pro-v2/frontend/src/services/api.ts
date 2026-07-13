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
      let allTickers: any[] = [];
      let cursor = '';
      let pageCount = 0;
      const maxPages = 5;

      while (pageCount < maxPages) {
        const url = `https://api.bybit.com/v5/market/tickers?category=spot&limit=100${cursor ? '&cursor=' + cursor : ''}`;
        const res = await fetch(url);
        if (!res.ok) break;
        const data = await res.json();
        
        if (data.retCode !== 0 || !data.result?.list || data.result.list.length === 0) break;
        
        allTickers = [...allTickers, ...data.result.list];
        const nextCursor = data.result.nextPageCursor || '';
        
        if (!nextCursor || nextCursor === cursor) break;
        
        cursor = nextCursor;
        pageCount++;
      }

      for (const ticker of allTickers) {
        const symbol = this.symbols.find(s => s.replace('/', '') === ticker.symbol);
        if (!symbol) continue;

        const priceData: PriceData = {
          symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.price24hPcnt) * 100,
          volume24h: parseFloat(ticker.volume24h),
          high24h: parseFloat(ticker.highPrice24h),
          low24h: parseFloat(ticker.lowPrice24h),
          timestamp: Date.now()
        };

        this.subscribers.get(symbol)?.forEach(cb => cb(priceData));
      }
    } catch (error) {
      console.warn('⚠️ Ошибка запроса цен Bybit');
    }
  }

  private start() {
    this.isRunning = true;
    console.log(`🚀 Bybit API запущен (${this.symbols.length} активов)`);
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
