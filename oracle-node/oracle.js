require('dotenv').config();
const { ethers } = require('ethers');
const cron = require('node-cron');

const ABI = [
  'function batchUpdateEngagement(string[] handles, uint256[] scores) external',
  'function resolveMarket(uint256 marketId, uint8 outcome) external',
  'function getCreatorCount() view returns (uint256)',
  'function getCreatorByIndex(uint256 index) view returns (string)',
  'function marketCount() view returns (uint256)',
  'function getMarketInfo(uint256 marketId) view returns (string, string, uint256, uint8, uint256, uint256, uint256)',
];

class AttentionOracle {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, this.wallet);
  }

  // 获取 Twitter 数据计算互动分数
  async fetchEngagementScore(handle) {
    try {
      const response = await fetch(
        `https://twitter-api45.p.rapidapi.com/screenname.php?screenname=${handle}`,
        {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com',
          },
        }
      );
      
      const data = await response.json();
      
      // 简单的互动分数算法：粉丝数 + 推文数 * 10
      const score = Math.floor(data.followers_count + data.statuses_count * 10);
      return score;
    } catch (error) {
      console.error(`Failed to fetch ${handle}:`, error.message);
      return 0;
    }
  }

  // 批量更新互动分数
  async updateAllEngagements() {
    console.log('[Oracle] Updating engagement scores...');
    
    try {
      const count = await this.contract.getCreatorCount();
      const handles = [];
      const scores = [];

      for (let i = 0; i < count; i++) {
        const handle = await this.contract.getCreatorByIndex(i);
        const score = await this.fetchEngagementScore(handle);
        
        handles.push(handle);
        scores.push(score);
        
        console.log(`  ${handle}: ${score}`);
        
        // 避免 API 限流
        await new Promise(r => setTimeout(r, 1000));
      }

      if (handles.length > 0) {
        const tx = await this.contract.batchUpdateEngagement(handles, scores);
        await tx.wait();
        console.log(`[Oracle] Updated ${handles.length} creators`);
      }
    } catch (error) {
      console.error('[Oracle] Update failed:', error.message);
    }
  }

  // 检查并结算到期的预测市场
  async checkAndResolveMarkets() {
    console.log('[Oracle] Checking markets for resolution...');
    
    try {
      const count = await this.contract.marketCount();
      const now = Math.floor(Date.now() / 1000);

      for (let i = 0; i < count; i++) {
        const info = await this.contract.getMarketInfo(i);
        const status = Number(info[3]);
        const endTime = Number(info[2]);
        
        // 跳过已结算的
        if (status !== 0) continue;
        
        // 跳过未到期的
        if (now < endTime) continue;

        console.log(`  Market ${i} is ready for resolution`);
        
        // 这里需要实际的结算逻辑
        // 例如：检查 Twitter 数据判断 Yes/No
        // 简化示例：随机结算
        const outcome = Math.random() > 0.5 ? 1 : 2; // 1=Yes, 2=No
        
        const tx = await this.contract.resolveMarket(i, outcome);
        await tx.wait();
        console.log(`  Market ${i} resolved: ${outcome === 1 ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.error('[Oracle] Resolution check failed:', error.message);
    }
  }

  start() {
    console.log('[Oracle] Starting...');
    
    // 每小时更新互动分数
    cron.schedule('0 * * * *', () => this.updateAllEngagements());
    
    // 每 10 分钟检查市场结算
    cron.schedule('*/10 * * * *', () => this.checkAndResolveMarkets());
    
    // 启动时立即执行一次
    this.updateAllEngagements();
    this.checkAndResolveMarkets();
  }
}

const oracle = new AttentionOracle();
oracle.start();