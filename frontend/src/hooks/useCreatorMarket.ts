import { useState, useCallback, useEffect, useMemo } from 'react';

// 本地存储的 key
const STORAGE_KEY = 'attention_fi_creators';
const ACTIVITY_STORAGE_KEY = 'attention_fi_activities';
const PRICE_HISTORY_KEY = 'attention_fi_price_history';

export interface Creator {
  handle: string;
  displayName?: string;
  avatar?: string;
  totalSupply: number;
  poolBalance: number;
  price: number;
  userShares: number;
  followers?: number;
  following?: number;
  tweets?: number;
  verified?: boolean;
  launchedAt?: number;
  // 新增字段
  attentionScore?: number;
  priceChange24h?: number;
  holders?: number;
  volume24h?: number;
  avgBuyPrice?: number; // 用户平均买入价格
}

export interface Activity {
  id: string;
  type: 'buy' | 'sell' | 'launch';
  user: string;
  creatorHandle: string;
  creatorName: string;
  amount: number;
  price: number;
  totalValue: number;
  timestamp: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPercent: number;
  holdings: Array<{
    creator: Creator;
    amount: number;
    currentValue: number;
    avgBuyPrice: number;
    pnl: number;
    pnlPercent: number;
  }>;
}

// ✅ 安全获取显示名称的辅助函数
function getSafeDisplayName(
  twitterDisplayName?: string,
  handle?: string
): string {
  const name = twitterDisplayName?.trim();
  // 过滤无效的名字
  const invalidNames = ['unknown', '', 'null', 'undefined', '(null)'];
  
  if (name && !invalidNames.includes(name.toLowerCase())) {
    return name;
  }
  
  // 如果 handle 存在，返回带 @ 的格式或直接返回
  if (handle) {
    return handle.startsWith('@') ? handle : `@${handle}`;
  }
  
  return 'Anonymous';
}

// 从 localStorage 读取 creators
function loadCreatorsFromStorage(): Creator[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存 creators 到 localStorage
function saveCreatorsToStorage(creators: Creator[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creators));
}

// 从 localStorage 读取活动记录
function loadActivitiesFromStorage(): Activity[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存活动记录到 localStorage
function saveActivitiesToStorage(activities: Activity[]) {
  if (typeof window === 'undefined') return;
  // 只保留最近 100 条
  const trimmed = activities.slice(0, 100);
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(trimmed));
}

// 从 localStorage 读取价格历史
function loadPriceHistoryFromStorage(): Record<string, PricePoint[]> {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(PRICE_HISTORY_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// 保存价格历史到 localStorage
function savePriceHistoryToStorage(history: Record<string, PricePoint[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
}

// 计算 Attention Score
function calculateAttentionScore(creator: Creator): number {
  const followers = creator.followers || 0;
  const tweets = creator.tweets || 0;
  const supply = creator.totalSupply || 1;
  const poolBalance = creator.poolBalance || 0;
  
  // 基于粉丝数、推文数、供应量和池子余额计算
  const followerScore = Math.min(Math.log10(followers + 1) * 100, 400);
  const engagementScore = Math.min(Math.log10(tweets + 1) * 50, 200);
  const marketScore = Math.min(Math.log10(poolBalance + 1) * 100, 300);
  const supplyScore = Math.min(supply * 10, 100);
  
  return Math.round(followerScore + engagementScore + marketScore + supplyScore);
}

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useCreatorMarket(walletAddress: string, isConnected: boolean) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(false);

  // 获取 Creator 列表（从 localStorage）
  const fetchCreators = useCallback(async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      
      const stored = loadCreatorsFromStorage();
      // 计算每个 creator 的 attention score 和 24h 变化
      const enhanced = stored.map(c => ({
        ...c,
        // ✅ 修复已存储的 Unknown 名称
        displayName: getSafeDisplayName(c.displayName, c.handle),
        attentionScore: c.attentionScore || calculateAttentionScore(c),
        priceChange24h: c.priceChange24h || (Math.random() - 0.5) * 20, // 模拟
        holders: c.holders || Math.max(1, Math.floor(c.totalSupply * 0.7)),
        volume24h: c.volume24h || c.poolBalance * 0.1,
      }));
      
      setCreators(enhanced);
      // ✅ 保存修复后的数据
      saveCreatorsToStorage(enhanced);
      
      setActivities(loadActivitiesFromStorage());
      setPriceHistory(loadPriceHistoryFromStorage());
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  // 添加活动记录
  const addActivity = useCallback((activity: Omit<Activity, 'id'>) => {
    const newActivity: Activity = {
      ...activity,
      id: generateId(),
    };
    
    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 100);
      saveActivitiesToStorage(updated);
      return updated;
    });
    
    return newActivity;
  }, []);

  // 记录价格历史
  const recordPricePoint = useCallback((handle: string, price: number) => {
    setPriceHistory(prev => {
      const history = prev[handle] || [];
      const newPoint: PricePoint = {
        timestamp: Date.now(),
        price,
      };
      // 保留最近 100 个点
      const updated = {
        ...prev,
        [handle]: [...history, newPoint].slice(-100),
      };
      savePriceHistoryToStorage(updated);
      return updated;
    });
  }, []);

  // 注册新 Creator
  const registerCreator = useCallback(async (
    handle: string,
    twitterData?: {
      displayName?: string;
      avatar?: string;
      followers?: number;
      following?: number;
      tweets?: number;
      verified?: boolean;
    }
  ): Promise<boolean> => {
    if (!handle.trim()) return false;
    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 1500));

      const initialPrice = 1.0;
      
      // ✅ 使用安全的显示名称获取函数
      const safeDisplayName = getSafeDisplayName(twitterData?.displayName, handle);
      
      const newCreator: Creator = {
        handle: handle,
        displayName: safeDisplayName,  // ✅ 使用安全的名称
        avatar: twitterData?.avatar || '',
        totalSupply: 1,
        poolBalance: 0,
        price: initialPrice,
        userShares: 0,
        followers: twitterData?.followers || 0,
        following: twitterData?.following || 0,
        tweets: twitterData?.tweets || 0,
        verified: twitterData?.verified || false,
        launchedAt: Date.now(),
        attentionScore: 0,
        priceChange24h: 0,
        holders: 1,
        volume24h: 0,
        avgBuyPrice: 0,
      };

      // 计算 attention score
      newCreator.attentionScore = calculateAttentionScore(newCreator);

      setCreators((prev) => {
        const filtered = prev.filter(
          (c) => c.handle.toLowerCase() !== handle.toLowerCase()
        );
        const updated = [newCreator, ...filtered];
        saveCreatorsToStorage(updated);
        return updated;
      });

      // 记录初始价格
      recordPricePoint(handle, initialPrice);

      // 添加 launch 活动
      addActivity({
        type: 'launch',
        user: walletAddress,
        creatorHandle: handle,
        creatorName: safeDisplayName,  // ✅ 使用安全的名称
        amount: 0,
        price: initialPrice,
        totalValue: 0,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      console.error('Register creator failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, addActivity, recordPricePoint]);

  // 购买 Creator 份额
  const buyShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0) return false;
    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 1000));

      let activityData: Omit<Activity, 'id'> | null = null;

      setCreators((prev) => {
        const updated = prev.map((c) => {
          if (c.handle.toLowerCase() === handle.toLowerCase()) {
            const newSupply = c.totalSupply + amount;
            const cost = c.price * amount * (1 + amount * 0.02); // 包含滑点
            const newPrice = c.price + amount * 0.1;
            
            // 计算新的平均买入价格
            const prevTotalCost = (c.avgBuyPrice || c.price) * c.userShares;
            const newTotalCost = prevTotalCost + cost;
            const newUserShares = c.userShares + amount;
            const newAvgBuyPrice = newUserShares > 0 ? newTotalCost / newUserShares : newPrice;

            // ✅ 使用安全的名称
            const safeName = getSafeDisplayName(c.displayName, c.handle);

            // 准备活动数据
            activityData = {
              type: 'buy',
              user: walletAddress,
              creatorHandle: handle,
              creatorName: safeName,
              amount,
              price: c.price,
              totalValue: cost,
              timestamp: Date.now(),
            };

            return {
              ...c,
              totalSupply: newSupply,
              poolBalance: c.poolBalance + cost,
              price: newPrice,
              userShares: newUserShares,
              holders: (c.holders || 1) + (c.userShares === 0 ? 1 : 0),
              volume24h: (c.volume24h || 0) + cost,
              avgBuyPrice: newAvgBuyPrice,
              attentionScore: calculateAttentionScore({ ...c, totalSupply: newSupply, poolBalance: c.poolBalance + cost }),
            };
          }
          return c;
        });
        saveCreatorsToStorage(updated);
        return updated;
      });

      // 记录价格和活动
      const creator = creators.find(c => c.handle.toLowerCase() === handle.toLowerCase());
      if (creator) {
        const newPrice = creator.price + amount * 0.1;
        recordPricePoint(handle, newPrice);
      }
      
      if (activityData) {
        addActivity(activityData);
      }

      return true;
    } catch (error) {
      console.error('Buy shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, creators, addActivity, recordPricePoint]);

  // 卖出 Creator 份额
  const sellShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0) return false;
    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 1000));

      let activityData: Omit<Activity, 'id'> | null = null;

      setCreators((prev) => {
        const updated = prev.map((c) => {
          if (c.handle.toLowerCase() === handle.toLowerCase() && c.userShares >= amount) {
            const payout = c.price * amount * 0.95;
            const newPrice = Math.max(1, c.price - amount * 0.1);
            const newUserShares = c.userShares - amount;

            // ✅ 使用安全的名称
            const safeName = getSafeDisplayName(c.displayName, c.handle);

            activityData = {
              type: 'sell',
              user: walletAddress,
              creatorHandle: handle,
              creatorName: safeName,
              amount,
              price: c.price,
              totalValue: payout,
              timestamp: Date.now(),
            };

            return {
              ...c,
              totalSupply: c.totalSupply - amount,
              poolBalance: Math.max(0, c.poolBalance - payout),
              price: newPrice,
              userShares: newUserShares,
              holders: newUserShares === 0 ? Math.max(1, (c.holders || 1) - 1) : c.holders,
              volume24h: (c.volume24h || 0) + payout,
              // avgBuyPrice 保持不变
              attentionScore: calculateAttentionScore({ ...c, totalSupply: c.totalSupply - amount }),
            };
          }
          return c;
        });
        saveCreatorsToStorage(updated);
        return updated;
      });

      const creator = creators.find(c => c.handle.toLowerCase() === handle.toLowerCase());
      if (creator) {
        const newPrice = Math.max(1, creator.price - amount * 0.1);
        recordPricePoint(handle, newPrice);
      }

      if (activityData) {
        addActivity(activityData);
      }

      return true;
    } catch (error) {
      console.error('Sell shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, creators, addActivity, recordPricePoint]);

  // 获取排行榜数据（排序后的 creators）
  const getLeaderboard = useCallback((
    sortBy: 'score' | 'price' | 'holders' | 'volume' | 'change' = 'score',
    order: 'asc' | 'desc' = 'desc'
  ) => {
    const sorted = [...creators].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'score':
          aVal = a.attentionScore || 0;
          bVal = b.attentionScore || 0;
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'holders':
          aVal = a.holders || 0;
          bVal = b.holders || 0;
          break;
        case 'volume':
          aVal = a.volume24h || 0;
          bVal = b.volume24h || 0;
          break;
        case 'change':
          aVal = a.priceChange24h || 0;
          bVal = b.priceChange24h || 0;
          break;
        default:
          return 0;
      }
      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [creators]);

  // 计算 Portfolio 统计
  const portfolioStats = useMemo((): PortfolioStats => {
    const holdings = creators
      .filter(c => c.userShares > 0)
      .map(c => {
        const currentValue = c.userShares * c.price;
        const invested = c.userShares * (c.avgBuyPrice || c.price * 0.9);
        const pnl = currentValue - invested;
        const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

        return {
          creator: c,
          amount: c.userShares,
          currentValue,
          avgBuyPrice: c.avgBuyPrice || c.price * 0.9,
          pnl,
          pnlPercent,
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);

    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvested = holdings.reduce((sum, h) => sum + (h.avgBuyPrice * h.amount), 0);
    const totalPnL = totalValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      totalValue,
      totalInvested,
      totalPnL,
      totalPnLPercent,
      holdings,
    };
  }, [creators]);

  // 获取特定 creator 的价格历史
  const getPriceHistory = useCallback((handle: string): PricePoint[] => {
    return priceHistory[handle] || [];
  }, [priceHistory]);

  // 获取最近活动
  const getRecentActivities = useCallback((limit: number = 20): Activity[] => {
    return activities.slice(0, limit);
  }, [activities]);

  // 获取特定 creator 的活动
  const getCreatorActivities = useCallback((handle: string, limit: number = 10): Activity[] => {
    return activities
      .filter(a => a.creatorHandle.toLowerCase() === handle.toLowerCase())
      .slice(0, limit);
  }, [activities]);

  // 删除 Creator（测试用）
  const removeCreator = useCallback((handle: string) => {
    setCreators((prev) => {
      const updated = prev.filter(
        (c) => c.handle.toLowerCase() !== handle.toLowerCase()
      );
      saveCreatorsToStorage(updated);
      return updated;
    });
  }, []);

  // 清空所有 Creators（测试用）
  const clearAllCreators = useCallback(() => {
    setCreators([]);
    setActivities([]);
    setPriceHistory({});
    saveCreatorsToStorage([]);
    saveActivitiesToStorage([]);
    savePriceHistoryToStorage({});
  }, []);

  // 初始化时加载数据
  useEffect(() => {
    if (isConnected) {
      fetchCreators();
    }
  }, [isConnected, fetchCreators]);

  return {
    // 数据
    creators,
    activities,
    portfolioStats,
    loading,
    
    // 核心操作
    registerCreator,
    buyShares,
    sellShares,
    fetchCreators,
    
    // 查询方法
    getLeaderboard,
    getPriceHistory,
    getRecentActivities,
    getCreatorActivities,
    
    // 工具方法
    removeCreator,
    clearAllCreators,
  };
}