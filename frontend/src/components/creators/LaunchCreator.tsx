'use client';

import { useState } from 'react';

interface TwitterUser {
  valid: boolean;
  handle: string;
  displayName: string;
  avatar: string;
  followers: number;
  following: number;
  tweets: number;
  verified: boolean;
  attentionScore: number;
  suggestedLiquidity: number;
}

interface LaunchCreatorProps {
  onLaunch: (handle: string, initialLiquidity: string) => Promise<void>;
  isConnected: boolean;
  usdcBalance: string;
}

export function LaunchCreator({ onLaunch, isConnected, usdcBalance }: LaunchCreatorProps) {
  const [handle, setHandle] = useState('');
  const [twitterUser, setTwitterUser] = useState<TwitterUser | null>(null);
  const [liquidity, setLiquidity] = useState('100');
  const [verifying, setVerifying] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  // 验证 Twitter 用户
  const verifyTwitter = async () => {
    if (!handle.trim()) return;

    setVerifying(true);
    setError('');
    setTwitterUser(null);

    try {
      const res = await fetch(`/api/twitter/verify?handle=${handle.replace('@', '')}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'User not found');
        return;
      }

      setTwitterUser(data);
      setLiquidity(data.suggestedLiquidity.toString());
    } catch (err) {
      setError('Failed to verify Twitter user');
    } finally {
      setVerifying(false);
    }
  };

  // Launch Creator
  const handleLaunch = async () => {
    if (!twitterUser) return;

    setLaunching(true);
    try {
      await onLaunch(twitterUser.handle, liquidity);
      // 重置表单
      setHandle('');
      setTwitterUser(null);
      setLiquidity('100');
    } catch (err: any) {
      setError(err.message || 'Launch failed');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          🚀 Launch a Creator
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tokenize any Twitter creator's attention and trade their influence
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Step 1: Verify Twitter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Step 1: Verify Twitter Account
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                placeholder="elonmusk"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace('@', ''))}
                onKeyDown={(e) => e.key === 'Enter' && verifyTwitter()}
                className="w-full pl-8 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={verifyTwitter}
              disabled={!handle.trim() || verifying}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 transition flex items-center gap-2"
            >
              {verifying ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                '🔍 Verify'
              )}
            </button>
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-2">❌ {error}</p>
          )}
        </div>

        {/* Twitter User Preview */}
        {twitterUser && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={twitterUser.avatar}
                alt={twitterUser.handle}
                className="w-16 h-16 rounded-full border-2 border-green-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {twitterUser.displayName}
                  </h3>
                  {twitterUser.verified && (
                    <span className="text-blue-500">✓</span>
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400">@{twitterUser.handle}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {twitterUser.attentionScore}
                </div>
                <div className="text-xs text-gray-500">Attention Score</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatNumber(twitterUser.followers)}
                </div>
                <div className="text-xs text-gray-500">Followers</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatNumber(twitterUser.following)}
                </div>
                <div className="text-xs text-gray-500">Following</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatNumber(twitterUser.tweets)}
                </div>
                <div className="text-xs text-gray-500">Tweets</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Set Liquidity */}
        {twitterUser && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Step 2: Initial Liquidity Pool
            </label>
            <div className="relative">
              <input
                type="number"
                min="10"
                value={liquidity}
                onChange={(e) => setLiquidity(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">USDC</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Suggested: ${twitterUser.suggestedLiquidity} based on follower count. 
              Your balance: <span className="text-green-500">${parseFloat(usdcBalance).toFixed(2)}</span>
            </p>

            {/* Quick amounts */}
            <div className="flex gap-2 mt-3">
              {['50', '100', '250', '500'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setLiquidity(amt)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    liquidity === amt
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Launch Button */}
        {twitterUser && (
          <button
            onClick={handleLaunch}
            disabled={!isConnected || launching || parseFloat(liquidity) > parseFloat(usdcBalance)}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {launching ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Launching...
              </>
            ) : (
              <>🚀 Launch @{twitterUser.handle}</>
            )}
          </button>
        )}

        {/* How it works */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">How Attention Mining Works</h4>
          <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-blue-500">1.</span>
              <span>Creator's Twitter engagement is tracked by our Oracle</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500">2.</span>
              <span>Share prices follow a dynamic bonding curve based on attention score</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500">3.</span>
              <span>Holders earn rewards when the creator's engagement grows</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}