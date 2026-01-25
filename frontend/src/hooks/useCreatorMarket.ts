import { useState, useCallback, useEffect } from 'react';

// 本地存储的 key
const STORAGE_KEY = 'attention_fi_creators';

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

export function useCreatorMarket(walletAddress: string, isConnected: boolean) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取 Creator 列表（从 localStorage）
  const fetchCreators = useCallback(async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      // 模拟网络延迟
      await new Promise((r) => setTimeout(r, 300));
      const stored = loadCreatorsFromStorage();
      setCreators(stored);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

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
      // 模拟区块链交易延迟（真实合约部署后这里会是实际的 tx）
      await new Promise((r) => setTimeout(r, 1500));

      const newCreator: Creator = {
        handle: handle,
        displayName: twitterData?.displayName || handle,
        avatar: twitterData?.avatar || '',
        totalSupply: 1,
        poolBalance: 0,
        price: 1.0, // 初始价格 $1 USDC
        userShares: 0,
        followers: twitterData?.followers || 0,
        following: twitterData?.following || 0,
        tweets: twitterData?.tweets || 0,
        verified: twitterData?.verified || false,
        launchedAt: Date.now(),
      };

      // 更新 state 并保存到 localStorage
      setCreators((prev) => {
        // 移除可能已存在的同名 creator，然后添加新的到最前面
        const filtered = prev.filter(
          (c) => c.handle.toLowerCase() !== handle.toLowerCase()
        );
        const updated = [newCreator, ...filtered];
        saveCreatorsToStorage(updated);
        return updated;
      });

      return true;
    } catch (error) {
      console.error('Register creator failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 购买 Creator 份额
  const buyShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0) return false;
    setLoading(true);

    try {
      // 模拟交易延迟
      await new Promise((r) => setTimeout(r, 1000));

      setCreators((prev) => {
        const updated = prev.map((c) => {
          if (c.handle.toLowerCase() === handle.toLowerCase()) {
            const newSupply = c.totalSupply + amount;
            const cost = c.price * amount;
            // Bonding Curve: 每买1份，价格上涨 $0.1
            const newPrice = c.price + amount * 0.1;
            return {
              ...c,
              totalSupply: newSupply,
              poolBalance: c.poolBalance + cost,
              price: newPrice,
              userShares: c.userShares + amount,
            };
          }
          return c;
        });
        saveCreatorsToStorage(updated);
        return updated;
      });

      return true;
    } catch (error) {
      console.error('Buy shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 卖出 Creator 份额
  const sellShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0) return false;
    setLoading(true);

    try {
      // 模拟交易延迟
      await new Promise((r) => setTimeout(r, 1000));

      setCreators((prev) => {
        const updated = prev.map((c) => {
          if (c.handle.toLowerCase() === handle.toLowerCase() && c.userShares >= amount) {
            // 卖出获得的金额（扣除 5% 滑点/手续费）
            const payout = c.price * amount * 0.95;
            // Bonding Curve: 每卖1份，价格下跌 $0.1（最低 $1）
            const newPrice = Math.max(1, c.price - amount * 0.1);
            return {
              ...c,
              totalSupply: c.totalSupply - amount,
              poolBalance: Math.max(0, c.poolBalance - payout),
              price: newPrice,
              userShares: c.userShares - amount,
            };
          }
          return c;
        });
        saveCreatorsToStorage(updated);
        return updated;
      });

      return true;
    } catch (error) {
      console.error('Sell shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 删除 Creator（可选功能，用于测试）
  const removeCreator = useCallback((handle: string) => {
    setCreators((prev) => {
      const updated = prev.filter(
        (c) => c.handle.toLowerCase() !== handle.toLowerCase()
      );
      saveCreatorsToStorage(updated);
      return updated;
    });
  }, []);

  // 清空所有 Creators（可选功能，用于测试）
  const clearAllCreators = useCallback(() => {
    setCreators([]);
    saveCreatorsToStorage([]);
  }, []);

  // 初始化时加载数据
  useEffect(() => {
    if (isConnected) {
      fetchCreators();
    }
  }, [isConnected, fetchCreators]);

  return {
    creators,
    loading,
    registerCreator,
    buyShares,
    sellShares,
    fetchCreators,
    removeCreator,      // 新增：删除单个 creator
    clearAllCreators,   // 新增：清空所有
  };
}