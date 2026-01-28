'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { 
  PREDICTION_MARKET_ADDRESS, 
  USDC_ADDRESS, 
  USDC_DECIMALS,
} from '@/constants/config';

// ============ 定价算法枚举 ============
export enum PricingAlgorithm {
  CPMM = 0,   // 恒定乘积做市商（原算法）
  LMSR = 1,   // 对数市场评分规则（新算法）
}

// ============ ABIs (更新为 V4) ============
const PREDICTION_MARKET_ABI = [
  // === 查询函数 ===
  {
    name: 'getMarketCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getMarketInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      { name: 'question', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'imageUrl', type: 'string' },
      { name: 'endTime', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'numOutcomes', type: 'uint8' },
      { name: 'liquidityPool', type: 'uint256' },
      { name: 'winnerIndex', type: 'uint8' },
      { name: 'creator', type: 'address' },
    ],
  },
  // 🆕 V4 新增：获取完整市场信息（含算法）
  {
    name: 'getMarketFullInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      { name: 'question', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'endTime', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'numOutcomes', type: 'uint8' },
      { name: 'liquidityPool', type: 'uint256' },
      { name: 'algorithm', type: 'uint8' },
      { name: 'lmsrB', type: 'uint256' },
    ],
  },
  // 🆕 V4 新增：获取市场算法类型
  {
    name: 'getMarketAlgorithm',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      { name: 'algorithm', type: 'uint8' },
      { name: 'lmsrB', type: 'uint256' },
    ],
  },
  {
    name: 'getMarketOutcomes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      { name: 'labels', type: 'string[]' },
      { name: 'shares', type: 'uint256[]' },
    ],
  },
  {
    name: 'getPrices',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [{ name: 'prices', type: 'uint256[]' }],
  },
  {
    name: 'getUserPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'shares', type: 'uint256[]' },
      { name: 'hasClaimed', type: 'bool' },
    ],
  },
  {
    name: 'getPriceHistory',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      { name: 'timestamps', type: 'uint256[]' },
      { name: 'prices', type: 'uint256[][]' },
    ],
  },
  {
    name: 'getAllUserActiveOrders',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'marketId', type: 'uint256' },
        { name: 'user', type: 'address' },
        { name: 'outcomeIndex', type: 'uint8' },
        { name: 'shares', type: 'uint256' },
        { name: 'price', type: 'uint256' },
        { name: 'usdcDeposit', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'isBuy', type: 'bool' },
        { name: 'status', type: 'uint8' },
      ],
    }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  // === 写入函数 ===
  {
    name: 'createMarket',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'imageUrl', type: 'string' },
      { name: 'duration', type: 'uint256' },
      { name: 'initialLiquidity', type: 'uint256' },
      { name: 'creatorFee', type: 'uint256' },
      { name: 'outcomeLabels', type: 'string[]' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  // 🆕 V4 新增：创建市场（指定算法）
  {
    name: 'createMarketWithAlgorithm',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'imageUrl', type: 'string' },
      { name: 'duration', type: 'uint256' },
      { name: 'initialLiquidity', type: 'uint256' },
      { name: 'creatorFee', type: 'uint256' },
      { name: 'outcomeLabels', type: 'string[]' },
      { name: 'algorithm', type: 'uint8' },
      { name: 'lmsrB', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'deleteMarket',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'buyShares',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'outcomeIndex', type: 'uint8' },
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'minShares', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'sellShares',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'outcomeIndex', type: 'uint8' },
      { name: 'shares', type: 'uint256' },
      { name: 'minUsdc', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'placeBuyOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'outcomeIndex', type: 'uint8' },
      { name: 'shares', type: 'uint256' },
      { name: 'price', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'placeSellOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'outcomeIndex', type: 'uint8' },
      { name: 'shares', type: 'uint256' },
      { name: 'price', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'cancelOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'claimWinnings',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'resolveMarket',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'winnerIndex', type: 'uint8' },
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
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// ============ 类型定义 ============
export interface Market {
  id: number;
  question: string;
  category: string;
  imageUrl?: string;
  endTime: number;
  status: number;
  numOutcomes: number;
  outcomeLabels: string[];
  outcomeShares: bigint[];
  prices: number[];
  liquidityPool: bigint;
  winnerIndex: number;
  creator: string;
  userShares: bigint[];
  hasClaimed: boolean;
  volume: string;
  // 🆕 V4 新增：算法相关
  algorithm: PricingAlgorithm;
  algorithmName: string;
  lmsrB: bigint;
  // 兼容旧接口
  yesShares: bigint;
  noShares: bigint;
  yesPrice: number;
  noPrice: number;
  userYesShares: bigint;
  userNoShares: bigint;
  outcome: boolean;
}

export interface LimitOrder {
  id: number;
  marketId: number;
  user: string;
  outcomeIndex: number;
  shares: bigint;
  price: number;
  usdcDeposit: bigint;
  timestamp: number;
  isBuy: boolean;
  status: number;
}

export interface PriceHistory {
  timestamps: number[];
  prices: number[][];
}

// 🆕 创建市场参数（支持算法选择）
export interface CreateMarketParams {
  question: string;
  category: string;
  imageUrl: string;
  durationDays: number;
  initialLiquidity: string;
  creatorFeeBps: number;
  outcomeLabels?: string[];
  algorithm?: PricingAlgorithm;
  lmsrB?: string; // LMSR 流动性参数（如 "100"）
}

// ============ Hook ============
export function usePredictionMarket() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isOwner, setIsOwner] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userOrders, setUserOrders] = useState<LimitOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState('0');

  // 算法名称映射
  const getAlgorithmName = (algo: number): string => {
    switch (algo) {
      case 0: return 'CPMM';
      case 1: return 'LMSR';
      default: return 'Unknown';
    }
  };

  // 检查是否是 owner
  useEffect(() => {
    const checkOwner = async () => {
      if (!publicClient || !address) {
        setIsOwner(false);
        return;
      }
      try {
        const owner = await publicClient.readContract({
          address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
          abi: PREDICTION_MARKET_ABI,
          functionName: 'owner',
        });
        setIsOwner((owner as string).toLowerCase() === address.toLowerCase());
      } catch {
        setIsOwner(false);
      }
    };
    checkOwner();
  }, [publicClient, address]);

  // 获取 USDC 余额
  const fetchBalance = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const balance = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      setUsdcBalance(formatUnits(balance as bigint, USDC_DECIMALS));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }, [publicClient, address]);

  // 获取市场列表
  const fetchMarkets = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);

    try {
      const count = await publicClient.readContract({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'getMarketCount',
      });

      const list: Market[] = [];

      for (let i = 0; i < Number(count); i++) {
        try {
          const info = await publicClient.readContract({
            address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
            abi: PREDICTION_MARKET_ABI,
            functionName: 'getMarketInfo',
            args: [BigInt(i)],
          }) as any;

          // 跳过已删除的市场
          if (Number(info[4]) === 3) continue;

          // 🆕 获取算法信息
          let algorithm: PricingAlgorithm = PricingAlgorithm.CPMM;
          let lmsrB: bigint = 0n;
          try {
            const algoInfo = await publicClient.readContract({
              address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
              abi: PREDICTION_MARKET_ABI,
              functionName: 'getMarketAlgorithm',
              args: [BigInt(i)],
            }) as any;
            algorithm = Number(algoInfo[0]) as PricingAlgorithm;
            lmsrB = algoInfo[1];
          } catch {
            // 如果调用失败，可能是旧版合约，默认 CPMM
          }

          const outcomes = await publicClient.readContract({
            address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
            abi: PREDICTION_MARKET_ABI,
            functionName: 'getMarketOutcomes',
            args: [BigInt(i)],
          }) as any;

          const rawPrices = await publicClient.readContract({
            address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
            abi: PREDICTION_MARKET_ABI,
            functionName: 'getPrices',
            args: [BigInt(i)],
          }) as bigint[];

          const rawPriceNumbers = rawPrices.map((p) => Number(p));
          const priceSum = rawPriceNumbers.reduce((a, b) => a + b, 0);
          const normalizedPrices = priceSum > 0
            ? rawPriceNumbers.map((p) => Math.round((p / priceSum) * 10000))
            : rawPriceNumbers;

          let userShares: bigint[] = [];
          let hasClaimed = false;

          if (address) {
            try {
              const position = await publicClient.readContract({
                address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
                abi: PREDICTION_MARKET_ABI,
                functionName: 'getUserPosition',
                args: [BigInt(i), address],
              }) as any;
              userShares = [...position[0]];
              hasClaimed = position[1];
            } catch (e) {
              console.error('Failed to get user position:', e);
            }
          }

          const numOutcomes = Number(info[5]);

          list.push({
            id: i,
            question: info[0],
            category: info[1],
            imageUrl: info[2],
            endTime: Number(info[3]),
            status: Number(info[4]),
            numOutcomes,
            outcomeLabels: [...outcomes[0]],
            outcomeShares: [...outcomes[1]],
            prices: normalizedPrices,
            liquidityPool: info[6],
            winnerIndex: Number(info[7]),
            creator: info[8],
            userShares: userShares.length > 0 ? userShares : Array(numOutcomes).fill(0n),
            hasClaimed,
            volume: formatUnits(info[6] as bigint, USDC_DECIMALS),
            // 🆕 算法信息
            algorithm,
            algorithmName: getAlgorithmName(algorithm),
            lmsrB,
            // 兼容旧接口
            yesPrice: Math.round(normalizedPrices[0] / 100),
            noPrice: normalizedPrices.length > 1 ? Math.round(normalizedPrices[1] / 100) : Math.round((10000 - normalizedPrices[0]) / 100),
            userYesShares: userShares[0] || 0n,
            userNoShares: userShares[1] || 0n,
            outcome: Number(info[7]) === 0,
            yesShares: outcomes[1][0] || 0n,
            noShares: outcomes[1][1] || 0n,
          });
        } catch (e) {
          console.error(`Failed to fetch market ${i}:`, e);
        }
      }

      list.sort((a, b) => b.id - a.id);
      setMarkets(list);
    } catch (error) {
      console.error('Failed to fetch markets:', error);
    } finally {
      setLoading(false);
    }
  }, [publicClient, address]);

  // 获取用户订单
  const fetchUserOrders = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const orders = await publicClient.readContract({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'getAllUserActiveOrders',
        args: [address],
      }) as any[];

      const formattedOrders: LimitOrder[] = orders.map((order) => ({
        id: Number(order.id),
        marketId: Number(order.marketId),
        user: order.user,
        outcomeIndex: Number(order.outcomeIndex),
        shares: order.shares,
        price: Number(order.price),
        usdcDeposit: order.usdcDeposit,
        timestamp: Number(order.timestamp),
        isBuy: order.isBuy,
        status: Number(order.status),
      }));

      setUserOrders(formattedOrders);
    } catch (error) {
      console.error('Failed to fetch user orders:', error);
    }
  }, [publicClient, address]);

  // 初始化加载
  useEffect(() => {
    if (publicClient) {
      fetchMarkets();
      fetchBalance();
      if (address) {
        fetchUserOrders();
      }
    }
  }, [publicClient, address, fetchMarkets, fetchBalance, fetchUserOrders]);

  // 确保 allowance
  const ensureAllowance = useCallback(async (requiredAmount: bigint) => {
    if (!publicClient || !walletClient || !address) return;

    const currentAllowance = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [address, PREDICTION_MARKET_ADDRESS as `0x${string}`],
    }) as bigint;

    if (currentAllowance < requiredAmount) {
      const approveAmount = requiredAmount * 10n;
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [PREDICTION_MARKET_ADDRESS as `0x${string}`, approveAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }, [publicClient, walletClient, address]);

  // Faucet
  const faucet = useCallback(async (amount: string) => {
    if (!walletClient || !publicClient || !address) return;
    const amountWei = parseUnits(amount, USDC_DECIMALS);
    const hash = await walletClient.writeContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'mint',
      args: [address, amountWei],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchBalance();
  }, [walletClient, publicClient, address, fetchBalance]);

  // 🆕 创建市场（支持算法选择）
  const createMarket = useCallback(async (
    question: string,
    category: string,
    imageUrl: string,
    durationDays: number,
    initialLiquidity: string,
    creatorFeeBps: number,
    outcomeLabels: string[] = ['Yes', 'No'],
    algorithm: PricingAlgorithm = PricingAlgorithm.CPMM,
    lmsrB: string = '100' // 默认 LMSR 参数
  ) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const liquidityWei = parseUnits(initialLiquidity, USDC_DECIMALS);
    await ensureAllowance(liquidityWei);

    let hash: `0x${string}`;

    if (algorithm === PricingAlgorithm.LMSR) {
      // 使用 LMSR 算法创建市场
      const lmsrBWei = parseUnits(lmsrB, 18); // LMSR b 参数使用 18 位精度
      hash = await walletClient.writeContract({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'createMarketWithAlgorithm',
        args: [
          question, 
          category, 
          imageUrl, 
          BigInt(durationDays * 24 * 60 * 60), 
          liquidityWei, 
          BigInt(creatorFeeBps), 
          outcomeLabels,
          algorithm,
          lmsrBWei,
        ],
      });
    } else {
      // 使用默认 CPMM 算法
      hash = await walletClient.writeContract({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'createMarket',
        args: [
          question, 
          category, 
          imageUrl, 
          BigInt(durationDays * 24 * 60 * 60), 
          liquidityWei, 
          BigInt(creatorFeeBps), 
          outcomeLabels
        ],
      });
    }
    
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
    await fetchBalance();
  }, [walletClient, publicClient, ensureAllowance, fetchMarkets, fetchBalance]);

  // 🆕 创建市场（简化版，使用参数对象）
  const createMarketAdvanced = useCallback(async (params: CreateMarketParams) => {
    return createMarket(
      params.question,
      params.category,
      params.imageUrl,
      params.durationDays,
      params.initialLiquidity,
      params.creatorFeeBps,
      params.outcomeLabels || ['Yes', 'No'],
      params.algorithm || PricingAlgorithm.CPMM,
      params.lmsrB || '100'
    );
  }, [createMarket]);

  // 删除市场
  const deleteMarket = useCallback(async (marketId: number) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const hash = await walletClient.writeContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'deleteMarket',
      args: [BigInt(marketId)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
  }, [walletClient, publicClient, fetchMarkets]);

  // 买入
  const buyShares = useCallback(async (marketId: number, outcomeIndex: number | boolean, amount: string) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const idx = typeof outcomeIndex === 'boolean' ? (outcomeIndex ? 0 : 1) : outcomeIndex;
    const amountWei = parseUnits(amount, USDC_DECIMALS);
    await ensureAllowance(amountWei);

    const hash = await walletClient.writeContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'buyShares',
      args: [BigInt(marketId), idx, amountWei, 0n],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
    await fetchBalance();
  }, [walletClient, publicClient, ensureAllowance, fetchMarkets, fetchBalance]);

  // 卖出
  const sellShares = useCallback(async (marketId: number, outcomeIndex: number | boolean, shares: bigint | string) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const idx = typeof outcomeIndex === 'boolean' ? (outcomeIndex ? 0 : 1) : outcomeIndex;
    const sharesWei = typeof shares === 'string' ? parseUnits(shares, 18) : shares;

    const hash = await walletClient.writeContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'sellShares',
      args: [BigInt(marketId), idx, sharesWei, 0n],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
    await fetchBalance();
  }, [walletClient, publicClient, fetchMarkets, fetchBalance]);

  // 限价买单
  const placeBuyOrder = useCallback(async (marketId: number, outcomeIndex: number, shares: string, price: number) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const sharesWei = parseUnits(shares, 18);
    const usdcRequired = (sharesWei * BigInt(price)) / (100n * BigInt(10 ** 12));
    await ensureAllowance(usdcRequired + BigInt(10 ** 6));

    const hash = await walletClient.writeContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'placeBuyOrder',
      args: [BigInt(marketId), outcomeIndex, sharesWei, BigInt(price * 100)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
    await fetchUserOrders();
    await fetchBalance();
  }, [walletClient, publicClient, ensureAllowance, fetchMarkets, fetchUserOrders, fetchBalance]);

  // 限价卖单
  const placeSellOrder = useCallback(async (marketId: number, outcomeIndex: number, shares: string, price: number) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const sharesWei = parseUnits(shares, 18);

    const hash = await walletClient.writeContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'placeSellOrder',
      args: [BigInt(marketId), outcomeIndex, sharesWei, BigInt(price * 100)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
    await fetchUserOrders();
  }, [walletClient, publicClient, fetchMarkets, fetchUserOrders]);

  // 取消订单
  const cancelOrder = useCallback(async (orderId: number) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const hash = await walletClient.writeContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'cancelOrder',
      args: [BigInt(orderId)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
    await fetchUserOrders();
    await fetchBalance();
  }, [walletClient, publicClient, fetchMarkets, fetchUserOrders, fetchBalance]);

  // 领取奖励
  const claimWinnings = useCallback(async (marketId: number) => {
    if (!walletClient || !publicClient) throw new Error('Not connected');
    const hash = await walletClient.writeContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'claimWinnings',
      args: [BigInt(marketId)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await fetchMarkets();
    await fetchBalance();
  }, [walletClient, publicClient, fetchMarkets, fetchBalance]);

  // 价格历史
  const getPriceHistory = useCallback(async (marketId: number): Promise<PriceHistory> => {
    if (!publicClient) return { timestamps: [], prices: [] };
    try {
      const result = await publicClient.readContract({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'getPriceHistory',
        args: [BigInt(marketId)],
      }) as any;
      return {
        timestamps: result[0].map((t: bigint) => Number(t)),
        prices: result[1].map((p: bigint[]) => p.map((v) => Number(v))),
      };
    } catch {
      return { timestamps: [], prices: [] };
    }
  }, [publicClient]);

  return {
    address: address || '',
    isConnected,
    isOwner,
    markets,
    userOrders,
    loading,
    usdcBalance,
    // 操作
    faucet,
    createMarket,
    createMarketAdvanced, // 🆕 新增
    deleteMarket,
    buyShares,
    sellShares,
    placeBuyOrder,
    placeSellOrder,
    cancelOrder,
    claimWinnings,
    getPriceHistory,
    fetchMarkets,
    fetchUserOrders,
    fetchBalance,
    // 🆕 导出枚举供外部使用
    PricingAlgorithm,
  };
}