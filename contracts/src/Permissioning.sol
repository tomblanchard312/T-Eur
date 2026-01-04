// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title Permissioning
 * @notice Role-based access control for tEUR infrastructure
 * @dev Manages all roles for Digital Euro ecosystem
 * 
 * Security considerations:
 * - Multi-sig required for role changes in production
 * - All role changes are logged for audit
 * - No role can be granted to zero address
 */
contract Permissioning {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");   // Can register wallets
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");         // Can confirm conditions
    bytes32 public constant WATERFALL_ROLE = keccak256("WATERFALL_ROLE");   // Can execute waterfall sweeps

    // Sovereign monetary control roles
    bytes32 public constant ECB_ROLE = keccak256("ECB_ROLE");
    bytes32 public constant STATE_BANK_ROLE = keccak256("STATE_BANK_ROLE");
    bytes32 public constant LOCAL_BANK_ROLE = keccak256("LOCAL_BANK_ROLE");
    bytes32 public constant PSP_ROLE = keccak256("PSP_ROLE");
    bytes32 public constant MERCHANT_ROLE = keccak256("MERCHANT_ROLE");
    bytes32 public constant WALLET_HOLDER_ROLE = keccak256("WALLET_HOLDER_ROLE");

    // Role mappings
    mapping(bytes32 => mapping(address => bool)) private _roles;

    // Events
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    // Errors
    error Unauthorized();
    error ZeroAddress();
    error RoleAlreadyGranted();
    error RoleNotGranted();

    modifier onlyAdmin() {
        if (!_roles[ADMIN_ROLE][msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        _roles[ADMIN_ROLE][initialAdmin] = true;
        emit RoleGranted(ADMIN_ROLE, initialAdmin, msg.sender);
    }

    // Role management

    function grantRole(bytes32 role, address account) external onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        if (_roles[role][account]) revert RoleAlreadyGranted();
        
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) external onlyAdmin {
        if (!_roles[role][account]) revert RoleNotGranted();
        
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    // Role checks

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }

    function isAdmin(address account) external view returns (bool) {
        return _roles[ADMIN_ROLE][account];
    }

    function isMinter(address account) external view returns (bool) {
        return _roles[MINTER_ROLE][account];
    }

    function isBurner(address account) external view returns (bool) {
        return _roles[BURNER_ROLE][account];
    }

    function isEmergencyController(address account) external view returns (bool) {
        return _roles[EMERGENCY_ROLE][account];
    }

    function isValidator(address account) external view returns (bool) {
        return _roles[VALIDATOR_ROLE][account];
    }

    function isRegistrar(address account) external view returns (bool) {
        return _roles[REGISTRAR_ROLE][account];
    }

    function isOracle(address account) external view returns (bool) {
        return _roles[ORACLE_ROLE][account];
    }

    function isWaterfallOperator(address account) external view returns (bool) {
        return _roles[WATERFALL_ROLE][account];
    }

    function isECB(address account) external view returns (bool) {
        return _roles[ECB_ROLE][account];
    }

    function isStateBank(address account) external view returns (bool) {
        return _roles[STATE_BANK_ROLE][account];
    }

    function isLocalBank(address account) external view returns (bool) {
        return _roles[LOCAL_BANK_ROLE][account];
    }

    function isPSP(address account) external view returns (bool) {
        return _roles[PSP_ROLE][account];
    }

    function isMerchant(address account) external view returns (bool) {
        return _roles[MERCHANT_ROLE][account];
    }

    function isWalletHolder(address account) external view returns (bool) {
        return _roles[WALLET_HOLDER_ROLE][account];
    }
}
