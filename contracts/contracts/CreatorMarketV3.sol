// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/BondingCurve.sol";

/**
 * @title CreatorMarketV3
 * @notice 支持多种 Bonding Curve 的 Creator 份额交易市场
 * @dev 升级点：支持线性、指数、Sigmoid 三种曲线类型
 */
contract CreatorMarketV3 is ReentrancyGuard, Ownable {
    using BondingCurve for BondingCurve.CurveType;
    
    IERC20 public usdc;
    
    // 默认曲线参数
    uint256 public constant DEFAULT_A = 1e4;          // 默认斜率
    uint256 public constant DEFAULT_B = 1e6;          // 默认基础价格 = 1 USDC
    uint256 public constant DEFAULT_INFLECTION = 100; // 默认拐点 (Sigmoid用)
    uint256 public constant FEE_BPS = 500;            // 5% 手续费
    uint256 public constant BPS = 10000;
    
    // 曲线配置结构
    struct CurveConfig {
        BondingCurve.CurveType curveType;
        uint256 A;               // 斜率/加速因子
        uint256 B;               // 基础价格
        uint256 inflectionPoint; // 拐点 (仅 Sigmoid 使用)
    }
    
    struct Creator {
        bool exists;
        uint256 totalSupply;      // 总发行量
        uint256 poolBalance;      // 池子里的 USDC
        CurveConfig curveConfig;  // 曲线配置
        mapping(address => uint256) balances; // 用户持仓
    }
    
    mapping(string => Creator) public creators;
    string[] public creatorList;
    
    // Events
    event CreatorRegistered(
        string indexed handle, 
        address indexed registrant,
        uint8 curveType,
        uint256 A,
        uint256 B
    );
    event SharesBought(string indexed handle, address indexed buyer, uint256 amount, uint256 cost);
    event SharesSold(string indexed handle, address indexed seller, uint256 amount, uint256 proceeds);
    event CurveConfigUpdated(string indexed handle, uint8 curveType, uint256 A, uint256 B);
    
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }
    
    // ============ View Functions ============
    
    /// @notice 获取购买 amount 份额的价格
    function getBuyPrice(string calldata handle, uint256 amount) public view returns (uint256) {
        Creator storage creator = creators[handle];
        require(creator.exists, "Creator does not exist");
        
        return BondingCurve.getBuyPrice(
            creator.curveConfig.curveType,
            creator.totalSupply,
            amount,
            creator.curveConfig.A,
            creator.curveConfig.B,
            creator.curveConfig.inflectionPoint
        );
    }
    
    /// @notice 获取卖出 amount 份额的收益（扣除手续费前）
    function getSellPrice(string calldata handle, uint256 amount) public view returns (uint256) {
        Creator storage creator = creators[handle];
        require(creator.exists, "Creator does not exist");
        require(creator.totalSupply >= amount, "Insufficient supply");
        
        return BondingCurve.getSellPrice(
            creator.curveConfig.curveType,
            creator.totalSupply,
            amount,
            creator.curveConfig.A,
            creator.curveConfig.B,
            creator.curveConfig.inflectionPoint
        );
    }
    
    /// @notice 获取当前单价
    function getCurrentPrice(string calldata handle) public view returns (uint256) {
        Creator storage creator = creators[handle];
        if (!creator.exists) return DEFAULT_B;
        
        return BondingCurve.getCurrentPrice(
            creator.curveConfig.curveType,
            creator.totalSupply,
            creator.curveConfig.A,
            creator.curveConfig.B,
            creator.curveConfig.inflectionPoint
        );
    }
    
    /// @notice 获取用户持仓
    function getUserShares(string calldata handle, address user) public view returns (uint256) {
        return creators[handle].balances[user];
    }
    
    /// @notice 获取 Creator 完整信息
    function getCreatorInfo(string calldata handle) public view returns (
        bool exists,
        uint256 totalSupply,
        uint256 poolBalance,
        uint256 currentPrice,
        uint8 curveType,
        uint256 curveA,
        uint256 curveB,
        uint256 inflectionPoint
    ) {
        Creator storage creator = creators[handle];
        return (
            creator.exists,
            creator.totalSupply,
            creator.poolBalance,
            getCurrentPrice(handle),
            uint8(creator.curveConfig.curveType),
            creator.curveConfig.A,
            creator.curveConfig.B,
            creator.curveConfig.inflectionPoint
        );
    }
    
    /// @notice 获取曲线配置
    function getCurveConfig(string calldata handle) public view returns (
        uint8 curveType,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) {
        Creator storage creator = creators[handle];
        return (
            uint8(creator.curveConfig.curveType),
            creator.curveConfig.A,
            creator.curveConfig.B,
            creator.curveConfig.inflectionPoint
        );
    }
    
    /// @notice 获取所有 Creator 数量
    function getCreatorCount() public view returns (uint256) {
        return creatorList.length;
    }
    
    /// @notice 获取 Creator handle by index
    function getCreatorByIndex(uint256 index) public view returns (string memory) {
        require(index < creatorList.length, "Index out of bounds");
        return creatorList[index];
    }
    
    /// @notice 预估价格影响
    function estimatePriceImpact(
        string calldata handle, 
        uint256 amount, 
        bool isBuy
    ) external view returns (uint256 avgPrice, uint256 priceImpactBps) {
        Creator storage creator = creators[handle];
        require(creator.exists, "Creator does not exist");
        
        uint256 currentPrice = getCurrentPrice(handle);
        uint256 totalCost;
        uint256 newPrice;
        
        if (isBuy) {
            totalCost = getBuyPrice(handle, amount);
            newPrice = BondingCurve.getCurrentPrice(
                creator.curveConfig.curveType,
                creator.totalSupply + amount,
                creator.curveConfig.A,
                creator.curveConfig.B,
                creator.curveConfig.inflectionPoint
            );
        } else {
            require(creator.totalSupply >= amount, "Insufficient supply");
            totalCost = getSellPrice(handle, amount);
            newPrice = BondingCurve.getCurrentPrice(
                creator.curveConfig.curveType,
                creator.totalSupply - amount,
                creator.curveConfig.A,
                creator.curveConfig.B,
                creator.curveConfig.inflectionPoint
            );
        }
        
        avgPrice = amount > 0 ? totalCost / amount : currentPrice;
        
        if (currentPrice > 0) {
            if (newPrice > currentPrice) {
                priceImpactBps = ((newPrice - currentPrice) * BPS) / currentPrice;
            } else {
                priceImpactBps = ((currentPrice - newPrice) * BPS) / currentPrice;
            }
        }
    }
    
    // ============ Write Functions ============
    
    /// @notice 注册新的 Creator（使用默认线性曲线）
    function registerCreator(string calldata handle) external {
        _registerCreatorWithCurve(
            handle,
            BondingCurve.CurveType.LINEAR,
            DEFAULT_A,
            DEFAULT_B,
            DEFAULT_INFLECTION
        );
    }
    
    /// @notice 注册新的 Creator（自定义曲线类型）
    /// @param handle Twitter handle
    /// @param curveType 曲线类型: 0=Linear, 1=Exponential, 2=Sigmoid
    /// @param A 斜率/加速因子
    /// @param B 基础价格
    function registerCreatorWithCurve(
        string calldata handle,
        uint8 curveType,
        uint256 A,
        uint256 B
    ) external {
        require(curveType <= 2, "Invalid curve type");
        
        _registerCreatorWithCurve(
            handle,
            BondingCurve.CurveType(curveType),
            A > 0 ? A : DEFAULT_A,
            B > 0 ? B : DEFAULT_B,
            DEFAULT_INFLECTION
        );
    }
    
    /// @notice 注册新的 Creator（完整参数）
    function registerCreatorFull(
        string calldata handle,
        uint8 curveType,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) external {
        require(curveType <= 2, "Invalid curve type");
        
        _registerCreatorWithCurve(
            handle,
            BondingCurve.CurveType(curveType),
            A > 0 ? A : DEFAULT_A,
            B > 0 ? B : DEFAULT_B,
            inflectionPoint > 0 ? inflectionPoint : DEFAULT_INFLECTION
        );
    }
    
    /// @notice 内部注册函数
    function _registerCreatorWithCurve(
        string calldata handle,
        BondingCurve.CurveType curveType,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal {
        require(bytes(handle).length > 0, "Handle cannot be empty");
        require(bytes(handle).length <= 32, "Handle too long");
        require(!creators[handle].exists, "Creator already exists");
        require(B >= 1e4, "Base price too low"); // 最低 0.01 USDC
        require(A <= 1e8, "Slope too high");     // 防止溢出
        
        Creator storage creator = creators[handle];
        creator.exists = true;
        creator.curveConfig = CurveConfig({
            curveType: curveType,
            A: A,
            B: B,
            inflectionPoint: inflectionPoint
        });
        
        creatorList.push(handle);
        
        emit CreatorRegistered(handle, msg.sender, uint8(curveType), A, B);
    }
    
    /// @notice 购买份额
    function buyShares(string calldata handle, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(amount <= 1000, "Max 1000 per tx"); // 防止 gas 过高
        
        Creator storage creator = creators[handle];
        require(creator.exists, "Creator does not exist");
        
        uint256 cost = getBuyPrice(handle, amount);
        uint256 fee = (cost * FEE_BPS) / BPS;
        uint256 totalCost = cost + fee;
        
        // 转入 USDC
        require(usdc.transferFrom(msg.sender, address(this), totalCost), "USDC transfer failed");
        
        // 更新状态
        creator.totalSupply += amount;
        creator.poolBalance += cost;
        creator.balances[msg.sender] += amount;
        
        emit SharesBought(handle, msg.sender, amount, totalCost);
    }
    
    /// @notice 卖出份额
    function sellShares(string calldata handle, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        Creator storage creator = creators[handle];
        require(creator.exists, "Creator does not exist");
        require(creator.balances[msg.sender] >= amount, "Insufficient shares");
        
        uint256 grossProceeds = getSellPrice(handle, amount);
        uint256 fee = (grossProceeds * FEE_BPS) / BPS;
        uint256 netProceeds = grossProceeds - fee;
        
        require(creator.poolBalance >= grossProceeds, "Insufficient pool balance");
        
        // 更新状态
        creator.totalSupply -= amount;
        creator.poolBalance -= grossProceeds;
        creator.balances[msg.sender] -= amount;
        
        // 转出 USDC
        require(usdc.transfer(msg.sender, netProceeds), "USDC transfer failed");
        
        emit SharesSold(handle, msg.sender, amount, netProceeds);
    }
    
    // ============ Admin Functions ============
    
    /// @notice 更新创作者曲线配置（仅 Owner）
    function updateCurveConfig(
        string calldata handle,
        uint8 curveType,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) external onlyOwner {
        require(curveType <= 2, "Invalid curve type");
        Creator storage creator = creators[handle];
        require(creator.exists, "Creator does not exist");
        
        creator.curveConfig = CurveConfig({
            curveType: BondingCurve.CurveType(curveType),
            A: A > 0 ? A : creator.curveConfig.A,
            B: B > 0 ? B : creator.curveConfig.B,
            inflectionPoint: inflectionPoint > 0 ? inflectionPoint : creator.curveConfig.inflectionPoint
        });
        
        emit CurveConfigUpdated(handle, curveType, A, B);
    }
    
    /// @notice 提取手续费收入
    function withdrawFees() external onlyOwner {
        uint256 totalPoolBalance = 0;
        for (uint i = 0; i < creatorList.length; i++) {
            totalPoolBalance += creators[creatorList[i]].poolBalance;
        }
        
        uint256 contractBalance = usdc.balanceOf(address(this));
        uint256 fees = contractBalance - totalPoolBalance;
        
        if (fees > 0) {
            require(usdc.transfer(owner(), fees), "Fee withdrawal failed");
        }
    }
}