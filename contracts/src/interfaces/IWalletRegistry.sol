// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title IWalletRegistry
 * @notice Interface for Digital Euro wallet registration and holding limits
 * @dev Implements ECB requirements for wallet management and caps
 */
interface IWalletRegistry {
    // Wallet types with different holding limits
    enum WalletType {
        UNREGISTERED,   // Cannot hold digital euro
        INDIVIDUAL,     // Natural person - €3,000 limit
        MERCHANT,       // Business receiving payments - €30,000 limit  
        PSP,            // Payment Service Provider - no limit
        NCB,            // National Central Bank - no limit
        BANK            // Commercial bank - no limit
    }

    // Wallet registration status
    struct WalletInfo {
        WalletType walletType;
        address linkedBankAccount;      // For waterfall/reverse-waterfall
        uint256 customLimit;            // Override if set (0 = use default)
        uint256 registrationTime;
        bool isActive;
        bytes32 kycHash;                // Hash of KYC data (stored off-chain)
    }

    // Events
    event WalletRegistered(
        address indexed wallet,
        WalletType indexed walletType,
        address linkedBankAccount,
        bytes32 kycHash
    );
    
    event WalletDeactivated(address indexed wallet, string reason);
    event WalletReactivated(address indexed wallet);
    event LinkedBankAccountUpdated(address indexed wallet, address oldBank, address newBank);
    event HoldingLimitUpdated(WalletType indexed walletType, uint256 oldLimit, uint256 newLimit);
    event CustomLimitSet(address indexed wallet, uint256 limit);

    // Registration
    function registerWallet(
        address wallet,
        WalletType walletType,
        address linkedBankAccount,
        bytes32 kycHash
    ) external;

    function deactivateWallet(address wallet, string calldata reason) external;
    function reactivateWallet(address wallet) external;

    // Configuration
    function setDefaultHoldingLimit(WalletType walletType, uint256 limit) external;
    function setCustomLimit(address wallet, uint256 limit) external;
    function updateLinkedBankAccount(address wallet, address newBankAccount) external;

    // Queries
    function getWalletInfo(address wallet) external view returns (WalletInfo memory);
    function getHoldingLimit(address wallet) external view returns (uint256);
    function getDefaultHoldingLimit(WalletType walletType) external view returns (uint256);
    function isRegistered(address wallet) external view returns (bool);
    function isActive(address wallet) external view returns (bool);
    function canHold(address wallet, uint256 amount) external view returns (bool);
    function getExcessAmount(address wallet, uint256 currentBalance, uint256 incomingAmount) external view returns (uint256);
}
