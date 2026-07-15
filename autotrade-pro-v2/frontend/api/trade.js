// api/trade.js
export const maxDuration = 30;

export default async function handler(req, res) {
  try {
    // Получаем цены с Binance
    const response = await fetch('https://api.binance.com/api/v3/ticker/price');
    const tickers = await response.json();
    
    // Возвращаем количество полученных тикеров
    res.status(200).json({
      status: 'ok',
      symbols: tickers.length,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
