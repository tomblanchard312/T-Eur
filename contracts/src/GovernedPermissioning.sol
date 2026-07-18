// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GovernedPermissioning
 * @notice Dual-control role administration for tEUR infrastructure.
 * @dev Every role mutation requires two distinct active administrators.
 */
contract GovernedPermissioning {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant WATERFALL_ROLE = keccak256("WATERFALL_ROLE");
    bytes32 public constant ECB_ROLE = keccak256("ECB_ROLE");
    bytes32 public constant STATE_BANK_ROLE = keccak256("STATE_BANK_ROLE");
    bytes32 public constant LOCAL_BANK_ROLE = keccak256("LOCAL_BANK_ROLE");
    bytes32 public constant PSP_ROLE = keccak256("PSP_ROLE");
    bytes32 public constant MERCHANT_ROLE = keccak256("MERCHANT_ROLE");
    bytes32 public constant WALLET_HOLDER_ROLE = keccak256("WALLET_HOLDER_ROLE");

    uint256 public constant MIN_PROPOSAL_LIFETIME = 1 hours;
    uint256 public constant MAX_PROPOSAL_LIFETIME = 14 days;

    struct RoleProposal {
        bytes32 role;
        address account;
        bool grant;
        address proposer;
        address approver;
        uint64 expiresAt;
        bool executed;
        bool cancelled;
    }

    mapping(bytes32 => mapping(address => bool)) private _roles;
    mapping(bytes32 => RoleProposal) public proposals;
    uint256 public adminCount;
    uint256 public proposalNonce;

    event RoleChangeProposed(bytes32 indexed proposalId, bytes32 indexed role, address indexed account, bool grant, address proposer, uint256 expiresAt);
    event RoleChangeApproved(bytes32 indexed proposalId, address indexed approver);
    event RoleChangeCancelled(bytes32 indexed proposalId, address indexed cancelledBy);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    error Unauthorized();
    error ZeroAddress();
    error DuplicateAdmin();
    error InvalidLifetime();
    error ProposalNotFound();
    error ProposalExpired();
    error ProposalFinalized();
    error SelfApproval();
    error RoleAlreadyGranted();
    error RoleNotGranted();
    error LastAdmin();

    modifier onlyAdmin() {
        if (!_roles[ADMIN_ROLE][msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address initialAdmin, address secondAdmin) {
        if (initialAdmin == address(0) || secondAdmin == address(0)) revert ZeroAddress();
        if (initialAdmin == secondAdmin) revert DuplicateAdmin();
        _roles[ADMIN_ROLE][initialAdmin] = true;
        _roles[ADMIN_ROLE][secondAdmin] = true;
        adminCount = 2;
        emit RoleGranted(ADMIN_ROLE, initialAdmin, msg.sender);
        emit RoleGranted(ADMIN_ROLE, secondAdmin, msg.sender);
    }

    function proposeRoleChange(bytes32 role, address account, bool grant, uint256 lifetime)
        external
        onlyAdmin
        returns (bytes32 proposalId)
    {
        if (account == address(0)) revert ZeroAddress();
        if (lifetime < MIN_PROPOSAL_LIFETIME || lifetime > MAX_PROPOSAL_LIFETIME) revert InvalidLifetime();
        if (grant && _roles[role][account]) revert RoleAlreadyGranted();
        if (!grant && !_roles[role][account]) revert RoleNotGranted();
        if (!grant && role == ADMIN_ROLE && adminCount <= 2) revert LastAdmin();

        proposalId = keccak256(abi.encode(block.chainid, address(this), ++proposalNonce, role, account, grant, msg.sender));
        proposals[proposalId] = RoleProposal(role, account, grant, msg.sender, address(0), uint64(block.timestamp + lifetime), false, false);
        emit RoleChangeProposed(proposalId, role, account, grant, msg.sender, block.timestamp + lifetime);
    }

    function approveAndExecute(bytes32 proposalId) external onlyAdmin {
        RoleProposal storage proposal = proposals[proposalId];
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed || proposal.cancelled) revert ProposalFinalized();
        if (block.timestamp > proposal.expiresAt) revert ProposalExpired();
        if (proposal.proposer == msg.sender) revert SelfApproval();

        proposal.approver = msg.sender;
        proposal.executed = true;
        if (proposal.grant) {
            if (_roles[proposal.role][proposal.account]) revert RoleAlreadyGranted();
            _roles[proposal.role][proposal.account] = true;
            if (proposal.role == ADMIN_ROLE) adminCount += 1;
            emit RoleGranted(proposal.role, proposal.account, msg.sender);
        } else {
            if (!_roles[proposal.role][proposal.account]) revert RoleNotGranted();
            if (proposal.role == ADMIN_ROLE) {
                if (adminCount <= 2) revert LastAdmin();
                adminCount -= 1;
            }
            _roles[proposal.role][proposal.account] = false;
            emit RoleRevoked(proposal.role, proposal.account, msg.sender);
        }
        emit RoleChangeApproved(proposalId, msg.sender);
    }

    function cancelProposal(bytes32 proposalId) external onlyAdmin {
        RoleProposal storage proposal = proposals[proposalId];
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed || proposal.cancelled) revert ProposalFinalized();
        if (msg.sender != proposal.proposer) revert Unauthorized();
        proposal.cancelled = true;
        emit RoleChangeCancelled(proposalId, msg.sender);
    }

    function hasRole(bytes32 role, address account) external view returns (bool) { return _roles[role][account]; }
    function isAdmin(address account) external view returns (bool) { return _roles[ADMIN_ROLE][account]; }
    function isMinter(address account) external view returns (bool) { return _roles[MINTER_ROLE][account]; }
    function isBurner(address account) external view returns (bool) { return _roles[BURNER_ROLE][account]; }
    function isEmergencyController(address account) external view returns (bool) { return _roles[EMERGENCY_ROLE][account]; }
    function isValidator(address account) external view returns (bool) { return _roles[VALIDATOR_ROLE][account]; }
    function isRegistrar(address account) external view returns (bool) { return _roles[REGISTRAR_ROLE][account]; }
    function isOracle(address account) external view returns (bool) { return _roles[ORACLE_ROLE][account]; }
    function isWaterfallOperator(address account) external view returns (bool) { return _roles[WATERFALL_ROLE][account]; }
    function isECB(address account) external view returns (bool) { return _roles[ECB_ROLE][account]; }
    function isStateBank(address account) external view returns (bool) { return _roles[STATE_BANK_ROLE][account]; }
    function isLocalBank(address account) external view returns (bool) { return _roles[LOCAL_BANK_ROLE][account]; }
    function isPSP(address account) external view returns (bool) { return _roles[PSP_ROLE][account]; }
    function isMerchant(address account) external view returns (bool) { return _roles[MERCHANT_ROLE][account]; }
    function isWalletHolder(address account) external view returns (bool) { return _roles[WALLET_HOLDER_ROLE][account]; }
}
