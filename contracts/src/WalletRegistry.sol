// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./interfaces/IWalletRegistry.sol";
import "./Permissioning.sol";

/**
 * @title WalletRegistry
 * @notice Manages Digital Euro wallet registration, KYC status, and holding limits
 * @dev Implements ECB requirements:
 *      - €3,000 default limit for individuals
 *      - Linked bank accounts for waterfall/reverse-waterfall
 *      - KYC hash storage (actual KYC data off-chain)
 * 
 * Security considerations:
 * - Only authorized registrars can register wallets
 * - KYC data never stored on-chain (only hash)
 * - Deactivation requires reason for audit trail
 */
contract WalletRegistry is IWalletRegistry {
    // Access control
    Permissioning public immutable permissioning;

    // Wallet storage
    mapping(address => WalletInfo) private _wallets;

    // Default holding limits per wallet type (in cents, 2 decimals)
    mapping(WalletType => uint256) private _defaultLimits;

    // Constants
    uint256 public constant INDIVIDUAL_DEFAULT_LIMIT = 300000;   // €3,000.00
    uint256 public constant MERCHANT_DEFAULT_LIMIT = 3000000;    // €30,000.00
    uint256 public constant UNLIMITED = type(uint256).max;

    // Errors
    error Unauthorized();
    error WalletAlreadyRegistered();
    error WalletNotRegistered();
    error WalletNotActive();
    error InvalidWalletType();
    error ZeroAddress();

    modifier onlyRegistrar() {
        if (!permissioning.isRegistrar(msg.sender)) revert Unauthorized();
        _;
    }

    modifier onlyAdmin() {
        if (!permissioning.isAdmin(msg.sender)) revert Unauthorized();
        _;
    }

    constructor(address _permissioning) {
        if (_permissioning == address(0)) revert ZeroAddress();
        permissioning = Permissioning(_permissioning);

        // Set default limits
        _defaultLimits[WalletType.UNREGISTERED] = 0;
        _defaultLimits[WalletType.INDIVIDUAL] = INDIVIDUAL_DEFAULT_LIMIT;
        _defaultLimits[WalletType.MERCHANT] = MERCHANT_DEFAULT_LIMIT;
        _defaultLimits[WalletType.PSP] = UNLIMITED;
        _defaultLimits[WalletType.NCB] = UNLIMITED;
        _defaultLimits[WalletType.BANK] = UNLIMITED;
    }

    // ============ Registration ============

    /**
     * @notice Register a new wallet with KYC verification
     * @param wallet Address to register
     * @param walletType Type determining holding limit
     * @param linkedBankAccount Bank account for waterfall
     * @param kycHash Hash of off-chain KYC data
     */
    function registerWallet(
        address wallet,
        WalletType walletType,
        address linkedBankAccount,
        bytes32 kycHash
    ) external onlyRegistrar {
        if (wallet == address(0)) revert ZeroAddress();
        if (_wallets[wallet].registrationTime != 0) revert WalletAlreadyRegistered();
        if (walletType == WalletType.UNREGISTERED) revert InvalidWalletType();

        _wallets[wallet] = WalletInfo({
            walletType: walletType,
            linkedBankAccount: linkedBankAccount,
            customLimit: 0,
            registrationTime: block.timestamp,
            isActive: true,
            kycHash: kycHash
        });

        emit WalletRegistered(wallet, walletType, linkedBankAccount, kycHash);
    }

    /**
     * @notice Deactivate a wallet (e.g., for compliance reasons)
     * @param wallet Address to deactivate
     * @param reason Audit trail reason
     */
    function deactivateWallet(address wallet, string calldata reason) external onlyRegistrar {
        if (_wallets[wallet].registrationTime == 0) revert WalletNotRegistered();
        
        _wallets[wallet].isActive = false;
        emit WalletDeactivated(wallet, reason);
    }

    /**
     * @notice Reactivate a previously deactivated wallet
     * @param wallet Address to reactivate
     */
    function reactivateWallet(address wallet) external onlyRegistrar {
        if (_wallets[wallet].registrationTime == 0) revert WalletNotRegistered();
        
        _wallets[wallet].isActive = true;
        emit WalletReactivated(wallet);
    }

    // ============ Configuration ============

    /**
     * @notice Update the default holding limit for a wallet type
     * @param walletType The wallet type to update
     * @param limit New limit in cents
     */
    function setDefaultHoldingLimit(WalletType walletType, uint256 limit) external onlyAdmin {
        uint256 oldLimit = _defaultLimits[walletType];
        _defaultLimits[walletType] = limit;
        emit HoldingLimitUpdated(walletType, oldLimit, limit);
    }

    /**
     * @notice Set a custom limit for a specific wallet
     * @param wallet Address to set limit for
     * @param limit Custom limit (0 to use default)
     */
    function setCustomLimit(address wallet, uint256 limit) external onlyRegistrar {
        if (_wallets[wallet].registrationTime == 0) revert WalletNotRegistered();
        
        _wallets[wallet].customLimit = limit;
        emit CustomLimitSet(wallet, limit);
    }

    /**
     * @notice Update the linked bank account for waterfall
     * @param wallet Wallet address
     * @param newBankAccount New linked bank account
     */
    function updateLinkedBankAccount(address wallet, address newBankAccount) external onlyRegistrar {
        if (_wallets[wallet].registrationTime == 0) revert WalletNotRegistered();
        
        address oldBank = _wallets[wallet].linkedBankAccount;
        _wallets[wallet].linkedBankAccount = newBankAccount;
        emit LinkedBankAccountUpdated(wallet, oldBank, newBankAccount);
    }

    // ============ Queries ============

    function getWalletInfo(address wallet) external view returns (WalletInfo memory) {
        return _wallets[wallet];
    }

    function getHoldingLimit(address wallet) external view returns (uint256) {
        WalletInfo storage info = _wallets[wallet];
        
        // Unregistered wallets cannot hold any digital euro
        if (info.registrationTime == 0) {
            return 0;
        }
        
        // Use custom limit if set, otherwise default
        if (info.customLimit > 0) {
            return info.customLimit;
        }
        
        return _defaultLimits[info.walletType];
    }

    function getDefaultHoldingLimit(WalletType walletType) external view returns (uint256) {
        return _defaultLimits[walletType];
    }

    function isRegistered(address wallet) external view returns (bool) {
        return _wallets[wallet].registrationTime != 0;
    }

    function isActive(address wallet) external view returns (bool) {
        WalletInfo storage info = _wallets[wallet];
        return info.registrationTime != 0 && info.isActive;
    }

    /**
     * @notice Check if a wallet can hold a specific amount
     * @param wallet Address to check
     * @param amount Total amount that would be held
     * @return bool True if within limit
     */
    function canHold(address wallet, uint256 amount) external view returns (bool) {
        WalletInfo storage info = _wallets[wallet];
        
        if (info.registrationTime == 0 || !info.isActive) {
            return false;
        }
        
        uint256 limit = info.customLimit > 0 ? info.customLimit : _defaultLimits[info.walletType];
        return amount <= limit;
    }

    /**
     * @notice Calculate excess amount above holding limit (for waterfall)
     * @param wallet Address to check
     * @param currentBalance Current tEUR balance
     * @param incomingAmount Amount being received
     * @return uint256 Amount to sweep to linked bank account
     */
    function getExcessAmount(
        address wallet,
        uint256 currentBalance,
        uint256 incomingAmount
    ) external view returns (uint256) {
        WalletInfo storage info = _wallets[wallet];
        
        if (info.registrationTime == 0) {
            // Unregistered: all is excess
            return currentBalance + incomingAmount;
        }
        
        uint256 limit = info.customLimit > 0 ? info.customLimit : _defaultLimits[info.walletType];
        
        if (limit == UNLIMITED) {
            return 0;
        }
        
        uint256 newBalance = currentBalance + incomingAmount;
        if (newBalance <= limit) {
            return 0;
        }
        
        return newBalance - limit;
    }
}
