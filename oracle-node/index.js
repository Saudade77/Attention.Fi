require('dotenv').config();
const { ethers } = require('ethers');
const cron = require('node-cron');

// 配置
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PREDICTION_MARKET_ADDRESS = process.env.PREDICTION_MARKET_ADDRESS;

// ABI（只需要用到的函数）
const MARKET_ABI = [
  'function getMarketCount() view returns (uint256)',
  'function getMarketInfo(uint256) view returns (tuple(string question, string category, string imageUrl, uint256 endTime, uint8 status, uint256 yesShares, uint256 noShares, uint256 liquidityPool, bool outcome, address creator))',
  'function resolveMarket(uint256 marketId, bool outcome)',
  'function owner() view returns (address)'
];

// 初始化
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const marketContract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, MARKET_ABI, wallet);

console.log('🔮 Oracle started!');
console.log(`📍 Contract: ${PREDICTION_MARKET_ADDRESS}`);
console.log(`👤 Oracle wallet: ${wallet.address}`);

// 检查并结算过期市场
async function checkAndResolveMarkets() {
  console.log(`\n⏰ [${new Date().toISOString()}] Checking markets...`);
  
  try {
    const marketCount = await marketContract.getMarketCount();
    console.log(`📊 Total markets: ${marketCount}`);
    
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 0; i < Number(marketCount); i++) {
      const info = await marketContract.getMarketInfo(i);
      const endTime = Number(info.endTime);
      const status = Number(info.status);
      
      // status: 0=Open, 1=Resolved, 2=Cancelled
      if (status === 0 && now > endTime) {
        console.log(`\n🎯 Market #${i} expired: "${info.question}"`);
        console.log(`   End time: ${new Date(endTime * 1000).toISOString()}`);
        
        // 这里需要你的逻辑来决定结果
        // 暂时跳过自动结算，只记录日志
        console.log(`   ⚠️ Needs manual resolution or API integration`);
        
        // 如果你想自动结算（需要接入数据源）：
        // const outcome = await fetchOutcomeFromAPI(info.question);
        // const tx = await marketContract.resolveMarket(i, outcome);
        // await tx.wait();
        // console.log(`   ✅ Resolved with outcome: ${outcome}`);
      }
    }
    
    console.log('✅ Check completed');
  } catch (error) {
    console.error('❌ Error checking markets:', error.message);
  }
}

// 每 5 分钟检查一次
cron.schedule('*/5 * * * *', checkAndResolveMarkets);

// 启动时立即检查一次
checkAndResolveMarkets();

// 保持进程运行
console.log('🔄 Oracle running... (checking every 5 minutes)');