// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./interfaces/ITokenizedEuro.sol";
import "./interfaces/IWalletRegistry.sol";
import "./Permissioning.sol";

contract TokenizedEuro is ITokenizedEuro {
    string public constant name = "Tokenized Euro";
    string public constant symbol = "tEUR";
    uint8 public constant decimals = 2;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    Permissioning public immutable permissioning;
    IWalletRegistry public walletRegistry;

    mapping(address => bool) public frozenAccounts;

    struct EscrowRecord {
        uint256 amount;
        string legalBasis;
        uint256 expiry;
    }

    mapping(address => EscrowRecord) public escrowedBalances;
    mapping(address => uint256) public escrowTotals;

    bool public paused;
    bool public waterfallEnabled;

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
    event AccountFrozen(address indexed account, address indexed by, string reason);
    event AccountUnfrozen(address indexed account, address indexed by);
    event FundsEscrowed(address indexed account, uint256 amount, string legalBasis, uint256 expiry);
    event FundsReleased(address indexed account, uint256 amount, address indexed to);
    event FundsBurnedFromEscrow(address indexed account, uint256 amount);

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
    error ActiveEscrowExists();

    mapping(bytes32 => bool) private _usedIdempotencyKeys;

    modifier onlyMinter() {
        if (!permissioning.isMinter(msg.sender)) revert Unauthorized();
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

    constructor(address permissioningAddress) {
        if (permissioningAddress == address(0)) revert ZeroAddress();
        permissioning = Permissioning(permissioningAddress);
    }

    function setWalletRegistry(address walletRegistryAddress) external {
        if (!permissioning.isAdmin(msg.sender)) revert Unauthorized();
        if (walletRegistryAddress == address(0)) revert ZeroAddress();
        address oldRegistry = address(walletRegistry);
        walletRegistry = IWalletRegistry(walletRegistryAddress);
        emit WalletRegistryUpdated(oldRegistry, walletRegistryAddress);
    }

    function setWaterfallEnabled(bool enabled) external {
        if (!permissioning.isAdmin(msg.sender)) revert Unauthorized();
        waterfallEnabled = enabled;
        emit WaterfallToggled(enabled);
    }

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

    function transferFrom(address from, address to, uint256 amount) external whenNotPaused returns (bool) {
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

    function mint(address to, uint256 amount, bytes32 idempotencyKey)
        external
        onlyECB
        whenNotPaused
        idempotent(idempotencyKey)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        _totalSupply += amount;
        _balances[to] += amount;
        emit Mint(to, amount, idempotencyKey);
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount, bytes32 idempotencyKey)
        external
        onlyECB
        whenNotPaused
        idempotent(idempotencyKey)
    {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (_balances[from] < amount) revert InsufficientBalance();
        _balances[from] -= amount;
        _totalSupply -= amount;
        emit Burn(from, amount, idempotencyKey);
        emit Transfer(from, address(0), amount);
    }

    function pause() external onlyEmergencyController {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyEmergencyController {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function freezeAccount(address account, string calldata reason) external onlyECB {
        if (account == address(0)) revert ZeroAddress();
        frozenAccounts[account] = true;
        emit AccountFrozen(account, msg.sender, reason);
    }

    function unfreezeAccount(address account) external onlyECB {
        if (account == address(0)) revert ZeroAddress();
        frozenAccounts[account] = false;
        emit AccountUnfrozen(account, msg.sender);
    }

    function escrowFunds(address account, uint256 amount, string calldata legalBasis, uint256 expiry)
        external
        onlyECB
    {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (expiry != 0 && expiry <= block.timestamp) revert EscrowExpired();
        if (escrowedBalances[account].amount != 0 || escrowTotals[account] != 0) revert ActiveEscrowExists();
        if (_balances[account] < amount) revert InsufficientBalance();

        _balances[account] -= amount;
        escrowedBalances[account] = EscrowRecord(amount, legalBasis, expiry);
        escrowTotals[account] = amount;
        emit FundsEscrowed(account, amount, legalBasis, expiry);
    }

    function releaseEscrowedFunds(address account, address to) external onlyECB {
        if (account == address(0) || to == address(0)) revert ZeroAddress();
        EscrowRecord memory record = escrowedBalances[account];
        if (record.amount == 0) revert InsufficientEscrowBalance();
        if (record.expiry > 0 && block.timestamp > record.expiry) revert EscrowExpired();

        delete escrowedBalances[account];
        escrowTotals[account] = 0;
        _balances[to] += record.amount;
        emit FundsReleased(account, record.amount, to);
    }

    function burnEscrowedFunds(address account) external onlyECB {
        if (account == address(0)) revert ZeroAddress();
        EscrowRecord memory record = escrowedBalances[account];
        if (record.amount == 0) revert InsufficientEscrowBalance();

        delete escrowedBalances[account];
        escrowTotals[account] = 0;
        _totalSupply -= record.amount;
        emit FundsBurnedFromEscrow(account, record.amount);
    }

    function executeWaterfall(address wallet) external whenNotPaused {
        if (!waterfallEnabled) revert WaterfallDisabled();
        if (!permissioning.isWaterfallOperator(msg.sender)) revert Unauthorized();
        _executeWaterfall(wallet);
    }

    function executeReverseWaterfall(address wallet, uint256 amount, bytes32 idempotencyKey)
        external
        whenNotPaused
        onlyMinter
        idempotent(idempotencyKey)
    {
        if (amount == 0) revert InvalidAmount();
        if (address(walletRegistry) == address(0)) revert WalletNotRegistered();

        IWalletRegistry.WalletInfo memory info = walletRegistry.getWalletInfo(wallet);
        if (info.registrationTime == 0) revert WalletNotRegistered();
        if (!info.isActive) revert WalletNotActive();
        if (info.linkedBankAccount == address(0)) revert NoLinkedBankAccount();
        if (_balances[info.linkedBankAccount] < amount) revert InsufficientBalance();

        _balances[info.linkedBankAccount] -= amount;
        uint256 limit = walletRegistry.getHoldingLimit(wallet);
        uint256 newBalance = _balances[wallet] + amount;

        if (newBalance > limit) {
            uint256 allowedAmount = limit - _balances[wallet];
            _balances[wallet] = limit;
            _balances[info.linkedBankAccount] += amount - allowedAmount;
            emit ReverseWaterfallExecuted(wallet, info.linkedBankAccount, allowedAmount);
            emit Transfer(info.linkedBankAccount, wallet, allowedAmount);
        } else {
            _balances[wallet] = newBalance;
            emit ReverseWaterfallExecuted(wallet, info.linkedBankAccount, amount);
            emit Transfer(info.linkedBankAccount, wallet, amount);
        }
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (frozenAccounts[from] || frozenAccounts[to]) revert AccountIsFrozen();
        if (_balances[from] < amount) revert InsufficientBalance();

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);

        if (waterfallEnabled && address(walletRegistry) != address(0)) {
            _executeWaterfall(to);
        }
    }

    function _executeWaterfall(address wallet) internal {
        if (address(walletRegistry) == address(0)) return;
        IWalletRegistry.WalletInfo memory info = walletRegistry.getWalletInfo(wallet);
        if (info.registrationTime == 0 || !info.isActive || info.linkedBankAccount == address(0)) return;

        uint256 excess = walletRegistry.getExcessAmount(wallet, _balances[wallet], 0);
        if (excess == 0) return;
        _balances[wallet] -= excess;
        _balances[info.linkedBankAccount] += excess;
        emit WaterfallExecuted(wallet, info.linkedBankAccount, excess);
        emit Transfer(wallet, info.linkedBankAccount, excess);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        if (owner == address(0) || spender == address(0)) revert ZeroAddress();
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function wouldExceedLimit(address to, uint256 amount) external view returns (bool) {
        if (address(walletRegistry) == address(0)) return false;
        return _balances[to] + amount > walletRegistry.getHoldingLimit(to);
    }

    function getWaterfallAmount(address to, uint256 amount) external view returns (uint256) {
        if (address(walletRegistry) == address(0)) return 0;
        return walletRegistry.getExcessAmount(to, _balances[to], amount);
    }

    function isIdempotencyKeyUsed(bytes32 key) external view returns (bool) {
        return _usedIdempotencyKeys[key];
    }
}
