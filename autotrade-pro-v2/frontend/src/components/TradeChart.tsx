import React from 'react';

interface TradeChartProps {
  symbol: string;
  entryPrice: number;
  side: 'buy' | 'sell';
}

const TradeChart: React.FC<TradeChartProps> = ({ symbol, entryPrice, side }) => {
  const prices = JSON.parse(localStorage.getItem(`prices_${symbol}`) || '[]');
  const color = side === 'buy' ? '#22c55e' : '#ef4444';

  if (prices.length < 5) {
    return <div className="h-[200px] bg-black/30 rounded-lg flex items-center justify-center text-gray-500 text-xs">Недостаточно данных</div>;
  }

  const min = Math.min(...prices, entryPrice);
  const max = Math.max(...prices, entryPrice);
  const range = max - min || 1;
  const entryY = ((max - entryPrice) / range) * 100;

  const points = prices.map((p: number, i: number) => {
    const x = (i / (prices.length - 1)) * 100;
    const y = ((max - p) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="relative h-[200px] bg-[#0a0a0f] rounded-lg overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {/* Линия цены */}
        <polyline points={points} fill="none" stroke="#4ade80" strokeWidth="0.5" />
        {/* Заливка под графиком */}
        <polygon points={`0,100 ${points} 100,100`} fill="rgba(74, 222, 128, 0.1)" />
        {/* Линия точки входа */}
        <line x1="0" y1={entryY} x2="100" y2={entryY} stroke={color} strokeWidth="0.5" strokeDasharray="2,2" />
      </svg>
      {/* Подпись точки входа */}
      <div className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/70 px-2 py-1 rounded text-xs font-bold" style={{ color, marginTop: entryY > 50 ? '-10px' : '10px' }}>
        Вход ${entryPrice.toFixed(4)}
      </div>
      {/* Цены на шкале */}
      <div className="absolute top-1 left-2 text-[10px] text-gray-500">${max.toFixed(2)}</div>
      <div className="absolute bottom-1 left-2 text-[10px] text-gray-500">${min.toFixed(2)}</div>
    </div>
  );
};

export default TradeChart;
