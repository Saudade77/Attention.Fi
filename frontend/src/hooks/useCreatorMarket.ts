import { useState, useCallback, useEffect } from 'react';
import { Contract, BrowserProvider, formatUnits, parseUnits } from 'ethers';
import { CREATOR_MARKET_ADDRESS, USDC_ADDRESS, USDC_DECIMALS } from '@/constants/config';

// 如果还没部署 CreatorMarketV2，可以先用模拟数据
const USE_MOCK = true; // 部署合约后改为 false

export interface Creator {
  handle: string;
  totalSupply: number;
  poolBalance: number;
  price: number;
  userShares: number;
}

export function useCreatorMarket(walletAddress: string, isConnected: boolean) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(false);

  // 模拟数据
  const mockCreators: Creator[] = [
    { handle: 'elonmusk', totalSupply: 156, poolBalance: 2340, price: 15.0, userShares: 5 },
    { handle: 'vitalikbuterin', totalSupply: 89, poolBalance: 1200, price: 13.5, userShares: 0 },
    { handle: 'caborojas', totalSupply: 45, poolBalance: 450, price: 10.0, userShares: 3 },
    { handle: 'naval', totalSupply: 72, poolBalance: 900, price: 12.5, userShares: 0 },
  ];

  // 获取 Creator 列表
  const fetchCreators = useCallback(async () => {
    if (!isConnected) return;
    
    if (USE_MOCK) {
      setCreators(mockCreators);
      return;
    }

    // 实际合约调用
    // setLoading(true);
    // try {
    //   const provider = new BrowserProvider(window.ethereum);
    //   const contract = new Contract(CREATOR_MARKET_ADDRESS, CreatorABI, provider);
    //   // ... fetch from contract
    // } finally {
    //   setLoading(false);
    // }
  }, [isConnected]);

  // 注册 Creator
  const registerCreator = useCallback(async (handle: string): Promise<boolean> => {
    if (!handle.trim()) return false;
    setLoading(true);

    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1000)); // 模拟延迟
        const newCreator: Creator = {
          handle: handle.toLowerCase(),
          totalSupply: 1,
          poolBalance: 0,
          price: 1.0,
          userShares: 1,
        };
        setCreators((prev) => [newCreator, ...prev]);
        return true;
      }

      // 实际合约调用
      // const provider = new BrowserProvider(window.ethereum);
      // const signer = await provider.getSigner();
      // const contract = new Contract(CREATOR_MARKET_ADDRESS, CreatorABI, signer);
      // const tx = await contract.registerCreator(handle);
      // await tx.wait();
      // await fetchCreators();
      return true;
    } catch (error) {
      console.error('Register failed:', error);
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
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1000));
        setCreators((prev) =>
          prev.map((c) => {
            if (c.handle === handle) {
              const newSupply = c.totalSupply + amount;
              const cost = c.price * amount;
              return {
                ...c,
                totalSupply: newSupply,
                poolBalance: c.poolBalance + cost,
                price: c.price + amount * 0.1, // 价格上涨
                userShares: c.userShares + amount,
              };
            }
            return c;
          })
        );
        return true;
      }

      // 实际合约调用
      // ...
      return true;
    } catch (error) {
      console.error('Buy failed:', error);
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
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1000));
        setCreators((prev) =>
          prev.map((c) => {
            if (c.handle === handle && c.userShares >= amount) {
              const payout = c.price * amount * 0.95; // 5% 滑点
              return {
                ...c,
                totalSupply: c.totalSupply - amount,
                poolBalance: c.poolBalance - payout,
                price: Math.max(1, c.price - amount * 0.1), // 价格下跌
                userShares: c.userShares - amount,
              };
            }
            return c;
          })
        );
        return true;
      }

      // 实际合约调用
      // ...
      return true;
    } catch (error) {
      console.error('Sell failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  return {
    creators,
    loading,
    registerCreator,
    buyShares,
    sellShares,
    fetchCreators,
  };
}