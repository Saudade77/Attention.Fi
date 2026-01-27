'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface ProbabilityChartProps {
  // 数据格式: [{ time: '12:00', yes: 65, no: 35 }, ...]
  data: { time: string; yes: number; no: number }[];
  height?: number;
  showLegend?: boolean;
}

// 统一的 Tooltip 样式
const tooltipStyles = {
  contentStyle: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    border: '1px solid rgba(75, 85, 99, 0.3)',
    borderRadius: '12px',
    padding: '10px 14px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  itemStyle: {
    color: '#F9FAFB',
    fontSize: '13px',
  },
  labelStyle: {
    color: '#9CA3AF',
    marginBottom: '4px',
    fontSize: '12px',
  },
};

export function ProbabilityChart({ data, height = 120, showLegend = false }: ProbabilityChartProps) {
  if (data.length < 2) {
    return (
      <div 
        style={{ height }} 
        className="flex items-center justify-center text-gray-400 text-sm"
      >
        Not enough data
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            width={35}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              name === 'yes' ? 'Yes' : 'No'
            ]}
            contentStyle={tooltipStyles.contentStyle}
            itemStyle={tooltipStyles.itemStyle}
            labelStyle={tooltipStyles.labelStyle}
            cursor={{ stroke: 'rgba(156, 163, 175, 0.3)' }}
          />
          {showLegend && (
            <Legend 
              verticalAlign="top" 
              height={24}
              iconType="circle"
              iconSize={8}
            />
          )}
          <Line
            type="monotone"
            dataKey="yes"
            name="Yes"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#22c55e' }}
          />
          <Line
            type="monotone"
            dataKey="no"
            name="No"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ========== 迷你版概率图（用于卡片预览） ==========
export function MiniProbabilityChart({ data, height = 40 }: { data: number[]; height?: number }) {
  const chartData = useMemo(() => {
    return data.map((yes, i) => ({ i, yes, no: 100 - yes }));
  }, [data]);

  const isYesLeading = data.length > 0 && data[data.length - 1] > 50;

  if (data.length < 2) {
    return <div style={{ height }} className="w-full" />;
  }

  return (
    <div style={{ height }} className="w-full opacity-70 hover:opacity-100 transition-opacity">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="yes"
            stroke={isYesLeading ? '#22c55e' : '#9ca3af'}
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="no"
            stroke={!isYesLeading ? '#ef4444' : '#9ca3af'}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ========== 生成模拟概率历史的工具函数 ==========
export function generateMockProbabilityHistory(
  currentYesPrice: number, // 当前 YES 的价格 (0-100)
  points: number = 12
): { time: string; yes: number; no: number }[] {
  const data: { time: string; yes: number; no: number }[] = [];
  
  // 起始值在 30-70 之间随机
  let yes = 30 + Math.random() * 40;
  
  const now = new Date();
  
  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 2 * 60 * 60 * 1000); // 每2小时一个点
    const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // 随机波动，但逐渐趋向当前值
    const progress = (points - 1 - i) / (points - 1);
    const targetYes = currentYesPrice;
    const randomWalk = (Math.random() - 0.5) * 15;
    yes = yes + (targetYes - yes) * 0.3 + randomWalk;
    yes = Math.max(5, Math.min(95, yes)); // 限制在 5-95 之间
    
    data.push({
      time: timeStr,
      yes: Math.round(yes * 10) / 10,
      no: Math.round((100 - yes) * 10) / 10,
    });
  }
  
  // 确保最后一个点是当前价格
  if (data.length > 0) {
    data[data.length - 1].yes = currentYesPrice;
    data[data.length - 1].no = 100 - currentYesPrice;
  }
  
  return data;
}