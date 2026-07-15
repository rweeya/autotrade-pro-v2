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
    if (prices.length < 10) {
      // Заглушка если нет данных
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Загрузка данных...', canvas.width / 2, canvas.height / 2);
      return;
    }

    const w = canvas.width, h = canvas.height;
    const padding = { top: 25, bottom: 25, left: 10, right: 10 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const min = Math.min(...prices, entryPrice) * 0.998;
    const max = Math.max(...prices, entryPrice) * 1.002;
    const range = max - min || 1;

    const toX = (i: number) => padding.left + (i / (prices.length - 1)) * plotW;
    const toY = (p: number) => padding.top + ((max - p) / range) * plotH;

    // Фон
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Сетка
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = padding.top + (i / 3) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      
      const price = max - (i / 3) * range;
      ctx.fillStyle = '#555';
      ctx.font = '9px Inter';
      ctx.textAlign = 'right';
      ctx.fillText('$' + price.toFixed(2), w - padding.right, y - 3);
    }

    // Линия цены с градиентом
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
    gradient.addColorStop(0, 'rgba(74, 222, 128, 0.3)');
    gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(prices[0]));
    for (let i = 1; i < prices.length; i++) {
      ctx.lineTo(toX(i), toY(prices[i]));
    }
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Градиент под линией
    ctx.lineTo(toX(prices.length - 1), padding.top + plotH);
    ctx.lineTo(toX(0), padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Точка входа
    const entryY = toY(entryPrice);
    ctx.strokeStyle = side === 'buy' ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, entryY);
    ctx.lineTo(w - padding.right, entryY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Кружок на точке входа справа
    ctx.beginPath();
    ctx.arc(w - padding.right, entryY, 4, 0, Math.PI * 2);
    ctx.fillStyle = side === 'buy' ? '#22c55e' : '#ef4444';
    ctx.fill();

    // Подпись
    ctx.fillStyle = side === 'buy' ? '#22c55e' : '#ef4444';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`Вход $${entryPrice.toFixed(4)}`, padding.left + 5, entryY - 8);

  }, [symbol, entryPrice, side]);

  return (
    <canvas 
      ref={canvasRef} 
      width={500} 
      height={280} 
      className="w-full rounded-lg" 
      style={{ background: '#0a0a0f' }}
    />
  );
};

export default TradeChart;
