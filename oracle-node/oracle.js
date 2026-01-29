require('dotenv').config();
const { ethers } = require('ethers');
const cron = require('node-cron');
const express = require('express');
const cors = require('cors');

// ============ Express API 服务器 ============
const app = express();
app.use(cors());
app.use(express.json());

// 内存存储
const commentsStore = new Map();

// ============ 合约 ABI ============
const PREDICTION_MARKET_ABI = [
  'function getMarketCount() view returns (uint256)',
  'function getMarketInfo(uint256 marketId) view returns (string question, string category, string imageUrl, uint256 endTime, uint8 status, uint8 numOutcomes, uint256 liquidityPool, uint8 winnerIndex, address creator)',
  'function getPrices(uint256 marketId) view returns (uint256[] prices)',
  'function resolveMarket(uint256 marketId, uint8 winnerIndex) external',
  'function owner() view returns (address)'
];

class AttentionOracle {
  constructor() {
    console.log('🔮 Initializing Oracle...');
    
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    this.predictionMarket = new ethers.Contract(
      process.env.PREDICTION_MARKET_ADDRESS, 
      PREDICTION_MARKET_ABI, 
      this.wallet
    );

    console.log(`📍 Prediction Market: ${process.env.PREDICTION_MARKET_ADDRESS}`);
    console.log(`👤 Oracle Wallet: ${this.wallet.address}`);
  }

  // ============ Prediction Market 功能 ============
  async checkAndResolveMarkets() {
    console.log('\n🎯 [Oracle] Checking prediction markets...');
    
    try {
      const count = await this.predictionMarket.getMarketCount();
      console.log(`   Found ${count} markets`);
      
      const now = Math.floor(Date.now() / 1000);

      for (let i = 0; i < Number(count); i++) {
        try {
          const info = await this.predictionMarket.getMarketInfo(i);
          const status = Number(info.status);
          const endTime = Number(info.endTime);
          
          if (status !== 0) continue;
          if (now <= endTime) continue;

          console.log(`\n   🔔 Market #${i} expired:`);
          console.log(`      Question: "${info.question}"`);
          console.log(`      End Time: ${new Date(endTime * 1000).toISOString()}`);
          console.log(`      ⚠️ Awaiting manual resolution`);
          
        } catch (error) {
          console.error(`   ❌ Error checking market ${i}:`, error.message);
        }
      }

      console.log(`\n   ✅ Check completed`);
    } catch (error) {
      console.error('❌ [Oracle] Market check failed:', error.message);
    }
  }

  // ============ 启动 API 服务 ============
  startAPIServer() {
    const PORT = process.env.PORT || 3001;

    // 健康检查
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        predictionMarket: process.env.PREDICTION_MARKET_ADDRESS,
      });
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
    console.log('\n🚀 Starting Prediction Market Oracle...\n');
    
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

    // 定时检查市场（每 10 分钟）
    cron.schedule('*/10 * * * *', () => {
      console.log('\n⏰ Scheduled: Checking markets...');
      this.checkAndResolveMarkets();
    });
    
    // 启动时立即执行
    console.log('🔄 Running initial check...\n');
    await this.checkAndResolveMarkets();
    
    console.log('\n✅ Oracle is running!');
    console.log('   📅 Market checks: Every 10 minutes');
    console.log('\n   Press Ctrl+C to stop.\n');
  }
}

// 启动
const oracle = new AttentionOracle();
oracle.start().catch(console.error);