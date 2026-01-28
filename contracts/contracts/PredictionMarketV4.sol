// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./libraries/LMSR.sol";

/**
 * @title PredictionMarketV4 - LMSR + CPMM 双算法预测市场
 * @notice 支持 LMSR（对数市场评分规则）和 CPMM（恒定乘积）两种定价算法
 * @dev 升级点：
 *      1. 新增 LMSR 算法选项，提供更稳定的价格发现
 *      2. 市场创建时可选择算法类型
 *      3. LMSR 的 b 参数可调，控制流动性深度
 */
contract PredictionMarketV4 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 枚举 ============
    enum PricingAlgorithm {
        CPMM,   // 恒定乘积做市商（原算法）
        LMSR    // 对数市场评分规则（新算法）
    }

    // ============ 结构体 ============
    struct Market {
        string question;
        string imageUrl;
        string category;
        uint256 endTime;
        uint256 resolutionTime;
        uint8 status;           // 0=Open, 1=Resolved, 2=Cancelled, 3=Deleted
        uint8 numOutcomes;
        uint8 winnerIndex;
        uint256 liquidityPool;
        address creator;
        uint256 creatorFee;
        PricingAlgorithm algorithm;
        uint256 lmsrB;          // LMSR 流动性参数
    }

    struct LimitOrder {
        uint256 id;
        uint256 marketId;
        address user;
        uint8 outcomeIndex;
        uint256 shares;
        uint256 price;          // basis points (100 = 1%)
        uint256 usdcDeposit;
        uint256 timestamp;
        bool isBuy;
        uint8 status;           // 0=Active, 1=Filled, 2=Cancelled
    }

    struct PricePoint {
        uint256 timestamp;
        uint256[] prices;
    }

    // ============ 状态变量 ============
    IERC20 public immutable usdc;
    
    Market[] public markets;
    mapping(uint256 => string[]) public outcomeLabels;
    mapping(uint256 => uint256[]) public outcomeShares;
    
    LimitOrder[] public orders;
    
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public userShares;
    mapping(uint256 => mapping(address => bool)) public claimed;
    
    mapping(uint256 => mapping(uint8 => uint256[])) public marketBuyOrders;
    mapping(uint256 => mapping(uint8 => uint256[])) public marketSellOrders;
    mapping(address => uint256[]) public userOrderIds;
    
    mapping(uint256 => PricePoint[]) public priceHistory;
    
    uint256 public platformFee = 100;
    uint256 public accumulatedFees;
    
    uint256 public constant MIN_LIQUIDITY = 10 * 10**6;
    uint256 public constant SHARE_PRECISION = 10**18;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant DEFAULT_LMSR_B = 100 * 10**18; // 默认 LMSR 参数

    // ============ 事件 ============
    event MarketCreated(uint256 indexed marketId, string question, uint8 numOutcomes, uint8 algorithm);
    event MarketDeleted(uint256 indexed marketId);
    event SharesPurchased(uint256 indexed marketId, address indexed buyer, uint8 outcomeIndex, uint256 usdcAmount, uint256 shares);
    event SharesSold(uint256 indexed marketId, address indexed seller, uint8 outcomeIndex, uint256 shares, uint256 usdcOut);
    event OrderPlaced(uint256 indexed marketId, uint256 indexed orderId, address user, uint8 outcomeIndex, bool isBuy, uint256 shares, uint256 price);
    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(uint256 indexed orderId, uint256 filledShares);
    event MarketResolved(uint256 indexed marketId, uint8 winnerIndex);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    // ============ 构造函数 ============
    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC");
        usdc = IERC20(_usdc);
    }

    // ============ 创建市场 ============
    
    /// @notice 创建市场（默认使用 CPMM 算法，向后兼容）
    function createMarket(
        string calldata question,
        string calldata category,
        string calldata imageUrl,
        uint256 duration,
        uint256 initialLiquidity,
        uint256 creatorFee,
        string[] calldata _outcomeLabels
    ) external onlyOwner returns (uint256 marketId) {
        return _createMarket(
            question,
            category,
            imageUrl,
            duration,
            initialLiquidity,
            creatorFee,
            _outcomeLabels,
            PricingAlgorithm.CPMM,
            DEFAULT_LMSR_B
        );
    }
    
    /// @notice 创建市场（指定算法）
    /// @param algorithm 0 = CPMM, 1 = LMSR
    /// @param lmsrB LMSR 流动性参数（仅 LMSR 有效），越大滑点越小
    function createMarketWithAlgorithm(
        string calldata question,
        string calldata category,
        string calldata imageUrl,
        uint256 duration,
        uint256 initialLiquidity,
        uint256 creatorFee,
        string[] calldata _outcomeLabels,
        uint8 algorithm,
        uint256 lmsrB
    ) external onlyOwner returns (uint256 marketId) {
        require(algorithm <= 1, "Invalid algorithm");
        
        return _createMarket(
            question,
            category,
            imageUrl,
            duration,
            initialLiquidity,
            creatorFee,
            _outcomeLabels,
            PricingAlgorithm(algorithm),
            lmsrB > 0 ? lmsrB : DEFAULT_LMSR_B
        );
    }
    
    /// @notice 内部创建市场函数
    function _createMarket(
        string calldata question,
        string calldata category,
        string calldata imageUrl,
        uint256 duration,
        uint256 initialLiquidity,
        uint256 creatorFee,
        string[] calldata _outcomeLabels,
        PricingAlgorithm algorithm,
        uint256 lmsrB
    ) internal returns (uint256 marketId) {
        uint8 numOutcomes = uint8(_outcomeLabels.length);
        require(numOutcomes >= 2 && numOutcomes <= 10, "2-10 outcomes");
        require(bytes(question).length > 0, "Empty question");
        require(duration >= 1 hours && duration <= 365 days, "Invalid duration");
        require(initialLiquidity >= MIN_LIQUIDITY, "Min liquidity");
        require(creatorFee <= 500, "Fee too high");

        usdc.safeTransferFrom(msg.sender, address(this), initialLiquidity);

        marketId = markets.length;
        
        markets.push(Market({
            question: question,
            imageUrl: imageUrl,
            category: category,
            endTime: block.timestamp + duration,
            resolutionTime: 0,
            status: 0,
            numOutcomes: numOutcomes,
            winnerIndex: 0,
            liquidityPool: initialLiquidity,
            creator: msg.sender,
            creatorFee: creatorFee,
            algorithm: algorithm,
            lmsrB: lmsrB
        }));

        // 初始化份额 - 均匀分配
        uint256 sharesPerOutcome = (initialLiquidity * SHARE_PRECISION / 10**6) / numOutcomes;
        for (uint8 i = 0; i < numOutcomes; i++) {
            outcomeLabels[marketId].push(_outcomeLabels[i]);
            outcomeShares[marketId].push(sharesPerOutcome);
        }

        _recordPrice(marketId);

        emit MarketCreated(marketId, question, numOutcomes, uint8(algorithm));
    }

    // ============ 删除市场 ============
    function deleteMarket(uint256 marketId) external onlyOwner {
        require(marketId < markets.length, "Invalid market");
        Market storage m = markets[marketId];
        require(m.status == 0 || m.status == 2, "Cannot delete resolved market");
        
        m.status = 3;
        
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            uint256[] storage buyOrderIds = marketBuyOrders[marketId][i];
            for (uint256 j = 0; j < buyOrderIds.length; j++) {
                LimitOrder storage order = orders[buyOrderIds[j]];
                if (order.status == 0) {
                    order.status = 2;
                    if (order.usdcDeposit > 0) {
                        usdc.safeTransfer(order.user, order.usdcDeposit);
                    }
                }
            }
            
            uint256[] storage sellOrderIds = marketSellOrders[marketId][i];
            for (uint256 j = 0; j < sellOrderIds.length; j++) {
                LimitOrder storage order = orders[sellOrderIds[j]];
                if (order.status == 0) {
                    order.status = 2;
                    userShares[marketId][order.outcomeIndex][order.user] += order.shares;
                }
            }
        }
        
        if (m.liquidityPool > 0) {
            uint256 refund = m.liquidityPool;
            m.liquidityPool = 0;
            usdc.safeTransfer(m.creator, refund);
        }
        
        emit MarketDeleted(marketId);
    }

    // ============ 价格计算 ============
    
    /// @notice 获取所有选项的价格
    function getPrices(uint256 marketId) public view returns (uint256[] memory prices) {
        Market storage m = markets[marketId];
        
        if (m.algorithm == PricingAlgorithm.LMSR) {
            return _getLMSRPrices(marketId);
        } else {
            return _getCPMMPrices(marketId);
        }
    }
    
    /// @notice CPMM 价格计算（原算法）
    function _getCPMMPrices(uint256 marketId) internal view returns (uint256[] memory prices) {
        Market storage m = markets[marketId];
        prices = new uint256[](m.numOutcomes);
        
        uint256 totalShares = 0;
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            totalShares += outcomeShares[marketId][i];
        }
        
        if (totalShares == 0) {
            uint256 equalPrice = BASIS_POINTS / m.numOutcomes;
            for (uint8 i = 0; i < m.numOutcomes; i++) {
                prices[i] = equalPrice;
            }
            return prices;
        }
        
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            prices[i] = (outcomeShares[marketId][i] * BASIS_POINTS) / totalShares;
            if (prices[i] < 100) prices[i] = 100;
            if (prices[i] > 9900) prices[i] = 9900;
        }
    }
    
    /// @notice LMSR 价格计算
    function _getLMSRPrices(uint256 marketId) internal view returns (uint256[] memory) {
        Market storage m = markets[marketId];
        uint256[] memory shares = outcomeShares[marketId];
        return LMSR.getPrices(shares, m.lmsrB);
    }

    function getPrice(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice) {
        uint256[] memory prices = getPrices(marketId);
        yesPrice = prices[0];
        noPrice = prices.length > 1 ? prices[1] : BASIS_POINTS - prices[0];
    }
    
    /// @notice 获取市场算法类型
    function getMarketAlgorithm(uint256 marketId) external view returns (uint8 algorithm, uint256 lmsrB) {
        Market storage m = markets[marketId];
        return (uint8(m.algorithm), m.lmsrB);
    }

    // ============ 价格历史 ============
    function _recordPrice(uint256 marketId) internal {
        uint256[] memory prices = getPrices(marketId);
        priceHistory[marketId].push(PricePoint({
            timestamp: block.timestamp,
            prices: prices
        }));
    }

    function getPriceHistory(uint256 marketId) external view returns (
        uint256[] memory timestamps,
        uint256[][] memory prices
    ) {
        require(marketId < markets.length, "Invalid market");
        
        PricePoint[] storage points = priceHistory[marketId];
        
        if (points.length == 0) {
            timestamps = new uint256[](1);
            prices = new uint256[][](1);
            timestamps[0] = block.timestamp;
            prices[0] = getPrices(marketId);
            return (timestamps, prices);
        }
        
        timestamps = new uint256[](points.length);
        prices = new uint256[][](points.length);
        
        for (uint256 i = 0; i < points.length; i++) {
            timestamps[i] = points[i].timestamp;
            prices[i] = points[i].prices;
        }
    }

    function getPriceHistoryLength(uint256 marketId) external view returns (uint256) {
        return priceHistory[marketId].length;
    }

    // ============ AMM 交易 ============
    
    function buyShares(
        uint256 marketId,
        uint8 outcomeIndex,
        uint256 usdcAmount,
        uint256 minShares
    ) external nonReentrant returns (uint256 shares) {
        Market storage m = markets[marketId];
        require(m.status == 0, "Not open");
        require(block.timestamp < m.endTime, "Ended");
        require(outcomeIndex < m.numOutcomes, "Invalid outcome");
        require(usdcAmount > 0, "Zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // 计算费用
        uint256 totalFee = platformFee + m.creatorFee;
        uint256 feeAmount = (usdcAmount * totalFee) / (BASIS_POINTS + totalFee);
        uint256 netAmount = usdcAmount - feeAmount;

        // 分配费用
        if (m.creatorFee > 0 && feeAmount > 0) {
            uint256 creatorFeeAmount = (feeAmount * m.creatorFee) / totalFee;
            usdc.safeTransfer(m.creator, creatorFeeAmount);
            accumulatedFees += feeAmount - creatorFeeAmount;
        } else {
            accumulatedFees += feeAmount;
        }

        // 根据算法计算份额
        if (m.algorithm == PricingAlgorithm.LMSR) {
            shares = _calculateLMSRShares(marketId, outcomeIndex, netAmount);
        } else {
            shares = _calculateCPMMShares(marketId, outcomeIndex, netAmount);
        }
        
        require(shares >= minShares, "Slippage");

        // 更新状态
        if (m.algorithm == PricingAlgorithm.LMSR) {
            _updateSharesAfterLMSRBuy(marketId, outcomeIndex, shares);
        } else {
            _updateSharesAfterCPMMBuy(marketId, outcomeIndex, netAmount, shares);
        }
        
        m.liquidityPool += netAmount;
        userShares[marketId][outcomeIndex][msg.sender] += shares;

        _recordPrice(marketId);

        emit SharesPurchased(marketId, msg.sender, outcomeIndex, usdcAmount, shares);
    }
    
    /// @notice LMSR 份额计算
    function _calculateLMSRShares(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 netAmount
    ) internal view returns (uint256) {
        Market storage m = markets[marketId];
        uint256[] memory shares = outcomeShares[marketId];
        
        // 使用二分查找确定能买多少份额
        uint256 low = 1;
        uint256 high = netAmount * SHARE_PRECISION / 10**6; // 最大可能份额
        uint256 result = 0;
        
        while (low <= high) {
            uint256 mid = (low + high) / 2;
            uint256 cost = LMSR.getBuyCost(shares, outcomeIndex, mid, m.lmsrB);
            
            if (cost <= netAmount) {
                result = mid;
                low = mid + 1;
            } else {
                if (mid == 0) break;
                high = mid - 1;
            }
        }
        
        return result > 0 ? result : 1;
    }
    
    /// @notice CPMM 份额计算（原算法）
    function _calculateCPMMShares(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 netAmount
    ) internal view returns (uint256) {
        uint256 usdcInShares = (netAmount * SHARE_PRECISION) / 10**6;
        
        uint256 otherShares = 0;
        Market storage m = markets[marketId];
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            if (i != outcomeIndex) {
                otherShares += outcomeShares[marketId][i];
            }
        }
        
        return (usdcInShares * otherShares) / (outcomeShares[marketId][outcomeIndex] + usdcInShares);
    }
    
    /// @notice LMSR 买入后更新份额
    function _updateSharesAfterLMSRBuy(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 shares
    ) internal {
        outcomeShares[marketId][outcomeIndex] += shares;
    }

    /// @notice CPMM 买入后更新份额（原算法）
    function _updateSharesAfterCPMMBuy(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 netAmount, 
        uint256 shares
    ) internal {
        Market storage m = markets[marketId];
        uint256 otherSharesTotal = 0;
        
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            if (i != outcomeIndex) {
                otherSharesTotal += outcomeShares[marketId][i];
            }
        }
        
        outcomeShares[marketId][outcomeIndex] += (netAmount * SHARE_PRECISION) / 10**6;
        
        if (otherSharesTotal > 0) {
            for (uint8 i = 0; i < m.numOutcomes; i++) {
                if (i != outcomeIndex) {
                    uint256 deduct = (shares * outcomeShares[marketId][i]) / otherSharesTotal;
                    if (deduct < outcomeShares[marketId][i]) {
                        outcomeShares[marketId][i] -= deduct;
                    }
                }
            }
        }
    }

    function sellShares(
        uint256 marketId,
        uint8 outcomeIndex,
        uint256 sharesAmount,
        uint256 minUSDC
    ) external nonReentrant returns (uint256 usdcOut) {
        Market storage m = markets[marketId];
        require(m.status == 0, "Not open");
        require(outcomeIndex < m.numOutcomes, "Invalid");
        require(sharesAmount > 0, "Zero");
        require(userShares[marketId][outcomeIndex][msg.sender] >= sharesAmount, "Insufficient");

        userShares[marketId][outcomeIndex][msg.sender] -= sharesAmount;

        // 根据算法计算返还
        if (m.algorithm == PricingAlgorithm.LMSR) {
            usdcOut = _calculateLMSRSellReturn(marketId, outcomeIndex, sharesAmount);
        } else {
            usdcOut = _calculateCPMMSellReturn(marketId, outcomeIndex, sharesAmount);
        }
        
        // 扣除费用
        uint256 fee = (usdcOut * platformFee) / BASIS_POINTS;
        usdcOut -= fee;
        accumulatedFees += fee;

        require(usdcOut >= minUSDC, "Slippage");
        require(usdcOut <= m.liquidityPool, "Insufficient liquidity");

        // 更新状态
        if (m.algorithm == PricingAlgorithm.LMSR) {
            _updateSharesAfterLMSRSell(marketId, outcomeIndex, sharesAmount);
        } else {
            _updateSharesAfterCPMMSell(marketId, outcomeIndex, sharesAmount, usdcOut + fee);
        }
        
        m.liquidityPool -= usdcOut;
        
        usdc.safeTransfer(msg.sender, usdcOut);

        _recordPrice(marketId);

        emit SharesSold(marketId, msg.sender, outcomeIndex, sharesAmount, usdcOut);
    }
    
    /// @notice LMSR 卖出收益计算
    function _calculateLMSRSellReturn(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 sharesAmount
    ) internal view returns (uint256) {
        Market storage m = markets[marketId];
        uint256[] memory shares = outcomeShares[marketId];
        return LMSR.getSellRevenue(shares, outcomeIndex, sharesAmount, m.lmsrB);
    }

    /// @notice CPMM 卖出收益计算（原算法）
    function _calculateCPMMSellReturn(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 sharesAmount
    ) internal view returns (uint256) {
        uint256 otherSharesTotal = 0;
        Market storage m = markets[marketId];
        
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            if (i != outcomeIndex) {
                otherSharesTotal += outcomeShares[marketId][i];
            }
        }
        
        uint256 returnShares = (sharesAmount * outcomeShares[marketId][outcomeIndex]) / (otherSharesTotal + sharesAmount);
        return (returnShares * 10**6) / SHARE_PRECISION;
    }
    
    /// @notice LMSR 卖出后更新份额
    function _updateSharesAfterLMSRSell(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 sharesAmount
    ) internal {
        outcomeShares[marketId][outcomeIndex] -= sharesAmount;
    }

    /// @notice CPMM 卖出后更新份额（原算法）
    function _updateSharesAfterCPMMSell(
        uint256 marketId, 
        uint8 outcomeIndex, 
        uint256 sharesAmount, 
        uint256 usdcOutGross
    ) internal {
        Market storage m = markets[marketId];
        
        outcomeShares[marketId][outcomeIndex] -= (usdcOutGross * SHARE_PRECISION) / 10**6;
        
        uint256 addPerOutcome = sharesAmount / (m.numOutcomes - 1);
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            if (i != outcomeIndex) {
                outcomeShares[marketId][i] += addPerOutcome;
            }
        }
    }

    // ============ 限价单（保持原有逻辑）============
    function placeBuyOrder(
        uint256 marketId,
        uint8 outcomeIndex,
        uint256 shares,
        uint256 price
    ) external nonReentrant returns (uint256 orderId) {
        Market storage m = markets[marketId];
        require(m.status == 0, "Closed");
        require(outcomeIndex < m.numOutcomes, "Invalid");
        require(price > 0 && price < BASIS_POINTS, "Price");
        require(shares > 0, "Zero");

        uint256 usdcRequired = (shares * price) / (BASIS_POINTS * 10**12);
        require(usdcRequired > 0, "Too small");
        
        usdc.safeTransferFrom(msg.sender, address(this), usdcRequired);

        orderId = orders.length;
        orders.push(LimitOrder({
            id: orderId,
            marketId: marketId,
            user: msg.sender,
            outcomeIndex: outcomeIndex,
            shares: shares,
            price: price,
            usdcDeposit: usdcRequired,
            timestamp: block.timestamp,
            isBuy: true,
            status: 0
        }));

        marketBuyOrders[marketId][outcomeIndex].push(orderId);
        userOrderIds[msg.sender].push(orderId);
        
        emit OrderPlaced(marketId, orderId, msg.sender, outcomeIndex, true, shares, price);
    }

    function placeSellOrder(
        uint256 marketId,
        uint8 outcomeIndex,
        uint256 shares,
        uint256 price
    ) external nonReentrant returns (uint256 orderId) {
        Market storage m = markets[marketId];
        require(m.status == 0, "Closed");
        require(outcomeIndex < m.numOutcomes, "Invalid");
        require(price > 0 && price < BASIS_POINTS, "Price");
        require(shares > 0, "Zero");
        require(userShares[marketId][outcomeIndex][msg.sender] >= shares, "Insufficient");

        userShares[marketId][outcomeIndex][msg.sender] -= shares;

        orderId = orders.length;
        orders.push(LimitOrder({
            id: orderId,
            marketId: marketId,
            user: msg.sender,
            outcomeIndex: outcomeIndex,
            shares: shares,
            price: price,
            usdcDeposit: 0,
            timestamp: block.timestamp,
            isBuy: false,
            status: 0
        }));

        marketSellOrders[marketId][outcomeIndex].push(orderId);
        userOrderIds[msg.sender].push(orderId);
        
        emit OrderPlaced(marketId, orderId, msg.sender, outcomeIndex, false, shares, price);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        require(orderId < orders.length, "Invalid");
        LimitOrder storage order = orders[orderId];
        require(order.user == msg.sender, "Not yours");
        require(order.status == 0, "Not active");

        order.status = 2;

        if (order.isBuy) {
            usdc.safeTransfer(msg.sender, order.usdcDeposit);
        } else {
            userShares[order.marketId][order.outcomeIndex][msg.sender] += order.shares;
        }

        emit OrderCancelled(orderId);
    }

    // ============ 用户订单查询 ============
    function getUserActiveOrders(address user, uint256 marketId) external view returns (LimitOrder[] memory) {
        uint256[] storage allOrderIds = userOrderIds[user];
        
        uint256 count = 0;
        for (uint256 i = 0; i < allOrderIds.length; i++) {
            LimitOrder storage order = orders[allOrderIds[i]];
            if (order.marketId == marketId && order.status == 0) {
                count++;
            }
        }
        
        LimitOrder[] memory result = new LimitOrder[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allOrderIds.length; i++) {
            LimitOrder storage order = orders[allOrderIds[i]];
            if (order.marketId == marketId && order.status == 0) {
                result[index] = order;
                index++;
            }
        }
        
        return result;
    }

    function getAllUserActiveOrders(address user) external view returns (LimitOrder[] memory) {
        uint256[] storage allOrderIds = userOrderIds[user];
        
        uint256 count = 0;
        for (uint256 i = 0; i < allOrderIds.length; i++) {
            if (orders[allOrderIds[i]].status == 0) {
                count++;
            }
        }
        
        LimitOrder[] memory result = new LimitOrder[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allOrderIds.length; i++) {
            if (orders[allOrderIds[i]].status == 0) {
                result[index] = orders[allOrderIds[i]];
                index++;
            }
        }
        
        return result;
    }

    // ============ 解决市场 ============
    function resolveMarket(uint256 marketId, uint8 winnerIndex) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == 0, "Not open");
        require(block.timestamp >= m.endTime, "Not ended");
        require(winnerIndex < m.numOutcomes, "Invalid");

        m.status = 1;
        m.winnerIndex = winnerIndex;
        m.resolutionTime = block.timestamp;

        _cancelAllMarketOrders(marketId);

        emit MarketResolved(marketId, winnerIndex);
    }

    function _cancelAllMarketOrders(uint256 marketId) internal {
        Market storage m = markets[marketId];
        
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            uint256[] storage buyOrderIds = marketBuyOrders[marketId][i];
            for (uint256 j = 0; j < buyOrderIds.length; j++) {
                LimitOrder storage order = orders[buyOrderIds[j]];
                if (order.status == 0) {
                    order.status = 2;
                    if (order.usdcDeposit > 0) {
                        usdc.safeTransfer(order.user, order.usdcDeposit);
                    }
                }
            }
            
            uint256[] storage sellOrderIds = marketSellOrders[marketId][i];
            for (uint256 j = 0; j < sellOrderIds.length; j++) {
                LimitOrder storage order = orders[sellOrderIds[j]];
                if (order.status == 0) {
                    order.status = 2;
                    userShares[marketId][order.outcomeIndex][order.user] += order.shares;
                }
            }
        }
    }

    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == 0, "Not open");
        m.status = 2;
        _cancelAllMarketOrders(marketId);
    }

    // ============ 领取奖励 ============
    function claimWinnings(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        require(m.status == 1, "Not resolved");
        require(!claimed[marketId][msg.sender], "Claimed");

        uint256 winningShares = userShares[marketId][m.winnerIndex][msg.sender];
        require(winningShares > 0, "No shares");

        uint256 totalWinningShares = outcomeShares[marketId][m.winnerIndex];
        payout = (winningShares * m.liquidityPool) / totalWinningShares;
        
        claimed[marketId][msg.sender] = true;
        usdc.safeTransfer(msg.sender, payout);

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    function claimRefund(uint256 marketId) external nonReentrant returns (uint256 refund) {
        Market storage m = markets[marketId];
        require(m.status == 2, "Not cancelled");
        require(!claimed[marketId][msg.sender], "Claimed");

        uint256 totalUserShares = 0;
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            totalUserShares += userShares[marketId][i][msg.sender];
        }
        require(totalUserShares > 0, "No shares");

        uint256 totalShares = 0;
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            totalShares += outcomeShares[marketId][i];
        }
        
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
        uint8 status,
        uint8 numOutcomes,
        uint256 liquidityPool,
        uint8 winnerIndex,
        address creator
    ) {
        Market storage m = markets[marketId];
        return (m.question, m.category, m.imageUrl, m.endTime, m.status, m.numOutcomes, m.liquidityPool, m.winnerIndex, m.creator);
    }
    
    /// @notice 获取市场完整信息（含算法）
    function getMarketFullInfo(uint256 marketId) external view returns (
        string memory question,
        string memory category,
        uint256 endTime,
        uint8 status,
        uint8 numOutcomes,
        uint256 liquidityPool,
        uint8 algorithm,
        uint256 lmsrB
    ) {
        Market storage m = markets[marketId];
        return (m.question, m.category, m.endTime, m.status, m.numOutcomes, m.liquidityPool, uint8(m.algorithm), m.lmsrB);
    }

    function getMarketOutcomes(uint256 marketId) external view returns (
        string[] memory labels,
        uint256[] memory shares
    ) {
        return (outcomeLabels[marketId], outcomeShares[marketId]);
    }

    function getUserPosition(uint256 marketId, address user) external view returns (
        uint256[] memory shares,
        bool hasClaimed
    ) {
        Market storage m = markets[marketId];
        shares = new uint256[](m.numOutcomes);
        for (uint8 i = 0; i < m.numOutcomes; i++) {
            shares[i] = userShares[marketId][i][user];
        }
        hasClaimed = claimed[marketId][user];
    }

    function getActiveOrders(uint256 marketId, uint8 outcomeIndex) external view returns (
        uint256[] memory buyOrderIds,
        uint256[] memory sellOrderIds
    ) {
        return (marketBuyOrders[marketId][outcomeIndex], marketSellOrders[marketId][outcomeIndex]);
    }

    function getOrderInfo(uint256 orderId) external view returns (LimitOrder memory) {
        return orders[orderId];
    }

    function getOrderCount() external view returns (uint256) {
        return orders.length;
    }

    // ============ Admin ============
    function withdrawFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        usdc.safeTransfer(owner(), amount);
    }

    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 500, "Too high");
        platformFee = _fee;
    }
}