// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PredictionMarketV2 - Polymarket-style prediction market
/// @notice 使用 USDC 结算 + CPMM 定价模型
contract PredictionMarketV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 结构体 ============
    struct Market {
        string question;
        string imageUrl;        // 市场图片
        string category;        // 分类：crypto, politics, sports, etc.
        uint256 endTime;
        uint256 resolutionTime; // 实际解决时间
        MarketStatus status;
        uint256 yesShares;      // Yes 份额总量
        uint256 noShares;       // No 份额总量
        uint256 liquidityPool;  // 流动性池 USDC 总量
        bool outcome;           // 结果：true = Yes 赢
        address creator;        // 创建者
        uint256 creatorFee;     // 创建者费用 (basis points, 100 = 1%)
    }

    enum MarketStatus { Open, Resolved, Cancelled }

    // ============ 状态变量 ============
    IERC20 public immutable usdc;
    
    Market[] public markets;
    
    // marketId => user => yes shares
    mapping(uint256 => mapping(address => uint256)) public yesBalances;
    // marketId => user => no shares
    mapping(uint256 => mapping(address => uint256)) public noBalances;
    // marketId => user => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;
    
    // 平台费用 (basis points)
    uint256 public platformFee = 100; // 1%
    uint256 public accumulatedFees;
    
    // 常量
    uint256 public constant MIN_LIQUIDITY = 10 * 10**6;  // 最小 10 USDC
    uint256 public constant SHARE_PRECISION = 10**18;
    uint256 public constant BASIS_POINTS = 10000;

    // ============ 事件 ============
    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string category,
        uint256 endTime,
        uint256 initialLiquidity
    );
    event SharesPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isYes,
        uint256 usdcAmount,
        uint256 sharesReceived,
        uint256 newYesPrice,
        uint256 newNoPrice
    );
    event SharesSold(
        uint256 indexed marketId,
        address indexed seller,
        bool isYes,
        uint256 sharesAmount,
        uint256 usdcReceived
    );
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 amount);

    // ============ 构造函数 ============
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    // ============ 创建市场 ============
    /// @notice 创建新的预测市场
    /// @param question 预测问题
    /// @param category 分类
    /// @param imageUrl 图片 URL
    /// @param duration 持续时间（秒）
    /// @param initialLiquidity 初始流动性（USDC）
    /// @param creatorFee 创建者费用（basis points）
    function createMarket(
        string calldata question,
        string calldata category,
        string calldata imageUrl,
        uint256 duration,
        uint256 initialLiquidity,
        uint256 creatorFee
    ) external onlyOwner returns (uint256 marketId) {
        require(bytes(question).length > 0, "Empty question");
        require(duration >= 1 hours, "Duration too short");
        require(duration <= 365 days, "Duration too long");
        require(initialLiquidity >= MIN_LIQUIDITY, "Insufficient initial liquidity");
        require(creatorFee <= 500, "Creator fee too high"); // 最多 5%

        // 转入初始流动性
        usdc.safeTransferFrom(msg.sender, address(this), initialLiquidity);

        marketId = markets.length;
        
        // 初始 50/50 价格：各给一半流动性
        uint256 initialShares = initialLiquidity * SHARE_PRECISION / 10**6;
        
        markets.push(Market({
            question: question,
            imageUrl: imageUrl,
            category: category,
            endTime: block.timestamp + duration,
            resolutionTime: 0,
            status: MarketStatus.Open,
            yesShares: initialShares,
            noShares: initialShares,
            liquidityPool: initialLiquidity,
            outcome: false,
            creator: msg.sender,
            creatorFee: creatorFee
        }));

        emit MarketCreated(marketId, question, category, block.timestamp + duration, initialLiquidity);
    }

    // ============ CPMM 定价 ============
    /// @notice 获取当前价格（以 cents 为单位，100 = $1）
    function getPrice(uint256 marketId) public view returns (uint256 yesPrice, uint256 noPrice) {
        Market storage m = markets[marketId];
        uint256 total = m.yesShares + m.noShares;
        
        if (total == 0) {
            return (50, 50);
        }
        
        // Yes 价格 = No 份额 / 总份额 (因为买 Yes 会减少 No 的相对占比)
        // 使用 CPMM: price = other_shares / total_shares
        yesPrice = (m.noShares * 100) / total;
        noPrice = (m.yesShares * 100) / total;
        
        // 确保价格在 1-99 范围内
        if (yesPrice == 0) yesPrice = 1;
        if (noPrice == 0) noPrice = 1;
        if (yesPrice > 99) yesPrice = 99;
        if (noPrice > 99) noPrice = 99;
    }

    /// @notice 计算购买份额所需的 USDC
    function getBuyPrice(
        uint256 marketId,
        bool isYes,
        uint256 sharesWanted
    ) public view returns (uint256 usdcRequired) {
        Market storage m = markets[marketId];
        
        uint256 yesReserve = m.yesShares;
        uint256 noReserve = m.noShares;
        
        // CPMM 公式: x * y = k
        // 买入 Yes 份额 = 从 No 储备中取出
        // usdcRequired = (shares * otherReserve) / (otherReserve - shares)
        
        if (isYes) {
            require(sharesWanted < noReserve, "Insufficient liquidity");
            // 买 Yes: 消耗 No 储备
            usdcRequired = (sharesWanted * yesReserve) / (noReserve - sharesWanted);
        } else {
            require(sharesWanted < yesReserve, "Insufficient liquidity");
            // 买 No: 消耗 Yes 储备
            usdcRequired = (sharesWanted * noReserve) / (yesReserve - sharesWanted);
        }
        
        // 转换为 USDC 单位 (6 decimals)
        usdcRequired = (usdcRequired * 10**6) / SHARE_PRECISION;
        
        // 添加费用
        uint256 totalFee = platformFee + markets[marketId].creatorFee;
        usdcRequired = (usdcRequired * (BASIS_POINTS + totalFee)) / BASIS_POINTS;
    }

    /// @notice 计算给定 USDC 能买到的份额
    function getSharesForUSDC(
        uint256 marketId,
        bool isYes,
        uint256 usdcAmount
    ) public view returns (uint256 shares) {
        Market storage m = markets[marketId];
        
        // 扣除费用
        uint256 totalFee = platformFee + m.creatorFee;
        uint256 usdcAfterFee = (usdcAmount * BASIS_POINTS) / (BASIS_POINTS + totalFee);
        
        // 转换为份额单位
        uint256 usdcInShares = (usdcAfterFee * SHARE_PRECISION) / 10**6;
        
        uint256 yesReserve = m.yesShares;
        uint256 noReserve = m.noShares;
        
        // CPMM: shares = (usdcInShares * otherReserve) / (thisReserve + usdcInShares)
        if (isYes) {
            shares = (usdcInShares * noReserve) / (yesReserve + usdcInShares);
        } else {
            shares = (usdcInShares * yesReserve) / (noReserve + usdcInShares);
        }
    }

    // ============ 交易功能 ============
    /// @notice 购买份额
    function buyShares(
        uint256 marketId,
        bool isYes,
        uint256 usdcAmount,
        uint256 minShares
    ) external nonReentrant returns (uint256 shares) {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Open, "Market not open");
        require(block.timestamp < m.endTime, "Market ended");
        require(usdcAmount > 0, "Zero amount");

        // 计算份额
        shares = getSharesForUSDC(marketId, isYes, usdcAmount);
        require(shares >= minShares, "Slippage too high");

        // 收取费用
        uint256 totalFee = platformFee + m.creatorFee;
        uint256 feeAmount = (usdcAmount * totalFee) / (BASIS_POINTS + totalFee);
        uint256 creatorFeeAmount = (feeAmount * m.creatorFee) / totalFee;
        uint256 platformFeeAmount = feeAmount - creatorFeeAmount;

        // 转入 USDC
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // 分配费用
        if (creatorFeeAmount > 0) {
            usdc.safeTransfer(m.creator, creatorFeeAmount);
        }
        accumulatedFees += platformFeeAmount;

        // 更新储备
        uint256 netAmount = usdcAmount - feeAmount;
        m.liquidityPool += netAmount;
        
        if (isYes) {
            m.yesShares += (netAmount * SHARE_PRECISION) / 10**6;
            m.noShares -= shares;
            yesBalances[marketId][msg.sender] += shares;
        } else {
            m.noShares += (netAmount * SHARE_PRECISION) / 10**6;
            m.yesShares -= shares;
            noBalances[marketId][msg.sender] += shares;
        }

        (uint256 newYesPrice, uint256 newNoPrice) = getPrice(marketId);
        
        emit SharesPurchased(
            marketId,
            msg.sender,
            isYes,
            usdcAmount,
            shares,
            newYesPrice,
            newNoPrice
        );
    }

    /// @notice 卖出份额
    function sellShares(
        uint256 marketId,
        bool isYes,
        uint256 sharesAmount,
        uint256 minUSDC
    ) external nonReentrant returns (uint256 usdcOut) {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Open, "Market not open");
        require(sharesAmount > 0, "Zero amount");

        if (isYes) {
            require(yesBalances[marketId][msg.sender] >= sharesAmount, "Insufficient balance");
            yesBalances[marketId][msg.sender] -= sharesAmount;
        } else {
            require(noBalances[marketId][msg.sender] >= sharesAmount, "Insufficient balance");
            noBalances[marketId][msg.sender] -= sharesAmount;
        }

        // 计算返还的 USDC (反向 CPMM)
        uint256 yesReserve = m.yesShares;
        uint256 noReserve = m.noShares;
        
        if (isYes) {
            usdcOut = (sharesAmount * yesReserve) / (noReserve + sharesAmount);
            m.noShares += sharesAmount;
            m.yesShares -= (usdcOut * SHARE_PRECISION) / 10**6;
        } else {
            usdcOut = (sharesAmount * noReserve) / (yesReserve + sharesAmount);
            m.yesShares += sharesAmount;
            m.noShares -= (usdcOut * SHARE_PRECISION) / 10**6;
        }

        // 转换为 USDC
        usdcOut = (usdcOut * 10**6) / SHARE_PRECISION;
        
        // 扣除费用
        uint256 fee = (usdcOut * platformFee) / BASIS_POINTS;
        usdcOut -= fee;
        accumulatedFees += fee;

        require(usdcOut >= minUSDC, "Slippage too high");
        require(usdcOut <= m.liquidityPool, "Insufficient liquidity");

        m.liquidityPool -= usdcOut;
        usdc.safeTransfer(msg.sender, usdcOut);

        emit SharesSold(marketId, msg.sender, isYes, sharesAmount, usdcOut);
    }

    // ============ 解决市场 ============
    /// @notice 解决市场（仅 Owner）
    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Open, "Market not open");
        require(block.timestamp >= m.endTime, "Market not ended");

        m.status = MarketStatus.Resolved;
        m.outcome = outcome;
        m.resolutionTime = block.timestamp;

        emit MarketResolved(marketId, outcome);
    }

    /// @notice 取消市场（仅 Owner）
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Open, "Market not open");
        
        m.status = MarketStatus.Cancelled;
    }

    // ============ 领取奖励 ============
    /// @notice 领取赢得的 USDC
    function claimWinnings(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Resolved, "Market not resolved");
        require(!claimed[marketId][msg.sender], "Already claimed");

        uint256 winningShares;
        uint256 totalWinningShares;

        if (m.outcome) {
            winningShares = yesBalances[marketId][msg.sender];
            totalWinningShares = m.yesShares;
        } else {
            winningShares = noBalances[marketId][msg.sender];
            totalWinningShares = m.noShares;
        }

        require(winningShares > 0, "No winning shares");

        // 按比例计算收益
        payout = (winningShares * m.liquidityPool) / totalWinningShares;
        
        claimed[marketId][msg.sender] = true;
        usdc.safeTransfer(msg.sender, payout);

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /// @notice 取消的市场退款
    function claimRefund(uint256 marketId) external nonReentrant returns (uint256 refund) {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Cancelled, "Market not cancelled");
        require(!claimed[marketId][msg.sender], "Already claimed");

        uint256 yesShares = yesBalances[marketId][msg.sender];
        uint256 noShares = noBalances[marketId][msg.sender];
        uint256 totalUserShares = yesShares + noShares;
        
        require(totalUserShares > 0, "No shares to refund");

        uint256 totalShares = m.yesShares + m.noShares;
        refund = (totalUserShares * m.liquidityPool) / totalShares;

        claimed[marketId][msg.sender] = true;
        usdc.safeTransfer(msg.sender, refund);
    }

    // ============ 查询函数 ============
    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getMarketInfo(uint256 marketId) external view returns (
        string memory question,
        string memory category,
        string memory imageUrl,
        uint256 endTime,
        MarketStatus status,
        uint256 yesShares,
        uint256 noShares,
        uint256 liquidityPool,
        bool outcome,
        address creator
    ) {
        Market storage m = markets[marketId];
        return (
            m.question,
            m.category,
            m.imageUrl,
            m.endTime,
            m.status,
            m.yesShares,
            m.noShares,
            m.liquidityPool,
            m.outcome,
            m.creator
        );
    }

    function getUserPosition(uint256 marketId, address user) external view returns (
        uint256 yesShares,
        uint256 noShares,
        bool hasClaimed
    ) {
        return (
            yesBalances[marketId][user],
            noBalances[marketId][user],
            claimed[marketId][user]
        );
    }

    // ============ Admin ============
    function withdrawFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        usdc.safeTransfer(owner(), amount);
    }

    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 500, "Fee too high"); // 最多 5%
        platformFee = _fee;
    }
}