'use client';

import { useEffect, useRef, useState } from 'react';

interface PriceChartProps {
  marketId: number;
  outcomeIndex: number;
  outcomeLabel: string;
  getPriceHistory: (marketId: number) => Promise<{ timestamps: number[]; prices: number[][] }>;
}

export function PriceChart({ marketId, outcomeIndex, outcomeLabel, getPriceHistory }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChart = async () => {
      setLoading(true);
      setError(null);

      try {
        const history = await getPriceHistory(marketId);
        
        if (!history.timestamps.length) {
          setError('No price history available');
          setLoading(false);
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 获取数据
        const prices = history.prices.map(p => p[outcomeIndex] / 100); // 转为百分比
        const timestamps = history.timestamps;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 设置样式
        const padding = 40;
        const width = canvas.width - padding * 2;
        const height = canvas.height - padding * 2;

        // 计算范围
        const minPrice = Math.max(0, Math.min(...prices) - 5);
        const maxPrice = Math.min(100, Math.max(...prices) + 5);
        const priceRange = maxPrice - minPrice;

        // 绘制背景网格
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
          const y = padding + (height / 4) * i;
          ctx.beginPath();
          ctx.moveTo(padding, y);
          ctx.lineTo(padding + width, y);
          ctx.stroke();
        }

        // 绘制 Y 轴标签
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
          const price = maxPrice - (priceRange / 4) * i;
          const y = padding + (height / 4) * i;
          ctx.fillText(`${price.toFixed(0)}%`, padding - 5, y + 3);
        }

        // 绘制价格曲线
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.beginPath();

        prices.forEach((price, i) => {
          const x = padding + (width / (prices.length - 1)) * i;
          const y = padding + height - ((price - minPrice) / priceRange) * height;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // 绘制填充区域
        ctx.lineTo(padding + width, padding + height);
        ctx.lineTo(padding, padding + height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fill();

        // 绘制数据点
        ctx.fillStyle = '#3B82F6';
        prices.forEach((price, i) => {
          const x = padding + (width / (prices.length - 1)) * i;
          const y = padding + height - ((price - minPrice) / priceRange) * height;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });

        setLoading(false);
      } catch (err) {
        console.error('Failed to load chart:', err);
        setError('Failed to load price history');
        setLoading(false);
      }
    };

    loadChart();
  }, [marketId, outcomeIndex, getPriceHistory]);

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          📈 {outcomeLabel} Price History
        </h4>
      </div>
      
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="h-40 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          {error}
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          className="w-full"
          style={{ maxHeight: '160px' }}
        />
      )}
    </div>
  );
}