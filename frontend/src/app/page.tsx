'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePredictionMarket } from '@/hooks/usePredictionMarket';
import { useCreatorMarket } from '@/hooks/useCreatorMarket';
import { CreateMarketModal } from '@/components/predictions/CreateMarketModal';
import { MarketList } from '@/components/predictions/MarketList';
import { CreatorCard } from '@/components/creators/CreatorCard';
import { CreatorLeaderboard } from '@/components/creators/CreatorLeaderboard';
import { ActivityFeed } from '@/components/creators/ActivityFeed';
import { CreatorPortfolio } from '@/components/portfolio/CreatorPortfolio';
import { TradeToast } from '@/components/ui/TradeToast';
import { motion, AnimatePresence } from 'framer-motion';
import { PortfolioPieChart, PortfolioHistoryChart, generateMockHistory } from '@/components/charts';

type Tab = 'predictions' | 'creators' | 'portfolio';
type CreatorView = 'grid' | 'leaderboard';

interface TwitterUser {
  handle: string;
  displayName: string;
  avatar: string;
  followers: number;
  following: number;
  tweets: number;
}

interface Activity {
  id: string;
  type: 'buy' | 'sell';
  user: string;
  creatorName: string;
  creatorHandle: string;
  amount: number;
  price: number;
  timestamp: number;
}

interface ToastData {
  show: boolean;
  type: 'buy' | 'sell';
  creatorName: string;
  amount: string;
  price: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('predictions');
  const [creatorView, setCreatorView] = useState<CreatorView>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCreatorHandle, setNewCreatorHandle] = useState('');
  const [twitterPreview, setTwitterPreview] = useState<TwitterUser | null>(null);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Toast 状态
  const [toast, setToast] = useState<ToastData>({
    show: false,
    type: 'buy',
    creatorName: '',
    amount: '',
    price: '',
  });

  const {
    address,
    isConnected,
    isOwner,
    markets,
    loading,
    usdcBalance,
    userOrders,
    faucet,
    createMarket,
    deleteMarket,
    buyShares,
    sellShares,
    claimWinnings,
    placeBuyOrder,
    placeSellOrder,
    getPriceHistory,
    cancelOrder,
    fetchUserOrders,
  } = usePredictionMarket();

  const {
    creators,
    activities,
    portfolioStats,
    loading: creatorLoading,
    fetchCreators,
    registerCreator,
    buyShares: buyCreatorShares,
    sellShares: sellCreatorShares,
    getLeaderboard,
    getCreatorActivities,
    getPriceHistory: getCreatorPriceHistory,
  } = useCreatorMarket(address, isConnected);

  useEffect(() => {
    if (isConnected) {
      fetchCreators();
    }
  }, [isConnected, fetchCreators]);

  // 封装买入函数，添加 Toast 提示
  const handleCreatorBuy = useCallback(async (handle: string, amount: number) => {
    const creator = creators.find(c => c.handle === handle);
    const success = await buyCreatorShares(handle, amount);
    
    if (success && creator) {
      // 显示成功 Toast
      setToast({
        show: true,
        type: 'buy',
        creatorName: creator.displayName || `@${handle}`,
        amount: amount.toString(),
        price: (amount * creator.price).toFixed(2),
      });
      // ❌ 删除下面这段，hook 已经自动处理 activities
      // const newActivity: Activity = { ... };
      // setActivities(prev => [newActivity, ...prev].slice(0, 50));
    }
    
    return success;
  }, [buyCreatorShares, creators]);

  // 封装卖出函数，添加 Toast 提示
  const handleCreatorSell = useCallback(async (handle: string, amount: number) => {
    const creator = creators.find(c => c.handle === handle);
    const success = await sellCreatorShares(handle, amount);
    
    if (success && creator) {
      setToast({
        show: true,
        type: 'sell',
        creatorName: creator.displayName || `@${handle}`,
        amount: amount.toString(),
        price: (amount * creator.price * 0.95).toFixed(2),
      });
      // ❌ 删除 setActivities 调用
    }
    
    return success;
  }, [sellCreatorShares, creators]);

  const handleVerifyTwitter = async () => {
    const handle = newCreatorHandle.trim();
    if (!handle) {
      alert('Please enter a Twitter handle');
      return;
    }

    if (creators.some(c => c.handle.toLowerCase() === handle.toLowerCase())) {
      alert(`@${handle} has already been launched!`);
      return;
    }

    setTwitterLoading(true);
    try {
      const res = await fetch(`/api/twitter/user?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || `Twitter user @${handle} not found`);
        return;
      }

      if (data.followers < 100) {
        alert(`@${handle} needs at least 100 followers to be launched`);
        return;
      }

      setTwitterPreview(data);
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error(error);
      alert('Failed to verify Twitter user. Please try again.');
    } finally {
      setTwitterLoading(false);
    }
  };

  const handleConfirmLaunch = async () => {
    if (!twitterPreview) return;

    setShowConfirmModal(false);
    const success = await registerCreator(twitterPreview.handle, {
      displayName: twitterPreview.displayName,
      avatar: twitterPreview.avatar,
      followers: twitterPreview.followers,
      following: twitterPreview.following,
      tweets: twitterPreview.tweets,
    });
    
    if (success) {
      setNewCreatorHandle('');
      setTwitterPreview(null);
      setToast({
        show: true,
        type: 'buy',
        creatorName: twitterPreview.displayName,
        amount: '🚀',
        price: 'Launched!',
      });
    }
  };

  const handleCancelLaunch = () => {
    setShowConfirmModal(false);
    setTwitterPreview(null);
  };

  // 计算持仓统计
  const predictionPositions = markets.filter((m) => {
    if (m.userShares && m.userShares.length > 0) {
      return m.userShares.some(s => s > 0n);
    }
    return m.userYesShares > 0n || m.userNoShares > 0n;
  }).length;

  const creatorHoldings = creators.filter((c) => c.userShares > 0);
  const totalCreatorValue = creatorHoldings.reduce(
    (acc, c) => acc + c.userShares * c.price,
    0
  );

  // 计算总投入（简化版，实际应该从合约获取）
  const totalInvested = creatorHoldings.reduce(
    (acc, c) => acc + c.userShares * (c.price * 0.9), // 假设平均买入价为当前价格的90%
    0
  );
  const totalPnL = totalCreatorValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // 排行榜数据转换
  const leaderboardCreators = creators.map(c => ({
    id: creators.indexOf(c),
    twitterHandle: c.handle,
    displayName: c.displayName || `@${c.handle}`,
    profileImage: c.avatar || '',
    engagementScore: c.attentionScore || 0,
    price: c.price,
    priceChange24h: c.priceChange24h || (Math.random() - 0.5) * 20, // 模拟
    holders: c.totalSupply > 0 ? Math.floor(c.totalSupply * 0.7) : 0, // 模拟
    volume24h: (c.poolBalance * 0.1).toFixed(2), // 模拟
  }));

  // Portfolio 数据转换
  const portfolioHoldings = creatorHoldings.map(c => ({
    creator: {
      id: creators.indexOf(c),
      displayName: c.displayName || `@${c.handle}`,
      twitterHandle: c.handle,
      profileImage: c.avatar || '',
      price: c.price,
      priceChange24h: c.priceChange24h || 0,
    },
    amount: c.userShares,
    avgBuyPrice: c.price * 0.9, // 模拟
    totalInvested: c.userShares * c.price * 0.9, // 模拟
  }));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#05060b] text-gray-900 dark:text-white transition-colors duration-300">
      {/* ========== Header ========== */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#05060b]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              PredictX
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

            <ConnectButton 
              showBalance={false}
              chainStatus="icon"
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
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
        <AnimatePresence mode="wait">
          {activeTab === 'predictions' && (
            <motion.div
              key="predictions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    🔮 Prediction Markets
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Trade on events with market orders or limit orders
                  </p>
                </div>
              </div>

              <MarketList
                markets={markets}
                userOrders={userOrders}
                isOwner={isOwner}
                onBuy={buyShares}
                onSell={sellShares}
                onClaim={claimWinnings}
                onDelete={deleteMarket}
                onPlaceBuyOrder={placeBuyOrder}
                onPlaceSellOrder={placeSellOrder}
                onCancelOrder={cancelOrder}
                getPriceHistory={getPriceHistory}
                isConnected={isConnected}
                loading={loading}
                usdcBalance={usdcBalance}
                userAddress={address}
              />
            </motion.div>
          )}

          {/* ===== Creators Tab ===== */}
          {activeTab === 'creators' && (
            <motion.div
              key="creators"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Launch Creator Section */}
              <div className="p-6 bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      🚀 Launch a Creator
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Start a bonding curve for any Twitter creator.
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
                    {twitterLoading ? 'Verifying...' : '🔍 Verify & Launch'}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Try:</span>
                  {['elonmusk', 'VitalikButerin', 'naval'].map((handle) => (
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

              {/* View Toggle */}
              {creators.length > 0 && (
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {creatorView === 'grid' ? '👤 All Creators' : '🏆 Leaderboard'}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreatorView('grid')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        creatorView === 'grid'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Grid View
                    </button>
                    <button
                      onClick={() => setCreatorView('leaderboard')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        creatorView === 'leaderboard'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Leaderboard
                    </button>
                  </div>
                </div>
              )}

              {!isConnected ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🔌</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Connect your wallet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Use the connect button in the header to get started
                  </p>
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content Area */}
                  <div className="lg:col-span-2">
                    {creatorView === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {creators.map((creator) => (
                          <CreatorCard
                            key={creator.handle}
                            creator={creator}
                            onBuy={handleCreatorBuy}
                            onSell={handleCreatorSell}
                            isConnected={isConnected}
                            loading={creatorLoading}
                          />
                        ))}
                      </div>
                    ) : (
                      <CreatorLeaderboard
                        creators={getLeaderboard('score', 'desc').map((c, idx) => ({
                          id: idx,
                          twitterHandle: c.handle,
                          displayName: c.displayName || `@${c.handle}`,
                          profileImage: c.avatar || '',
                          engagementScore: c.attentionScore || 0,
                          price: c.price,
                          priceChange24h: c.priceChange24h || 0,
                          holders: c.holders || 0,
                          volume24h: (c.volume24h || 0).toFixed(2),
                        }))}
                        onSelectCreator={(creator) => {
                          setCreatorView('grid');
                        }}
                      />
                    )}
                  </div>

                  {/* Sidebar - Activity Feed */}
                  <div className="lg:col-span-1">
                    <ActivityFeed activities={activities} maxItems={15} />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ===== Portfolio Tab ===== */}
          {activeTab === 'portfolio' && (
            <motion.div
              key="portfolio"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">💼 Your Portfolio</h2>

              {/* Overview Cards */}
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
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Portfolio Value</div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${(parseFloat(usdcBalance) + totalCreatorValue).toFixed(2)}
                  </div>
                </div>
              </div>

              {!isConnected ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800">
                  Connect wallet to view your portfolio
                </div>
              ) : (
                <>
                  {/* ===== 新增：Portfolio 可视化图表 ===== */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 资产分布饼图 */}
                    <PortfolioPieChart
                      title="Asset Distribution"
                      holdings={[
                        { name: 'USDC', value: parseFloat(usdcBalance), color: '#22c55e' },
                        ...creatorHoldings.map((c, i) => ({
                          name: `@${c.handle}`,
                          value: c.userShares * c.price,
                        })),
                      ].filter(h => h.value > 0)}
                    />
                    
                    {/* 净值走势图 */}
                    <PortfolioHistoryChart
                      title="Portfolio Value (7D)"
                      data={generateMockHistory(parseFloat(usdcBalance) + totalCreatorValue, 7)}
                    />
                  </div>

                  {/* ===== 原有内容：持仓列表 ===== */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Creator Portfolio */}
                    {creatorHoldings.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          👤 Creator Holdings
                        </h3>
                        <CreatorPortfolio
                          holdings={portfolioStats.holdings.map(h => ({
                            creator: {
                              id: creators.indexOf(h.creator),
                              displayName: h.creator.displayName || `@${h.creator.handle}`,
                              twitterHandle: h.creator.handle,
                              profileImage: h.creator.avatar || '',
                              price: h.creator.price,
                              priceChange24h: h.creator.priceChange24h || 0,
                            },
                            amount: h.amount,
                            avgBuyPrice: h.avgBuyPrice,
                            totalInvested: h.avgBuyPrice * h.amount,
                          }))}
                          totalValue={portfolioStats.totalValue}
                          totalPnL={portfolioStats.totalPnL}
                          totalPnLPercent={portfolioStats.totalPnLPercent}
                        />
                      </div>
                    )}

                    {/* Prediction Positions */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        🔮 Prediction Positions
                      </h3>
                      <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                        {predictionPositions === 0 ? (
                          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <div className="text-4xl mb-2">📭</div>
                            No prediction positions yet
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200 dark:divide-gray-800">
                            {markets
                              .filter((m) => {
                                if (m.userShares && m.userShares.length > 0) {
                                  return m.userShares.some(s => s > 0n);
                                }
                                return m.userYesShares > 0n || m.userNoShares > 0n;
                              })
                              .map((m) => (
                                <motion.div
                                  key={m.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-lg">
                                      🔮
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white max-w-xs truncate">
                                        {m.question}
                                      </div>
                                      <div className="text-sm text-purple-500 dark:text-purple-400">
                                        {m.numOutcomes > 2 ? `Multi-Choice (${m.numOutcomes})` : 'Yes/No Market'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    {m.userShares && m.userShares.length > 0 ? (
                                      m.userShares.map((shares, idx) => 
                                        shares > 0n && (
                                          <div key={idx} className="text-gray-900 dark:text-white font-semibold">
                                            {(Number(shares) / 1e18).toFixed(2)} {m.outcomeLabels?.[idx] || `Opt ${idx + 1}`}
                                          </div>
                                        )
                                      )
                                    ) : (
                                      <>
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
                                      </>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========== Twitter Confirm Modal ========== */}
      <AnimatePresence>
        {showConfirmModal && twitterPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[#12141c] rounded-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-800 text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  ✅ Twitter Verified
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Confirm to launch this creator's bonding curve
                </p>
              </div>

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
                  </div>
                </div>
              </div>

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
                  {creatorLoading ? 'Launching...' : '🚀 Launch Creator'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== Create Market Modal ========== */}
      <CreateMarketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={createMarket}
      />

      {/* ========== Trade Toast ========== */}
      <TradeToast
        show={toast.show}
        type={toast.type}
        creatorName={toast.creatorName}
        amount={toast.amount}
        price={toast.price}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </main>
  );
}