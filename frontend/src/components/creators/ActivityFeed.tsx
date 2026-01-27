'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Activity {
  id: string;
  type: 'buy' | 'sell' | 'launch';
  user: string;
  creatorName: string;
  creatorHandle: string;
  amount: number;
  price: number;
  timestamp: number;
}

interface ActivityFeedProps {
  activities: Activity[];
  maxItems?: number;
}

export function ActivityFeed({ activities, maxItems = 10 }: ActivityFeedProps) {
  const [displayedActivities, setDisplayedActivities] = useState<Activity[]>([]);

  useEffect(() => {
    setDisplayedActivities(activities.slice(0, maxItems));
  }, [activities, maxItems]);

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const shortenAddress = (address: string) => {
    if (!address || address.length < 10) return address || 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTypeConfig = (type: Activity['type']) => {
    switch (type) {
      case 'buy':
        return { icon: '↗', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600', label: 'bought' };
      case 'sell':
        return { icon: '↙', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600', label: 'sold' };
      case 'launch':
        return { icon: '🚀', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600', label: 'launched' };
    }
  };

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live Activity
        </h3>
        <span className="text-xs text-gray-500">{activities.length} trades</span>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {displayedActivities.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm">No activity yet</div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayedActivities.map((activity, index) => {
              const config = getTypeConfig(activity.type);
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, height: 0, x: -20 }}
                  animate={{ opacity: 1, height: 'auto', x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    {/* 交易类型图标 */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bg} ${config.text}`}>
                      {config.icon}
                    </div>

                    {/* 交易详情 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {shortenAddress(activity.user)}
                        </span>
                        <span className={`mx-1 ${config.text}`}>
                          {config.label}
                        </span>
                        {activity.type !== 'launch' && (
                          <>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {activity.amount}
                            </span>
                            <span className="text-gray-500"> keys of </span>
                          </>
                        )}
                        <span className="font-medium text-blue-500">
                          @{activity.creatorHandle}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {activity.type !== 'launch' && `$${(activity.amount * activity.price).toFixed(2)} • `}
                        {formatTime(activity.timestamp)}
                      </div>
                    </div>

                    {/* 新交易标记 */}
                    {index === 0 && Date.now() - activity.timestamp < 30000 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full"
                      >
                        NEW
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}