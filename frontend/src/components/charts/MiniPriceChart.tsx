'use client';

import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface MiniPriceChartProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export function MiniPriceChart({ 
  data, 
  width = 60, 
  height = 28,
  positive 
}: MiniPriceChartProps) {
  const chartData = useMemo(() => {
    return data.map((price, index) => ({ index, price }));
  }, [data]);

  const isPositive = positive ?? (data.length > 1 && data[data.length - 1] >= data[0]);
  const color = isPositive ? '#22c55e' : '#ef4444';

  if (data.length < 2) {
    return (
      <div 
        style={{ width, height }} 
        className="flex items-center justify-center text-gray-400 text-xs"
      >
        —
      </div>
    );
  }

  return (
    <div style={{ width, height }} className="flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}