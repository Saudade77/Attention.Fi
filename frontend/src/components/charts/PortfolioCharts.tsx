'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

// ✅ 统一的 Tooltip 样式配置
const tooltipStyles = {
  contentStyle: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    border: '1px solid rgba(75, 85, 99, 0.3)',
    borderRadius: '12px',
    padding: '10px 14px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  itemStyle: {
    color: '#F9FAFB',  // ✅ 强制文字为亮白色
    fontSize: '14px',
    fontWeight: 500,
  },
  labelStyle: {
    color: '#9CA3AF',  // 标签文字为灰色
    marginBottom: '4px',
  },
};

// ========== 饼图组件 ==========
interface HoldingData {
  name: string;
  value: number;
  color?: string;
}

interface PortfolioPieChartProps {
  holdings: HoldingData[];
  title?: string;
}

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f43f5e'];

export function PortfolioPieChart({ holdings, title = 'Asset Distribution' }: PortfolioPieChartProps) {
  const total = holdings.reduce((acc, h) => acc + h.value, 0);

  if (holdings.length === 0 || total === 0) {
    return (
      <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="h-[200px] flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <div>No holdings to display</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={holdings}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {holdings.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
              contentStyle={tooltipStyles.contentStyle}
              itemStyle={tooltipStyles.itemStyle}
              labelStyle={tooltipStyles.labelStyle}
              cursor={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
        {holdings.slice(0, 6).map((h, i) => (
          <div key={h.name} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: h.color || PIE_COLORS[i % PIE_COLORS.length] }} 
            />
            <span className="text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
              {h.name}
            </span>
            <span className="text-gray-900 dark:text-white font-medium">
              {((h.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
        {holdings.length > 6 && (
          <span className="text-xs text-gray-500">+{holdings.length - 6} more</span>
        )}
      </div>
    </div>
  );
}

// ========== 净值走势图组件 ==========
interface PortfolioHistoryProps {
  data: { date: string; value: number }[];
  title?: string;
}

export function PortfolioHistoryChart({ data, title = 'Portfolio Value' }: PortfolioHistoryProps) {
  const { minValue, maxValue, change, changePercent, isPositive } = useMemo(() => {
    if (data.length === 0) return { minValue: 0, maxValue: 100, change: 0, changePercent: 0, isPositive: true };
    
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    
    return {
      minValue: min * 0.95,
      maxValue: max * 1.05,
      change: diff,
      changePercent: pct,
      isPositive: diff >= 0,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="h-[200px] flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <div>Start trading to see your history</div>
          </div>
        </div>
      </div>
    );
  }

  const currentValue = data[data.length - 1]?.value || 0;

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            ${currentValue.toFixed(2)}
          </div>
        </div>
        <div className={`text-right ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          <div className="text-lg font-semibold">
            {isPositive ? '+' : ''}{change.toFixed(2)}
          </div>
          <div className="text-sm">
            {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="5%" 
                  stopColor={isPositive ? '#22c55e' : '#ef4444'} 
                  stopOpacity={0.3}
                />
                <stop 
                  offset="95%" 
                  stopColor={isPositive ? '#22c55e' : '#ef4444'} 
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={[minValue, maxValue]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={45}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
              contentStyle={tooltipStyles.contentStyle}
              itemStyle={tooltipStyles.itemStyle}
              labelStyle={tooltipStyles.labelStyle}
              cursor={{ stroke: 'rgba(156, 163, 175, 0.3)' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? '#22c55e' : '#ef4444'}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ========== 生成模拟历史数据的工具函数 ==========
export function generateMockHistory(currentValue: number, days: number = 7): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = [];
  let value = currentValue * (0.7 + Math.random() * 0.2);
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const progress = (days - i) / days;
    const targetValue = currentValue;
    const randomWalk = (Math.random() - 0.5) * currentValue * 0.1;
    value = value + (targetValue - value) * 0.3 + randomWalk;
    value = Math.max(0, value);
    
    data.push({ date: dateStr, value });
  }
  
  if (data.length > 0) {
    data[data.length - 1].value = currentValue;
  }
  
  return data;
}

// ========== 生成 Creator 价格历史的工具函数 ==========
export function generatePriceHistory(currentPrice: number, points: number = 7): number[] {
  const data: number[] = [];
  let price = currentPrice * (0.8 + Math.random() * 0.3);
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const targetPrice = currentPrice;
    const randomWalk = (Math.random() - 0.5) * currentPrice * 0.15;
    price = price + (targetPrice - price) * 0.4 + randomWalk;
    price = Math.max(0.01, price);
    data.push(price);
  }
  
  data[data.length - 1] = currentPrice;
  
  return data;
}