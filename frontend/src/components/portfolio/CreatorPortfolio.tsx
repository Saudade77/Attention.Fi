// components/portfolio/CreatorPortfolio.tsx
'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface Holding {
  creator: {
    id: number;
    displayName: string;
    twitterHandle: string;
    profileImage: string;
    price: number;
    priceChange24h: number;
  };
  amount: number;
  avgBuyPrice: number;
  totalInvested: number;
}

interface CreatorPortfolioProps {
  holdings: Holding[];
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
}

export function CreatorPortfolio({
  holdings,
  totalValue,
  totalPnL,
  totalPnLPercent,
}: CreatorPortfolioProps) {
  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const aValue = a.amount * a.creator.price;
      const bValue = b.amount * b.creator.price;
      return bValue - aValue;
    });
  }, [holdings]);

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="text-sm opacity-80 mb-1">Creator Portfolio Value</div>
        <div className="text-4xl font-bold mb-4">
          ${totalValue.toFixed(2)}
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            totalPnL >= 0 ? 'bg-green-400/20' : 'bg-red-400/20'
          }`}>
            {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USDC
          </div>
          <div className={`text-sm ${totalPnL >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Holdings List */}
      <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">
            Your Holdings ({holdings.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {sortedHoldings.map((holding, index) => {
            const currentValue = holding.amount * holding.creator.price;
            const pnl = currentValue - holding.totalInvested;
            const pnlPercent = (pnl / holding.totalInvested) * 100;

            return (
              <motion.div
                key={holding.creator.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden">
                    <Image
                      src={holding.creator.profileImage || '/default-avatar.png'}
                      alt={holding.creator.displayName}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>

                  {/* Creator Info */}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {holding.creator.displayName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {holding.amount.toFixed(2)} keys @ ${holding.avgBuyPrice.toFixed(4)} avg
                    </div>
                  </div>

                  {/* Value & PnL */}
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">
                      ${currentValue.toFixed(2)}
                    </div>
                    <div className={`text-sm font-medium ${
                      pnl >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                    </div>
                  </div>
                </div>

                {/* Mini Progress Bar for allocation */}
                <div className="mt-3">
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(currentValue / totalValue) * 100}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {((currentValue / totalValue) * 100).toFixed(1)}% of portfolio
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}