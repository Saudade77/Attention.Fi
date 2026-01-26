'use client';

import { useState } from 'react';
import { MarketCard } from './MarketCard';
import { Market, LimitOrder, PriceHistory } from '@/hooks/usePredictionMarket';

interface MarketListProps {
  markets: Market[];
  userOrders?: LimitOrder[];
  isOwner?: boolean;
  onBuy: (marketId: number, outcomeIndex: number | boolean, amount: string) => Promise<void>;
  onSell: (marketId: number, outcomeIndex: number | boolean, shares: bigint | string) => Promise<void>;
  onClaim: (marketId: number) => Promise<void>;
  onDelete?: (marketId: number) => Promise<void>;
  onPlaceBuyOrder?: (marketId: number, outcomeIndex: number, shares: string, price: number) => Promise<void>;
  onPlaceSellOrder?: (marketId: number, outcomeIndex: number, shares: string, price: number) => Promise<void>;
  onCancelOrder?: (orderId: number) => Promise<void>;
  getPriceHistory?: (marketId: number) => Promise<PriceHistory>;
  isConnected: boolean;
  loading: boolean;
  usdcBalance: string;
  userAddress?: string;
}

type Filter = 'all' | 'open' | 'resolved' | 'my-positions' | 'multi-outcome';
type SortBy = 'newest' | 'volume' | 'ending-soon';

export function MarketList({
  markets,
  userOrders = [],
  isOwner = false,
  onBuy,
  onSell,
  onClaim,
  onDelete,
  onPlaceBuyOrder,
  onPlaceSellOrder,
  onCancelOrder,
  getPriceHistory,
  isConnected,
  loading,
  usdcBalance,
  userAddress = '',
}: MarketListProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter
  let filteredMarkets = markets.filter((m) => {
    if (filter === 'open') return m.status === 0;
    if (filter === 'resolved') return m.status === 1;
    if (filter === 'my-positions') return m.userShares?.some(s => s > 0n) || m.userYesShares > 0n || m.userNoShares > 0n;
    if (filter === 'multi-outcome') return m.numOutcomes > 2;
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
    { key: 'multi-outcome', label: '🎯 Multi-Choice' },
  ];

  const totalVolume = markets.reduce((acc, m) => acc + parseFloat(m.volume || '0'), 0);
  const activeMarkets = markets.filter((m) => m.status === 0).length;
  const multiOutcomeCount = markets.filter((m) => m.numOutcomes > 2).length;

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
              : filter === 'multi-outcome'
              ? "No multi-choice markets available"
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              userOrders={userOrders}
              isOwner={isOwner}
              onBuy={onBuy}
              onSell={onSell}
              onClaim={onClaim}
              onDelete={onDelete}
              onPlaceBuyOrder={onPlaceBuyOrder}
              onPlaceSellOrder={onPlaceSellOrder}
              onCancelOrder={onCancelOrder}
              isConnected={isConnected}
              usdcBalance={usdcBalance}
              userAddress={userAddress}
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
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{activeMarkets}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{multiOutcomeCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Multi-Choice</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${totalVolume.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Volume</div>
        </div>
      </div>
    </div>
  );
}