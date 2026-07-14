import React from 'react'

interface TradingChartProps {
  symbol: string
}

const TradingChart: React.FC<TradingChartProps> = ({ symbol }) => {
  // Убираем / из символа для TradingView
  const cleanSymbol = symbol.replace('/', '');
  const tvSymbol = `BINANCE:${cleanSymbol}`;
  const encodedSymbol = encodeURIComponent(tvSymbol);
  
  const widgetUrl = `https://s.tradingview.com/widgetembed/?frame_id=tv_${cleanSymbol}&symbol=${encodedSymbol}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=000000&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=0&hideideas=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=ru`;

  return (
    <div className="bg-black/50 rounded-xl border border-red-500/30 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2 bg-red-950/20 border-b border-red-500/20">
        <h3 className="text-red-400 font-bold text-sm">📈 {symbol}</h3>
        <span className="text-xs text-gray-600">TradingView</span>
      </div>
      <iframe
        src={widgetUrl}
        width="100%"
        height="400"
        allowTransparency={true}
        frameBorder="0"
        title={`Chart ${symbol}`}
        className="w-full"
        loading="lazy"
      />
    </div>
  )
}

export default TradingChart
