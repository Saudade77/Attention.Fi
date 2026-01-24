'use client';

import { useState, useEffect } from 'react';

interface Creator {
  handle: string;
  totalSupply: number;
  poolBalance: number;
  price: number;
  userShares: number;
  // Twitter 数据（从 API 获取）
  displayName?: string;
  avatar?: string;
  followers?: number;
  attentionScore?: number;
  priceChange24h?: number;
}

interface CreatorCardProps {
  creator: Creator;
  onBuy: (handle: string, amount: number) => Promise<boolean>;
  onSell: (handle: string, amount: number) => Promise<boolean>;
  isConnected: boolean;
  loading: boolean;
}

export function CreatorCard({ creator, onBuy, onSell, isConnected, loading }: CreatorCardProps) {
  const [buyAmount, setBuyAmount] = useState('1');
  const [sellAmount, setSellAmount] = useState('1');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [isProcessing, setIsProcessing] = useState(false);
  const [twitterData, setTwitterData] = useState<any>(null);

  // 获取 Twitter 数据
  useEffect(() => {
    async function fetchTwitterData() {
      try {
        const res = await fetch(`/api/twitter/verify?handle=${creator.handle}`);
        if (res.ok) {
          const data = await res.json();
          setTwitterData(data);
        }
      } catch (e) {
        console.log('Failed to fetch Twitter data');
      }
    }
    fetchTwitterData();
  }, [creator.handle]);

  const handleBuy = async () => {
    const amount = parseInt(buyAmount);
    if (!amount || amount <= 0) return;

    setIsProcessing(true);
    try {
      await onBuy(creator.handle, amount);
      setBuyAmount('1');
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
      await onSell(creator.handle, amount);
      setSellAmount('1');
    } catch (error: any) {
      alert(error.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const estimatedCost = parseFloat(buyAmount || '0') * creator.price;
  const estimatedReturn = parseFloat(sellAmount || '0') * creator.price * 0.95;
  const attentionScore = twitterData?.attentionScore || creator.attentionScore || 0;
  const scoreColor = attentionScore >= 700 ? 'text-green-500' : attentionScore >= 400 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
      {/* Attention Score Bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-800">
        <div 
          className={`h-full bg-gradient-to-r ${
            attentionScore >= 700 ? 'from-green-500 to-emerald-500' :
            attentionScore >= 400 ? 'from-yellow-500 to-orange-500' :
            'from-red-500 to-rose-500'
          }`}
          style={{ width: `${Math.min(attentionScore / 10, 100)}%` }}
        />
      </div>

      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            {twitterData?.avatar ? (
              <img
                src={twitterData.avatar}
                alt={creator.handle}
                className="w-14 h-14 rounded-full border-2 border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
                {creator.handle.slice(0, 2).toUpperCase()}
              </div>
            )}
            {twitterData?.verified && (
              <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✓</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {twitterData?.displayName || `@${creator.handle}`}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              @{creator.handle}
            </p>
          </div>

          {/* Attention Score */}
          <div className="text-right">
            <div className={`text-2xl font-bold ${scoreColor}`}>
              {attentionScore}
            </div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              ${creator.price.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">Price</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {creator.totalSupply}
            </div>
            <div className="text-xs text-gray-500">Supply</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {twitterData ? formatNumber(twitterData.followers) : '-'}
            </div>
            <div className="text-xs text-gray-500">Followers</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {creator.userShares}
            </div>
            <div className="text-xs text-gray-500">You Own</div>
          </div>
        </div>
      </div>

      {/* Trade Section */}
      <div className="p-5">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition ${
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
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition ${
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
            <div className="flex gap-2">
              {[1, 5, 10, 25].map((val) => (
                <button
                  key={val}
                  onClick={() => setBuyAmount(val.toString())}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    buyAmount === val.toString()
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total cost</span>
                <span className="font-bold text-gray-900 dark:text-white">${estimatedCost.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleBuy}
              disabled={!isConnected || isProcessing || loading}
              className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all"
            >
              {isProcessing ? 'Processing...' : `Buy ${buyAmount} Share${parseInt(buyAmount) > 1 ? 's' : ''}`}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              {[1, Math.floor(creator.userShares / 2), creator.userShares]
                .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                .map((val) => (
                  <button
                    key={val}
                    onClick={() => setSellAmount(val.toString())}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      sellAmount === val.toString()
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {val === creator.userShares ? 'All' : val}
                  </button>
                ))}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">You receive (after 5% fee)</span>
                <span className="font-bold text-gray-900 dark:text-white">${estimatedReturn.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleSell}
              disabled={!isConnected || isProcessing || loading || creator.userShares === 0}
              className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all"
            >
              {isProcessing ? 'Processing...' : `Sell ${sellAmount} Share${parseInt(sellAmount) > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const formatNumber = (num: number | undefined | null): string => {
  // 添加空值检查
  if (num === undefined || num === null) return '0';
  
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};