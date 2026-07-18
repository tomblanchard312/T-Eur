// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenLedgerV2.sol";

contract MintBurnControllerV2 {
    ITokenLedgerV2 public immutable ledger;
    address public immutable governance;
    address public mintAuthority;
    address public burnAuthority;

    uint256 public maxSupply;
    uint256 public maxMintPerOperation;
    uint256 public maxBurnPerOperation;
    bool public mintingPaused;
    bool public burningPaused;

    mapping(bytes32 => bool) public usedOperationDigests;

    event MintAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);
    event BurnAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);
    event LimitsUpdated(uint256 maxSupply, uint256 maxMintPerOperation, uint256 maxBurnPerOperation);
    event MintingPauseUpdated(bool paused);
    event BurningPauseUpdated(bool paused);
    event MintExecuted(
        address indexed authority,
        address indexed beneficiary,
        uint256 amount,
        bytes32 indexed operationDigest,
        bytes32 referenceHash
    );
    event BurnExecuted(
        address indexed authority,
        address indexed account,
        uint256 amount,
        bytes32 indexed operationDigest,
        bytes32 referenceHash
    );

    error Unauthorized();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidReference();
    error MintingPaused();
    error BurningPaused();
    error SupplyCapExceeded();
    error OperationLimitExceeded();
    error OperationAlreadyUsed();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyMintAuthority() {
        if (msg.sender != mintAuthority) revert Unauthorized();
        _;
    }

    modifier onlyBurnAuthority() {
        if (msg.sender != burnAuthority) revert Unauthorized();
        _;
    }

    constructor(
        address ledgerAddress,
        address governanceAddress,
        address mintAuthorityAddress,
        address burnAuthorityAddress,
        uint256 initialMaxSupply,
        uint256 initialMaxMintPerOperation,
        uint256 initialMaxBurnPerOperation
    ) {
        if (
            ledgerAddress == address(0) || governanceAddress == address(0) || mintAuthorityAddress == address(0)
                || burnAuthorityAddress == address(0)
        ) revert ZeroAddress();
        if (
            initialMaxSupply == 0 || initialMaxMintPerOperation == 0 || initialMaxBurnPerOperation == 0
        ) revert InvalidAmount();

        ledger = ITokenLedgerV2(ledgerAddress);
        governance = governanceAddress;
        mintAuthority = mintAuthorityAddress;
        burnAuthority = burnAuthorityAddress;
        maxSupply = initialMaxSupply;
        maxMintPerOperation = initialMaxMintPerOperation;
        maxBurnPerOperation = initialMaxBurnPerOperation;
    }

    function setMintAuthority(address newAuthority) external onlyGovernance {
        if (newAuthority == address(0)) revert ZeroAddress();
        address previous = mintAuthority;
        mintAuthority = newAuthority;
        emit MintAuthorityUpdated(previous, newAuthority);
    }

    function setBurnAuthority(address newAuthority) external onlyGovernance {
        if (newAuthority == address(0)) revert ZeroAddress();
        address previous = burnAuthority;
        burnAuthority = newAuthority;
        emit BurnAuthorityUpdated(previous, newAuthority);
    }

    function setLimits(uint256 newMaxSupply, uint256 newMaxMintPerOperation, uint256 newMaxBurnPerOperation)
        external
        onlyGovernance
    {
        if (newMaxSupply < ledger.totalSupply()) revert SupplyCapExceeded();
        if (newMaxSupply == 0 || newMaxMintPerOperation == 0 || newMaxBurnPerOperation == 0) revert InvalidAmount();

        maxSupply = newMaxSupply;
        maxMintPerOperation = newMaxMintPerOperation;
        maxBurnPerOperation = newMaxBurnPerOperation;
        emit LimitsUpdated(newMaxSupply, newMaxMintPerOperation, newMaxBurnPerOperation);
    }

    function setMintingPaused(bool paused) external onlyGovernance {
        mintingPaused = paused;
        emit MintingPauseUpdated(paused);
    }

    function setBurningPaused(bool paused) external onlyGovernance {
        burningPaused = paused;
        emit BurningPauseUpdated(paused);
    }

    function mint(address beneficiary, uint256 amount, bytes32 referenceHash, bytes32 clientKey)
        external
        onlyMintAuthority
    {
        if (mintingPaused) revert MintingPaused();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (referenceHash == bytes32(0)) revert InvalidReference();
        if (amount > maxMintPerOperation) revert OperationLimitExceeded();
        if (ledger.totalSupply() + amount > maxSupply) revert SupplyCapExceeded();

        bytes32 digest = _operationDigest(keccak256("MINT"), msg.sender, beneficiary, amount, clientKey);
        _consumeOperation(digest);
        ledger.controllerMint(beneficiary, amount, digest);

        emit MintExecuted(msg.sender, beneficiary, amount, digest, referenceHash);
    }

    function burn(address account, uint256 amount, bytes32 referenceHash, bytes32 clientKey)
        external
        onlyBurnAuthority
    {
        if (burningPaused) revert BurningPaused();
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (referenceHash == bytes32(0)) revert InvalidReference();
        if (amount > maxBurnPerOperation) revert OperationLimitExceeded();

        bytes32 digest = _operationDigest(keccak256("BURN"), msg.sender, account, amount, clientKey);
        _consumeOperation(digest);
        ledger.controllerBurn(account, amount, digest);

        emit BurnExecuted(msg.sender, account, amount, digest, referenceHash);
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
            abi.encode(block.chainid, address(this), operationType, actor, target, amount, clientKey)
        );
    }
}
