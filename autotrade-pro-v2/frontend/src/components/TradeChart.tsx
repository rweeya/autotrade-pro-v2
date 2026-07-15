import React, { useRef, useEffect } from 'react';

interface TradeChartProps {
  symbol: string;
  entryPrice: number;
  side: 'buy' | 'sell';
}

const TradeChart: React.FC<TradeChartProps> = ({ symbol, entryPrice, side }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prices = JSON.parse(localStorage.getItem(`prices_${symbol}`) || '[]');
    const w = canvas.width, h = canvas.height;
    
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    if (prices.length < 10) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Загрузка...', w / 2, h / 2);
      return;
    }

    const pad = 30;
    const min = Math.min(...prices, entryPrice) * 0.998;
    const max = Math.max(...prices, entryPrice) * 1.002;
    const range = max - min || 1;

    const toX = (i: number) => pad + (i / (prices.length - 1)) * (w - pad * 2);
    const toY = (p: number) => pad + ((max - p) / range) * (h - pad * 2);

    // Сетка
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = pad + (i / 3) * (h - pad * 2);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }

    // Свечи
    for (let i = 1; i < prices.length; i++) {
      const open = prices[i - 1], close = prices[i];
      const high = Math.max(open, close) * 1.001;
      const low = Math.min(open, close) * 0.999;
      const isUp = close >= open;

      ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444';
      ctx.fillStyle = isUp ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 1;

      // Хвост
      ctx.beginPath();
      ctx.moveTo(toX(i), toY(high));
      ctx.lineTo(toX(i), toY(low));
      ctx.stroke();

      // Тело
      const bodyH = Math.abs(toY(open) - toY(close));
      ctx.fillRect(toX(i) - 1.5, toY(Math.max(open, close)), 3, Math.max(1, bodyH));
    }

    // Точка входа
    const entryY = toY(entryPrice);
    ctx.strokeStyle = side === 'buy' ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, entryY);
    ctx.lineTo(w - pad, entryY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Кружок
    ctx.beginPath();
    ctx.arc(w - pad, entryY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Подпись
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`Вход $${entryPrice}`, pad + 5, entryY - 8);

  }, [symbol, entryPrice, side]);

  return <canvas ref={canvasRef} width={500} height={280} className="w-full rounded-lg" />;
};

export default TradeChart;
