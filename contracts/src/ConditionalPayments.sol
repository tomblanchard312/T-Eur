// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./interfaces/IConditionalPayments.sol";
import "./interfaces/ITokenizedEuro.sol";
import "./Permissioning.sol";

/**
 * @title ConditionalPayments
 * @notice Escrow-based conditional payment system for Digital Euro
 * @dev Implements ECB requirements for:
 *      - Pay-on-delivery
 *      - Pay-per-use
 *      - Milestone-based payments
 * 
 * IMPORTANT: This is NOT programmable money. The tEUR held in escrow
 * remains fully fungible and unrestricted. Only the release mechanism
 * is conditional.
 * 
 * Security considerations:
 * - Funds held in this contract, not burned/reminted
 * - Automatic refund on expiry protects payers
 * - Arbiter system for dispute resolution
 * - All operations are auditable
 */
contract ConditionalPayments is IConditionalPayments {
    // Dependencies
    ITokenizedEuro public immutable teur;
    Permissioning public immutable permissioning;

    // Storage
    mapping(bytes32 => ConditionalPayment) private _payments;
    mapping(address => bytes32[]) private _payerPayments;
    mapping(address => bytes32[]) private _payeePayments;
    
    // Milestone tracking: paymentId => milestoneIndex => completed
    mapping(bytes32 => mapping(uint256 => bool)) private _milestones;
    
    // Idempotency
    mapping(bytes32 => bool) private _usedIdempotencyKeys;

    // Configuration
    uint256 public constant MIN_EXPIRY = 1 hours;
    uint256 public constant MAX_EXPIRY = 365 days;
    uint256 public constant DEFAULT_EXPIRY = 30 days;

    // Errors
    error Unauthorized();
    error InvalidAmount();
    error InvalidExpiry();
    error PaymentNotFound();
    error PaymentNotPending();
    error PaymentExpired();
    error PaymentNotExpired();
    error ConditionNotMet();
    error NotArbiter();
    error NotDisputed();
    error AlreadyDisputed();
    error IdempotencyKeyUsed();
    error ZeroAddress();
    error InsufficientBalance();

    // Events (inherited from interface)

    modifier onlyPayer(bytes32 paymentId) {
        if (_payments[paymentId].payer != msg.sender) revert Unauthorized();
        _;
    }

    modifier onlyPayee(bytes32 paymentId) {
        if (_payments[paymentId].payee != msg.sender) revert Unauthorized();
        _;
    }

    modifier onlyArbiter(bytes32 paymentId) {
        if (_payments[paymentId].arbiter != msg.sender) revert NotArbiter();
        _;
    }

    modifier paymentExists(bytes32 paymentId) {
        if (_payments[paymentId].createdAt == 0) revert PaymentNotFound();
        _;
    }

    modifier paymentPending(bytes32 paymentId) {
        if (_payments[paymentId].status != PaymentStatus.PENDING) revert PaymentNotPending();
        _;
    }

    modifier idempotent(bytes32 key) {
        if (_usedIdempotencyKeys[key]) revert IdempotencyKeyUsed();
        _usedIdempotencyKeys[key] = true;
        _;
    }

    constructor(address _teur, address _permissioning) {
        if (_teur == address(0) || _permissioning == address(0)) revert ZeroAddress();
        teur = ITokenizedEuro(_teur);
        permissioning = Permissioning(_permissioning);
    }

    // ============ Core Operations ============

    /**
     * @notice Create a conditional payment with escrowed funds
     * @param payee Recipient when condition is met
     * @param amount Amount in tEUR cents
     * @param conditionType Type of condition to gate release
     * @param conditionData Encoded condition parameters
     * @param expiresAt Timestamp when payment expires (auto-refund)
     * @param arbiter Optional dispute resolver
     * @param idempotencyKey Unique key to prevent duplicates
     * @return paymentId Unique payment identifier
     */
    function createConditionalPayment(
        address payee,
        uint256 amount,
        ConditionType conditionType,
        bytes32 conditionData,
        uint256 expiresAt,
        address arbiter,
        bytes32 idempotencyKey
    ) external idempotent(idempotencyKey) returns (bytes32 paymentId) {
        if (payee == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (expiresAt != 0 && (expiresAt < block.timestamp + MIN_EXPIRY || expiresAt > block.timestamp + MAX_EXPIRY)) {
            revert InvalidExpiry();
        }

        // Use default expiry if not specified
        uint256 actualExpiry = expiresAt == 0 ? block.timestamp + DEFAULT_EXPIRY : expiresAt;

        // Generate payment ID
        paymentId = keccak256(abi.encodePacked(
            msg.sender,
            payee,
            amount,
            idempotencyKey,
            block.timestamp
        ));

        // Transfer tEUR from payer to this contract (escrow)
        // Requires prior approval
        bool success = teur.transferFrom(msg.sender, address(this), amount);
        if (!success) revert InsufficientBalance();

        // Create payment record
        _payments[paymentId] = ConditionalPayment({
            paymentId: paymentId,
            payer: msg.sender,
            payee: payee,
            amount: amount,
            conditionType: conditionType,
            conditionData: conditionData,
            createdAt: block.timestamp,
            expiresAt: actualExpiry,
            status: PaymentStatus.PENDING,
            arbiter: arbiter
        });

        // Track for queries
        _payerPayments[msg.sender].push(paymentId);
        _payeePayments[payee].push(paymentId);

        emit ConditionalPaymentCreated(
            paymentId,
            msg.sender,
            payee,
            amount,
            conditionType,
            actualExpiry
        );
    }

    /**
     * @notice Confirm delivery for a pay-on-delivery payment
     * @dev Can be called by payer (acknowledging receipt) or authorized oracle
     * @param paymentId Payment to confirm
     * @param deliveryProof Hash of delivery proof (tracking number, signature, etc.)
     */
    function confirmDelivery(
        bytes32 paymentId,
        bytes32 deliveryProof
    ) external paymentExists(paymentId) paymentPending(paymentId) {
        ConditionalPayment storage payment = _payments[paymentId];
        
        if (payment.conditionType != ConditionType.DELIVERY) revert ConditionNotMet();
        
        // Only payer or authorized oracle can confirm
        bool authorized = (msg.sender == payment.payer) || 
                         permissioning.isOracle(msg.sender);
        if (!authorized) revert Unauthorized();

        emit DeliveryConfirmed(paymentId, msg.sender, deliveryProof);

        // Auto-release on delivery confirmation
        _releasePayment(paymentId, deliveryProof);
    }

    /**
     * @notice Confirm a milestone for milestone-based payments
     * @param paymentId Payment to update
     * @param milestoneIndex Index of the completed milestone
     */
    function confirmMilestone(
        bytes32 paymentId,
        uint256 milestoneIndex
    ) external paymentExists(paymentId) paymentPending(paymentId) {
        ConditionalPayment storage payment = _payments[paymentId];
        
        if (payment.conditionType != ConditionType.MILESTONE) revert ConditionNotMet();
        
        // Only payer or authorized oracle can confirm milestones
        bool authorized = (msg.sender == payment.payer) || 
                         permissioning.isOracle(msg.sender);
        if (!authorized) revert Unauthorized();

        _milestones[paymentId][milestoneIndex] = true;
        emit MilestoneCompleted(paymentId, milestoneIndex, msg.sender);

        // Check if all milestones are complete
        // conditionData contains the total milestone count as uint256
        uint256 totalMilestones = uint256(payment.conditionData);
        bool allComplete = true;
        for (uint256 i = 0; i < totalMilestones; i++) {
            if (!_milestones[paymentId][i]) {
                allComplete = false;
                break;
            }
        }

        if (allComplete) {
            _releasePayment(paymentId, bytes32(totalMilestones));
        }
    }

    /**
     * @notice Release payment when condition is met
     * @param paymentId Payment to release
     * @param proofOfCondition Evidence that condition was satisfied
     */
    function releasePayment(
        bytes32 paymentId,
        bytes32 proofOfCondition
    ) external paymentExists(paymentId) paymentPending(paymentId) {
        ConditionalPayment storage payment = _payments[paymentId];

        // For TIME_LOCK, anyone can release after the time
        if (payment.conditionType == ConditionType.TIME_LOCK) {
            uint256 unlockTime = uint256(payment.conditionData);
            if (block.timestamp < unlockTime) revert ConditionNotMet();
        } else if (payment.conditionType == ConditionType.NONE) {
            // Direct payment - only payee can claim
            if (msg.sender != payment.payee) revert Unauthorized();
        } else {
            // Other conditions require specific confirmation flows
            revert ConditionNotMet();
        }

        _releasePayment(paymentId, proofOfCondition);
    }

    /**
     * @notice Refund payment back to payer
     * @dev Only payer can refund before expiry (cancellation)
     * @param paymentId Payment to refund
     * @param reason Reason for refund
     */
    function refundPayment(
        bytes32 paymentId,
        string calldata reason
    ) external paymentExists(paymentId) paymentPending(paymentId) onlyPayer(paymentId) {
        _refundPayment(paymentId, reason);
    }

    /**
     * @notice Dispute a payment
     * @param paymentId Payment to dispute
     * @param reason Dispute reason
     */
    function disputePayment(
        bytes32 paymentId,
        string calldata reason
    ) external paymentExists(paymentId) paymentPending(paymentId) {
        ConditionalPayment storage payment = _payments[paymentId];
        
        // Only payer or payee can dispute
        if (msg.sender != payment.payer && msg.sender != payment.payee) {
            revert Unauthorized();
        }
        
        // Must have an arbiter to dispute
        if (payment.arbiter == address(0)) revert NotArbiter();

        payment.status = PaymentStatus.DISPUTED;
        emit PaymentDisputed(paymentId, msg.sender, reason);
    }

    /**
     * @notice Resolve a dispute
     * @param paymentId Disputed payment
     * @param releaseToPayee True to release to payee, false to refund payer
     */
    function resolveDispute(
        bytes32 paymentId,
        bool releaseToPayee
    ) external paymentExists(paymentId) onlyArbiter(paymentId) {
        ConditionalPayment storage payment = _payments[paymentId];
        
        if (payment.status != PaymentStatus.DISPUTED) revert NotDisputed();

        if (releaseToPayee) {
            payment.status = PaymentStatus.RELEASED;
            teur.transfer(payment.payee, payment.amount);
            emit PaymentReleased(paymentId, payment.payee, payment.amount, bytes32("DISPUTE_RESOLVED"));
        } else {
            payment.status = PaymentStatus.REFUNDED;
            teur.transfer(payment.payer, payment.amount);
            emit PaymentRefunded(paymentId, payment.payer, payment.amount, "Dispute resolved in payer's favor");
        }

        emit DisputeResolved(paymentId, msg.sender, releaseToPayee);
    }

    /**
     * @notice Claim expired payment (auto-refund to payer)
     * @param paymentId Expired payment
     */
    function claimExpiredPayment(bytes32 paymentId) external paymentExists(paymentId) {
        ConditionalPayment storage payment = _payments[paymentId];
        
        if (payment.status != PaymentStatus.PENDING) revert PaymentNotPending();
        if (block.timestamp < payment.expiresAt) revert PaymentNotExpired();

        payment.status = PaymentStatus.EXPIRED;
        teur.transfer(payment.payer, payment.amount);
        emit PaymentRefunded(paymentId, payment.payer, payment.amount, "Payment expired");
    }

    // ============ Internal Functions ============

    function _releasePayment(bytes32 paymentId, bytes32 proofOfCondition) internal {
        ConditionalPayment storage payment = _payments[paymentId];
        
        payment.status = PaymentStatus.RELEASED;
        teur.transfer(payment.payee, payment.amount);
        
        emit PaymentReleased(paymentId, payment.payee, payment.amount, proofOfCondition);
    }

    function _refundPayment(bytes32 paymentId, string calldata reason) internal {
        ConditionalPayment storage payment = _payments[paymentId];
        
        payment.status = PaymentStatus.REFUNDED;
        teur.transfer(payment.payer, payment.amount);
        
        emit PaymentRefunded(paymentId, payment.payer, payment.amount, reason);
    }

    // ============ Queries ============

    function getPayment(bytes32 paymentId) external view returns (ConditionalPayment memory) {
        return _payments[paymentId];
    }

    function getPaymentsByPayer(address payer) external view returns (bytes32[] memory) {
        return _payerPayments[payer];
    }

    function getPaymentsByPayee(address payee) external view returns (bytes32[] memory) {
        return _payeePayments[payee];
    }

    function isConditionMet(bytes32 paymentId) external view returns (bool) {
        ConditionalPayment storage payment = _payments[paymentId];
        
        if (payment.conditionType == ConditionType.NONE) {
            return true;
        }
        
        if (payment.conditionType == ConditionType.TIME_LOCK) {
            return block.timestamp >= uint256(payment.conditionData);
        }
        
        if (payment.conditionType == ConditionType.MILESTONE) {
            uint256 totalMilestones = uint256(payment.conditionData);
            for (uint256 i = 0; i < totalMilestones; i++) {
                if (!_milestones[paymentId][i]) {
                    return false;
                }
            }
            return true;
        }
        
        // DELIVERY, MULTI_SIG, ORACLE require explicit confirmation
        return payment.status == PaymentStatus.RELEASED;
    }

    function isMilestoneComplete(bytes32 paymentId, uint256 milestoneIndex) external view returns (bool) {
        return _milestones[paymentId][milestoneIndex];
    }
}
