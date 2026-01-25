require('dotenv').config();
const { ethers } = require('ethers');
const cron = require('node-cron');

// ============ 合约 ABI ============
// PredictionMarketV2 ABI
const PREDICTION_MARKET_ABI = [
  'function getMarketCount() view returns (uint256)',
  'function getMarketInfo(uint256 marketId) view returns (tuple(string question, string category, string imageUrl, uint256 endTime, uint8 status, uint256 yesShares, uint256 noShares, uint256 liquidityPool, bool outcome, address creator))',
  'function resolveMarket(uint256 marketId, bool outcome) external',
  'function owner() view returns (address)'
];

// CreatorMarket ABI
const CREATOR_MARKET_ABI = [
  'function getCreatorCount() view returns (uint256)',
  'function creators(uint256 index) view returns (tuple(string handle, string name, string avatar, uint256 totalShares, uint256 lastPrice, uint256 lastEngagement, uint256 lastUpdateTime, bool isActive))',
  'function batchUpdateEngagement(string[] handles, uint256[] scores) external',
  'function owner() view returns (address)'
];

class AttentionOracle {
  constructor() {
    console.log('🔮 Initializing Oracle...');
    
    // 初始化 Provider 和 Wallet
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    // 初始化合约
    this.predictionMarket = new ethers.Contract(
      process.env.PREDICTION_MARKET_ADDRESS, 
      PREDICTION_MARKET_ABI, 
      this.wallet
    );
    
    // CreatorMarket 是可选的
    if (process.env.CREATOR_MARKET_ADDRESS) {
      this.creatorMarket = new ethers.Contract(
        process.env.CREATOR_MARKET_ADDRESS, 
        CREATOR_MARKET_ABI, 
        this.wallet
      );
    }

    console.log(`📍 Prediction Market: ${process.env.PREDICTION_MARKET_ADDRESS}`);
    console.log(`📍 Creator Market: ${process.env.CREATOR_MARKET_ADDRESS || 'Not configured'}`);
    console.log(`👤 Oracle Wallet: ${this.wallet.address}`);
  }

  // ============ Twitter API ============
  async fetchTwitterData(handle) {
    try {
      // 移除 @ 符号
      const cleanHandle = handle.replace('@', '');
      
      const response = await fetch(
        `https://twitter241.p.rapidapi.com/user?username=${cleanHandle}`,
        {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': process.env.RAPIDAPI_HOST || 'twitter241.p.rapidapi.com',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.result?.legacy) {
        const user = data.result.legacy;
        return {
          followers: user.followers_count || 0,
          following: user.friends_count || 0,
          tweets: user.statuses_count || 0,
          likes: user.favourites_count || 0,
        };
      }
      
      return null;
    } catch (error) {
      console.error(`   ❌ Failed to fetch @${handle}:`, error.message);
      return null;
    }
  }

  // 计算互动分数
  calculateEngagementScore(data) {
    if (!data) return 0;
    
    // 算法：粉丝数 * 1 + 推文数 * 0.1 + 点赞数 * 0.01
    // 可以根据需要调整权重
    const score = Math.floor(
      data.followers * 1 + 
      data.tweets * 0.1 + 
      data.likes * 0.01
    );
    
    return score;
  }

  // ============ Creator Market 功能 ============
  async updateAllEngagements() {
    if (!this.creatorMarket) {
      console.log('[Oracle] Creator Market not configured, skipping...');
      return;
    }

    console.log('\n📊 [Oracle] Updating engagement scores...');
    
    try {
      const count = await this.creatorMarket.getCreatorCount();
      console.log(`   Found ${count} creators`);
      
      const handles = [];
      const scores = [];

      for (let i = 0; i < Number(count); i++) {
        try {
          const creator = await this.creatorMarket.creators(i);
          const handle = creator.handle;
          
          if (!creator.isActive) {
            console.log(`   ⏭️ Skipping inactive creator: @${handle}`);
            continue;
          }

          const twitterData = await this.fetchTwitterData(handle);
          const score = this.calculateEngagementScore(twitterData);
          
          handles.push(handle);
          scores.push(score);
          
          console.log(`   ✅ @${handle}: ${score} (followers: ${twitterData?.followers || 0})`);
          
          // 避免 API 限流，每次请求间隔 1.5 秒
          await this.sleep(1500);
        } catch (error) {
          console.error(`   ❌ Error processing creator ${i}:`, error.message);
        }
      }

      if (handles.length > 0) {
        console.log(`   📤 Submitting ${handles.length} updates to blockchain...`);
        const tx = await this.creatorMarket.batchUpdateEngagement(handles, scores);
        const receipt = await tx.wait();
        console.log(`   ✅ Updated! Tx: ${receipt.hash}`);
      } else {
        console.log('   ℹ️ No creators to update');
      }
    } catch (error) {
      console.error('❌ [Oracle] Engagement update failed:', error.message);
    }
  }

  // ============ Prediction Market 功能 ============
  async checkAndResolveMarkets() {
    console.log('\n🎯 [Oracle] Checking prediction markets...');
    
    try {
      const count = await this.predictionMarket.getMarketCount();
      console.log(`   Found ${count} markets`);
      
      const now = Math.floor(Date.now() / 1000);
      let resolvedCount = 0;

      for (let i = 0; i < Number(count); i++) {
        try {
          const info = await this.predictionMarket.getMarketInfo(i);
          const status = Number(info.status);
          const endTime = Number(info.endTime);
          
          // status: 0=Open, 1=Resolved, 2=Cancelled
          if (status !== 0) {
            continue; // 跳过已结算/取消的市场
          }
          
          if (now <= endTime) {
            continue; // 跳过未到期的市场
          }

          console.log(`\n   🔔 Market #${i} expired and needs resolution:`);
          console.log(`      Question: "${info.question}"`);
          console.log(`      Category: ${info.category}`);
          console.log(`      End Time: ${new Date(endTime * 1000).toISOString()}`);
          console.log(`      Yes Shares: ${ethers.formatUnits(info.yesShares, 6)}`);
          console.log(`      No Shares: ${ethers.formatUnits(info.noShares, 6)}`);

          // ⚠️ 自动结算逻辑
          // 目前需要手动结算或接入数据源
          // 以下是示例代码（取消注释后启用）：
          
          /*
          // 方法1：基于 Twitter 粉丝增长判断
          if (info.category === 'Creator Growth') {
            const outcome = await this.resolveCreatorGrowthMarket(info.question);
            if (outcome !== null) {
              const tx = await this.predictionMarket.resolveMarket(i, outcome);
              await tx.wait();
              console.log(`      ✅ Resolved as: ${outcome ? 'YES' : 'NO'}`);
              resolvedCount++;
            }
          }
          */
          
          console.log(`      ⚠️ Awaiting manual resolution or API integration`);
          
        } catch (error) {
          console.error(`   ❌ Error checking market ${i}:`, error.message);
        }
      }

      console.log(`\n   ✅ Check completed. Resolved: ${resolvedCount} markets`);
    } catch (error) {
      console.error('❌ [Oracle] Market check failed:', error.message);
    }
  }

  // 示例：解析 Creator Growth 类型的市场
  async resolveCreatorGrowthMarket(question) {
    // 从问题中提取 handle 和目标粉丝数
    // 例如: "Will @elonmusk reach 200M followers by end of month?"
    const handleMatch = question.match(/@(\w+)/);
    const targetMatch = question.match(/(\d+(?:\.\d+)?)\s*[MKmk]?\s*followers/i);
    
    if (!handleMatch || !targetMatch) {
      console.log('      ⚠️ Could not parse question');
      return null;
    }

    const handle = handleMatch[1];
    let target = parseFloat(targetMatch[1]);
    
    // 处理 M/K 后缀
    if (targetMatch[0].toLowerCase().includes('m')) {
      target *= 1000000;
    } else if (targetMatch[0].toLowerCase().includes('k')) {
      target *= 1000;
    }

    const twitterData = await this.fetchTwitterData(handle);
    if (!twitterData) {
      console.log('      ⚠️ Could not fetch Twitter data');
      return null;
    }

    console.log(`      📊 @${handle} has ${twitterData.followers} followers (target: ${target})`);
    return twitterData.followers >= target;
  }

  // 工具函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ 启动 Oracle ============
  async start() {
    console.log('\n🚀 Starting Attention Oracle...\n');
    
    // 验证配置
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`💰 Oracle wallet balance: ${ethers.formatEther(balance)} ETH`);
      
      if (balance === 0n) {
        console.warn('⚠️ Warning: Oracle wallet has no ETH for gas fees!');
      }
    } catch (error) {
      console.error('❌ Failed to connect to RPC:', error.message);
      return;
    }

    // 定时任务
    // 每小时更新一次 Creator 互动分数
    cron.schedule('0 * * * *', () => {
      console.log('\n⏰ Scheduled: Updating engagements...');
      this.updateAllEngagements();
    });
    
    // 每 10 分钟检查一次市场结算
    cron.schedule('*/10 * * * *', () => {
      console.log('\n⏰ Scheduled: Checking markets...');
      this.checkAndResolveMarkets();
    });
    
    // 启动时立即执行一次
    console.log('🔄 Running initial checks...\n');
    await this.checkAndResolveMarkets();
    await this.updateAllEngagements();
    
    console.log('\n✅ Oracle is running!');
    console.log('   📅 Engagement updates: Every hour (at :00)');
    console.log('   📅 Market checks: Every 10 minutes');
    console.log('\n   Press Ctrl+C to stop.\n');
  }
}

// 启动
const oracle = new AttentionOracle();
oracle.start().catch(console.error);