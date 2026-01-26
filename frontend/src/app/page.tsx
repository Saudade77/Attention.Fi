'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePredictionMarket } from '@/hooks/usePredictionMarket';
import { useCreatorMarket } from '@/hooks/useCreatorMarket';
import { CreateMarketModal } from '@/components/predictions/CreateMarketModal';
import { MarketList } from '@/components/predictions/MarketList';
import { CreatorCard } from '@/components/creators/CreatorCard';

type Tab = 'predictions' | 'creators' | 'portfolio';

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
    loading: creatorLoading,
    fetchCreators,
    registerCreator,
    buyShares: buyCreatorShares,
    sellShares: sellCreatorShares,
  } = useCreatorMarket(address, isConnected);

  useEffect(() => {
    if (isConnected) {
      fetchCreators();
    }
  }, [isConnected, fetchCreators]);

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
      alert(`🎉 @${twitterPreview.handle} launched successfully!`);
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

            {/* RainbowKit Connect Button */}
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
        {activeTab === 'predictions' && (
          <div className="space-y-6">
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
          </div>
        )}

        {/* ===== Creators Tab ===== */}
        {activeTab === 'creators' && (
          <div className="space-y-6">
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
                  No positions yet. Start trading!
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {/* Prediction Holdings */}
                  {markets
                    .filter((m) => {
                      if (m.userShares && m.userShares.length > 0) {
                        return m.userShares.some(s => s > 0n);
                      }
                      return m.userYesShares > 0n || m.userNoShares > 0n;
                    })
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