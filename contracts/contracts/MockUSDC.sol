// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Mock USDC for testing
/// @notice 测试用的 USDC，任何人都可以 mint
contract MockUSDC is ERC20 {
    uint8 private _decimals = 6; // USDC 使用 6 位小数

    constructor() ERC20("Mock USDC", "USDC") {
        // 给部署者初始代币
        _mint(msg.sender, 1_000_000 * 10**6); // 100万 USDC
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice 任何人都可以领取测试代币
    function faucet(uint256 amount) external {
        require(amount <= 10_000 * 10**6, "Max 10k USDC per request");
        _mint(msg.sender, amount);
    }

    /// @notice 方便测试：直接 mint 给指定地址
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}