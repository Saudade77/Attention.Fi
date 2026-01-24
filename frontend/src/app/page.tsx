'use client';

import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePredictionMarket } from '@/hooks/usePredictionMarket';
import { useCreatorMarket } from '@/hooks/useCreatorMarket';
import { CreateMarketModal } from '@/components/predictions/CreateMarketModal';
import { MarketList } from '@/components/predictions/MarketList';
import { CreatorCard } from '@/components/creators/CreatorCard';

type Tab = 'predictions' | 'creators' | 'portfolio';

// Twitter 用户数据接口
interface TwitterUser {
  handle: string;
  displayName: string;
  avatar: string;
  followers: number;
  following: number;
  tweets: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('predictions');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCreatorHandle, setNewCreatorHandle] = useState('');
  
  // Twitter 验证相关状态
  const [twitterPreview, setTwitterPreview] = useState<TwitterUser | null>(null);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
    address,
    isConnected,
    isOwner,
    markets,
    loading,
    usdcBalance,
    connect,
    disconnect,
    faucet,
    createMarket,
    buyShares,
    sellShares,
    claimWinnings,
  } = usePredictionMarket();

  const {
    creators,
    loading: creatorLoading,
    fetchCreators,
    registerCreator,
    buyShares: buyCreatorShares,
    sellShares: sellCreatorShares,
  } = useCreatorMarket(address, isConnected);

  // 刷新 creators 列表
  useEffect(() => {
    if (isConnected) {
      fetchCreators();
    }
  }, [isConnected, fetchCreators]);

  // Step 1: 用户点击 Launch -> 先验证 Twitter
  const handleVerifyTwitter = async () => {
    const handle = newCreatorHandle.trim();
    if (!handle) {
      alert('Please enter a Twitter handle');
      return;
    }

    // 检查是否已存在（比较时用 toLowerCase，但不影响原始输入）
    if (creators.some(c => c.handle.toLowerCase() === handle.toLowerCase())) {
      alert(`@${handle} has already been launched!`);
      return;
    }

    setTwitterLoading(true);
    try {
      // 调用 Twitter API 验证用户
      const res = await fetch(`/api/twitter/user?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || `Twitter user @${handle} not found`);
        return;
      }

      // 可选：检查粉丝数门槛
      if (data.followers < 100) {
        alert(`@${handle} needs at least 100 followers to be launched`);
        return;
      }

      // 保存预览数据，显示确认弹窗
      setTwitterPreview(data);
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error(error);
      alert('Failed to verify Twitter user. Please try again.');
    } finally {
      setTwitterLoading(false);
    }
  };

  // Step 2: 用户确认 -> 调用合约注册
  const handleConfirmLaunch = async () => {
    if (!twitterPreview) return;

    setShowConfirmModal(false);
    const success = await registerCreator(twitterPreview.handle);
    
    if (success) {
      setNewCreatorHandle('');
      setTwitterPreview(null);
      alert(`🎉 @${twitterPreview.handle} launched successfully!`);
      await fetchCreators();
    }
  };

  // 取消确认
  const handleCancelLaunch = () => {
    setShowConfirmModal(false);
    setTwitterPreview(null);
  };

  // 计算 Portfolio 统计
  const predictionPositions = markets.filter(
    (m) => m.userYesShares > 0n || m.userNoShares > 0n
  ).length;
  const creatorHoldings = creators.filter((c) => c.userShares > 0);
  const totalCreatorValue = creatorHoldings.reduce(
    (acc, c) => acc + c.userShares * c.price,
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#05060b] text-gray-900 dark:text-white transition-colors duration-300">
      {/* ========== Header ========== */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#05060b]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          {/* Logo & Nav */}
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              Attention.Fi
            </h1>

            <nav className="hidden md:flex items-center gap-1">
              {(['predictions', 'creators', 'portfolio'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab === 'predictions' && '🔮 '}
                  {tab === 'creators' && '👤 '}
                  {tab === 'portfolio' && '💼 '}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Wallet & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isConnected && (
              <>
                <div className="hidden sm:flex px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold">
                  <span className="text-green-600 dark:text-green-400">
                    ${parseFloat(usdcBalance).toFixed(2)}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-1">USDC</span>
                </div>

                <button
                  onClick={() => faucet('1000')}
                  className="px-3 py-2 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 font-semibold text-sm hover:bg-yellow-200 dark:hover:bg-yellow-500/30 transition"
                  title="Get test USDC"
                >
                  🚰 Faucet
                </button>

                {isOwner && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:opacity-90 transition"
                  >
                    + Create Market
                  </button>
                )}
              </>
            )}

            <ThemeToggle />

            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-xl text-sm font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <button
                  onClick={disconnect}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg hover:bg-blue-700 transition"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden px-4 pb-3 flex gap-2">
          {(['predictions', 'creators', 'portfolio'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {/* ========== Main Content ========== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ===== Predictions Tab ===== */}
        {activeTab === 'predictions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  🔮 Prediction Markets
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Trade on creator milestones and events
                </p>
              </div>
            </div>

            <MarketList
              markets={markets}
              onBuy={buyShares}
              onSell={sellShares}
              onClaim={claimWinnings}
              isConnected={isConnected}
              loading={loading}
              usdcBalance={usdcBalance}
            />
          </div>
        )}

        {/* ===== Creators Tab ===== */}
        {activeTab === 'creators' && (
          <div className="space-y-6">
            {/* Launch Creator Card */}
            <div className="p-6 bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    🚀 Launch a Creator
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Start a bonding curve for any Twitter creator. Verified via Twitter API.
                  </p>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  Min 100 followers
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                    @
                  </span>
                  <input
                    type="text"
                    placeholder="elonmusk"
                    value={newCreatorHandle}
                    onChange={(e) =>
                      setNewCreatorHandle(e.target.value.replace('@', ''))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyTwitter()}
                    className="w-full pl-9 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    disabled={twitterLoading || creatorLoading}
                  />
                </div>
                <button
                  onClick={handleVerifyTwitter}
                  disabled={!isConnected || !newCreatorHandle.trim() || twitterLoading || creatorLoading}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg min-w-[120px]"
                >
                  {twitterLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    '🔍 Verify & Launch'
                  )}
                </button>
              </div>

              {/* Quick suggestions */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Try:</span>
                {['elonmusk', 'VitalikButerin', 'naval', 'balaboris'].map((handle) => (
                  <button
                    key={handle}
                    onClick={() => setNewCreatorHandle(handle)}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    @{handle}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-white dark:bg-[#12141c] rounded-xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {creators.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Active Creators</div>
              </div>
              <div className="p-4 bg-white dark:bg-[#12141c] rounded-xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${creators.reduce((acc, c) => acc + c.poolBalance, 0).toFixed(0)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Locked</div>
              </div>
              <div className="p-4 bg-white dark:bg-[#12141c] rounded-xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {creatorHoldings.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Your Holdings</div>
              </div>
            </div>

            {/* Creator Grid */}
            {!isConnected ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔌</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Connect your wallet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Connect to view and trade creator shares
                </p>
                <button
                  onClick={connect}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
                >
                  Connect Wallet
                </button>
              </div>
            ) : creatorLoading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Loading creators...</p>
              </div>
            ) : creators.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">👤</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No creators launched yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Be the first to launch a creator above!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {creators.map((creator) => (
                  <CreatorCard
                    key={creator.handle}
                    creator={creator}
                    onBuy={buyCreatorShares}
                    onSell={sellCreatorShares}
                    isConnected={isConnected}
                    loading={creatorLoading}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Portfolio Tab ===== */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">💼 Your Portfolio</h2>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-6 bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">USDC Balance</div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ${parseFloat(usdcBalance).toFixed(2)}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Prediction Positions</div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {predictionPositions}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Creator Holdings</div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {creatorHoldings.length}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Creator Value</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${totalCreatorValue.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Holdings List */}
            <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-white">All Positions</h3>
              </div>

              {!isConnected ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  Connect wallet to view your portfolio
                </div>
              ) : predictionPositions === 0 && creatorHoldings.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  No positions yet. Start trading in Predictions or Creators tab!
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {/* Prediction Holdings */}
                  {markets
                    .filter((m) => m.userYesShares > 0n || m.userNoShares > 0n)
                    .map((m) => (
                      <div key={m.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-lg">
                            🔮
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white max-w-xs truncate">
                              {m.question}
                            </div>
                            <div className="text-sm text-purple-500 dark:text-purple-400">
                              Prediction Market
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {m.userYesShares > 0n && (
                            <div className="text-green-600 dark:text-green-400 font-semibold">
                              {(Number(m.userYesShares) / 1e18).toFixed(2)} YES
                            </div>
                          )}
                          {m.userNoShares > 0n && (
                            <div className="text-red-600 dark:text-red-400 font-semibold">
                              {(Number(m.userNoShares) / 1e18).toFixed(2)} NO
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  {/* Creator Holdings */}
                  {creatorHoldings.map((c) => (
                    <div key={c.handle} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <div className="flex items-center gap-3">
                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt={c.handle}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                            {c.handle.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            @{c.handle}
                          </div>
                          <div className="text-sm text-blue-500 dark:text-blue-400">
                            Creator Shares
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {c.userShares} shares
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400">
                          ${(c.userShares * c.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== Twitter Confirm Modal ========== */}
      {showConfirmModal && twitterPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#12141c] rounded-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                ✅ Twitter Verified
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Confirm to launch this creator's bonding curve
              </p>
            </div>

            {/* User Preview */}
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={twitterPreview.avatar}
                  alt={twitterPreview.handle}
                  className="w-16 h-16 rounded-full object-cover border-4 border-blue-500"
                />
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {twitterPreview.displayName}
                  </div>
                  <div className="text-blue-500 dark:text-blue-400">
                    @{twitterPreview.handle}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {(twitterPreview.followers / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Followers</div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {(twitterPreview.following / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Following</div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {(twitterPreview.tweets / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Tweets</div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 mb-6">
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>🎯 Starting Price:</strong> $1.00 USDC per share
                  <br />
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Price increases with each purchase (Bonding Curve)
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex gap-3">
              <button
                onClick={handleCancelLaunch}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLaunch}
                disabled={creatorLoading}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition shadow-lg"
              >
                {creatorLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Launching...
                  </span>
                ) : (
                  '🚀 Launch Creator'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Create Market Modal ========== */}
      <CreateMarketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={createMarket}
      />
    </main>
  );
}