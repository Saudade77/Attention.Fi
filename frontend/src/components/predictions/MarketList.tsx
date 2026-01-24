'use client';

import { useState } from 'react';
import { MarketCard } from './MarketCard';

interface Market {
  id: number;
  question: string;
  category: string;
  endTime: number;
  status: number;
  yesShares: bigint;
  noShares: bigint;
  yesPrice: number;
  noPrice: number;
  userYesShares: bigint;
  userNoShares: bigint;
  hasClaimed: boolean;
  volume: string;
  outcome: boolean;
}

interface MarketListProps {
  markets: Market[];
  onBuy: (marketId: number, isYes: boolean, amount: string) => Promise<void>;
  onSell: (marketId: number, isYes: boolean, shares: bigint) => Promise<void>;
  onClaim: (marketId: number) => Promise<void>;
  isConnected: boolean;
  loading: boolean;
  usdcBalance: string;
}

type Filter = 'all' | 'open' | 'resolved' | 'my-positions';
type SortBy = 'newest' | 'volume' | 'ending-soon';

export function MarketList({
  markets,
  onBuy,
  onSell,
  onClaim,
  isConnected,
  loading,
  usdcBalance,
}: MarketListProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter
  let filteredMarkets = markets.filter((m) => {
    if (filter === 'open') return m.status === 0;
    if (filter === 'resolved') return m.status === 1;
    if (filter === 'my-positions') return m.userYesShares > 0n || m.userNoShares > 0n;
    return true;
  });

  // Search
  if (searchQuery) {
    filteredMarkets = filteredMarkets.filter((m) =>
      m.question.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Sort
  filteredMarkets = [...filteredMarkets].sort((a, b) => {
    if (sortBy === 'volume') return parseFloat(b.volume) - parseFloat(a.volume);
    if (sortBy === 'ending-soon') return a.endTime - b.endTime;
    return b.id - a.id;
  });

  const filterButtons: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All Markets' },
    { key: 'open', label: '🟢 Open' },
    { key: 'resolved', label: '✅ Resolved' },
    { key: 'my-positions', label: '👤 My Positions' },
  ];

  return (
    <div>
      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === btn.key
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {btn.label}
            </button>
          ))}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="ml-auto px-4 py-2 bg-white dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 focus:outline-none"
          >
            <option value="newest">🕐 Newest</option>
            <option value="volume">📊 Volume</option>
            <option value="ending-soon">⏰ Ending Soon</option>
          </select>
        </div>
      </div>

      {/* Market Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔮</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No markets found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'my-positions'
              ? "You haven't made any predictions yet"
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              onBuy={onBuy}
              onSell={onSell}
              onClaim={onClaim}
              isConnected={isConnected}
              usdcBalance={usdcBalance}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-around text-center">
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{markets.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Markets</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {markets.filter((m) => m.status === 0).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${markets.reduce((acc, m) => acc + parseFloat(m.volume || '0'), 0).toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Volume</div>
        </div>
      </div>
    </div>
  );
}