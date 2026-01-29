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

// ============ 导出曲线类型（从 config 重新导出） ============
export { CurveType } from '@/constants/config';

// ============ ABI 定义（基于 CreatorMarketV3.sol） ============
const CREATOR_MARKET_ABI = [
  // === 查询函数 ===
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
    name: 'getCurveConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'handle', type: 'string' }],
    outputs: [
      { name: 'curveType', type: 'uint8' },
      { name: 'A', type: 'uint256' },
      { name: 'B', type: 'uint256' },
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
  // === 写入函数 ===
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
  // 曲线配置（链上数据）
  curveType: CurveType;
  curveTypeName: string;
  curveA: bigint;
  curveB: bigint;
  inflectionPoint: bigint;
  // 统计（部分从元数据计算）
  attentionScore?: number;
  priceChange24h?: number;
  holders?: number;
  volume24h?: number;
  avgBuyPrice?: number;
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

// ============ localStorage 仅用于缓存元数据 ============
const META_STORAGE_KEY = 'attention_fi_creator_meta';
const ACTIVITY_STORAGE_KEY = 'attention_fi_activities';
const PRICE_HISTORY_KEY = 'attention_fi_price_history';

// 曲线名称映射
function getCurveTypeName(curveType: number): string {
  switch (curveType) {
    case 0: return 'Linear';
    case 1: return 'Exponential';
    case 2: return 'Sigmoid';
    default: return 'Unknown';
  }
}

// 安全获取显示名称
function getSafeDisplayName(displayName?: string, handle?: string): string {
  const name = displayName?.trim();
  const invalidNames = ['unknown', '', 'null', 'undefined', '(null)'];
  
  if (name && !invalidNames.includes(name.toLowerCase())) {
    return name;
  }
  
  if (handle) {
    return handle.startsWith('@') ? handle : `@${handle}`;
  }
  
  return 'Anonymous';
}

// 计算 Attention Score
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

// localStorage 工具函数
function loadMetaFromStorage(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(META_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveMetaToStorage(meta: Record<string, any>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
}

function loadActivitiesFromStorage(): Activity[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveActivitiesToStorage(activities: Activity[]) {
  if (typeof window === 'undefined') return;
  const trimmed = activities.slice(0, 100);
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(trimmed));
}

function loadPriceHistoryFromStorage(): Record<string, PricePoint[]> {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(PRICE_HISTORY_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function savePriceHistoryToStorage(history: Record<string, PricePoint[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
}

// ============ Hook ============
export function useCreatorMarket(walletAddress?: string, isConnected?: boolean) {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // 使用传入的参数或 wagmi 的值
  const address = walletAddress || wagmiAddress;
  const connected = isConnected !== undefined ? isConnected : wagmiConnected;

  const [creators, setCreators] = useState<Creator[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [creatorMeta, setCreatorMeta] = useState<Record<string, any>>({});

  // ============ 核心：从链上获取 Creator 列表 ============
  const fetchCreators = useCallback(async () => {
    if (!publicClient) return;
    
    setLoading(true);
    try {
      // 加载本地元数据缓存
      const meta = loadMetaFromStorage();
      setCreatorMeta(meta);

      // 1. 获取链上 creator 数量
      const count = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getCreatorCount',
      }) as bigint;

      const list: Creator[] = [];

      // 2. 逐个获取 creator 信息
      for (let i = 0; i < Number(count); i++) {
        try {
          // 获取 handle
          const handle = await publicClient.readContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'getCreatorByIndex',
            args: [BigInt(i)],
          }) as string;

          // 获取链上完整信息
          const info = await publicClient.readContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'getCreatorInfo',
            args: [handle],
          }) as readonly [boolean, bigint, bigint, bigint, number, bigint, bigint, bigint];

          if (!info[0]) continue; // exists check

          // 获取用户持仓
          let userShares = 0n;
          if (address) {
            try {
              userShares = await publicClient.readContract({
                address: CREATOR_MARKET_ADDRESS as `0x${string}`,
                abi: CREATOR_MARKET_ABI,
                functionName: 'getUserShares',
                args: [handle, address as `0x${string}`],
              }) as bigint;
            } catch {
              // 忽略错误
            }
          }

          // 从本地缓存获取元数据（Twitter 信息等）
          const localMeta = meta[handle.toLowerCase()] || {};

          const creator: Creator = {
            handle,
            displayName: getSafeDisplayName(localMeta.displayName, handle),
            avatar: localMeta.avatar || '',
            // 链上数据
            totalSupply: Number(info[1]),
            poolBalance: Number(formatUnits(info[2], USDC_DECIMALS)),
            price: Number(formatUnits(info[3], USDC_DECIMALS)),
            userShares: Number(userShares),
            // 曲线配置（链上）
            curveType: Number(info[4]) as CurveType,
            curveTypeName: getCurveTypeName(Number(info[4])),
            curveA: info[5],
            curveB: info[6],
            inflectionPoint: info[7],
            // 元数据（本地缓存）
            followers: localMeta.followers || 0,
            following: localMeta.following || 0,
            tweets: localMeta.tweets || 0,
            verified: localMeta.verified || false,
            launchedAt: localMeta.launchedAt || Date.now(),
            // 统计
            attentionScore: 0,
            priceChange24h: localMeta.priceChange24h || 0,
            holders: localMeta.holders || Math.max(1, Math.floor(Number(info[1]) * 0.7)),
            volume24h: localMeta.volume24h || Number(formatUnits(info[2], USDC_DECIMALS)) * 0.1,
            avgBuyPrice: localMeta.avgBuyPrice || 0,
          };

          creator.attentionScore = calculateAttentionScore(creator);
          list.push(creator);
        } catch (e) {
          console.error(`Failed to fetch creator ${i}:`, e);
        }
      }

      setCreators(list);
      setActivities(loadActivitiesFromStorage());
      setPriceHistory(loadPriceHistoryFromStorage());
    } catch (error) {
      console.error('Failed to fetch creators:', error);
    } finally {
      setLoading(false);
    }
  }, [publicClient, address]);

  // 确保 USDC allowance
  const ensureAllowance = useCallback(async (requiredAmount: bigint) => {
    if (!publicClient || !walletClient || !address) return;

    const currentAllowance = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [address as `0x${string}`, CREATOR_MARKET_ADDRESS as `0x${string}`],
    }) as bigint;

    if (currentAllowance < requiredAmount) {
      const approveAmount = requiredAmount * 10n;
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CREATOR_MARKET_ADDRESS as `0x${string}`, approveAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }, [publicClient, walletClient, address]);

  // 添加活动记录（本地）
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

  // 记录价格历史（本地）
  const recordPricePoint = useCallback((handle: string, price: number) => {
    setPriceHistory(prev => {
      const history = prev[handle] || [];
      const newPoint: PricePoint = {
        timestamp: Date.now(),
        price,
      };
      const updated = {
        ...prev,
        [handle]: [...history, newPoint].slice(-100),
      };
      savePriceHistoryToStorage(updated);
      return updated;
    });
  }, []);

  // 保存 creator 元数据到 localStorage
  const saveCreatorMeta = useCallback((handle: string, data: any) => {
    const meta = loadMetaFromStorage();
    meta[handle.toLowerCase()] = {
      ...meta[handle.toLowerCase()],
      ...data,
    };
    saveMetaToStorage(meta);
    setCreatorMeta(meta);
  }, []);

  // ============ 注册新 Creator（链上） ============
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

      if (curveConfig && curveConfig.curveType !== undefined) {
        // 使用自定义曲线
        const A = curveConfig.A ? BigInt(curveConfig.A) : BigInt(10000); // DEFAULT_A
        const B = curveConfig.B ? parseUnits(curveConfig.B, USDC_DECIMALS) : BigInt(1000000); // DEFAULT_B
        
        if (curveConfig.inflectionPoint) {
          // 完整参数
          hash = await walletClient.writeContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'registerCreatorFull',
            args: [handle, curveConfig.curveType, A, B, BigInt(curveConfig.inflectionPoint)],
          });
        } else {
          // 简化参数
          hash = await walletClient.writeContract({
            address: CREATOR_MARKET_ADDRESS as `0x${string}`,
            abi: CREATOR_MARKET_ABI,
            functionName: 'registerCreatorWithCurve',
            args: [handle, curveConfig.curveType, A, B],
          });
        }
      } else {
        // 默认线性曲线
        hash = await walletClient.writeContract({
          address: CREATOR_MARKET_ADDRESS as `0x${string}`,
          abi: CREATOR_MARKET_ABI,
          functionName: 'registerCreator',
          args: [handle],
        });
      }

      await publicClient.waitForTransactionReceipt({ hash });

      // 保存 Twitter 元数据到 localStorage
      const safeDisplayName = getSafeDisplayName(twitterData?.displayName, handle);
      saveCreatorMeta(handle, {
        displayName: safeDisplayName,
        avatar: twitterData?.avatar || '',
        followers: twitterData?.followers || 0,
        following: twitterData?.following || 0,
        tweets: twitterData?.tweets || 0,
        verified: twitterData?.verified || false,
        launchedAt: Date.now(),
      });

      // 添加 launch 活动记录
      addActivity({
        type: 'launch',
        user: address || '',
        creatorHandle: handle,
        creatorName: safeDisplayName,
        amount: 0,
        price: 1.0,
        totalValue: 0,
        timestamp: Date.now(),
      });

      // 重新获取链上数据
      await fetchCreators();
      return true;
    } catch (error) {
      console.error('Register creator failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, address, saveCreatorMeta, addActivity, fetchCreators]);

  // ============ 购买份额（链上） ============
  const buyShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0 || !walletClient || !publicClient) return false;
    setLoading(true);

    try {
      // 获取购买价格
      const cost = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getBuyPrice',
        args: [handle, BigInt(amount)],
      }) as bigint;

      // 添加 5% 手续费
      const totalCost = (cost * 105n) / 100n;
      
      // 确保 allowance
      await ensureAllowance(totalCost);

      // 执行链上购买
      const hash = await walletClient.writeContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'buyShares',
        args: [handle, BigInt(amount)],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // 获取新价格并记录
      const newPrice = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getCurrentPrice',
        args: [handle],
      }) as bigint;

      const priceNum = Number(formatUnits(newPrice, USDC_DECIMALS));
      recordPricePoint(handle, priceNum);

      // 记录活动
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

      // 重新获取链上数据
      await fetchCreators();
      return true;
    } catch (error) {
      console.error('Buy shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, address, ensureAllowance, creators, recordPricePoint, addActivity, fetchCreators]);

  // ============ 卖出份额（链上） ============
  const sellShares = useCallback(async (handle: string, amount: number): Promise<boolean> => {
    if (amount <= 0 || !walletClient || !publicClient) return false;
    setLoading(true);

    try {
      // 获取卖出收益
      const proceeds = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getSellPrice',
        args: [handle, BigInt(amount)],
      }) as bigint;

      // 执行链上卖出
      const hash = await walletClient.writeContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'sellShares',
        args: [handle, BigInt(amount)],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // 获取新价格并记录
      const newPrice = await publicClient.readContract({
        address: CREATOR_MARKET_ADDRESS as `0x${string}`,
        abi: CREATOR_MARKET_ABI,
        functionName: 'getCurrentPrice',
        args: [handle],
      }) as bigint;

      const priceNum = Number(formatUnits(newPrice, USDC_DECIMALS));
      recordPricePoint(handle, priceNum);

      // 记录活动
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

      // 重新获取链上数据
      await fetchCreators();
      return true;
    } catch (error) {
      console.error('Sell shares failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletClient, publicClient, address, creators, recordPricePoint, addActivity, fetchCreators]);

  // ============ 价格查询（链上） ============
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
    } catch (error) {
      console.error('Get buy price failed:', error);
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
    } catch (error) {
      console.error('Get sell price failed:', error);
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
    } catch (error) {
      console.error('Estimate price impact failed:', error);
      return null;
    }
  }, [publicClient]);

  // ============ 排行榜 ============
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

  // ============ Portfolio 统计 ============
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

  // 获取价格历史（本地缓存）
  const getPriceHistory = useCallback((handle: string): PricePoint[] => {
    return priceHistory[handle] || [];
  }, [priceHistory]);

  // 获取最近活动（本地缓存）
  const getRecentActivities = useCallback((limit: number = 20): Activity[] => {
    return activities.slice(0, limit);
  }, [activities]);

  // 获取特定 creator 的活动
  const getCreatorActivities = useCallback((handle: string, limit: number = 10): Activity[] => {
    return activities
      .filter(a => a.creatorHandle.toLowerCase() === handle.toLowerCase())
      .slice(0, limit);
  }, [activities]);

  // 清空本地缓存（不影响链上数据）
  const clearLocalCache = useCallback(() => {
    setActivities([]);
    setPriceHistory({});
    setCreatorMeta({});
    saveMetaToStorage({});
    saveActivitiesToStorage([]);
    savePriceHistoryToStorage({});
  }, []);

  // ============ 初始化：只要有 publicClient 就加载链上数据 ============
  useEffect(() => {
    if (publicClient) {
      fetchCreators();
    }
  }, [publicClient, fetchCreators]);

  // 当钱包地址变化时重新获取用户持仓
  useEffect(() => {
    if (publicClient && address) {
      fetchCreators();
    }
  }, [publicClient, address, fetchCreators]);

  return {
    // 数据
    creators,
    activities,
    portfolioStats,
    loading,
    
    // 核心操作（链上）
    registerCreator,
    buyShares,
    sellShares,
    fetchCreators,
    
    // 价格查询（链上）
    getBuyPrice,
    getSellPrice,
    estimatePriceImpact,
    
    // 查询方法
    getLeaderboard,
    getPriceHistory,
    getRecentActivities,
    getCreatorActivities,
    
    // 工具方法
    clearLocalCache,
  };
}