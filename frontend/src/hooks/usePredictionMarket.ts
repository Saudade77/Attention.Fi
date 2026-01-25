import { useState, useCallback, useEffect } from 'react';
import { Contract, BrowserProvider, formatUnits, parseUnits } from 'ethers';
import { PREDICTION_MARKET_ADDRESS, USDC_ADDRESS, USDC_DECIMALS } from '@/constants/config';
import PredictionMarketABI from '@/constants/PredictionMarketV2.json';
import USDCABI from '@/constants/MockUSDC.json';

export interface Market {
  id: number;
  question: string;
  category: string;
  imageUrl: string;
  endTime: number;
  status: number; // 0=Open, 1=Resolved, 2=Cancelled
  yesShares: bigint;
  noShares: bigint;
  liquidityPool: bigint;
  outcome: boolean;
  creator: string;
  yesPrice: number;
  noPrice: number;
  userYesShares: bigint;
  userNoShares: bigint;
  hasClaimed: boolean;
  volume: string; // 格式化后的 USDC 金额
}

export function usePredictionMarket() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [marketContract, setMarketContract] = useState<Contract | null>(null);
  const [usdcContract, setUsdcContract] = useState<Contract | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [usdcAllowance, setUsdcAllowance] = useState<bigint>(0n);

  // 连接钱包
  const connect = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask');
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const marketContract = new Contract(PREDICTION_MARKET_ADDRESS, PredictionMarketABI, signer);
      const usdcContract = new Contract(USDC_ADDRESS, USDCABI, signer);

      // 检查是否是 Owner
      const owner = await marketContract.owner();
      const isOwner = owner.toLowerCase() === address.toLowerCase();

      setProvider(provider);
      setMarketContract(marketContract);
      setUsdcContract(usdcContract);
      setAddress(address);
      setIsConnected(true);
      setIsOwner(isOwner);

      // 获取 USDC 余额和授权额度
      const balance = await usdcContract.balanceOf(address);
      const allowance = await usdcContract.allowance(address, PREDICTION_MARKET_ADDRESS);
      setUsdcBalance(formatUnits(balance, USDC_DECIMALS));
      setUsdcAllowance(allowance);

    } catch (error) {
      console.error('Connection failed:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setMarketContract(null);
    setUsdcContract(null);
    setAddress('');
    setIsConnected(false);
    setIsOwner(false);
  }, []);

  // 获取市场列表
  const fetchMarkets = useCallback(async () => {
    if (!marketContract) return;
    setLoading(true);

    try {
      const count = await marketContract.getMarketCount();
      const list: Market[] = [];

      for (let i = 0; i < Number(count); i++) {
        const info = await marketContract.getMarketInfo(i);
        const [yesPrice, noPrice] = await marketContract.getPrice(i);
        
        let userYesShares = 0n;
        let userNoShares = 0n;
        let hasClaimed = false;
        
        if (address) {
          const position = await marketContract.getUserPosition(i, address);
          userYesShares = position.yesShares;
          userNoShares = position.noShares;
          hasClaimed = position.hasClaimed;
        }

        list.push({
          id: i,
          question: info.question,
          category: info.category,
          imageUrl: info.imageUrl,
          endTime: Number(info.endTime),
          status: Number(info.status),
          yesShares: info.yesShares,
          noShares: info.noShares,
          liquidityPool: info.liquidityPool,
          outcome: info.outcome,
          creator: info.creator,
          yesPrice: Number(yesPrice),
          noPrice: Number(noPrice),
          userYesShares,
          userNoShares,
          hasClaimed,
          volume: formatUnits(info.liquidityPool, USDC_DECIMALS),
        });
      }

      list.sort((a, b) => b.id - a.id);
      setMarkets(list);
    } catch (error) {
      console.error('Failed to fetch markets:', error);
    } finally {
      setLoading(false);
    }
  }, [marketContract, address]);

  // 授权 USDC
  const approveUSDC = useCallback(async (amount: string) => {
    if (!usdcContract) throw new Error('Not connected');
    
    const amountWei = parseUnits(amount, USDC_DECIMALS);
    const tx = await usdcContract.approve(PREDICTION_MARKET_ADDRESS, amountWei);
    await tx.wait();
    
    const newAllowance = await usdcContract.allowance(address, PREDICTION_MARKET_ADDRESS);
    setUsdcAllowance(newAllowance);
  }, [usdcContract, address]);

  // 领取测试 USDC
  const faucet = useCallback(async (amount: string = '1000') => {
    if (!usdcContract) throw new Error('Not connected');
    
    const amountWei = parseUnits(amount, USDC_DECIMALS);
    const tx = await usdcContract.faucet(amountWei);
    await tx.wait();
    
    const balance = await usdcContract.balanceOf(address);
    setUsdcBalance(formatUnits(balance, USDC_DECIMALS));
  }, [usdcContract, address]);

  // 创建市场
  const createMarket = useCallback(async (
    question: string,
    category: string,
    imageUrl: string,
    durationDays: number,
    initialLiquidity: string,
    creatorFeeBps: number = 100
  ) => {
    if (!marketContract || !usdcContract) throw new Error('Not connected');

    const liquidityWei = parseUnits(initialLiquidity, USDC_DECIMALS);
    const durationSeconds = durationDays * 24 * 60 * 60;

    // 检查授权
    const allowance = await usdcContract.allowance(address, PREDICTION_MARKET_ADDRESS);
    if (allowance < liquidityWei) {
      const approveTx = await usdcContract.approve(PREDICTION_MARKET_ADDRESS, liquidityWei);
      await approveTx.wait();
    }

    const tx = await marketContract.createMarket(
      question,
      category,
      imageUrl,
      durationSeconds,
      liquidityWei,
      creatorFeeBps
    );
    await tx.wait();
    await fetchMarkets();
  }, [marketContract, usdcContract, address, fetchMarkets]);

  // 购买份额
  const buyShares = useCallback(async (
    marketId: number,
    isYes: boolean,
    usdcAmount: string,
    minShares: bigint = 0n
  ) => {
    if (!marketContract || !usdcContract) throw new Error('Not connected');

    const amountWei = parseUnits(usdcAmount, USDC_DECIMALS);

    // 检查授权
    const allowance = await usdcContract.allowance(address, PREDICTION_MARKET_ADDRESS);
    if (allowance < amountWei) {
      const approveTx = await usdcContract.approve(PREDICTION_MARKET_ADDRESS, amountWei * 10n);
      await approveTx.wait();
      setUsdcAllowance(amountWei * 10n);
    }

    const tx = await marketContract.buyShares(marketId, isYes, amountWei, minShares);
    await tx.wait();
    
    // 更新余额
    const balance = await usdcContract.balanceOf(address);
    setUsdcBalance(formatUnits(balance, USDC_DECIMALS));
    
    await fetchMarkets();
  }, [marketContract, usdcContract, address, fetchMarkets]);

  // 卖出份额
  const sellShares = useCallback(async (
    marketId: number,
    isYes: boolean,
    sharesAmount: bigint,
    minUSDC: bigint = 0n
  ) => {
    if (!marketContract) throw new Error('Not connected');

    const tx = await marketContract.sellShares(marketId, isYes, sharesAmount, minUSDC);
    await tx.wait();
    
    // 更新余额
    if (usdcContract) {
      const balance = await usdcContract.balanceOf(address);
      setUsdcBalance(formatUnits(balance, USDC_DECIMALS));
    }
    
    await fetchMarkets();
  }, [marketContract, usdcContract, address, fetchMarkets]);

  // 领取奖励
  const claimWinnings = useCallback(async (marketId: number) => {
    if (!marketContract) throw new Error('Not connected');

    const tx = await marketContract.claimWinnings(marketId);
    await tx.wait();
    
    // 更新余额
    if (usdcContract) {
      const balance = await usdcContract.balanceOf(address);
      setUsdcBalance(formatUnits(balance, USDC_DECIMALS));
    }
    
    await fetchMarkets();
  }, [marketContract, usdcContract, address, fetchMarkets]);

  // 解决市场（仅 Owner）
  const resolveMarket = useCallback(async (marketId: number, outcome: boolean) => {
    if (!marketContract) throw new Error('Not connected');

    const tx = await marketContract.resolveMarket(marketId, outcome);
    await tx.wait();
    await fetchMarkets();
  }, [marketContract, fetchMarkets]);
  
  // 自动重连
  useEffect(() => {
    // 使用 eth_accounts 检查是否已连接，而不是 selectedAddress
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts' 
          }) as string[];
          if (accounts && accounts.length > 0) {
            connect();
          }
        } catch (error) {
          console.error('Failed to check connection:', error);
        }
      }
    };
    checkConnection();
  }, [connect]);

  // 连接后获取市场
  useEffect(() => {
    if (marketContract) {
      fetchMarkets();
    }
  }, [marketContract, fetchMarkets]);

  return {
    // 状态
    provider,
    address,
    isConnected,
    isOwner,
    markets,
    loading,
    usdcBalance,
    usdcAllowance,
    
    // 方法
    connect,
    disconnect,
    fetchMarkets,
    approveUSDC,
    faucet,
    createMarket,
    buyShares,
    sellShares,
    claimWinnings,
    resolveMarket,
  };
}