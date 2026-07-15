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
    if (prices.length < 10) return;

    const w = canvas.width, h = canvas.height;
    const padding = 30;
    const min = Math.min(...prices, entryPrice) * 0.999;
    const max = Math.max(...prices, entryPrice) * 1.001;
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);
    
    // Фон
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Сетка
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = padding + (i / 4) * (h - padding * 2);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
    }

    // Линия цены
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    prices.forEach((p: number, i: number) => {
      const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
      const y = padding + ((max - p) / range) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Точка входа (горизонтальная линия)
    const entryY = padding + ((max - entryPrice) / range) * (h - padding * 2);
    ctx.strokeStyle = side === 'buy' ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, entryY);
    ctx.lineTo(w - padding, entryY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Метка "Вход"
    ctx.fillStyle = side === 'buy' ? '#22c55e' : '#ef4444';
    ctx.font = '10px Inter';
    ctx.fillText(`Вход $${entryPrice}`, padding, entryY - 5);

  }, [symbol, entryPrice, side]);

  return <canvas ref={canvasRef} width={400} height={250} className="w-full rounded-lg" />;
};

export default TradeChart;
