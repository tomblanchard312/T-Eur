// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenLedgerV2.sol";

contract EscrowControllerV2 {
    enum EscrowState {
        None,
        Active,
        Released,
        Burned,
        Expired,
        Cancelled
    }

    struct EscrowCase {
        address source;
        address beneficiary;
        uint256 amount;
        uint256 expiry;
        bytes32 caseReferenceHash;
        bytes32 documentHash;
        EscrowState state;
    }

    ITokenLedgerV2 public immutable ledger;
    address public immutable authority;
    uint256 public nextNonce;
    uint256 public totalActiveEscrow;

    mapping(bytes32 => EscrowCase) private _cases;
    mapping(address => uint256) public activeEscrowBySource;
    mapping(bytes32 => bool) public usedOperationDigests;

    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed source,
        address indexed beneficiary,
        uint256 amount,
        uint256 expiry,
        bytes32 caseReferenceHash,
        bytes32 documentHash
    );
    event EscrowReleased(bytes32 indexed escrowId, address indexed beneficiary, uint256 amount);
    event EscrowBurned(bytes32 indexed escrowId, uint256 amount);
    event EscrowExpired(bytes32 indexed escrowId, address indexed source, uint256 amount);
    event EscrowCancelled(bytes32 indexed escrowId, address indexed source, uint256 amount);

    error Unauthorized();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidExpiry();
    error InvalidReference();
    error InvalidState();
    error NotExpired();
    error PastExpiry();
    error OperationAlreadyUsed();

    modifier onlyAuthority() {
        if (msg.sender != authority) revert Unauthorized();
        _;
    }

    constructor(address ledgerAddress, address authorityAddress) {
        if (ledgerAddress == address(0) || authorityAddress == address(0)) revert ZeroAddress();
        ledger = ITokenLedgerV2(ledgerAddress);
        authority = authorityAddress;
    }

    function createEscrow(
        address source,
        address beneficiary,
        uint256 amount,
        uint256 expiry,
        bytes32 caseReferenceHash,
        bytes32 documentHash,
        bytes32 clientKey
    ) external onlyAuthority returns (bytes32 escrowId) {
        if (source == address(0) || beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (expiry != 0 && expiry <= block.timestamp) revert InvalidExpiry();
        if (caseReferenceHash == bytes32(0)) revert InvalidReference();

        bytes32 operationDigest = _operationDigest(
            keccak256("CREATE_ESCROW"),
            msg.sender,
            source,
            amount,
            clientKey
        );
        _consumeOperation(operationDigest);

        uint256 nonce = nextNonce++;
        escrowId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                nonce,
                source,
                beneficiary,
                amount,
                caseReferenceHash
            )
        );

        _cases[escrowId] = EscrowCase({
            source: source,
            beneficiary: beneficiary,
            amount: amount,
            expiry: expiry,
            caseReferenceHash: caseReferenceHash,
            documentHash: documentHash,
            state: EscrowState.Active
        });

        activeEscrowBySource[source] += amount;
        totalActiveEscrow += amount;
        ledger.controllerMove(source, address(this), amount);

        emit EscrowCreated(
            escrowId,
            source,
            beneficiary,
            amount,
            expiry,
            caseReferenceHash,
            documentHash
        );
    }

    function releaseEscrow(bytes32 escrowId, bytes32 clientKey) external onlyAuthority {
        EscrowCase storage escrowCase = _requireActiveBeforeExpiry(escrowId);
        bytes32 operationDigest = _operationDigest(
            keccak256("RELEASE_ESCROW"),
            msg.sender,
            escrowCase.beneficiary,
            escrowCase.amount,
            clientKey
        );
        _consumeOperation(operationDigest);

        uint256 amount = escrowCase.amount;
        address beneficiary = escrowCase.beneficiary;
        _closeEscrow(escrowCase, EscrowState.Released);
        ledger.controllerMove(address(this), beneficiary, amount);

        emit EscrowReleased(escrowId, beneficiary, amount);
    }

    function burnEscrow(bytes32 escrowId, bytes32 clientKey) external onlyAuthority {
        EscrowCase storage escrowCase = _requireActiveBeforeExpiry(escrowId);
        bytes32 operationDigest = _operationDigest(
            keccak256("BURN_ESCROW"),
            msg.sender,
            escrowCase.source,
            escrowCase.amount,
            clientKey
        );
        _consumeOperation(operationDigest);

        uint256 amount = escrowCase.amount;
        _closeEscrow(escrowCase, EscrowState.Burned);
        ledger.controllerBurn(address(this), amount, clientKey);

        emit EscrowBurned(escrowId, amount);
    }

    function cancelEscrow(bytes32 escrowId, bytes32 clientKey) external onlyAuthority {
        EscrowCase storage escrowCase = _requireActiveBeforeExpiry(escrowId);
        bytes32 operationDigest = _operationDigest(
            keccak256("CANCEL_ESCROW"),
            msg.sender,
            escrowCase.source,
            escrowCase.amount,
            clientKey
        );
        _consumeOperation(operationDigest);

        uint256 amount = escrowCase.amount;
        address source = escrowCase.source;
        _closeEscrow(escrowCase, EscrowState.Cancelled);
        ledger.controllerMove(address(this), source, amount);

        emit EscrowCancelled(escrowId, source, amount);
    }

    function expireEscrow(bytes32 escrowId) external {
        EscrowCase storage escrowCase = _requireActive(escrowId);
        if (escrowCase.expiry == 0 || block.timestamp < escrowCase.expiry) revert NotExpired();

        uint256 amount = escrowCase.amount;
        address source = escrowCase.source;
        _closeEscrow(escrowCase, EscrowState.Expired);
        ledger.controllerMove(address(this), source, amount);

        emit EscrowExpired(escrowId, source, amount);
    }

    function getEscrow(bytes32 escrowId) external view returns (EscrowCase memory) {
        return _cases[escrowId];
    }

    function operationDigest(
        bytes32 operationType,
        address actor,
        address target,
        uint256 amount,
        bytes32 clientKey
    ) external view returns (bytes32) {
        return _operationDigest(operationType, actor, target, amount, clientKey);
    }

    function _requireActive(bytes32 escrowId) internal view returns (EscrowCase storage escrowCase) {
        escrowCase = _cases[escrowId];
        if (escrowCase.state != EscrowState.Active) revert InvalidState();
    }

    function _requireActiveBeforeExpiry(bytes32 escrowId)
        internal
        view
        returns (EscrowCase storage escrowCase)
    {
        escrowCase = _requireActive(escrowId);
        if (escrowCase.expiry != 0 && block.timestamp >= escrowCase.expiry) revert PastExpiry();
    }

    function _closeEscrow(EscrowCase storage escrowCase, EscrowState finalState) internal {
        escrowCase.state = finalState;
        activeEscrowBySource[escrowCase.source] -= escrowCase.amount;
        totalActiveEscrow -= escrowCase.amount;
    }

    function _consumeOperation(bytes32 digest) internal {
        if (usedOperationDigests[digest]) revert OperationAlreadyUsed();
        usedOperationDigests[digest] = true;
    }

    function _operationDigest(
        bytes32 operationType,
        address actor,
        address target,
        uint256 amount,
        bytes32 clientKey
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                operationType,
                actor,
                target,
                amount,
                clientKey
            )
        );
    }
}
