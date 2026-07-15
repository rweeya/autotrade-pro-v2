import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradeChartProps {
  symbol: string;
  entryPrice: number;
  side: 'buy' | 'sell';
}

const TradeChart: React.FC<TradeChartProps> = ({ symbol, entryPrice, side }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = `tv_chart_${symbol.replace('/', '_')}_${Date.now()}`;

  useEffect(() => {
    const widgetUrl = `https://s.tradingview.com/widgetembed/?frame_id=${id}&symbol=BINANCE:${symbol.replace('/', '')}&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=000000&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=0&hideideas=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=ru`;

    if (containerRef.current) {
      containerRef.current.innerHTML = `
        <div style="position: relative; height: 300px;">
          <iframe src="${widgetUrl}" width="100%" height="300" frameborder="0" style="border-radius: 8px;"></iframe>
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; display: flex; align-items: center; justify-content: flex-start; padding-left: 50px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 100%; height: 2px; border-top: 2px dashed ${side === 'buy' ? '#22c55e' : '#ef4444'}; position: absolute; left: 0; right: 0; top: 50%;"></div>
              <span style="background: #000; color: ${side === 'buy' ? '#22c55e' : '#ef4444'}; font-weight: bold; font-size: 11px; padding: 2px 8px; border-radius: 4px; position: relative; z-index: 1;">
                ВХОД $${entryPrice.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      `;
    }
  }, [symbol, entryPrice, side, id]);

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height: 300, background: '#000' }} />;
};

export default TradeChart;
