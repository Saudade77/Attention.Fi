// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreatorMarketV2
 * @notice 使用 USDC 结算的 Creator 份额交易市场 (Bonding Curve)
 */
contract CreatorMarketV2 is ReentrancyGuard, Ownable {
    IERC20 public usdc;
    
    // Bonding Curve 参数
    uint256 public constant A = 1e4;      // 斜率 (每份额价格增加量，单位: USDC最小单位)
    uint256 public constant B = 1e6;      // 基础价格 = 1 USDC (6位小数)
    uint256 public constant FEE_BPS = 500; // 5% 手续费
    uint256 public constant BPS = 10000;
    
    struct Creator {
        bool exists;
        uint256 totalSupply;      // 总发行量
        uint256 poolBalance;      // 池子里的 USDC
        mapping(address => uint256) balances; // 用户持仓
    }
    
    mapping(string => Creator) public creators;
    string[] public creatorList;
    
    // Events
    event CreatorRegistered(string indexed handle, address indexed registrant);
    event SharesBought(string indexed handle, address indexed buyer, uint256 amount, uint256 cost);
    event SharesSold(string indexed handle, address indexed seller, uint256 amount, uint256 proceeds);
    
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }
    
    // ============ View Functions ============
    
    /// @notice 获取购买 amount 份额的价格
    function getBuyPrice(string calldata handle, uint256 amount) public view returns (uint256) {
        Creator storage creator = creators[handle];
        uint256 supply = creator.totalSupply;
        
        // 积分: ∫(A*x + B)dx from supply to supply+amount
        uint256 sum1 = (supply + amount) * (supply + amount);
        uint256 sum2 = supply * supply;
        return (A * (sum1 - sum2) / 2) + (B * amount);
    }
    
    /// @notice 获取卖出 amount 份额的收益（扣除手续费前）
    function getSellPrice(string calldata handle, uint256 amount) public view returns (uint256) {
        Creator storage creator = creators[handle];
        require(creator.totalSupply >= amount, "Insufficient supply");
        uint256 supply = creator.totalSupply;
        
        uint256 sum1 = supply * supply;
        uint256 sum2 = (supply - amount) * (supply - amount);
        return (A * (sum1 - sum2) / 2) + (B * amount);
    }
    
    /// @notice 获取当前单价
    function getCurrentPrice(string calldata handle) public view returns (uint256) {
        Creator storage creator = creators[handle];
        return A * creator.totalSupply + B;
    }
    
    /// @notice 获取用户持仓
    function getUserShares(string calldata handle, address user) public view returns (uint256) {
        return creators[handle].balances[user];
    }
    
    /// @notice 获取 Creator 信息
    function getCreatorInfo(string calldata handle) public view returns (
        bool exists,
        uint256 totalSupply,
        uint256 poolBalance,
        uint256 currentPrice
    ) {
        Creator storage creator = creators[handle];
        return (
            creator.exists,
            creator.totalSupply,
            creator.poolBalance,
            getCurrentPrice(handle)
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
    
    // ============ Write Functions ============
    
    /// @notice 注册新的 Creator
    function registerCreator(string calldata handle) external {
        require(bytes(handle).length > 0, "Handle cannot be empty");
        require(bytes(handle).length <= 32, "Handle too long");
        require(!creators[handle].exists, "Creator already exists");
        
        creators[handle].exists = true;
        creatorList.push(handle);
        
        emit CreatorRegistered(handle, msg.sender);
    }
    
    /// @notice 购买份额
    function buyShares(string calldata handle, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        Creator storage creator = creators[handle];
        require(creator.exists, "Creator does not exist");
        
        uint256 cost = getBuyPrice(handle, amount);
        uint256 fee = (cost * FEE_BPS) / BPS;
        uint256 totalCost = cost + fee;
        
        // 转入 USDC
        require(usdc.transferFrom(msg.sender, address(this), totalCost), "USDC transfer failed");
        
        // 更新状态
        creator.totalSupply += amount;
        creator.poolBalance += cost; // 手续费不进池子
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