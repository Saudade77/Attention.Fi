// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BondingCurve - 多曲线类型联合曲线库
 * @notice 支持线性、指数、Sigmoid 三种曲线类型
 */
library BondingCurve {
    
    // 曲线类型枚举
    enum CurveType {
        LINEAR,      // 线性: price = A * supply + B
        EXPONENTIAL, // 指数: price = B * (1 + A/1e6)^supply ≈ 二次近似
        SIGMOID      // S型: 早期慢 -> 中期快 -> 后期慢
    }
    
    uint256 constant PRECISION = 1e18;
    
    // ============ 线性曲线 (原始实现) ============
    
    /// @notice 线性曲线 - 计算购买价格
    /// @dev price = A * supply + B，积分计算总成本
    function getLinearBuyPrice(
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        // ∫(A*x + B)dx from supply to supply+amount
        // = A/2 * [(supply+amount)² - supply²] + B * amount
        uint256 sum1 = (currentSupply + amount) * (currentSupply + amount);
        uint256 sum2 = currentSupply * currentSupply;
        return (A * (sum1 - sum2) / 2) + (B * amount);
    }
    
    /// @notice 线性曲线 - 计算卖出收益
    function getLinearSellPrice(
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        require(currentSupply >= amount, "Insufficient supply");
        uint256 sum1 = currentSupply * currentSupply;
        uint256 sum2 = (currentSupply - amount) * (currentSupply - amount);
        return (A * (sum1 - sum2) / 2) + (B * amount);
    }
    
    /// @notice 线性曲线 - 获取当前单价
    function getLinearCurrentPrice(
        uint256 currentSupply,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        return A * currentSupply + B;
    }
    
    // ============ 指数曲线 (二次近似) ============
    
    /// @notice 指数曲线 - 计算购买价格
    /// @dev 使用二次近似: price ≈ B + A * supply²
    /// @param A 加速因子 (建议 1e2 ~ 1e4)
    /// @param B 基础价格
    function getExponentialBuyPrice(
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        // ∫(B + A*x²)dx = B*x + A*x³/3
        // 从 supply 到 supply+amount 的积分
        uint256 newSupply = currentSupply + amount;
        
        uint256 cost1 = B * newSupply + (A * newSupply * newSupply * newSupply) / 3;
        uint256 cost0 = B * currentSupply + (A * currentSupply * currentSupply * currentSupply) / 3;
        
        return cost1 - cost0;
    }
    
    /// @notice 指数曲线 - 计算卖出收益
    function getExponentialSellPrice(
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        require(currentSupply >= amount, "Insufficient supply");
        uint256 newSupply = currentSupply - amount;
        
        uint256 cost0 = B * currentSupply + (A * currentSupply * currentSupply * currentSupply) / 3;
        uint256 cost1 = B * newSupply + (A * newSupply * newSupply * newSupply) / 3;
        
        return cost0 - cost1;
    }
    
    /// @notice 指数曲线 - 获取当前单价
    function getExponentialCurrentPrice(
        uint256 currentSupply,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        return B + A * currentSupply * currentSupply;
    }
    
    // ============ Sigmoid 曲线 (分段线性近似) ============
    
    /// @notice Sigmoid 曲线 - 计算购买价格
    /// @dev 分段实现: 早期平缓 -> 中期陡峭 -> 后期平缓
    /// @param A 最大价格增量
    /// @param B 基础价格
    /// @param inflectionPoint 拐点位置（默认可设为 100）
    function getSigmoidBuyPrice(
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal pure returns (uint256) {
        uint256 totalCost = 0;
        uint256 supply = currentSupply;
        
        // 逐个计算每个份额的价格（简化版，实际可优化为区间积分）
        // 为了 gas 效率，使用分段积分
        for (uint256 i = 0; i < amount; i++) {
            totalCost += _sigmoidPrice(supply + i, A, B, inflectionPoint);
        }
        
        return totalCost;
    }
    
    /// @notice Sigmoid 曲线 - 计算卖出收益
    function getSigmoidSellPrice(
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal pure returns (uint256) {
        require(currentSupply >= amount, "Insufficient supply");
        
        uint256 totalReturn = 0;
        for (uint256 i = 0; i < amount; i++) {
            totalReturn += _sigmoidPrice(currentSupply - 1 - i, A, B, inflectionPoint);
        }
        
        return totalReturn;
    }
    
    /// @notice Sigmoid 曲线 - 获取当前单价
    function getSigmoidCurrentPrice(
        uint256 currentSupply,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal pure returns (uint256) {
        return _sigmoidPrice(currentSupply, A, B, inflectionPoint);
    }
    
    /// @notice 内部函数：计算 Sigmoid 单点价格
    /// @dev 使用分段线性近似 S 曲线
    function _sigmoidPrice(
        uint256 supply,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal pure returns (uint256) {
        // S 曲线分三段:
        // 1. supply < inflectionPoint/2: 缓慢增长
        // 2. inflectionPoint/2 <= supply < inflectionPoint*3/2: 快速增长
        // 3. supply >= inflectionPoint*3/2: 趋于平缓
        
        uint256 halfPoint = inflectionPoint / 2;
        uint256 threeHalfPoint = (inflectionPoint * 3) / 2;
        
        if (supply < halfPoint) {
            // 早期：缓慢增长 (斜率 = A / (4 * inflectionPoint))
            return B + (A * supply * supply) / (4 * inflectionPoint * halfPoint);
        } else if (supply < threeHalfPoint) {
            // 中期：快速增长 (线性斜率 = A / inflectionPoint)
            uint256 midProgress = supply - halfPoint;
            uint256 basePrice = B + A / 4; // 在 halfPoint 时的价格
            return basePrice + (A * midProgress) / inflectionPoint;
        } else {
            // 后期：趋于平缓
            uint256 lateProgress = supply - threeHalfPoint;
            uint256 basePrice = B + (A * 3) / 4; // 在 threeHalfPoint 时的价格
            // 使用递减斜率
            uint256 remaining = A / 4;
            uint256 decay = inflectionPoint + lateProgress;
            return basePrice + (remaining * lateProgress) / decay;
        }
    }
    
    // ============ 统一接口 ============
    
    /// @notice 根据曲线类型计算购买价格
    function getBuyPrice(
        CurveType curveType,
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal pure returns (uint256) {
        if (curveType == CurveType.LINEAR) {
            return getLinearBuyPrice(currentSupply, amount, A, B);
        } else if (curveType == CurveType.EXPONENTIAL) {
            return getExponentialBuyPrice(currentSupply, amount, A, B);
        } else {
            return getSigmoidBuyPrice(currentSupply, amount, A, B, inflectionPoint);
        }
    }
    
    /// @notice 根据曲线类型计算卖出收益
    function getSellPrice(
        CurveType curveType,
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal pure returns (uint256) {
        if (curveType == CurveType.LINEAR) {
            return getLinearSellPrice(currentSupply, amount, A, B);
        } else if (curveType == CurveType.EXPONENTIAL) {
            return getExponentialSellPrice(currentSupply, amount, A, B);
        } else {
            return getSigmoidSellPrice(currentSupply, amount, A, B, inflectionPoint);
        }
    }
    
    /// @notice 根据曲线类型获取当前价格
    function getCurrentPrice(
        CurveType curveType,
        uint256 currentSupply,
        uint256 A,
        uint256 B,
        uint256 inflectionPoint
    ) internal pure returns (uint256) {
        if (curveType == CurveType.LINEAR) {
            return getLinearCurrentPrice(currentSupply, A, B);
        } else if (curveType == CurveType.EXPONENTIAL) {
            return getExponentialCurrentPrice(currentSupply, A, B);
        } else {
            return getSigmoidCurrentPrice(currentSupply, A, B, inflectionPoint);
        }
    }
}