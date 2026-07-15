import React, { useEffect, useRef } from 'react';

interface TradeChartProps {
  symbol: string;
  entryPrice: number;
  side: 'buy' | 'sell';
}

const TradeChart: React.FC<TradeChartProps> = ({ symbol, entryPrice, side }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = `tv_chart_${symbol.replace('/', '_')}`;

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof TradingView !== 'undefined' && containerRef.current) {
        const widget = new (TradingView as any).widget({
          container_id: id,
          symbol: `BINANCE:${symbol.replace('/', '')}`,
          interval: '15',
          theme: 'dark',
          style: '1',
          locale: 'ru',
          toolbar_bg: '#111',
          enable_publishing: false,
          hide_top_toolbar: true,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          save_image: false,
          height: 300,
          width: '100%',
          studies: [],
          disabled_features: ['header_symbol_search', 'header_compare', 'header_saveload'],
        });

        widget.onChartReady(() => {
          const chart = widget.chart();
          chart.createShape(
            { time: Date.now() / 1000 - 3600, price: entryPrice },
            { time: Date.now() / 1000, price: entryPrice },
            {
              shape: 'trend_line',
              text: `Вход $${entryPrice}`,
              lock: true,
              overrides: {
                linecolor: side === 'buy' ? '#22c55e' : '#ef4444',
                linewidth: 2,
                linestyle: 2,
                textColor: side === 'buy' ? '#22c55e' : '#ef4444',
              }
            }
          );
        });
      }
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [symbol, entryPrice, side, id]);

  return <div id={id} ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height: 300 }} />;
};

export default TradeChart;
