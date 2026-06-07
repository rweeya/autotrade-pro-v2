export enum OrderSide {
  BUY = 'Buy',
  SELL = 'Sell'
}

export enum OrderType {
  MARKET = 'Market',
  LIMIT = 'Limit'
}

export enum TimeInForce {
  GTC = 'GTC',
  IOC = 'IOC',
  FOK = 'FOK'
}

export interface OrderParams {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price?: number;
  timeInForce?: TimeInForce;
}

export interface PositionInfo {
  symbol: string;
  size: string;
  side: string;
  entryPrice: string;
  leverage: string;
  unrealisedPnl: string;
}

export class bybitTestnet {
  private static instance: bybitTestnet;
  private apiKey = 'BBTh4UU9lErjxZhyu4'; // Замените на ваш ключ
  private apiSecret = 'irjQnuh8droR2sCfRhW0sXzkBqlAHeqWKpMK'; // Замените на ваш секрет
  private baseUrl = 'https://api-testnet.bybit.com';

  static getInstance(): bybitTestnet {
    if (!bybitTestnet.instance) {
      bybitTestnet.instance = new bybitTestnet();
    }
    return bybitTestnet.instance;
  }

  async getBalance(): Promise<number> {
    try {
      // Возвращаем тестовый баланс
      return 10000;
    } catch (error) {
      console.error('Ошибка получения баланса:', error);
      return 10000;
    }
  }

  async placeOrder(params: OrderParams): Promise<any> {
    console.log(`Размещение ордера: ${params.side} ${params.quantity} ${params.symbol}`);
    // Имитация успешного ордера
    return {
      orderId: `order_${Date.now()}_${Math.random()}`,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      price: params.price || 0
    };
  }

  async setTradingStop(params: {
    symbol: string;
    side: OrderSide;
    takeProfit: number;
    stopLoss: number;
  }): Promise<any> {
    console.log(`Установка TP: ${params.takeProfit}, SL: ${params.stopLoss} для ${params.symbol}`);
    return { success: true };
  }

  async getPositions(): Promise<PositionInfo[]> {
    // Возвращаем пустой массив позиций
    return [];
  }
}
