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

// ============ 颜色配置 ============
const OUTCOME_COLORS = [
  '#22c55e', // green - Option A / Yes
  '#ef4444', // red - Option B / No
  '#3b82f6', // blue - Option C
  '#a855f7', // purple - Option D
  '#f97316', // orange - Option E
  '#ec4899', // pink - Option F
  '#14b8a6', // teal - Option G
  '#eab308', // yellow - Option H
];

// ============ 类型定义 ============
interface ProbabilityDataPoint {
  time: string;
  [key: string]: string | number; // 动态键：outcome_0, outcome_1, ...
}

interface ProbabilityChartProps {
  data: ProbabilityDataPoint[];
  outcomeLabels?: string[];
  height?: number;
  showLegend?: boolean;
}

interface MiniProbabilityChartProps {
  data: number[][]; // 每个时间点的各选项概率 [[50, 30, 20], [55, 25, 20], ...]
  outcomeLabels?: string[];
  height?: number;
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

// ============ 完整概率图（支持多选项） ============
export function ProbabilityChart({ 
  data, 
  outcomeLabels = ['Yes', 'No'],
  height = 120, 
  showLegend = false 
}: ProbabilityChartProps) {
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

  // 确定有多少个选项
  const numOutcomes = outcomeLabels.length;

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
            formatter={(value: number | string | undefined, name: string | number | undefined) => {
              const numValue = typeof value === 'number' ? value : 0;
              // 从 outcome_0 提取索引，映射到标签
              const idx = typeof name === 'string' && name.startsWith('outcome_') 
                ? parseInt(name.split('_')[1]) 
                : 0;
              const label = outcomeLabels[idx] || String(name);
              return [`${numValue.toFixed(1)}%`, label];
            }}
            contentStyle={tooltipStyles.contentStyle}
            itemStyle={tooltipStyles.itemStyle}
            labelStyle={tooltipStyles.labelStyle}
            cursor={{ stroke: 'rgba(156, 163, 175, 0.3)' }}
            wrapperStyle={{ outline: 'none' }}
          />
          {showLegend && (
            <Legend 
              verticalAlign="top" 
              height={24}
              iconType="circle"
              iconSize={8}
              formatter={(value) => {
                const idx = typeof value === 'string' && value.startsWith('outcome_') 
                  ? parseInt(value.split('_')[1]) 
                  : 0;
                return outcomeLabels[idx] || value;
              }}
            />
          )}
          {/* 动态生成每个选项的线 */}
          {Array.from({ length: numOutcomes }).map((_, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={`outcome_${index}`}
              name={`outcome_${index}`}
              stroke={OUTCOME_COLORS[index % OUTCOME_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ 
                r: 4, 
                fill: OUTCOME_COLORS[index % OUTCOME_COLORS.length], 
                stroke: 'none' 
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============ 迷你版概率图（支持多选项） ============
export function MiniProbabilityChart({ 
  data, 
  outcomeLabels = ['Yes', 'No'],
  height = 40 
}: MiniProbabilityChartProps) {
  const chartData = useMemo(() => {
    return data.map((probs, i) => {
      const point: { i: number; [key: string]: number } = { i };
      probs.forEach((prob, idx) => {
        point[`outcome_${idx}`] = prob;
      });
      return point;
    });
  }, [data]);

  const numOutcomes = data[0]?.length || 2;

  // 找出当前领先的选项
  const lastPoint = data[data.length - 1];
  const leadingIndex = lastPoint 
    ? lastPoint.indexOf(Math.max(...lastPoint))
    : 0;

  if (data.length < 2) {
    return <div style={{ height }} className="w-full" />;
  }

  return (
    <div style={{ height }} className="w-full opacity-70 hover:opacity-100 transition-opacity">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={[0, 100]} hide />
          {Array.from({ length: numOutcomes }).map((_, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={`outcome_${index}`}
              stroke={
                index === leadingIndex 
                  ? OUTCOME_COLORS[index % OUTCOME_COLORS.length]
                  : '#9ca3af'
              }
              strokeWidth={index === leadingIndex ? 2 : 1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============ 生成模拟概率历史（支持多选项） ============
export function generateMockProbabilityHistory(
  currentPrices: number[], // 当前各选项概率 [50, 30, 20]
  points: number = 12
): ProbabilityDataPoint[] {
  const numOutcomes = currentPrices.length;
  const data: ProbabilityDataPoint[] = [];
  
  // 初始化概率（从平均值开始波动）
  const avgPrice = 100 / numOutcomes;
  let probs = currentPrices.map(() => avgPrice + (Math.random() - 0.5) * 20);
  
  // 归一化函数
  const normalize = (arr: number[]): number[] => {
    const sum = arr.reduce((a, b) => a + b, 0);
    return arr.map(v => Math.max(1, Math.min(98, (v / sum) * 100)));
  };
  
  probs = normalize(probs);
  
  const now = new Date();
  
  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 2 * 60 * 60 * 1000);
    const timeStr = time.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
    
    // 向目标价格移动 + 随机波动
    probs = probs.map((prob, idx) => {
      const target = currentPrices[idx];
      const randomWalk = (Math.random() - 0.5) * 10;
      return prob + (target - prob) * 0.25 + randomWalk;
    });
    
    probs = normalize(probs);
    
    const point: ProbabilityDataPoint = { time: timeStr };
    probs.forEach((prob, idx) => {
      point[`outcome_${idx}`] = Math.round(prob * 10) / 10;
    });
    
    data.push(point);
  }
  
  // 确保最后一个点是当前价格
  if (data.length > 0) {
    const normalizedCurrent = normalize([...currentPrices]);
    normalizedCurrent.forEach((price, idx) => {
      data[data.length - 1][`outcome_${idx}`] = price;
    });
  }
  
  return data;
}

// ============ 生成迷你图数据格式（支持多选项） ============
export function generateMiniProbabilityData(
  currentPrices: number[],
  points: number = 12
): number[][] {
  const fullData = generateMockProbabilityHistory(currentPrices, points);
  return fullData.map(point => {
    const probs: number[] = [];
    let idx = 0;
    while (point[`outcome_${idx}`] !== undefined) {
      probs.push(point[`outcome_${idx}`] as number);
      idx++;
    }
    return probs;
  });
}