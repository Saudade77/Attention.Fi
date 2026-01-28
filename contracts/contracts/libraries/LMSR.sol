// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title LMSR - Logarithmic Market Scoring Rule
 * @notice 对数市场评分规则算法库，用于预测市场定价
 * @dev 使用定点数学实现 exp 和 ln 的近似计算
 */
library LMSR {
    uint256 constant PRECISION = 1e18;
    uint256 constant HALF_PRECISION = 5e17;
    
    // ln(2) * 1e18
    uint256 constant LN2 = 693147180559945309;
    
    // e * 1e18
    uint256 constant E = 2718281828459045235;

    /**
     * @notice 计算自然指数 e^x（定点数，18位精度）
     * @dev 使用泰勒级数: e^x = 1 + x + x²/2! + x³/3! + ...
     * @param x 输入值（可以是负数，使用 int256）
     * @return 结果 * 1e18
     */
    function expFixed(int256 x) internal pure returns (uint256) {
        // 处理边界情况
        if (x < -42 * 1e18) return 0;
        if (x > 42 * 1e18) return type(uint256).max;
        
        // 处理负数：e^(-x) = 1/e^x
        bool negative = x < 0;
        if (negative) x = -x;
        
        uint256 ux = uint256(x);
        
        // 分解: e^x = e^(整数部分) * e^(小数部分)
        // 使用 e^n = (e)^n 的整数幂
        uint256 intPart = ux / PRECISION;
        uint256 fracPart = ux % PRECISION;
        
        // 计算 e^(小数部分) 使用泰勒级数
        uint256 result = PRECISION; // 1
        uint256 term = fracPart;
        result += term; // + x
        
        term = (term * fracPart) / PRECISION / 2;
        result += term; // + x²/2!
        
        term = (term * fracPart) / PRECISION / 3;
        result += term; // + x³/3!
        
        term = (term * fracPart) / PRECISION / 4;
        result += term; // + x⁴/4!
        
        term = (term * fracPart) / PRECISION / 5;
        result += term; // + x⁵/5!
        
        term = (term * fracPart) / PRECISION / 6;
        result += term; // + x⁶/6!
        
        term = (term * fracPart) / PRECISION / 7;
        result += term; // + x⁷/7!
        
        term = (term * fracPart) / PRECISION / 8;
        result += term; // + x⁸/8!
        
        // 乘以 e^(整数部分)
        for (uint256 i = 0; i < intPart && i < 50; i++) {
            result = (result * E) / PRECISION;
            if (result > type(uint256).max / E) {
                result = type(uint256).max;
                break;
            }
        }
        
        // 处理负指数
        if (negative) {
            if (result == 0) return type(uint256).max;
            result = (PRECISION * PRECISION) / result;
        }
        
        return result;
    }

    /**
     * @notice 计算自然对数 ln(x)（定点数）
     * @dev 使用恒等式和泰勒级数
     * @param x 输入值 * 1e18（必须 > 0）
     * @return 结果 * 1e18（有符号）
     */
    function lnFixed(uint256 x) internal pure returns (int256) {
        require(x > 0, "ln(0) undefined");
        
        int256 result = 0;
        uint256 y = x;
        
        // 归一化到 [1, e) 范围，同时累计 ln 值
        // ln(x) = ln(x/e^k) + k*1
        while (y >= E) {
            y = (y * PRECISION) / E;
            result += int256(PRECISION);
        }
        while (y < PRECISION) {
            y = (y * E) / PRECISION;
            result -= int256(PRECISION);
        }
        
        // 现在 y 在 [1, e) 范围，使用泰勒级数计算 ln(y)
        // ln(1+z) = z - z²/2 + z³/3 - z⁴/4 + ...  其中 z = y - 1
        int256 z = int256(y) - int256(PRECISION);
        int256 zPow = z;
        
        result += zPow; // z
        zPow = (zPow * z) / int256(PRECISION);
        result -= zPow / 2; // - z²/2
        zPow = (zPow * z) / int256(PRECISION);
        result += zPow / 3; // + z³/3
        zPow = (zPow * z) / int256(PRECISION);
        result -= zPow / 4; // - z⁴/4
        zPow = (zPow * z) / int256(PRECISION);
        result += zPow / 5; // + z⁵/5
        zPow = (zPow * z) / int256(PRECISION);
        result -= zPow / 6; // - z⁶/6
        zPow = (zPow * z) / int256(PRECISION);
        result += zPow / 7; // + z⁷/7
        zPow = (zPow * z) / int256(PRECISION);
        result -= zPow / 8; // - z⁸/8
        
        return result;
    }

    /**
     * @notice 计算 LMSR 成本函数 C(q) = b * ln(Σ exp(q_i / b))
     * @param shares 各选项的份额数组（18位精度）
     * @param b 流动性参数（越大滑点越小）
     * @return 成本值（6位精度，USDC单位）
     */
    function costFunction(
        uint256[] memory shares, 
        uint256 b
    ) internal pure returns (uint256) {
        require(b > 0, "b must be positive");
        require(shares.length >= 2, "Need at least 2 outcomes");
        
        // 计算 Σ exp(q_i / b)
        uint256 sumExp = 0;
        for (uint256 i = 0; i < shares.length; i++) {
            // q_i / b，转换为 18 位精度
            int256 exponent = int256((shares[i] * PRECISION) / b);
            // 限制指数范围防止溢出
            if (exponent > 20 * int256(PRECISION)) exponent = 20 * int256(PRECISION);
            uint256 expVal = expFixed(exponent);
            sumExp += expVal;
        }
        
        // b * ln(sumExp)
        if (sumExp == 0) return 0;
        int256 lnSum = lnFixed(sumExp);
        if (lnSum <= 0) return 0;
        
        // 转换为 6 位精度（USDC）
        return (b * uint256(lnSum)) / PRECISION / 1e12;
    }

    /**
     * @notice 计算购买份额的成本
     * @param currentShares 当前各选项份额（18位精度）
     * @param outcomeIndex 要购买的选项索引
     * @param amount 购买数量（18位精度）
     * @param b 流动性参数
     * @return 购买成本（6位精度，USDC单位）
     */
    function getBuyCost(
        uint256[] memory currentShares,
        uint8 outcomeIndex,
        uint256 amount,
        uint256 b
    ) internal pure returns (uint256) {
        require(outcomeIndex < currentShares.length, "Invalid outcome");
        
        uint256 costBefore = costFunction(currentShares, b);
        
        // 创建新份额数组
        uint256[] memory newShares = new uint256[](currentShares.length);
        for (uint256 i = 0; i < currentShares.length; i++) {
            newShares[i] = currentShares[i];
        }
        newShares[outcomeIndex] += amount;
        
        uint256 costAfter = costFunction(newShares, b);
        
        return costAfter > costBefore ? costAfter - costBefore : 0;
    }

    /**
     * @notice 计算卖出份额的收益
     * @param currentShares 当前各选项份额
     * @param outcomeIndex 要卖出的选项索引
     * @param amount 卖出数量
     * @param b 流动性参数
     * @return 卖出收益（6位精度）
     */
    function getSellRevenue(
        uint256[] memory currentShares,
        uint8 outcomeIndex,
        uint256 amount,
        uint256 b
    ) internal pure returns (uint256) {
        require(outcomeIndex < currentShares.length, "Invalid outcome");
        require(currentShares[outcomeIndex] >= amount, "Insufficient shares");
        
        uint256 costBefore = costFunction(currentShares, b);
        
        uint256[] memory newShares = new uint256[](currentShares.length);
        for (uint256 i = 0; i < currentShares.length; i++) {
            newShares[i] = currentShares[i];
        }
        newShares[outcomeIndex] -= amount;
        
        uint256 costAfter = costFunction(newShares, b);
        
        return costBefore > costAfter ? costBefore - costAfter : 0;
    }

    /**
     * @notice 计算各选项的概率/价格
     * @dev p_i = exp(q_i / b) / Σ exp(q_j / b)
     * @param shares 各选项的份额数组
     * @param b 流动性参数
     * @return prices 各选项价格（基点，总和 = 10000）
     */
    function getPrices(
        uint256[] memory shares, 
        uint256 b
    ) internal pure returns (uint256[] memory prices) {
        prices = new uint256[](shares.length);
        
        if (shares.length == 0) return prices;
        
        // 计算所有 exp 值
        uint256 sumExp = 0;
        uint256[] memory expValues = new uint256[](shares.length);
        
        for (uint256 i = 0; i < shares.length; i++) {
            int256 exponent = int256((shares[i] * PRECISION) / b);
            if (exponent > 20 * int256(PRECISION)) exponent = 20 * int256(PRECISION);
            expValues[i] = expFixed(exponent);
            sumExp += expValues[i];
        }
        
        // 计算概率
        if (sumExp == 0) {
            uint256 equalPrice = 10000 / shares.length;
            for (uint256 i = 0; i < shares.length; i++) {
                prices[i] = equalPrice;
            }
            return prices;
        }
        
        uint256 totalBps = 0;
        for (uint256 i = 0; i < shares.length; i++) {
            prices[i] = (expValues[i] * 10000) / sumExp;
            // 限制最小/最大价格
            if (prices[i] < 100) prices[i] = 100;
            if (prices[i] > 9900) prices[i] = 9900;
            totalBps += prices[i];
        }
        
        // 归一化确保总和为 10000
        if (totalBps != 10000 && shares.length > 0) {
            int256 diff = int256(10000) - int256(totalBps);
            if (int256(prices[0]) + diff > 100) {
                prices[0] = uint256(int256(prices[0]) + diff);
            }
        }
        
        return prices;
    }
}