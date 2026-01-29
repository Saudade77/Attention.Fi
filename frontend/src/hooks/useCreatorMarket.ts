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

// ============ 导出曲线类型 ============
export { CurveType } from '@/constants/config';

// ============ ABI 定义 ============
const CREATOR_MARKET_ABI = [
  {
    name: 'getCreatorCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCreatorByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'getCreatorInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'handle', type: 'string' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'poolBalance', type: 'uint256' },
      { name: 'currentPrice', type: 'uint256' },
      { name: 'curveType', type: 'uint8' },
      { name: 'curveA', type: 'uint256' },
      { name: 'curveB', type: 'uint256' },
      { name: 'inflectionPoint', type: 'uint256' },
    ],
  },
  {
    name: 'getUserShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getBuyPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getSellPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'handle', type: 'string' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'estimatePriceImpact',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'isBuy', type: 'bool' },
    ],
    outputs: [
      { name: 'avgPrice', type: 'uint256' },
      { name: 'priceImpactBps', type: 'uint256' },
    ],
  },
  {
    name: 'registerCreator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'handle', type: 'string' }],
    outputs: [],
  },
  {
    name: 'registerCreatorWithCurve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'curveType', type: 'uint8' },
      { name: 'A', type: 'uint256' },
      { name: 'B', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'registerCreatorFull',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'curveType', type: 'uint8' },
      { name: 'A', type: 'uint256' },
      { name: 'B', type: 'uint256' },
      { name: 'inflectionPoint', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'buyShares',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'sellShares',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

// ============ 类型定义 ============
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

export interface PriceImpact {
  avgPrice: number;
  priceImpactBps: number;
  priceImpactPercent: number;
}

const META_STORAGE_KEY = 'attention_fi_creator_meta';
const ACTIVITY_STORAGE_KEY = 'attention_fi_activities';
const PRICE_HISTORY_KEY = 'attention_fi_price_history';

// ============ 工具函数 ============
function getCurveTypeName(curveType: number): string {
  switch (curveType) {
    case 0: return 'Linear';
    case 1: return 'Exponential';
    case 2: return 'Sigmoid';
    default: return 'Unknown';
  }
}

function getSafeDisplayName(displayName?: string, handle?: string): string {
  const name = displayName?.trim();
  const invalidNames = ['unknown', '', 'null', 'undefined', '(null)'];
  if (name && !invalidNames.includes(name.toLowerCase())) {
    return name;
  }
  return handle ? `@${handle.replace('@', '')}` : 'Anonymous';
}

function calculateAttentionScore(creator: Creator): number {
  const followers = creator.followers || 0;
  const tweets = creator.tweets || 0;
  const supply = creator.totalSupply || 1;
  const poolBalance = creator.poolBalance || 0;
  
  const followerScore = Math.min(Math.log10(followers + 1) * 100, 400);
  const engagementScore = Math.min(Math.log10(tweets + 1) * 50, 200);
  const marketScore = Math.min(Math.log10(poolBalance + 1) * 100, 300);
  const supplyScore = Math.min(supply * 10, 100);
  
  return Math.round(followerScore + engagementScore + marketScore + supplyScore);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadMeta(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(META_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMeta(meta: Record<string, any>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
}

function loadActivities(): Activity[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveActivities(activities: Activity[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities.slice(0, 200)));
}

function loadPriceHistory(): Record<string, PricePoint[]> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY) || '{}');
  } catch {
    return {};
  }
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
  const [metaCache, setMetaCache] = useState<Record<string, any>>({});

  // ============ 修复1: 保存元数据到 localStorage + Redis ============
  const saveCreatorMeta = useCallback(async (handle: string, data: Partial<Creator>) => {
    // 更新本地缓存
    const meta = loadMeta();
    const newData = {
      ...meta[handle.toLowerCase()],
      ...data,
      handle,
      lastUpdated: Date.now(),
    };
    meta[handle.toLowerCase()] = newData;
    saveMeta(meta);
    setMetaCache(meta);

    // 同步到 Redis 后端
    try {
      await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          displayName: data.displayName,
          avatar: data.avatar,
          followers: data.followers,
          following: data.following,
          tweets: data.tweets,
          verified: data.verified,
        }),
      });
      console.log(`✅ Synced @${handle} to Redis`);
    } catch (e) {
      console.error(`❌ Failed to sync @${handle} to Redis:`, e);
    }
  }, []);

  // ============ 批量刷新缺失的 Twitter 数据 ============
  const refreshMissingTwitterData = useCallback(async (handles: string[]) => {
    const BATCH_SIZE = 3;
    const DELAY_MS = 1000;

    console.log(`🔄 Starting refresh for ${handles.length} creators...`);

    for (let i = 0; i < handles.length; i += BATCH_SIZE) {
      const batch = handles.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (handle) => {
        try {
          // 修复2: 添加时间戳防止缓存
          const res = await fetch(
            `/api/creators/${encodeURIComponent(handle)}?refresh=true&t=${Date.now()}`, 
            { cache: 'no-store' }
          );
          
          if (res.ok) {
            const data = await res.json();
            console.log(`✅ Refreshed @${handle}: ${data.followers?.toLocaleString() || 0} followers, Score: ${data.attentionScore || 'N/A'}`);
            
            // 更新本地缓存
            const meta = loadMeta();
            meta[handle.toLowerCase()] = {
              ...meta[handle.toLowerCase()],
              ...data,
            };
            saveMeta(meta);
            
            // 更新 state
            setCreators(prev => prev.map(c => {
              if (c.handle.toLowerCase() === handle.toLowerCase()) {
                const updated: Creator = {
                  ...c,
                  displayName: getSafeDisplayName(data.displayName, handle),
                  avatar: data.avatar || c.avatar,
                  followers: data.followers || 0,
                  following: data.following || 0,
                  tweets: data.tweets || 0,
                  verified: data.verified || false,
                  _metaLoaded: true,
                };
                // 使用 API 返回的 attentionScore 或重新计算
                updated.attentionScore = data.attentionScore || calculateAttentionScore(updated);
                return updated;
              }
              return c;
            }));
          } else {
            console.warn(`⚠️ Failed to refresh @${handle}: ${res.status}`);
          }
        } catch (e) {
          console.error(`❌ Error refreshing @${handle}:`, e);
        }
      }));

      if (i + BATCH_SIZE < handles.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
    
    console.log(`✅ Refresh complete for ${handles.length} creators`);
  }, []);

  // ============ 从链上获取列表 + 从 API 获取元数据 ============
  const fetchCreators = useCallback(async () => {
    if (!publicClient) return;
    
    setLoading(true);
    try {
      const localMeta = loadMeta();
      
      const apiMetaPromise = fetch(`/api/creators?t=${Date.now()}`, { 
        cache: 'no-store' 
      }).then(res => res.ok ? res.json() : []).catch(() => []);

      const countPromise = publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getCreatorCount',
      }) as Promise<bigint>;

      const [apiCreatorsData, count] = await Promise.all([apiMetaPromise, countPromise]);

      console.log(`📊 Found ${count} creators on-chain, ${apiCreatorsData.length} in Redis`);

      // 建立元数据映射表
      const metaMap: Record<string, any> = { ...localMeta };
      if (Array.isArray(apiCreatorsData)) {
        apiCreatorsData.forEach((item: any) => {
          if (item && item.handle) {
            metaMap[item.handle.toLowerCase()] = {
              ...metaMap[item.handle.toLowerCase()],
              ...item,
              _fromApi: true
            };
          }
        });
      }
      
      setMetaCache(metaMap);
      saveMeta(metaMap);

      const list: Creator[] = [];
      const needsRefresh: string[] = [];

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
          const hasValidData = meta.followers > 0 || meta.tweets > 0;

          // 检测是否需要刷新
          if (!hasValidData) {
            needsRefresh.push(handle);
          }

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
            attentionScore: meta.attentionScore || 0, // 先用 API 返回的值
            priceChange24h: meta.priceChange24h || 0,
            holders: meta.holders || Math.max(1, Math.floor(Number(info[1]) * 0.7)),
            volume24h: meta.volume24h || Number(formatUnits(info[2], USDC_DECIMALS)) * 0.1,
            avgBuyPrice: meta.avgBuyPrice || 0,
            _metaLoaded: hasValidData,
          };

          // 如果 API 没有返回 attentionScore，则计算
          if (!creator.attentionScore) {
            creator.attentionScore = calculateAttentionScore(creator);
          }
          
          list.push(creator);
        } catch (e) {
          console.error(`Failed to fetch creator ${i}:`, e);
        }
      }

      setCreators(list);
      setActivities(loadActivities());
      setPriceHistory(loadPriceHistory());

      // 后台自动刷新缺失数据
      if (needsRefresh.length > 0) {
        console.log(`🔄 ${needsRefresh.length} creators need Twitter data refresh`);
        // 使用 setTimeout 确保不阻塞 UI
        setTimeout(() => {
          refreshMissingTwitterData(needsRefresh);
        }, 100);
      }

    } catch (error) {
      console.error('Failed to fetch creators:', error);
    } finally {
      setLoading(false);
    }
  }, [publicClient, address, refreshMissingTwitterData]);

  // ============ 按需刷新单个 Creator ============
  const refreshTwitterData = useCallback(async (handle: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/creators/${encodeURIComponent(handle)}?refresh=true&t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!res.ok) {
        console.warn(`Failed to refresh Twitter data for @${handle}: ${res.status}`);
        return false;
      }

      const data = await res.json();
      
      // 更新 localStorage
      const meta = loadMeta();
      meta[handle.toLowerCase()] = {
        ...meta[handle.toLowerCase()],
        ...data,
        lastUpdated: Date.now(),
      };
      saveMeta(meta);
      setMetaCache(meta);

      // 更新 state
      setCreators(prev => prev.map(c => {
        if (c.handle.toLowerCase() === handle.toLowerCase()) {
          const updated: Creator = {
            ...c,
            displayName: getSafeDisplayName(data.displayName, handle),
            avatar: data.avatar || c.avatar,
            followers: data.followers || c.followers,
            following: data.following || c.following,
            tweets: data.tweets || c.tweets,
            verified: data.verified || c.verified,
            _metaLoaded: true,
          };
          updated.attentionScore = data.attentionScore || calculateAttentionScore(updated);
          return updated;
        }
        return c;
      }));

      return true;
    } catch (error) {
      console.error(`Error refreshing Twitter data for @${handle}:`, error);
      return false;
    }
  }, []);

  // ============ 确保 USDC allowance ============
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

  // ============ 添加活动记录 ============
  const addActivity = useCallback((activity: Omit<Activity, 'id'>) => {
    const newActivity: Activity = { ...activity, id: generateId() };
    setActivities(prev => {
      const updated = [newActivity, ...prev].slice(0, 200);
      saveActivities(updated);
      return updated;
    });
    return newActivity;
  }, []);

  // ============ 记录价格 ============
  const recordPrice = useCallback((handle: string, price: number) => {
    setPriceHistory(prev => {
      const history = prev[handle] || [];
      const updated = {
        ...prev,
        [handle]: [...history, { timestamp: Date.now(), price }].slice(-100),
      };
      savePriceHistory(updated);
      return updated;
    });
  }, []);

  // ============ 注册 Creator (修复3: 同步到 Redis) ============
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

      // 保存 Twitter 元数据到 localStorage + Redis
      const displayName = getSafeDisplayName(twitterData?.displayName, handle);
      await saveCreatorMeta(handle, {
        displayName,
        avatar: twitterData?.avatar || `https://unavatar.io/twitter/${handle}`,
        followers: twitterData?.followers || 0,
        following: twitterData?.following || 0,
        tweets: twitterData?.tweets || 0,
        verified: twitterData?.verified || false,
        launchedAt: Date.now(),
      });

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

      await fetchCreators();
      return true;
    } catch (error) {
      console.error('Register creator failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, address, saveCreatorMeta, addActivity, fetchCreators]);

  // ============ 购买份额 ============
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

      const totalCost = (cost * 105n) / 100n;
      await ensureAllowance(totalCost);

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

      const priceNum = Number(formatUnits(newPrice, USDC_DECIMALS));
      recordPrice(handle, priceNum);

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

  // ============ 卖出份额 ============
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

      const priceNum = Number(formatUnits(newPrice, USDC_DECIMALS));
      recordPrice(handle, priceNum);

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
    } catch {
      return 0;
    }
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
    } catch {
      return 0;
    }
  }, [publicClient]);

  const estimatePriceImpact = useCallback(async (
    handle: string, 
    amount: number, 
    isBuy: boolean
  ): Promise<PriceImpact | null> => {
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
    } catch {
      return null;
    }
  }, [publicClient]);

  // ============ 排行榜 ============
  const getLeaderboard = useCallback((
    sortBy: 'score' | 'price' | 'holders' | 'volume' | 'change' = 'score',
    order: 'asc' | 'desc' = 'desc'
  ) => {
    return [...creators].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'score': aVal = a.attentionScore; bVal = b.attentionScore; break;
        case 'price': aVal = a.price; bVal = b.price; break;
        case 'holders': aVal = a.holders; bVal = b.holders; break;
        case 'volume': aVal = a.volume24h; bVal = b.volume24h; break;
        case 'change': aVal = a.priceChange24h; bVal = b.priceChange24h; break;
        default: return 0;
      }
      return order === 'desc' ? bVal - aVal : aVal - bVal;
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

    return { totalValue, totalInvested, totalPnL, totalPnLPercent, holdings };
  }, [creators]);

  // ============ 其他查询方法 ============
  const getPriceHistory = useCallback((handle: string): PricePoint[] => {
    return priceHistory[handle] || [];
  }, [priceHistory]);

  const getRecentActivities = useCallback((limit: number = 20): Activity[] => {
    return activities.slice(0, limit);
  }, [activities]);

  const getCreatorActivities = useCallback((handle: string, limit: number = 10): Activity[] => {
    return activities
      .filter(a => a.creatorHandle.toLowerCase() === handle.toLowerCase())
      .slice(0, limit);
  }, [activities]);

  // ============ 初始化 ============
  useEffect(() => {
    if (publicClient) {
      fetchCreators();
    }
  }, [publicClient, fetchCreators]);

  useEffect(() => {
    if (publicClient && address) {
      fetchCreators();
    }
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
    refreshMissingTwitterData,
    refreshTwitterData,
    saveCreatorMeta,
    getBuyPrice,
    getSellPrice,
    estimatePriceImpact,
    getLeaderboard,
    getPriceHistory,
    getRecentActivities,
    getCreatorActivities,
  };
}