// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./interfaces/ITokenizedEuro.sol";
import "./interfaces/IWalletRegistry.sol";
import "./Permissioning.sol";

/**
 * @title TokenizedEuro
 * @notice ERC-20 compatible token representing the Digital Euro (tEUR)
 * @dev 1:1 backed by EUR reserves, 2 decimal places
 * 
 * ECB Digital Euro features:
 * - Holding limits enforced per wallet type
 * - Waterfall: excess funds auto-swept to linked bank account
 * - Reverse waterfall: top-up from bank for payments
 * - Fully fungible, NOT programmable money
 * 
 * Security considerations:
 * - Only authorized minters can create tokens
 * - Only authorized burners can destroy tokens
 * - Emergency controls can pause all transfers
 * - All operations are auditable
 */
contract TokenizedEuro is ITokenizedEuro {
    // Token metadata
    string public constant name = "Tokenized Euro";
    string public constant symbol = "tEUR";
    uint8 public constant decimals = 2;

    // State
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Access control
    Permissioning public immutable permissioning;
    
    // Wallet registry for holding limits
    IWalletRegistry public walletRegistry;

    // Sovereign monetary controls
    mapping(address => bool) public frozenAccounts;

    struct EscrowRecord {
        uint256 amount;
        string legalBasis;
        uint256 expiry;
    }

    mapping(address => EscrowRecord) public escrowedBalances;
    mapping(address => uint256) public escrowTotals;

    // Emergency controls
    bool public paused;
    
    // Waterfall configuration
    bool public waterfallEnabled;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value, bytes32 indexed idempotencyKey);
    event Burn(address indexed from, uint256 value, bytes32 indexed idempotencyKey);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event WaterfallExecuted(address indexed wallet, address indexed bankAccount, uint256 amount);
    event ReverseWaterfallExecuted(address indexed wallet, address indexed bankAccount, uint256 amount);
    event WalletRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event WaterfallToggled(bool enabled);

    // Sovereign monetary control events
    event AccountFrozen(address indexed account, address indexed by, string reason);
    event AccountUnfrozen(address indexed account, address indexed by);
    event FundsEscrowed(address indexed account, uint256 amount, string legalBasis, uint256 expiry);
    event FundsReleased(address indexed account, uint256 amount, address indexed to);
    event FundsBurnedFromEscrow(address indexed account, uint256 amount);

    // Errors
    error Unauthorized();
    error ContractPaused();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();
    error IdempotencyKeyUsed();
    error WalletNotRegistered();
    error WalletNotActive();
    error HoldingLimitExceeded();
    error NoLinkedBankAccount();
    error WaterfallDisabled();
    error AccountIsFrozen();
    error InsufficientEscrowBalance();
    error EscrowExpired();
    error InvalidAmount();

    // Idempotency tracking
    mapping(bytes32 => bool) private _usedIdempotencyKeys;

    modifier onlyMinter() {
        if (!permissioning.isMinter(msg.sender)) revert Unauthorized();
        _;
    }

    modifier onlyBurner() {
        if (!permissioning.isBurner(msg.sender)) revert Unauthorized();
        _;
    }

    modifier onlyEmergencyController() {
        if (!permissioning.isEmergencyController(msg.sender)) revert Unauthorized();
        _;
    }

    modifier onlyECB() {
        if (!permissioning.isECB(msg.sender)) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier idempotent(bytes32 key) {
        if (_usedIdempotencyKeys[key]) revert IdempotencyKeyUsed();
        _usedIdempotencyKeys[key] = true;
        _;
    }

    constructor(address _permissioning) {
        if (_permissioning == address(0)) revert ZeroAddress();
        permissioning = Permissioning(_permissioning);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the wallet registry for holding limit enforcement
     * @param _walletRegistry Address of the WalletRegistry contract
     */
    function setWalletRegistry(address _walletRegistry) external {
        if (!permissioning.isAdmin(msg.sender)) revert Unauthorized();
        
        address oldRegistry = address(walletRegistry);
        walletRegistry = IWalletRegistry(_walletRegistry);
        emit WalletRegistryUpdated(oldRegistry, _walletRegistry);
    }

    /**
     * @notice Toggle waterfall functionality
     * @param enabled Whether waterfall should be enabled
     */
    function setWaterfallEnabled(bool enabled) external {
        if (!permissioning.isAdmin(msg.sender)) revert Unauthorized();
        
        waterfallEnabled = enabled;
        emit WaterfallToggled(enabled);
    }

    // ============ ERC-20 Implementation ============

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external whenNotPaused returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance();
            unchecked {
                _approve(from, msg.sender, currentAllowance - amount);
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    // Minting and Burning

    /**
     * @notice Mint new tEUR tokens
     * @param to Recipient address
     * @param amount Amount to mint (in cents, 2 decimals)
     * @param idempotencyKey Unique key to prevent duplicate minting
     */
    function mint(
        address to,
        uint256 amount,
        bytes32 idempotencyKey
    ) external onlyECB whenNotPaused idempotent(idempotencyKey) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        _totalSupply += amount;
        _balances[to] += amount;
        
        emit Mint(to, amount, idempotencyKey);
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice Burn tEUR tokens
     * @param from Address to burn from
     * @param amount Amount to burn (in cents, 2 decimals)
     * @param idempotencyKey Unique key to prevent duplicate burning
     */
    function burn(
        address from,
        uint256 amount,
        bytes32 idempotencyKey
    ) external onlyECB whenNotPaused idempotent(idempotencyKey) {
        if (_balances[from] < amount) revert InsufficientBalance();
        
        _balances[from] -= amount;
        _totalSupply -= amount;
        
        emit Burn(from, amount, idempotencyKey);
        emit Transfer(from, address(0), amount);
    }

    // Emergency Controls

    function pause() external onlyEmergencyController {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyEmergencyController {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ============ Sovereign Monetary Controls ============

    /**
     * @notice Freeze an account (sanctions)
     * @param account Address to freeze
     * @param reason Reason for freezing
     */
    function freezeAccount(address account, string calldata reason) external onlyECB {
        if (account == address(0)) revert ZeroAddress();
        frozenAccounts[account] = true;
        emit AccountFrozen(account, msg.sender, reason);
    }

    /**
     * @notice Unfreeze an account
     * @param account Address to unfreeze
     */
    function unfreezeAccount(address account) external onlyECB {
        if (account == address(0)) revert ZeroAddress();
        frozenAccounts[account] = false;
        emit AccountUnfrozen(account, msg.sender);
    }

    /**
     * @notice Escrow funds from an account
     * @param account Address to escrow from
     * @param amount Amount to escrow
     * @param legalBasis Legal basis for escrow
     * @param expiry Expiry timestamp (0 for no expiry)
     */
    function escrowFunds(address account, uint256 amount, string calldata legalBasis, uint256 expiry) external onlyECB {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (_balances[account] < amount) revert InsufficientBalance();

        _balances[account] -= amount;
        escrowedBalances[account] = EscrowRecord(amount, legalBasis, expiry);
        escrowTotals[account] += amount;

        emit FundsEscrowed(account, amount, legalBasis, expiry);
    }

    /**
     * @notice Release escrowed funds to an account
     * @param account Address to release from escrow
     * @param to Address to send funds to
     */
    function releaseEscrowedFunds(address account, address to) external onlyECB {
        if (account == address(0) || to == address(0)) revert ZeroAddress();
        EscrowRecord memory record = escrowedBalances[account];
        if (record.amount == 0) revert InsufficientEscrowBalance();
        if (record.expiry > 0 && block.timestamp > record.expiry) revert EscrowExpired();

        uint256 amount = record.amount;
        _balances[to] += amount;
        escrowTotals[account] -= amount;
        delete escrowedBalances[account];

        emit FundsReleased(account, amount, to);
    }

    /**
     * @notice Burn funds from escrow
     * @param account Address to burn escrow from
     */
    function burnEscrowedFunds(address account) external onlyECB {
        if (account == address(0)) revert ZeroAddress();
        EscrowRecord memory record = escrowedBalances[account];
        if (record.amount == 0) revert InsufficientEscrowBalance();

        uint256 amount = record.amount;
        _totalSupply -= amount;
        escrowTotals[account] -= amount;
        delete escrowedBalances[account];

        emit FundsBurnedFromEscrow(account, amount);
    }

    // ============ Waterfall Functions ============

    /**
     * @notice Execute waterfall: sweep excess tEUR to linked bank account
     * @dev Called automatically on transfers or manually by authorized operator
     * @param wallet Address to sweep from
     */
    function executeWaterfall(address wallet) external whenNotPaused {
        if (!waterfallEnabled) revert WaterfallDisabled();
        if (!permissioning.isWaterfallOperator(msg.sender)) revert Unauthorized();
        
        _executeWaterfall(wallet);
    }

    /**
     * @notice Execute reverse waterfall: top-up wallet from linked bank account
     * @dev Mints tEUR to wallet, burns from bank account
     * @param wallet Address to top up
     * @param amount Amount to top up
     * @param idempotencyKey Unique key for idempotency
     */
    function executeReverseWaterfall(
        address wallet,
        uint256 amount,
        bytes32 idempotencyKey
    ) external whenNotPaused onlyMinter idempotent(idempotencyKey) {
        if (address(walletRegistry) == address(0)) revert WalletNotRegistered();
        
        IWalletRegistry.WalletInfo memory info = walletRegistry.getWalletInfo(wallet);
        if (info.registrationTime == 0) revert WalletNotRegistered();
        if (!info.isActive) revert WalletNotActive();
        if (info.linkedBankAccount == address(0)) revert NoLinkedBankAccount();
        
        // Burn from bank account
        if (_balances[info.linkedBankAccount] < amount) revert InsufficientBalance();
        _balances[info.linkedBankAccount] -= amount;
        
        // Credit to wallet (up to limit)
        uint256 limit = walletRegistry.getHoldingLimit(wallet);
        uint256 newBalance = _balances[wallet] + amount;
        
        if (newBalance > limit) {
            // Only transfer up to limit
            uint256 allowedAmount = limit - _balances[wallet];
            _balances[wallet] = limit;
            // Return excess to bank
            _balances[info.linkedBankAccount] += (amount - allowedAmount);
            
            emit ReverseWaterfallExecuted(wallet, info.linkedBankAccount, allowedAmount);
            emit Transfer(info.linkedBankAccount, wallet, allowedAmount);
        } else {
            _balances[wallet] = newBalance;
            
            emit ReverseWaterfallExecuted(wallet, info.linkedBankAccount, amount);
            emit Transfer(info.linkedBankAccount, wallet, amount);
        }
    }

    // ============ Internal Functions ============

    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (frozenAccounts[from]) revert AccountIsFrozen();
        if (frozenAccounts[to]) revert AccountIsFrozen();
        if (_balances[from] < amount) revert InsufficientBalance();

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);

        // Execute waterfall for recipient if enabled and registry is set
        if (waterfallEnabled && address(walletRegistry) != address(0)) {
            _executeWaterfall(to);
        }
    }

    function _executeWaterfall(address wallet) internal {
        if (address(walletRegistry) == address(0)) return;
        
        IWalletRegistry.WalletInfo memory info = walletRegistry.getWalletInfo(wallet);
        if (info.registrationTime == 0 || !info.isActive) return;
        if (info.linkedBankAccount == address(0)) return;
        
        uint256 excess = walletRegistry.getExcessAmount(wallet, _balances[wallet], 0);
        if (excess == 0) return;
        
        // Sweep excess to linked bank account
        _balances[wallet] -= excess;
        _balances[info.linkedBankAccount] += excess;
        
        emit WaterfallExecuted(wallet, info.linkedBankAccount, excess);
        emit Transfer(wallet, info.linkedBankAccount, excess);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        if (owner == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Check if a transfer would exceed the recipient's holding limit
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return bool True if transfer would exceed limit
     */
    function wouldExceedLimit(address to, uint256 amount) external view returns (bool) {
        if (address(walletRegistry) == address(0)) return false;
        
        uint256 newBalance = _balances[to] + amount;
        uint256 limit = walletRegistry.getHoldingLimit(to);
        
        return newBalance > limit;
    }

    /**
     * @notice Get the amount that would be swept via waterfall after a transfer
     * @param to Recipient address
     * @param amount Amount being transferred
     * @return uint256 Amount that would be swept to linked bank
     */
    function getWaterfallAmount(address to, uint256 amount) external view returns (uint256) {
        if (address(walletRegistry) == address(0)) return 0;
        
        return walletRegistry.getExcessAmount(to, _balances[to], amount);
    }

    // Idempotency check
    function isIdempotencyKeyUsed(bytes32 key) external view returns (bool) {
        return _usedIdempotencyKeys[key];
    }
}
