// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library BondingCurve {
    /// @notice 计算购买 amount 份额需要的 ETH（线性曲线: price = A * supply + B）
    /// @param currentSupply 当前供应量
    /// @param amount 购买数量
    /// @param A 斜率 (建议 1e12 ~ 1e14)
    /// @param B 基础价格
    function getBuyPrice(
        uint256 currentSupply,
        uint256 amount,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        // 积分: ∫(A*x + B)dx from supply to supply+amount
        // = A/2 * [(supply+amount)^2 - supply^2] + B * amount
        uint256 sum1 = (currentSupply + amount) * (currentSupply + amount);
        uint256 sum2 = currentSupply * currentSupply;
        return (A * (sum1 - sum2) / 2) + (B * amount);
    }

    /// @notice 计算卖出 amount 份额获得的 ETH
    function getSellPrice(
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

    /// @notice 获取当前单价
    function getCurrentPrice(
        uint256 currentSupply,
        uint256 A,
        uint256 B
    ) internal pure returns (uint256) {
        return A * currentSupply + B;
    }
}