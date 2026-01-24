'use client';

import { useState } from 'react';

interface Market {
  id: number;
  question: string;
  category: string;
  endTime: number;
  status: number;
  yesPrice: number;
  noPrice: number;
  userYesShares: bigint;
  userNoShares: bigint;
  hasClaimed: boolean;
  volume: string;
  outcome: boolean;
}

interface MarketCardProps {
  market: Market;
  onBuy: (marketId: number, isYes: boolean, amount: string) => Promise<void>;
  onSell: (marketId: number, isYes: boolean, shares: bigint) => Promise<void>;
  onClaim: (marketId: number) => Promise<void>;
  isConnected: boolean;
  usdcBalance: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  crypto: 'from-orange-500 to-yellow-500',
  politics: 'from-blue-500 to-indigo-500',
  sports: 'from-green-500 to-emerald-500',
  entertainment: 'from-pink-500 to-rose-500',
  tech: 'from-purple-500 to-violet-500',
  default: 'from-gray-500 to-gray-600',
};

const CATEGORY_ICONS: Record<string, string> = {
  crypto: '₿',
  politics: '🏛️',
  sports: '⚽',
  entertainment: '🎬',
  tech: '💻',
  default: '🔮',
};

export function MarketCard({ market, onBuy, onSell, onClaim, isConnected, usdcBalance }: MarketCardProps) {
  const [amount, setAmount] = useState('10');
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no' | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTradePanel, setShowTradePanel] = useState(false);

  const isOpen = market.status === 0;
  const isResolved = market.status === 1;
  const timeLeft = market.endTime * 1000 - Date.now();
  const daysLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  const categoryColor = CATEGORY_COLORS[market.category] || CATEGORY_COLORS.default;
  const categoryIcon = CATEGORY_ICONS[market.category] || CATEGORY_ICONS.default;
  const hasPosition = market.userYesShares > 0n || market.userNoShares > 0n;

  const handleTrade = async () => {
    if (!selectedSide) return;
    setLoading(true);
    try {
      await onBuy(market.id, selectedSide === 'yes', amount);
      setShowTradePanel(false);
      setSelectedSide(null);
    } catch (error: any) {
      alert(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  const price = selectedSide === 'yes' ? market.yesPrice : market.noPrice;
  const potentialShares = parseFloat(amount) / (price / 100);

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-lg dark:hover:border-gray-700 transition-all duration-200">
      {/* Category Color Bar */}
      <div className={`h-1.5 bg-gradient-to-r ${categoryColor}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${categoryColor} flex items-center justify-center text-lg shadow-md`}>
              {categoryIcon}
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                {market.category}
              </span>
              {isOpen && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {daysLeft > 0 ? `${daysLeft}d ${hoursLeft}h left` : `${hoursLeft}h left`}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Volume</div>
            <div className="text-sm font-bold text-green-600 dark:text-green-400">${market.volume}</div>
          </div>
        </div>

        {/* Question */}
        <h3 className="text-lg font-semibold mb-5 leading-snug text-gray-900 dark:text-white">
          {market.question}
        </h3>

        {/* Price Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => {
              setSelectedSide('yes');
              setShowTradePanel(true);
            }}
            disabled={!isOpen || !isConnected}
            className={`relative p-4 rounded-xl border-2 transition-all duration-150 ${
              selectedSide === 'yes' && showTradePanel
                ? 'border-green-500 bg-green-500/10 dark:bg-green-500/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500 bg-gray-50 dark:bg-gray-800/60'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Yes</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{market.yesPrice}¢</div>
            {isResolved && market.outcome && (
              <div className="absolute top-2 right-2 text-green-500 text-lg">✓</div>
            )}
          </button>

          <button
            onClick={() => {
              setSelectedSide('no');
              setShowTradePanel(true);
            }}
            disabled={!isOpen || !isConnected}
            className={`relative p-4 rounded-xl border-2 transition-all duration-150 ${
              selectedSide === 'no' && showTradePanel
                ? 'border-red-500 bg-red-500/10 dark:bg-red-500/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-red-400 dark:hover:border-red-500 bg-gray-50 dark:bg-gray-800/60'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">No</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{market.noPrice}¢</div>
            {isResolved && !market.outcome && (
              <div className="absolute top-2 right-2 text-green-500 text-lg">✓</div>
            )}
          </button>
        </div>

        {/* User Position */}
        {hasPosition && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-4 border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">Your Position</div>
                <div className="flex gap-3 text-sm">
                  {market.userYesShares > 0n && (
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      {(Number(market.userYesShares) / 1e18).toFixed(2)} Yes
                    </span>
                  )}
                  {market.userNoShares > 0n && (
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      {(Number(market.userNoShares) / 1e18).toFixed(2)} No
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Panel */}
        {showTradePanel && isOpen && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                Buy{' '}
                <span className={selectedSide === 'yes' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {selectedSide?.toUpperCase()}
                </span>
              </span>
              <button
                onClick={() => {
                  setShowTradePanel(false);
                  setSelectedSide(null);
                }}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Amount Input */}
            <div className="relative">
              <input
                type="number"
                step="1"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-lg pr-16 text-gray-900 dark:text-white font-medium"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                USDC
              </span>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2">
              {['10', '25', '50', '100'].map((val) => (
                <button
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    amount === val
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>

            {/* Balance Display */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Balance: <span className="font-semibold text-gray-700 dark:text-gray-200">${parseFloat(usdcBalance).toFixed(2)} USDC</span>
            </div>

            {/* Trade Info */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-2 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Avg price</span>
                <span className="text-gray-900 dark:text-white font-medium">{price}¢</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Est. shares</span>
                <span className="text-gray-900 dark:text-white font-medium">{potentialShares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Potential return</span>
                <span className="text-green-600 dark:text-green-400 font-bold">
                  ${potentialShares.toFixed(2)} (if wins)
                </span>
              </div>
            </div>

            {/* Buy Button */}
            <button
              onClick={handleTrade}
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                selectedSide === 'yes'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Buy ${selectedSide?.toUpperCase()}`
              )}
            </button>
          </div>
        )}

        {/* Claim Button */}
        {isResolved && hasPosition && !market.hasClaimed && (
          <button
            onClick={() => onClaim(market.id)}
            className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl font-bold text-lg hover:from-yellow-500 hover:to-orange-600 transition-all mt-4 shadow-lg hover:shadow-xl text-white"
          >
            🎉 Claim Winnings
          </button>
        )}

        {/* Status Badge */}
        {!isOpen && (
          <div
            className={`text-center py-3 rounded-xl text-sm font-semibold mt-4 ${
              isResolved
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}
          >
            {isResolved ? `✅ Resolved: ${market.outcome ? 'YES' : 'NO'} won` : '❌ Market Cancelled'}
          </div>
        )}
      </div>
    </div>
  );
}