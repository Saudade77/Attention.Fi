require('dotenv').config();
const { ethers } = require('ethers');
const cron = require('node-cron');
const express = require('express');
const cors = require('cors');

// ============ Express API 服务器 ============
const app = express();
app.use(cors());
app.use(express.json());

// 内存存储（生产环境应使用数据库）
const commentsStore = new Map(); // marketId -> comments[]

// ============ 合约 ABI ============
// PredictionMarketV3 ABI
const PREDICTION_MARKET_ABI = [
  'function getMarketCount() view returns (uint256)',
  'function getMarketInfo(uint256 marketId) view returns (string question, string category, string imageUrl, uint256 endTime, uint8 status, uint8 numOutcomes, uint256 liquidityPool, uint8 winnerIndex, address creator)',
  'function getPrices(uint256 marketId) view returns (uint256[] prices)',
  'function resolveMarket(uint256 marketId, uint8 winnerIndex) external',
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
    console.log('🔮 Initializing Oracle V3...');
    
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    this.predictionMarket = new ethers.Contract(
      process.env.PREDICTION_MARKET_ADDRESS, 
      PREDICTION_MARKET_ABI, 
      this.wallet
    );
    
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

  calculateEngagementScore(data) {
    if (!data) return 0;
    return Math.floor(
      data.followers * 1 + 
      data.tweets * 0.1 + 
      data.likes * 0.01
    );
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
    console.log('\n🎯 [Oracle] Checking prediction markets (V3)...');
    
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
          const numOutcomes = Number(info.numOutcomes);
          
          if (status !== 0) continue;
          if (now <= endTime) continue;

          console.log(`\n   🔔 Market #${i} expired and needs resolution:`);
          console.log(`      Question: "${info.question}"`);
          console.log(`      Category: ${info.category}`);
          console.log(`      Outcomes: ${numOutcomes}`);
          console.log(`      End Time: ${new Date(endTime * 1000).toISOString()}`);
          
          // 获取当前价格
          const prices = await this.predictionMarket.getPrices(i);
          console.log(`      Prices: ${prices.map(p => `${Number(p) / 100}%`).join(', ')}`);
          
          console.log(`      ⚠️ Awaiting manual resolution`);
          
        } catch (error) {
          console.error(`   ❌ Error checking market ${i}:`, error.message);
        }
      }

      console.log(`\n   ✅ Check completed. Resolved: ${resolvedCount} markets`);
    } catch (error) {
      console.error('❌ [Oracle] Market check failed:', error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ 启动 API 服务 ============
  startAPIServer() {
    const PORT = process.env.PORT || 3001;

    // 健康检查
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // 获取市场评论
    app.get('/api/market/:id/comments', (req, res) => {
      const marketId = parseInt(req.params.id);
      const comments = commentsStore.get(marketId) || [];
      res.json(comments);
    });

    // 发表评论
    app.post('/api/market/:id/comments', (req, res) => {
      const marketId = parseInt(req.params.id);
      const { content, user } = req.body;
      
      if (!content || !user) {
        return res.status(400).json({ error: 'Missing content or user' });
      }

      const comment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user,
        content: content.slice(0, 280),
        timestamp: Date.now()
      };

      if (!commentsStore.has(marketId)) {
        commentsStore.set(marketId, []);
      }
      commentsStore.get(marketId).push(comment);

      // 限制每个市场最多 100 条评论
      if (commentsStore.get(marketId).length > 100) {
        commentsStore.set(marketId, commentsStore.get(marketId).slice(-100));
      }

      res.json(comment);
    });

    app.listen(PORT, () => {
      console.log(`🌐 API Server running on port ${PORT}`);
    });
  }

  // ============ 启动 Oracle ============
  async start() {
    console.log('\n🚀 Starting Attention Oracle V3...\n');
    
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

    // 启动 API 服务
    this.startAPIServer();

    // 定时任务
    cron.schedule('0 * * * *', () => {
      console.log('\n⏰ Scheduled: Updating engagements...');
      this.updateAllEngagements();
    });
    
    cron.schedule('*/10 * * * *', () => {
      console.log('\n⏰ Scheduled: Checking markets...');
      this.checkAndResolveMarkets();
    });
    
    // 启动时立即执行
    console.log('🔄 Running initial checks...\n');
    await this.checkAndResolveMarkets();
    await this.updateAllEngagements();
    
    console.log('\n✅ Oracle V3 is running!');
    console.log('   📅 Engagement updates: Every hour');
    console.log('   📅 Market checks: Every 10 minutes');
    console.log('\n   Press Ctrl+C to stop.\n');
  }
}

// 启动
const oracle = new AttentionOracle();
oracle.start().catch(console.error);