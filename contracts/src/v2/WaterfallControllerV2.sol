// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenLedgerV2.sol";
import "./HoldingLimitPolicyV2.sol";

contract WaterfallControllerV2 {
    ITokenLedgerV2 public immutable ledger;
    HoldingLimitPolicyV2 public immutable holdingPolicy;
    address public immutable governance;
    address public operatorAuthority;

    mapping(address => address) public linkedSettlementAccount;
    mapping(bytes32 => bool) public usedOperationDigests;

    event OperatorAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);
    event SettlementAccountLinked(address indexed wallet, address indexed settlementAccount);
    event WaterfallExecuted(
        address indexed source,
        address indexed wallet,
        address indexed settlementAccount,
        uint256 walletAmount,
        uint256 sweptAmount
    );
    event ReverseWaterfallExecuted(
        address indexed settlementAccount,
        address indexed wallet,
        uint256 amount
    );

    error Unauthorized();
    error ZeroAddress();
    error InvalidAmount();
    error NoSettlementAccount();
    error NoAvailableCapacity();
    error OperationAlreadyUsed();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operatorAuthority) revert Unauthorized();
        _;
    }

    constructor(
        address ledgerAddress,
        address holdingPolicyAddress,
        address governanceAddress,
        address operatorAuthorityAddress
    ) {
        if (
            ledgerAddress == address(0) || holdingPolicyAddress == address(0) || governanceAddress == address(0)
                || operatorAuthorityAddress == address(0)
        ) revert ZeroAddress();

        ledger = ITokenLedgerV2(ledgerAddress);
        holdingPolicy = HoldingLimitPolicyV2(holdingPolicyAddress);
        governance = governanceAddress;
        operatorAuthority = operatorAuthorityAddress;
    }

    function setOperatorAuthority(address newAuthority) external onlyGovernance {
        if (newAuthority == address(0)) revert ZeroAddress();
        address previous = operatorAuthority;
        operatorAuthority = newAuthority;
        emit OperatorAuthorityUpdated(previous, newAuthority);
    }

    function linkSettlementAccount(address wallet, address settlementAccount) external onlyGovernance {
        if (wallet == address(0) || settlementAccount == address(0)) revert ZeroAddress();
        linkedSettlementAccount[wallet] = settlementAccount;
        emit SettlementAccountLinked(wallet, settlementAccount);
    }

    function executeWaterfall(address source, address wallet, uint256 amount, bytes32 clientKey)
        external
        onlyOperator
        returns (uint256 walletAmount, uint256 sweptAmount)
    {
        if (source == address(0) || wallet == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        address settlementAccount = linkedSettlementAccount[wallet];
        if (settlementAccount == address(0)) revert NoSettlementAccount();

        bytes32 digest = _operationDigest(keccak256("WATERFALL"), source, wallet, amount, clientKey);
        _consumeOperation(digest);

        uint256 capacity = holdingPolicy.availableCapacity(wallet);
        walletAmount = capacity >= amount ? amount : capacity;
        sweptAmount = amount - walletAmount;

        if (walletAmount > 0) ledger.controllerMove(source, wallet, walletAmount);
        if (sweptAmount > 0) ledger.controllerMove(source, settlementAccount, sweptAmount);

        emit WaterfallExecuted(source, wallet, settlementAccount, walletAmount, sweptAmount);
    }

    function executeReverseWaterfall(address wallet, uint256 requestedAmount, bytes32 clientKey)
        external
        onlyOperator
        returns (uint256 transferredAmount)
    {
        if (wallet == address(0)) revert ZeroAddress();
        if (requestedAmount == 0) revert InvalidAmount();

        address settlementAccount = linkedSettlementAccount[wallet];
        if (settlementAccount == address(0)) revert NoSettlementAccount();

        uint256 capacity = holdingPolicy.availableCapacity(wallet);
        if (capacity == 0) revert NoAvailableCapacity();
        transferredAmount = capacity >= requestedAmount ? requestedAmount : capacity;

        bytes32 digest = _operationDigest(
            keccak256("REVERSE_WATERFALL"), settlementAccount, wallet, transferredAmount, clientKey
        );
        _consumeOperation(digest);

        ledger.controllerMove(settlementAccount, wallet, transferredAmount);
        emit ReverseWaterfallExecuted(settlementAccount, wallet, transferredAmount);
    }

    function _consumeOperation(bytes32 digest) internal {
        if (usedOperationDigests[digest]) revert OperationAlreadyUsed();
        usedOperationDigests[digest] = true;
    }

    function _operationDigest(
        bytes32 operationType,
        address source,
        address target,
        uint256 amount,
        bytes32 clientKey
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(block.chainid, address(this), operationType, msg.sender, source, target, amount, clientKey)
        );
    }
}
