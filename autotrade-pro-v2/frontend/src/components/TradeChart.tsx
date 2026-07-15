import React from 'react';

interface TradeChartProps {
  symbol: string;
  entryPrice: number;
  side: 'buy' | 'sell';
}

const TradeChart: React.FC<TradeChartProps> = ({ symbol, entryPrice, side }) => {
  const cleanSymbol = symbol.replace('/', '');
  const tvSymbol = `BINANCE:${cleanSymbol}`;
  const encodedSymbol = encodeURIComponent(tvSymbol);
  
  const widgetUrl = `https://s.tradingview.com/widgetembed/?frame_id=trade_${cleanSymbol}&symbol=${encodedSymbol}&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=000000&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=0&hideideas=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=ru`;

  return (
    <div className="relative">
      <div className="absolute top-2 left-4 z-10 bg-black/80 px-2 py-1 rounded text-xs font-bold" style={{ color: side === 'buy' ? '#22c55e' : '#ef4444' }}>
        Вход: ${entryPrice.toFixed(4)}
      </div>
      <iframe
        src={widgetUrl}
        width="100%"
        height="300"
        allowTransparency={true}
        frameBorder="0"
        title={`Trade ${symbol}`}
        className="w-full"
        loading="lazy"
      />
    </div>
  );
};

export default TradeChart;
