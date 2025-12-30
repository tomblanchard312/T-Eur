// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title ITokenizedEuro
 * @notice Interface for the Digital Euro (tEUR) contract
 * @dev Implements ECB Digital Euro requirements including holding limits and waterfall
 */
interface ITokenizedEuro {
    // ERC-20 standard functions
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // Minting and Burning
    function mint(address to, uint256 amount, bytes32 idempotencyKey) external;
    function burn(address from, uint256 amount, bytes32 idempotencyKey) external;
    
    // Emergency Controls
    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);
    
    // Waterfall (ECB Digital Euro feature)
    function executeWaterfall(address wallet) external;
    function executeReverseWaterfall(address wallet, uint256 amount, bytes32 idempotencyKey) external;
    function waterfallEnabled() external view returns (bool);
    
    // View functions
    function wouldExceedLimit(address to, uint256 amount) external view returns (bool);
    function getWaterfallAmount(address to, uint256 amount) external view returns (uint256);
    function isIdempotencyKeyUsed(bytes32 key) external view returns (bool);
}
