'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Market, LimitOrder } from '@/hooks/usePredictionMarket';
// ✅ 引入支持多选项的概率图表组件
import { 
  ProbabilityChart,
  MiniProbabilityChart, 
  generateMockProbabilityHistory,
  generateMiniProbabilityData,
} from '@/components/charts/ProbabilityChart';

interface MarketCardProps {
  market: Market;
  userOrders?: LimitOrder[];
  onBuy: (marketId: number, outcomeIndex: number | boolean, amount: string) => Promise<void>;
  onSell: (marketId: number, outcomeIndex: number | boolean, shares: bigint | string) => Promise<void>;
  onClaim: (marketId: number) => Promise<void>;
  onDelete?: (marketId: number) => Promise<void>;
  onPlaceBuyOrder?: (marketId: number, outcomeIndex: number, shares: string, price: number) => Promise<void>;
  onPlaceSellOrder?: (marketId: number, outcomeIndex: number, shares: string, price: number) => Promise<void>;
  onCancelOrder?: (orderId: number) => Promise<void>;
  isConnected: boolean;
  isOwner?: boolean;
  usdcBalance: string;
  userAddress?: string;
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

const OUTCOME_COLORS = [
  'text-green-600 dark:text-green-400',
  'text-red-600 dark:text-red-400',
  'text-blue-600 dark:text-blue-400',
  'text-purple-600 dark:text-purple-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
];

const OUTCOME_BG_COLORS = [
  'border-green-500 bg-green-500/10 dark:bg-green-500/20',
  'border-red-500 bg-red-500/10 dark:bg-red-500/20',
  'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20',
  'border-purple-500 bg-purple-500/10 dark:bg-purple-500/20',
  'border-orange-500 bg-orange-500/10 dark:bg-orange-500/20',
  'border-pink-500 bg-pink-500/10 dark:bg-pink-500/20',
];

const OUTCOME_BTN_COLORS = [
  'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
  'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
  'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
  'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
  'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
  'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
];

// ✅ 图表颜色（与 ProbabilityChart 一致）
const CHART_COLORS = [
  '#22c55e', // green
  '#ef4444', // red
  '#3b82f6', // blue
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
];

export function MarketCard({ 
  market, 
  userOrders = [],
  onBuy, 
  onSell, 
  onClaim,
  onDelete,
  onPlaceBuyOrder,
  onPlaceSellOrder,
  onCancelOrder,
  isConnected,
  isOwner = false,
  usdcBalance,
}: MarketCardProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  
  const [buyAmount, setBuyAmount] = useState('10');
  const [buyLimitPrice, setBuyLimitPrice] = useState('50');
  const [buyLimitShares, setBuyLimitShares] = useState('10');
  
  const [sellShares, setSellShares] = useState('');
  const [sellLimitPrice, setSellLimitPrice] = useState('50');
  const [sellLimitShares, setSellLimitShares] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const isOpen = market.status === 0;
  const isResolved = market.status === 1;
  const isCancelled = market.status === 2;
  const timeLeft = market.endTime * 1000 - Date.now();
  const daysLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  const categoryColor = CATEGORY_COLORS[market.category] || CATEGORY_COLORS.default;
  const categoryIcon = CATEGORY_ICONS[market.category] || CATEGORY_ICONS.default;
  
  const hasPosition = market.userShares 
    ? market.userShares.some(s => s > 0n)
    : (market.userYesShares > 0n || market.userNoShares > 0n);

  const marketOrders = userOrders.filter(o => o.marketId === market.id);

  const numOutcomes = market.numOutcomes || 2;

  // ✅ 获取当前各选项价格
  const currentPrices = useMemo(() => {
    if (market.prices && market.prices.length > 0) {
      return market.prices.map(p => p / 100);
    }
    // 兼容旧版二元市场
    if (numOutcomes === 2) {
      const yesPrice = typeof market.yesPrice === 'number' ? market.yesPrice : 50;
      return [yesPrice, 100 - yesPrice];
    }
    // 默认平均分布
    return Array(numOutcomes).fill(100 / numOutcomes);
  }, [market.prices, market.yesPrice, numOutcomes]);

  // ✅ 获取选项标签
  const outcomeLabels = useMemo(() => {
    if (market.outcomeLabels && market.outcomeLabels.length >= numOutcomes) {
      return market.outcomeLabels.slice(0, numOutcomes);
    }
    if (numOutcomes === 2) {
      return ['Yes', 'No'];
    }
    return Array.from({ length: numOutcomes }, (_, i) => `Option ${String.fromCharCode(65 + i)}`);
  }, [market.outcomeLabels, numOutcomes]);

  // ✅ 生成概率历史数据（支持多选项）
  const probabilityHistory = useMemo(() => {
    return generateMiniProbabilityData(currentPrices, 12);
  }, [currentPrices]);

  // ✅ 生成完整图表数据
  const fullChartData = useMemo(() => {
    return generateMockProbabilityHistory(currentPrices, 12);
  }, [currentPrices]);

  const getOutcomeLabel = useCallback((index: number) => {
    return outcomeLabels[index] || `Option ${index + 1}`;
  }, [outcomeLabels]);

  const getOutcomePrice = useCallback((index: number) => {
    if (market.prices && market.prices[index] !== undefined) {
      return (market.prices[index] / 100).toFixed(0);
    }
    return index === 0 ? market.yesPrice : market.noPrice;
  }, [market.prices, market.yesPrice, market.noPrice]);

  const getUserShares = useCallback((index: number) => {
    if (market.userShares && market.userShares[index]) {
      return market.userShares[index];
    }
    return index === 0 ? market.userYesShares : market.userNoShares;
  }, [market.userShares, market.userYesShares, market.userNoShares]);

  const formatShares = (shares: bigint) => {
    return (Number(shares) / 1e18).toFixed(2);
  };

  useEffect(() => {
    if (selectedOutcome !== null) {
      const userHolding = getUserShares(selectedOutcome);
      if (userHolding > 0n) {
        const holdingStr = formatShares(userHolding);
        setSellShares(holdingStr);
        setSellLimitShares(holdingStr);
      }
    }
  }, [selectedOutcome, getUserShares]);

  const handleBuy = async () => {
    if (selectedOutcome === null) return;
    setLoading(true);
    try {
      if (orderType === 'market') {
        await onBuy(market.id, selectedOutcome, buyAmount);
      } else if (onPlaceBuyOrder) {
        await onPlaceBuyOrder(market.id, selectedOutcome, buyLimitShares, parseInt(buyLimitPrice));
      }
      setShowTradePanel(false);
      setSelectedOutcome(null);
    } catch (error: any) {
      console.error('Buy error:', error);
      alert(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (selectedOutcome === null) return;
    setLoading(true);
    try {
      if (orderType === 'market') {
        await onSell(market.id, selectedOutcome, sellShares);
      } else if (onPlaceSellOrder) {
        await onPlaceSellOrder(market.id, selectedOutcome, sellLimitShares, parseInt(sellLimitPrice));
      }
      setShowTradePanel(false);
      setSelectedOutcome(null);
    } catch (error: any) {
      console.error('Sell error:', error);
      alert(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!onCancelOrder) return;
    setLoading(true);
    try {
      await onCancelOrder(orderId);
    } catch (error: any) {
      console.error('Cancel order error:', error);
      alert(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setLoading(true);
    try {
      await onDelete(market.id);
      setDeleteConfirm(false);
    } catch (error: any) {
      console.error('Delete market error:', error);
      alert(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  const currentPrice = selectedOutcome !== null 
    ? (market.prices?.[selectedOutcome] || (selectedOutcome === 0 ? market.yesPrice * 100 : market.noPrice * 100)) / 100
    : 50;

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-lg dark:hover:border-gray-700 transition-all duration-200">
      <div className={`h-1.5 bg-gradient-to-r ${categoryColor}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${categoryColor} flex items-center justify-center text-lg shadow-md`}>
              {categoryIcon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                  {market.category}
                </span>
                {numOutcomes > 2 && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                    {numOutcomes} options
                  </span>
                )}
              </div>
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

        <h3 className="text-lg font-semibold mb-3 leading-snug text-gray-900 dark:text-white">
          {market.question}
        </h3>

        {/* ✅ 概率走势图（支持所有市场类型） */}
        {probabilityHistory.length > 1 && (
          <div className="mb-4">
            <div 
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => setShowChart(!showChart)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Probability Trend</span>
                <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition">
                  {showChart ? '▼' : '▶'}
                </span>
              </div>
              {/* ✅ 动态图例 */}
              <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                {outcomeLabels.map((label, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="text-gray-500 truncate max-w-[60px]">{label}</span>
                  </span>
                ))}
              </div>
            </div>
            
            {/* 图表区域 */}
            <div className={`mt-2 transition-all duration-300 overflow-hidden ${showChart ? 'h-32' : 'h-10'}`}>
              {showChart ? (
                <ProbabilityChart 
                  data={fullChartData}
                  outcomeLabels={outcomeLabels}
                  height={120}
                  showLegend={false}
                />
              ) : (
                <MiniProbabilityChart 
                  data={probabilityHistory}
                  outcomeLabels={outcomeLabels}
                  height={36} 
                />
              )}
            </div>
          </div>
        )}

        {/* Outcome Buttons */}
        <div className={`grid gap-3 mb-4 ${numOutcomes <= 2 ? 'grid-cols-2' : numOutcomes <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {Array.from({ length: numOutcomes }).map((_, index) => {
            const isWinner = isResolved && market.winnerIndex === index;
            const isSelected = selectedOutcome === index && showTradePanel;
            const colorIndex = index % OUTCOME_COLORS.length;
            const userHolding = getUserShares(index);
            
            return (
              <button
                key={index}
                onClick={() => {
                  setSelectedOutcome(index);
                  setShowTradePanel(true);
                  setTradeMode(userHolding > 0n ? 'sell' : 'buy');
                }}
                disabled={!isOpen || !isConnected}
                className={`relative p-4 rounded-xl border-2 transition-all duration-150 ${
                  isSelected
                    ? OUTCOME_BG_COLORS[colorIndex]
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-800/60'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium truncate">
                  {getOutcomeLabel(index)}
                </div>
                <div className={`text-2xl font-bold ${OUTCOME_COLORS[colorIndex]}`}>
                  {getOutcomePrice(index)}%
                </div>
                {userHolding > 0n && (
                  <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {formatShares(userHolding)} shares
                  </div>
                )}
                {isWinner && (
                  <div className="absolute top-2 right-2 text-green-500 text-lg">✓</div>
                )}
              </button>
            );
          })}
        </div>

        {/* User Position */}
        {hasPosition && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-4 border border-blue-200 dark:border-blue-800">
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">Your Position</div>
            <div className="flex flex-wrap gap-2 text-sm">
              {Array.from({ length: numOutcomes }).map((_, index) => {
                const shares = getUserShares(index);
                if (shares <= 0n) return null;
                return (
                  <span key={index} className={`font-semibold ${OUTCOME_COLORS[index % OUTCOME_COLORS.length]}`}>
                    {formatShares(shares)} {getOutcomeLabel(index)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* User Orders */}
        {marketOrders.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl mb-4 border border-yellow-200 dark:border-yellow-800">
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-2 font-medium">
              Your Open Orders ({marketOrders.length})
            </div>
            <div className="space-y-2">
              {marketOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded-lg p-2">
                  <div>
                    <span className={order.isBuy ? 'text-green-600' : 'text-red-600'}>
                      {order.isBuy ? 'BUY' : 'SELL'}
                    </span>
                    {' '}
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatShares(order.shares)} {getOutcomeLabel(order.outcomeIndex)}
                    </span>
                    {' @ '}
                    <span className="font-medium">{(order.price / 100).toFixed(0)}%</span>
                  </div>
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={loading}
                    className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Panel */}
        {showTradePanel && isOpen && selectedOutcome !== null && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                Trade{' '}
                <span className={OUTCOME_COLORS[selectedOutcome % OUTCOME_COLORS.length]}>
                  {getOutcomeLabel(selectedOutcome)}
                </span>
              </span>
              <button
                onClick={() => {
                  setShowTradePanel(false);
                  setSelectedOutcome(null);
                }}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTradeMode('buy')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  tradeMode === 'buy' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeMode('sell')}
                disabled={getUserShares(selectedOutcome) <= 0n}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  tradeMode === 'sell' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Sell
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOrderType('market')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  orderType === 'market' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                Market
              </button>
              <button
                onClick={() => setOrderType('limit')}
                disabled={tradeMode === 'buy' ? !onPlaceBuyOrder : !onPlaceSellOrder}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  orderType === 'limit' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Limit
              </button>
            </div>

            {/* BUY MODE */}
            {tradeMode === 'buy' && (
              <>
                {orderType === 'market' ? (
                  <>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-lg pr-16 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Amount"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">USDC</span>
                    </div>
                    <div className="flex gap-2">
                      {['10', '25', '50', '100'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setBuyAmount(val)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                            buyAmount === val ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          ${val}
                        </button>
                      ))}
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Est. shares</span>
                        <span className="font-medium">{(parseFloat(buyAmount || '0') / (currentPrice / 100)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-500">Potential return</span>
                        <span className="text-green-600 font-medium">${(parseFloat(buyAmount || '0') / (currentPrice / 100)).toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Price (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={buyLimitPrice}
                          onChange={(e) => setBuyLimitPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Shares</label>
                        <input
                          type="number"
                          min="1"
                          value={buyLimitShares}
                          onChange={(e) => setBuyLimitShares(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">USDC to lock</span>
                        <span className="font-medium text-blue-600">
                          ${((parseFloat(buyLimitShares) || 0) * (parseFloat(buyLimitPrice) || 0) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* SELL MODE */}
            {tradeMode === 'sell' && (
              <>
                <div className="text-xs text-gray-500 mb-1">
                  Available: <span className="font-semibold">{formatShares(getUserShares(selectedOutcome))} shares</span>
                </div>
                {orderType === 'market' ? (
                  <>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={formatShares(getUserShares(selectedOutcome))}
                        value={sellShares}
                        onChange={(e) => setSellShares(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-lg pr-20 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Shares"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Shares</span>
                    </div>
                    <div className="flex gap-2">
                      {['25', '50', '75', '100'].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => {
                            const max = Number(getUserShares(selectedOutcome)) / 1e18;
                            setSellShares((max * parseInt(pct) / 100).toFixed(2));
                          }}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Est. receive</span>
                        <span className="font-medium text-green-600">
                          ~${((parseFloat(sellShares) || 0) * currentPrice / 100).toFixed(2)} USDC
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Price (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={sellLimitPrice}
                          onChange={(e) => setSellLimitPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Shares</label>
                        <input
                          type="number"
                          min="0.01"
                          max={formatShares(getUserShares(selectedOutcome))}
                          value={sellLimitShares}
                          onChange={(e) => setSellLimitShares(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Receive if filled</span>
                        <span className="font-medium text-green-600">
                          ${((parseFloat(sellLimitShares) || 0) * (parseFloat(sellLimitPrice) || 0) / 100).toFixed(2)} USDC
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="text-xs text-gray-500">
              Balance: <span className="font-semibold">${parseFloat(usdcBalance).toFixed(2)} USDC</span>
            </div>

            <button
              onClick={tradeMode === 'buy' ? handleBuy : handleSell}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                tradeMode === 'buy'
                  ? `bg-gradient-to-r ${OUTCOME_BTN_COLORS[selectedOutcome % OUTCOME_BTN_COLORS.length]}`
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
              ) : tradeMode === 'buy' ? (
                orderType === 'market' ? `Buy ${getOutcomeLabel(selectedOutcome)}` : 'Place Buy Order'
              ) : (
                orderType === 'market' ? `Sell ${getOutcomeLabel(selectedOutcome)}` : 'Place Sell Order'
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
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}
          >
            {isResolved 
              ? `✅ Resolved: ${getOutcomeLabel(market.winnerIndex)} won` 
              : '❌ Market Cancelled'}
          </div>
        )}

        {/* Admin Delete */}
        {isOwner && (isOpen || isCancelled) && onDelete && (
          <div className="mt-4">
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition flex items-center justify-center gap-2"
              >
                🗑️ Delete Market
              </button>
            ) : (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                  Are you sure? This will refund all users and cancel all orders.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}