'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniPriceChart, generatePriceHistory } from '@/components/charts';

interface Creator {
  handle: string;
  totalSupply: number;
  poolBalance: number;
  price: number;
  userShares: number;
  displayName?: string;
  avatar?: string;
  followers?: number;
  attentionScore?: number;
  priceChange24h?: number;
  priceHistory?: number[];
}

interface CreatorCardProps {
  creator: Creator;
  onBuy: (handle: string, amount: number) => Promise<boolean>;
  onSell: (handle: string, amount: number) => Promise<boolean>;
  isConnected: boolean;
  loading: boolean;
}

// Attention Score 等级配置
const getScoreLevel = (score: number) => {
  if (score >= 700) return { label: 'Elite', color: 'from-yellow-400 to-orange-500', icon: '👑', bg: 'bg-yellow-500' };
  if (score >= 500) return { label: 'Hot', color: 'from-red-400 to-pink-500', icon: '🔥', bg: 'bg-red-500' };
  if (score >= 300) return { label: 'Rising', color: 'from-blue-400 to-purple-500', icon: '📈', bg: 'bg-blue-500' };
  return { label: 'New', color: 'from-gray-400 to-gray-500', icon: '🌱', bg: 'bg-gray-500' };
};

export function CreatorCard({ creator, onBuy, onSell, isConnected, loading }: CreatorCardProps) {
  const [buyAmount, setBuyAmount] = useState('1');
  const [sellAmount, setSellAmount] = useState('1');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [isProcessing, setIsProcessing] = useState(false);
  const [twitterData, setTwitterData] = useState<any>(null);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const [prevPrice, setPrevPrice] = useState(creator.price);

  // 生成或使用价格历史数据
  const priceHistory = useMemo(() => {
    if (creator.priceHistory && creator.priceHistory.length > 0) {
      return creator.priceHistory;
    }
    return generatePriceHistory(creator.price, 7);
  }, [creator.priceHistory, creator.price]);

  // 获取 Twitter 数据 - 使用新的统一 API
  useEffect(() => {
    async function fetchTwitterData() {
      // 如果 creator 已经有完整数据，直接使用
      if (creator.followers && creator.followers > 0) {
        setTwitterData({
          displayName: creator.displayName,
          avatar: creator.avatar,
          followers: creator.followers,
          attentionScore: creator.attentionScore,
          priceChange24h: creator.priceChange24h,
        });
        return;
      }

      try {
        // 使用新的统一 API
        const res = await fetch(`/api/creators?handle=${encodeURIComponent(creator.handle.toLowerCase())}`);
        if (res.ok) {
          const data = await res.json();
          // 处理返回数据（可能有 _noData 标记表示没有 Twitter 数据）
          if (!data._noData && !data.error) {
            setTwitterData({
              displayName: data.displayName,
              avatar: data.avatar,
              followers: data.followers || 0,
              attentionScore: data.attentionScore || 0,
              priceChange24h: data.priceChange24h || 0,
            });
          }
        }
      } catch (e) {
        console.log('Failed to fetch Twitter data for', creator.handle);
      }
    }
    fetchTwitterData();
  }, [creator.handle, creator.followers, creator.displayName, creator.avatar, creator.attentionScore, creator.priceChange24h]);

  // 监听价格变化
  useEffect(() => {
    if (creator.price !== prevPrice) {
      setPriceFlash(creator.price > prevPrice ? 'up' : 'down');
      setPrevPrice(creator.price);
      const timer = setTimeout(() => setPriceFlash(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [creator.price, prevPrice]);

  // 处理买入数量输入
  const handleBuyAmountChange = (value: string) => {
    const num = value.replace(/[^0-9]/g, '');
    setBuyAmount(num);
  };

  // 处理卖出数量输入
  const handleSellAmountChange = (value: string) => {
    const num = value.replace(/[^0-9]/g, '');
    if (num && parseInt(num) > creator.userShares) {
      setSellAmount(creator.userShares.toString());
    } else {
      setSellAmount(num);
    }
  };

  const handleBuy = async () => {
    const amount = parseInt(buyAmount);
    if (!amount || amount <= 0) return;

    setIsProcessing(true);
    try {
      const success = await onBuy(creator.handle, amount);
      if (success) {
        setBuyAmount('1');
        setShowTradePanel(false);
      }
    } catch (error: any) {
      alert(error.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSell = async () => {
    const amount = parseInt(sellAmount);
    if (!amount || amount <= 0 || amount > creator.userShares) return;

    setIsProcessing(true);
    try {
      const success = await onSell(creator.handle, amount);
      if (success) {
        setSellAmount('1');
        setShowTradePanel(false);
      }
    } catch (error: any) {
      alert(error.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const parsedBuyAmount = parseInt(buyAmount) || 0;
  const parsedSellAmount = parseInt(sellAmount) || 0;
  const estimatedCost = parsedBuyAmount * creator.price * (1 + parsedBuyAmount * 0.02);
  const estimatedReturn = parsedSellAmount * creator.price * 0.95;
  const attentionScore = twitterData?.attentionScore || creator.attentionScore || 0;
  const scoreLevel = getScoreLevel(attentionScore);
  const priceChange = creator.priceChange24h || (twitterData?.priceChange24h) || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
    >
      {/* Attention Score Bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-800">
        <motion.div 
          className={`h-full bg-gradient-to-r ${scoreLevel.color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(attentionScore / 10, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            {twitterData?.avatar || creator.avatar ? (
              <img
                src={twitterData?.avatar || creator.avatar}
                alt={creator.handle}
                className="w-14 h-14 rounded-full border-2 border-gray-200 dark:border-gray-700 object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
                {creator.handle.slice(0, 2).toUpperCase()}
              </div>
            )}
            {/* Score Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-1 -right-1 text-lg"
              title={`${scoreLevel.label} Creator`}
            >
              {scoreLevel.icon}
            </motion.div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {twitterData?.displayName || creator.displayName || `@${creator.handle}`}
            </h3>
            <a
              href={`https://twitter.com/${creator.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline"
            >
              @{creator.handle}
            </a>
          </div>

          {/* Attention Score */}
          <div className="text-right">
            <motion.div 
              className={`text-2xl font-bold bg-gradient-to-r ${scoreLevel.color} bg-clip-text text-transparent`}
              key={attentionScore}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
            >
              {attentionScore}
            </motion.div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          {/* Price + Mini Chart */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg col-span-2">
            <div className="flex items-center justify-center gap-2">
              <div>
                <motion.div 
                  className={`text-lg font-bold transition-colors duration-300 ${
                    priceFlash === 'up' ? 'text-green-500' :
                    priceFlash === 'down' ? 'text-red-500' :
                    'text-gray-900 dark:text-white'
                  }`}
                  key={creator.price}
                  animate={priceFlash ? { scale: [1, 1.1, 1] } : {}}
                >
                  ${creator.price.toFixed(2)}
                </motion.div>
                {priceChange !== 0 && (
                  <div className={`text-xs ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
                  </div>
                )}
              </div>
              {/* 迷你走势图 */}
              <MiniPriceChart 
                data={priceHistory} 
                width={50} 
                height={24}
                positive={priceChange >= 0}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">Price (7d)</div>
          </div>
          
          <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {creator.totalSupply}
            </div>
            <div className="text-xs text-gray-500">Supply</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className={`text-sm font-bold ${creator.userShares > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
              {creator.userShares}
            </div>
            <div className="text-xs text-gray-500">You Own</div>
          </div>
        </div>

        {/* User Position Badge */}
        {creator.userShares > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 p-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-600 dark:text-blue-400 font-medium">Your Position</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {creator.userShares} shares ≈ ${(creator.userShares * creator.price).toFixed(2)}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Trade Section */}
      <div className="p-5">
        {/* Quick Buy/Sell Buttons */}
        {!showTradePanel ? (
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveTab('buy');
                setShowTradePanel(true);
              }}
              disabled={!isConnected}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Buy Key
            </motion.button>
            {creator.userShares > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveTab('sell');
                  setShowTradePanel(true);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all"
              >
                Sell Key
              </motion.button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Close Button */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {activeTab === 'buy' ? '🟢 Buy' : '🔴 Sell'} @{creator.handle}
                </span>
                <button
                  onClick={() => setShowTradePanel(false)}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('buy')}
                  className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${
                    activeTab === 'buy'
                      ? 'bg-green-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setActiveTab('sell')}
                  disabled={creator.userShares === 0}
                  className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${
                    activeTab === 'sell'
                      ? 'bg-red-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  } disabled:opacity-50`}
                >
                  Sell
                </button>
              </div>

              {activeTab === 'buy' ? (
                <div className="space-y-3">
                  {/* 数量输入框 */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Number of Keys
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={buyAmount}
                        onChange={(e) => handleBuyAmountChange(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-semibold pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                        keys
                      </span>
                    </div>
                  </div>

                  {/* Cost Estimate */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Amount</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {parsedBuyAmount || 0} key{parsedBuyAmount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Est. total cost</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        ${parsedBuyAmount > 0 ? estimatedCost.toFixed(2) : '0.00'}
                      </span>
                    </div>
                    {parsedBuyAmount > 5 && (
                      <div className="mt-2 text-xs text-orange-500 flex items-center gap-1">
                        ⚠️ Price impact: ~{(parsedBuyAmount * 2).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleBuy}
                    disabled={!isConnected || isProcessing || loading || parsedBuyAmount <= 0}
                    className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      `Buy ${parsedBuyAmount || 0} Key${parsedBuyAmount !== 1 ? 's' : ''}`
                    )}
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Available Balance */}
                  <div className="text-xs text-gray-500">
                    Available: <span className="font-semibold text-gray-900 dark:text-white">{creator.userShares} keys</span>
                  </div>

                  {/* 卖出数量输入框 */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Number of Keys to Sell
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={sellAmount}
                        onChange={(e) => handleSellAmountChange(e.target.value)}
                        placeholder="Enter amount"
                        max={creator.userShares}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-lg font-semibold pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                        keys
                      </span>
                    </div>
                    {/* Max 按钮 */}
                    <button
                      type="button"
                      onClick={() => setSellAmount(creator.userShares.toString())}
                      className="mt-2 text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Sell All ({creator.userShares} keys)
                    </button>
                  </div>

                  {/* Return Estimate */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Selling</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {parsedSellAmount || 0} key{parsedSellAmount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">You receive (after 5% fee)</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        ${parsedSellAmount > 0 ? estimatedReturn.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSell}
                    disabled={!isConnected || isProcessing || loading || parsedSellAmount <= 0 || parsedSellAmount > creator.userShares}
                    className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      `Sell ${parsedSellAmount || 0} Key${parsedSellAmount !== 1 ? 's' : ''}`
                    )}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}