// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenLedgerV2.sol";
import "./MerkleProofV2.sol";

contract MigrationControllerV2 {
    enum MigrationState {
        Active,
        Finalized,
        Cancelled
    }

    ITokenLedgerV2 public immutable ledger;
    address public immutable governance;
    bytes32 public immutable snapshotId;
    bytes32 public immutable manifestHash;
    bytes32 public immutable balanceRoot;
    uint256 public immutable expectedTotal;
    uint256 public immutable claimDeadline;

    MigrationState public state;
    bool public claimsPaused;
    uint256 public claimedTotal;
    uint256 public claimedAccounts;

    mapping(uint256 => uint256) private _claimedBitMap;

    event BalanceClaimed(uint256 indexed index, address indexed account, uint256 amount, bytes32 indexed leaf);
    event ClaimsPaused(address indexed governance);
    event ClaimsUnpaused(address indexed governance);
    event MigrationFinalized(uint256 claimedAccounts, uint256 claimedTotal, uint256 ledgerTotalSupply);
    event MigrationCancelled(address indexed governance);

    error Unauthorized();
    error ZeroAddress();
    error InvalidConfiguration();
    error InvalidState();
    error ClaimsArePaused();
    error ClaimWindowClosed();
    error AlreadyClaimed();
    error InvalidProof();
    error InvalidAmount();
    error ReconciliationMismatch();
    error ClaimsAlreadyStarted();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyActive() {
        if (state != MigrationState.Active) revert InvalidState();
        _;
    }

    constructor(
        address ledgerAddress,
        address governanceAddress,
        bytes32 snapshotIdentifier,
        bytes32 signedManifestHash,
        bytes32 balancesRoot,
        uint256 expectedMigrationTotal,
        uint256 deadline
    ) {
        if (ledgerAddress == address(0) || governanceAddress == address(0)) revert ZeroAddress();
        if (
            snapshotIdentifier == bytes32(0) || signedManifestHash == bytes32(0) || balancesRoot == bytes32(0)
                || expectedMigrationTotal == 0 || deadline <= block.timestamp
        ) revert InvalidConfiguration();

        ledger = ITokenLedgerV2(ledgerAddress);
        governance = governanceAddress;
        snapshotId = snapshotIdentifier;
        manifestHash = signedManifestHash;
        balanceRoot = balancesRoot;
        expectedTotal = expectedMigrationTotal;
        claimDeadline = deadline;
        state = MigrationState.Active;
    }

    function claimBalance(uint256 index, address account, uint256 amount, bytes32[] calldata proof)
        external
        onlyActive
    {
        if (claimsPaused) revert ClaimsArePaused();
        if (block.timestamp > claimDeadline) revert ClaimWindowClosed();
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (isClaimed(index)) revert AlreadyClaimed();

        bytes32 leaf = balanceLeaf(index, account, amount);
        if (!MerkleProofV2.verify(proof, balanceRoot, leaf)) revert InvalidProof();
        if (claimedTotal + amount > expectedTotal) revert ReconciliationMismatch();

        _setClaimed(index);
        claimedTotal += amount;
        claimedAccounts += 1;

        bytes32 ledgerKey = keccak256(abi.encode(snapshotId, index, account, amount));
        ledger.controllerMint(account, amount, ledgerKey);

        emit BalanceClaimed(index, account, amount, leaf);
    }

    function pauseClaims() external onlyGovernance onlyActive {
        claimsPaused = true;
        emit ClaimsPaused(msg.sender);
    }

    function unpauseClaims() external onlyGovernance onlyActive {
        claimsPaused = false;
        emit ClaimsUnpaused(msg.sender);
    }

    function finalize() external onlyGovernance onlyActive {
        if (claimedTotal != expectedTotal) revert ReconciliationMismatch();
        if (ledger.totalSupply() < claimedTotal) revert ReconciliationMismatch();

        state = MigrationState.Finalized;
        claimsPaused = true;
        emit MigrationFinalized(claimedAccounts, claimedTotal, ledger.totalSupply());
    }

    function cancelBeforeClaims() external onlyGovernance onlyActive {
        if (claimedTotal != 0 || claimedAccounts != 0) revert ClaimsAlreadyStarted();
        state = MigrationState.Cancelled;
        claimsPaused = true;
        emit MigrationCancelled(msg.sender);
    }

    function isClaimed(uint256 index) public view returns (bool) {
        uint256 wordIndex = index >> 8;
        uint256 bitIndex = index & 255;
        uint256 word = _claimedBitMap[wordIndex];
        uint256 mask = 1 << bitIndex;
        return word & mask == mask;
    }

    function balanceLeaf(uint256 index, address account, uint256 amount) public view returns (bytes32) {
        return keccak256(abi.encode(snapshotId, index, account, amount));
    }

    function _setClaimed(uint256 index) private {
        uint256 wordIndex = index >> 8;
        uint256 bitIndex = index & 255;
        _claimedBitMap[wordIndex] |= 1 << bitIndex;
    }
}
