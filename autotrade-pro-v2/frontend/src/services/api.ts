export interface PriceData {
  symbol: string;
  price: number;
}

export interface TradeData {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  quantity: number;
  invested: number;
  tpPrice: number;
  slPrice: number;
  entryTime: number;
  breakevenActivated: boolean;
}

export interface ServerData {
  status: string;
  symbols: number;
  trades: number;
  openTrades: TradeData[];
}

type Callback = (data: ServerData) => void;

const SERVER_URL = 'https://autotrade-server-1.onrender.com';

class PriceManager {
  private intervalId: number | null = null;
  private subscribers: Set<Callback> = new Set();
  private isRunning = false;

  subscribe(callback: Callback) {
    this.subscribers.add(callback);
    if (!this.isRunning) this.start();
  }

  private async fetchData() {
    try {
      const res = await fetch(SERVER_URL);
      const data: ServerData = await res.json();
      this.subscribers.forEach(cb => cb(data));
    } catch (error) {
      console.warn('⚠️ Сервер недоступен');
    }
  }

  private start() {
    this.isRunning = true;
    console.log(`🚀 Подключено к серверу ${SERVER_URL}`);
    this.fetchData();
    this.intervalId = window.setInterval(() => this.fetchData(), 2000);
  }

  disconnect() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.subscribers.clear();
  }
}

export const createPriceManager = () => new PriceManager();


