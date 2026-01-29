'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { 
  CREATOR_MARKET_ADDRESS, 
  USDC_ADDRESS, 
  USDC_DECIMALS,
  CurveType,
} from '@/constants/config';

export { CurveType } from '@/constants/config';

// ============ ABI ============
const CREATOR_MARKET_ABI = [
  { name: 'getCreatorCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getCreatorByIndex', type: 'function', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'string' }] },
  { name: 'getCreatorInfo', type: 'function', stateMutability: 'view', inputs: [{ name: 'handle', type: 'string' }], outputs: [{ name: 'exists', type: 'bool' }, { name: 'totalSupply', type: 'uint256' }, { name: 'poolBalance', type: 'uint256' }, { name: 'currentPrice', type: 'uint256' }, { name: 'curveType', type: 'uint8' }, { name: 'curveA', type: 'uint256' }, { name: 'curveB', type: 'uint256' }, { name: 'inflectionPoint', type: 'uint256' }] },
  { name: 'getUserShares', type: 'function', stateMutability: 'view', inputs: [{ name: 'handle', type: 'string' }, { name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getBuyPrice', type: 'function', stateMutability: 'view', inputs: [{ name: 'handle', type: 'string' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'getSellPrice', type: 'function', stateMutability: 'view', inputs: [{ name: 'handle', type: 'string' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'getCurrentPrice', type: 'function', stateMutability: 'view', inputs: [{ name: 'handle', type: 'string' }], outputs: [{ type: 'uint256' }] },
  { name: 'estimatePriceImpact', type: 'function', stateMutability: 'view', inputs: [{ name: 'handle', type: 'string' }, { name: 'amount', type: 'uint256' }, { name: 'isBuy', type: 'bool' }], outputs: [{ name: 'avgPrice', type: 'uint256' }, { name: 'priceImpactBps', type: 'uint256' }] },
  { name: 'registerCreator', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'handle', type: 'string' }], outputs: [] },
  { name: 'registerCreatorWithCurve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'handle', type: 'string' }, { name: 'curveType', type: 'uint8' }, { name: 'A', type: 'uint256' }, { name: 'B', type: 'uint256' }], outputs: [] },
  { name: 'registerCreatorFull', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'handle', type: 'string' }, { name: 'curveType', type: 'uint8' }, { name: 'A', type: 'uint256' }, { name: 'B', type: 'uint256' }, { name: 'inflectionPoint', type: 'uint256' }], outputs: [] },
  { name: 'buyShares', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'handle', type: 'string' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'sellShares', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'handle', type: 'string' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

const USDC_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

// ============ 类型 ============
export interface Creator {
  handle: string;
  displayName: string;
  avatar: string;
  totalSupply: number;
  poolBalance: number;
  price: number;
  userShares: number;
  curveType: CurveType;
  curveTypeName: string;
  curveA: bigint;
  curveB: bigint;
  inflectionPoint: bigint;
  followers: number;
  following: number;
  tweets: number;
  verified: boolean;
  launchedAt: number;
  attentionScore: number;
  priceChange24h: number;
  holders: number;
  volume24h: number;
  avgBuyPrice: number;
  _metaLoaded: boolean;
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

export interface PricePoint { timestamp: number; price: number; }

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

export interface PriceImpact {
  avgPrice: number;
  priceImpactBps: number;
  priceImpactPercent: number;
}

// ============ Storage Keys ============
const ACTIVITY_STORAGE_KEY = 'attention_fi_activities';
const PRICE_HISTORY_KEY = 'attention_fi_price_history';

// ============ 工具函数 ============
function getCurveTypeName(curveType: number): string {
  const names: Record<number, string> = { 0: 'Linear', 1: 'Exponential', 2: 'Sigmoid' };
  return names[curveType] || 'Unknown';
}

function getSafeDisplayName(displayName?: string, handle?: string): string {
  const name = displayName?.trim();
  if (name && !['unknown', '', 'null', 'undefined'].includes(name.toLowerCase())) {
    return name;
  }
  return handle ? `@${handle.replace('@', '')}` : 'Anonymous';
}

function calculateLocalScore(c: { followers?: number; tweets?: number; poolBalance?: number; totalSupply?: number }): number {
  const followers = c.followers || 0;
  const tweets = c.tweets || 0;
  const poolBalance = c.poolBalance || 0;
  const supply = c.totalSupply || 1;
  return Math.round(
    Math.min(Math.log10(followers + 1) * 100, 400) +
    Math.min(Math.log10(tweets + 1) * 50, 200) +
    Math.min(Math.log10(poolBalance + 1) * 100, 300) +
    Math.min(supply * 10, 100)
  );
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadActivities(): Activity[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveActivities(activities: Activity[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities.slice(0, 200)));
}

function loadPriceHistory(): Record<string, PricePoint[]> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY) || '{}'); } catch { return {}; }
}

function savePriceHistory(history: Record<string, PricePoint[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
}

// ============ Hook ============
export function useCreatorMarket() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [creators, setCreators] = useState<Creator[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(false);

  // ============ 从 API 获取元数据映射 ============
  const fetchMetaFromApi = useCallback(async (): Promise<Record<string, any>> => {
    try {
      const res = await fetch(`/api/creators?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return {};
      const data = await res.json();
      const map: Record<string, any> = {};
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item?.handle) {
            map[item.handle.toLowerCase()] = item;
          }
        });
      }
      return map;
    } catch {
      return {};
    }
  }, []);

  // ============ 手动刷新单个 Creator ============
  const refreshTwitterData = useCallback(async (handle: string): Promise<boolean> => {
    const normalizedHandle = handle.toLowerCase();
    try {
      const res = await fetch(`/api/creators?handle=${encodeURIComponent(normalizedHandle)}&refresh=true&t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!res.ok) {
        console.warn(`⚠️ Failed to refresh @${handle}: ${res.status}`);
        return false;
      }

      const data = await res.json();
      console.log(`✅ Refreshed @${handle}: ${data.followers?.toLocaleString() || 0} followers`);
      
      // 更新 state
      setCreators(prev => prev.map(c => {
        if (c.handle.toLowerCase() === normalizedHandle) {
          return {
            ...c,
            displayName: getSafeDisplayName(data.displayName, handle),
            avatar: data.avatar || c.avatar,
            followers: data.followers || 0,
            following: data.following || 0,
            tweets: data.tweets || 0,
            verified: data.verified || false,
            attentionScore: data.attentionScore || calculateLocalScore({ ...c, ...data }),
            _metaLoaded: true,
          };
        }
        return c;
      }));
      
      return true;
    } catch (e) {
      console.error(`❌ Error refreshing @${handle}:`, e);
      return false;
    }
  }, []);

  // ============ 获取所有 Creators ============
  const fetchCreators = useCallback(async () => {
    if (!publicClient) return;
    
    setLoading(true);
    try {
      // 并行获取链上数据和 API 元数据
      const [metaMap, count] = await Promise.all([
        fetchMetaFromApi(),
        publicClient.readContract({
          address: CREATOR_MARKET_ADDRESS as `0x${string}`,
          abi: CREATOR_MARKET_ABI,
          functionName: 'getCreatorCount',
        }) as Promise<bigint>
      ]);

      console.log(`📊 Found ${count} creators on-chain, ${Object.keys(metaMap).length} in Redis`);

      const list: Creator[] = [];

      for (let i = 0; i < Number(count); i++) {
        try {
          const handle = await publicClient.readContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'getCreatorByIndex',
            args: [BigInt(i)],
          }) as string;

          const info = await publicClient.readContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'getCreatorInfo',
            args: [handle],
          }) as readonly [boolean, bigint, bigint, bigint, number, bigint, bigint, bigint];

          if (!info[0]) continue;

          let userShares = 0n;
          if (address) {
            try {
              userShares = await publicClient.readContract({
                address: CREATOR_MARKET_ADDRESS as `0x${string}`,
                abi: CREATOR_MARKET_ABI,
                functionName: 'getUserShares',
                args: [handle, address as `0x${string}`],
              }) as bigint;
            } catch {}
          }

          const meta = metaMap[handle.toLowerCase()] || {};
          const hasValidData = (meta.followers > 0) || (meta.tweets > 0);

          const creator: Creator = {
            handle,
            displayName: getSafeDisplayName(meta.displayName, handle),
            avatar: meta.avatar || `https://unavatar.io/twitter/${handle}`,
            totalSupply: Number(info[1]),
            poolBalance: Number(formatUnits(info[2], USDC_DECIMALS)),
            price: Number(formatUnits(info[3], USDC_DECIMALS)),
            userShares: Number(userShares),
            curveType: Number(info[4]) as CurveType,
            curveTypeName: getCurveTypeName(Number(info[4])),
            curveA: info[5],
            curveB: info[6],
            inflectionPoint: info[7],
            followers: meta.followers || 0,
            following: meta.following || 0,
            tweets: meta.tweets || 0,
            verified: meta.verified || false,
            launchedAt: meta.launchedAt || Date.now(),
            attentionScore: meta.attentionScore || 0,
            priceChange24h: meta.priceChange24h || 0,
            holders: meta.holders || Math.max(1, Math.floor(Number(info[1]) * 0.7)),
            volume24h: meta.volume24h || Number(formatUnits(info[2], USDC_DECIMALS)) * 0.1,
            avgBuyPrice: meta.avgBuyPrice || 0,
            _metaLoaded: hasValidData,
          };

          // 如果没有 attentionScore，本地计算一个
          if (!creator.attentionScore) {
            creator.attentionScore = calculateLocalScore(creator);
          }
          
          list.push(creator);
        } catch (e) {
          console.error(`Failed to fetch creator ${i}:`, e);
        }
      }

      setCreators(list);
      setActivities(loadActivities());
      setPriceHistory(loadPriceHistory());

      // ⚠️ 不再自动刷新！用户需要时手动点击刷新按钮

    } catch (error) {
      console.error('Failed to fetch creators:', error);
    } finally {
      setLoading(false);
    }
  }, [publicClient, address, fetchMetaFromApi]);

  // ============ 辅助函数 ============
  const addActivity = useCallback((activity: Omit<Activity, 'id'>) => {
    const newActivity: Activity = { ...activity, id: generateId() };
    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 200);
      saveActivities(updated);
      return updated;
    });
    return newActivity;
  }, []);

  const recordPrice = useCallback((handle: string, price: number) => {
    setPriceHistory(prev => {
      const history = prev[handle] || [];
      const updated = { ...prev, [handle]: [...history, { timestamp: Date.now(), price }].slice(-100) };
      savePriceHistory(updated);
      return updated;
    });
  }, []);

  const ensureAllowance = useCallback(async (requiredAmount: bigint) => {
    if (!publicClient || !walletClient || !address) return;

    const currentAllowance = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [address as `0x${string}`, CREATOR_MARKET_ADDRESS as `0x${string}`],
    }) as bigint;

    if (currentAllowance < requiredAmount) {
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CREATOR_MARKET_ADDRESS as `0x${string}`, requiredAmount * 10n],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }, [publicClient, walletClient, address]);

  // ============ 注册 Creator（后端自动获取 Twitter 数据） ============
  const registerCreator = useCallback(async (
    handle: string,
    twitterData?: {
      displayName?: string;
      avatar?: string;
      followers?: number;
      following?: number;
      tweets?: number;
      verified?: boolean;
    },
    curveConfig?: {
      curveType?: CurveType;
      A?: string;
      B?: string;
      inflectionPoint?: string;
    }
  ): Promise<boolean> => {
    if (!handle.trim() || !walletClient || !publicClient) return false;
    setLoading(true);

    try {
      // 1. 先在链上注册
      let hash: `0x${string}`;

      if (curveConfig?.curveType !== undefined) {
        const A = curveConfig.A ? BigInt(curveConfig.A) : 10000n;
        const B = curveConfig.B ? parseUnits(curveConfig.B, USDC_DECIMALS) : 1000000n;
        
        if (curveConfig.inflectionPoint) {
          hash = await walletClient.writeContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'registerCreatorFull',
            args: [handle, curveConfig.curveType, A, B, BigInt(curveConfig.inflectionPoint)],
          });
        } else {
          hash = await walletClient.writeContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'registerCreatorWithCurve',
            args: [handle, curveConfig.curveType, A, B],
          });
        }
      } else {
        hash = await walletClient.writeContract({
          address: CREATOR_MARKET_ADDRESS as `0x${string}`,
          abi: CREATOR_MARKET_ABI,
          functionName: 'registerCreator',
          args: [handle],
        });
      }

      await publicClient.waitForTransactionReceipt({ hash });

      // 2. 调用后端 API 保存元数据（后端会自动获取 Twitter 数据）
      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          displayName: twitterData?.displayName,
          avatar: twitterData?.avatar,
          followers: twitterData?.followers,
          following: twitterData?.following,
          tweets: twitterData?.tweets,
          verified: twitterData?.verified,
        }),
      });

      const savedData = await res.json();
      const displayName = getSafeDisplayName(savedData.data?.displayName || twitterData?.displayName, handle);

      // 3. 记录活动
      addActivity({
        type: 'launch',
        user: address || '',
        creatorHandle: handle,
        creatorName: displayName,
        amount: 0,
        price: 1.0,
        totalValue: 0,
        timestamp: Date.now(),
      });

      // 4. 刷新列表
      await fetchCreators();
      return true;
    } catch (error) {
      console.error('Register creator failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, address, addActivity, fetchCreators]);

  // ============ 买入 ============
  const buyShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0 || !walletClient || !publicClient) return false;
    setLoading(true);

    try {
      const cost = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getBuyPrice',
        args: [handle, BigInt(amount)],
      }) as bigint;

      await ensureAllowance((cost * 105n) / 100n);

      const hash = await walletClient.writeContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'buyShares',
        args: [handle, BigInt(amount)],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      const newPrice = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getCurrentPrice',
        args: [handle],
      }) as bigint;

      recordPrice(handle, Number(formatUnits(newPrice, USDC_DECIMALS)));

      const creator = creators.find(c => c.handle.toLowerCase() === handle.toLowerCase());
      addActivity({
        type: 'buy',
        user: address || '',
        creatorHandle: handle,
        creatorName: creator?.displayName || handle,
        amount,
        price: Number(formatUnits(cost, USDC_DECIMALS)) / amount,
        totalValue: Number(formatUnits(cost, USDC_DECIMALS)),
        timestamp: Date.now(),
      });

      await fetchCreators();
      return true;
    } catch (error) {
      console.error('Buy shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, address, ensureAllowance, creators, recordPrice, addActivity, fetchCreators]);

  // ============ 卖出 ============
  const sellShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0 || !walletClient || !publicClient) return false;
    setLoading(true);

    try {
      const proceeds = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getSellPrice',
        args: [handle, BigInt(amount)],
      }) as bigint;

      const hash = await walletClient.writeContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'sellShares',
        args: [handle, BigInt(amount)],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      const newPrice = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getCurrentPrice',
        args: [handle],
      }) as bigint;

      recordPrice(handle, Number(formatUnits(newPrice, USDC_DECIMALS)));

      const creator = creators.find(c => c.handle.toLowerCase() === handle.toLowerCase());
      addActivity({
        type: 'sell',
        user: address || '',
        creatorHandle: handle,
        creatorName: creator?.displayName || handle,
        amount,
        price: Number(formatUnits(proceeds, USDC_DECIMALS)) / amount,
        totalValue: Number(formatUnits(proceeds, USDC_DECIMALS)),
        timestamp: Date.now(),
      });

      await fetchCreators();
      return true;
    } catch (error) {
      console.error('Sell shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, address, creators, recordPrice, addActivity, fetchCreators]);

  // ============ 价格查询 ============
  const getBuyPrice = useCallback(async (handle: string, amount: number): Promise<number> => {
    if (!publicClient || amount <= 0) return 0;
    try {
      const cost = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getBuyPrice',
        args: [handle, BigInt(amount)],
      }) as bigint;
      return Number(formatUnits(cost, USDC_DECIMALS));
    } catch { return 0; }
  }, [publicClient]);

  const getSellPrice = useCallback(async (handle: string, amount: number): Promise<number> => {
    if (!publicClient || amount <= 0) return 0;
    try {
      const proceeds = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getSellPrice',
        args: [handle, BigInt(amount)],
      }) as bigint;
      return Number(formatUnits(proceeds, USDC_DECIMALS));
    } catch { return 0; }
  }, [publicClient]);

  const estimatePriceImpact = useCallback(async (handle: string, amount: number, isBuy: boolean): Promise<PriceImpact | null> => {
    if (!publicClient || amount <= 0) return null;
    try {
      const result = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'estimatePriceImpact',
        args: [handle, BigInt(amount), isBuy],
      }) as readonly [bigint, bigint];
      return {
        avgPrice: Number(formatUnits(result[0], USDC_DECIMALS)),
        priceImpactBps: Number(result[1]),
        priceImpactPercent: Number(result[1]) / 100,
      };
    } catch { return null; }
  }, [publicClient]);

  // ============ 排行榜 ============
  const getLeaderboard = useCallback((
    sortBy: 'score' | 'price' | 'holders' | 'volume' | 'change' = 'score',
    order: 'asc' | 'desc' = 'desc'
  ) => {
    return [...creators].sort((a, b) => {
      const getValue = (c: Creator) => {
        switch (sortBy) {
          case 'score': return c.attentionScore;
          case 'price': return c.price;
          case 'holders': return c.holders;
          case 'volume': return c.volume24h;
          case 'change': return c.priceChange24h;
          default: return 0;
        }
      };
      return order === 'desc' ? getValue(b) - getValue(a) : getValue(a) - getValue(b);
    });
  }, [creators]);

  // ============ Portfolio ============
  const portfolioStats = useMemo((): PortfolioStats => {
    const holdings = creators
      .filter(c => c.userShares > 0)
      .map(c => {
        const currentValue = c.userShares * c.price;
        const invested = c.userShares * (c.avgBuyPrice || c.price * 0.9);
        const pnl = currentValue - invested;
        return {
          creator: c,
          amount: c.userShares,
          currentValue,
          avgBuyPrice: c.avgBuyPrice || c.price * 0.9,
          pnl,
          pnlPercent: invested > 0 ? (pnl / invested) * 100 : 0,
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);

    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvested = holdings.reduce((sum, h) => sum + (h.avgBuyPrice * h.amount), 0);
    const totalPnL = totalValue - totalInvested;

    return {
      totalValue,
      totalInvested,
      totalPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
      holdings,
    };
  }, [creators]);

  // ============ 其他方法 ============
  const getPriceHistory = useCallback((handle: string): PricePoint[] => priceHistory[handle] || [], [priceHistory]);
  const getRecentActivities = useCallback((limit: number = 20): Activity[] => activities.slice(0, limit), [activities]);
  const getCreatorActivities = useCallback((handle: string, limit: number = 10): Activity[] => 
    activities.filter(a => a.creatorHandle.toLowerCase() === handle.toLowerCase()).slice(0, limit), [activities]);

  // ============ 初始化 ============
  useEffect(() => {
    if (publicClient) fetchCreators();
  }, [publicClient, fetchCreators]);

  useEffect(() => {
    if (publicClient && address) fetchCreators();
  }, [address]);

  return {
    creators,
    activities,
    portfolioStats,
    loading,
    registerCreator,
    buyShares,
    sellShares,
    fetchCreators,
    refreshTwitterData, // 手动刷新单个
    getBuyPrice,
    getSellPrice,
    estimatePriceImpact,
    getLeaderboard,
    getPriceHistory,
    getRecentActivities,
    getCreatorActivities,
  };
}