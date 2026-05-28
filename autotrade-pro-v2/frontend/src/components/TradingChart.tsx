import React from 'react'

interface TradingChartProps {
  symbol: string
}

const TradingChart: React.FC<TradingChartProps> = ({ symbol }) => {
  let tvSymbol = symbol
  if (symbol.includes('/USDT')) {
    tvSymbol = `BINANCE:${symbol.replace('/USDT', '')}USDT`
  } else if (symbol.includes('/')) {
    tvSymbol = `FX:${symbol.replace('/', '')}`
  } else {
    tvSymbol = `NASDAQ:${symbol}`
  }

  const encodedSymbol = encodeURIComponent(tvSymbol)
  
  const widgetUrl = `https://www.tradingview.com/widgetembed/?frame_id=tradingview_widget&symbol=${encodedSymbol}&interval=60&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%22MASimple@tv-basicstudies%22%2C%22RSI@tv-basicstudies%22%2C%22MACD@tv-basicstudies%22%5D&theme=dark&style=1&timezone=Etc%2FUTC`

  return (
    <div className="bg-black/50 rounded-xl border border-purple-500/30 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-purple-400 font-bold">📈 ГРАФИК: {symbol}</h3>
        <div className="text-xs text-gray-500">Powered by TradingView</div>
      </div>
      <iframe
        src={widgetUrl}
        width="100%"
        height="500"
        allowTransparency={true}
        frameBorder="0"
        title="TradingView Chart"
        className="rounded-lg"
      />
    </div>
  )
}

export default TradingChart