'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

type SortKey = 'score' | 'price' | 'holders' | 'volume' | 'change';

interface Creator {
  id: number;
  twitterHandle: string;
  displayName: string;
  profileImage: string;
  engagementScore: number;
  price: number;
  priceChange24h: number;
  holders: number;
  volume24h: string;
}

interface CreatorLeaderboardProps {
  creators: Creator[];
  onSelectCreator: (creator: Creator) => void;
}

// 颜色配置
const RANK_COLORS = [
  { bg: 'bg-yellow-400', text: 'text-yellow-900', bar: 'bg-yellow-400' },     // 1st
  { bg: 'bg-gray-300', text: 'text-gray-700', bar: 'bg-gray-400' },           // 2nd
  { bg: 'bg-orange-400', text: 'text-orange-900', bar: 'bg-orange-400' },     // 3rd
  { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500', bar: 'bg-blue-500' }, // 4th+
];

export function CreatorLeaderboard({ creators, onSelectCreator }: CreatorLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showChart, setShowChart] = useState(true);

  const sortedCreators = useMemo(() => {
    return [...creators].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortKey) {
        case 'score': aVal = a.engagementScore; bVal = b.engagementScore; break;
        case 'price': aVal = a.price; bVal = b.price; break;
        case 'holders': aVal = a.holders; bVal = b.holders; break;
        case 'volume': aVal = parseFloat(a.volume24h); bVal = parseFloat(b.volume24h); break;
        case 'change': aVal = a.priceChange24h; bVal = b.priceChange24h; break;
        default: return 0;
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [creators, sortKey, sortOrder]);

  // 计算最大值用于条形图比例
  const maxValues = useMemo(() => ({
    score: Math.max(...creators.map(c => c.engagementScore), 1),
    price: Math.max(...creators.map(c => c.price), 1),
    holders: Math.max(...creators.map(c => c.holders), 1),
    volume: Math.max(...creators.map(c => parseFloat(c.volume24h)), 1),
  }), [creators]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const SortButton = ({ keyName, label }: { keyName: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(keyName)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        sortKey === keyName
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {label}
      {sortKey === keyName && (
        <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>
      )}
    </button>
  );

  // 获取当前排序key对应的值
  const getBarValue = (creator: Creator): number => {
    switch (sortKey) {
      case 'score': return creator.engagementScore;
      case 'price': return creator.price;
      case 'holders': return creator.holders;
      case 'volume': return parseFloat(creator.volume24h);
      case 'change': return Math.abs(creator.priceChange24h);
      default: return creator.engagementScore;
    }
  };

  const getBarMax = (): number => {
    switch (sortKey) {
      case 'score': return maxValues.score;
      case 'price': return maxValues.price;
      case 'holders': return maxValues.holders;
      case 'volume': return maxValues.volume;
      case 'change': return Math.max(...creators.map(c => Math.abs(c.priceChange24h)), 1);
      default: return maxValues.score;
    }
  };

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🏆 Creator Leaderboard
          </h2>
          <button
            onClick={() => setShowChart(!showChart)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              showChart 
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            {showChart ? '📊 Hide Bars' : '📊 Show Bars'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <SortButton keyName="score" label="Score" />
          <SortButton keyName="price" label="Price" />
          <SortButton keyName="holders" label="Holders" />
          <SortButton keyName="volume" label="Volume" />
          <SortButton keyName="change" label="24h %" />
        </div>
      </div>

      {/* ✅ 新增：Top 5 条形图可视化 */}
      {showChart && sortedCreators.length > 0 && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium">
            Top 5 by {sortKey.charAt(0).toUpperCase() + sortKey.slice(1)}
          </div>
          <div className="space-y-2">
            {sortedCreators.slice(0, 5).map((creator, index) => {
              const value = getBarValue(creator);
              const max = getBarMax();
              const percentage = (value / max) * 100;
              const rankColor = RANK_COLORS[Math.min(index, 3)];
              
              return (
                <div key={creator.id} className="flex items-center gap-3">
                  <div className="w-6 text-xs font-bold text-gray-400">
                    #{index + 1}
                  </div>
                  <div className="w-20 truncate text-sm text-gray-700 dark:text-gray-300">
                    @{creator.twitterHandle}
                  </div>
                  <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className={`h-full ${rankColor.bar} rounded-full flex items-center justify-end pr-2`}
                    >
                      <span className="text-xs font-bold text-white drop-shadow">
                        {sortKey === 'price' ? `$${value.toFixed(4)}` : 
                         sortKey === 'volume' ? `$${value.toFixed(0)}` :
                         sortKey === 'change' ? `${value.toFixed(1)}%` :
                         value.toFixed(0)}
                      </span>
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {sortedCreators.map((creator, index) => {
          const rankColor = RANK_COLORS[Math.min(index, 3)];
          const barValue = getBarValue(creator);
          const barMax = getBarMax();
          const barPercentage = (barValue / barMax) * 100;
          
          return (
            <motion.div
              key={creator.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectCreator(creator)}
              className="relative flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition overflow-hidden"
            >
              {/* ✅ 背景条形图 */}
              {showChart && (
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500/10 to-transparent dark:from-blue-500/20 transition-all duration-500"
                  style={{ width: `${barPercentage}%` }}
                />
              )}
              
              {/* Rank */}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rankColor.bg} ${rankColor.text}`}>
                {index + 1}
              </div>

              {/* Avatar */}
              <div className="relative z-10 w-10 h-10 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-gray-700">
                <Image
                  src={creator.profileImage || '/default-avatar.png'}
                  alt={creator.displayName}
                  width={40}
                  height={40}
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* Info */}
              <div className="relative z-10 flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">
                  {creator.displayName}
                </div>
                <div className="text-sm text-gray-500">@{creator.twitterHandle}</div>
              </div>

              {/* Stats */}
              <div className="relative z-10 text-right">
                <div className="font-bold text-gray-900 dark:text-white">
                  ${creator.price.toFixed(4)}
                </div>
                <div className={`text-sm font-medium ${
                  creator.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {creator.priceChange24h >= 0 ? '+' : ''}{creator.priceChange24h.toFixed(1)}%
                </div>
              </div>

              {/* Score Badge */}
              <div className="relative z-10 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">{creator.engagementScore}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {sortedCreators.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">🏆</div>
          <div>No creators to display</div>
        </div>
      )}
    </div>
  );
}