import React from 'react';

interface TradeChartProps {
  symbol: string;
  entryPrice: number;
  side: 'buy' | 'sell';
}

const TradeChart: React.FC<TradeChartProps> = ({ symbol, entryPrice, side }) => {
  const cleanSymbol = symbol.replace('/', '');
  const color = side === 'buy' ? '#22c55e' : '#ef4444';
  const widgetUrl = `https://s.tradingview.com/widgetembed/?frame_id=trade_${cleanSymbol}_${Date.now()}&symbol=BINANCE:${cleanSymbol}&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=000000&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=0&hideideas=1&locale=ru`;

  return (
    <div className="relative h-[300px] rounded-lg overflow-hidden">
      <iframe src={widgetUrl} width="100%" height="300" frameBorder="0" className="absolute inset-0" />
      <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 pointer-events-none z-10 flex items-center px-4">
        <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: color }} />
        <span className="px-3 py-1 rounded text-xs font-bold mx-2" style={{ background: '#000', color }}>
          ВХОД ${entryPrice.toFixed(4)}
        </span>
        <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: color }} />
      </div>
    </div>
  );
};

export default TradeChart;
