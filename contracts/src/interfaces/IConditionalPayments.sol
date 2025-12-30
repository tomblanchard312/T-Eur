// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title IConditionalPayments
 * @notice Interface for conditional payment mechanisms (pay-on-delivery, milestones, etc.)
 * @dev Implements ECB Digital Euro conditional payment requirements
 * 
 * Note: This is NOT programmable money - funds remain unrestricted tEUR.
 * Conditions only gate the release of escrowed funds.
 */
interface IConditionalPayments {
    // Condition types
    enum ConditionType {
        NONE,               // Direct payment (no condition)
        DELIVERY,           // Release on delivery confirmation
        MILESTONE,          // Release on milestone completion
        TIME_LOCK,          // Release after timestamp
        MULTI_SIG,          // Release on multiple confirmations
        ORACLE              // Release based on external oracle
    }

    // Payment status
    enum PaymentStatus {
        PENDING,            // Payment created, awaiting condition
        RELEASED,           // Condition met, funds released
        REFUNDED,           // Condition failed, funds returned
        EXPIRED,            // Deadline passed, auto-refund
        DISPUTED            // Under dispute resolution
    }

    // Conditional payment structure
    struct ConditionalPayment {
        bytes32 paymentId;
        address payer;
        address payee;
        uint256 amount;
        ConditionType conditionType;
        bytes32 conditionData;          // Encoded condition parameters
        uint256 createdAt;
        uint256 expiresAt;
        PaymentStatus status;
        address arbiter;                // Optional dispute resolver
    }

    // Events
    event ConditionalPaymentCreated(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        ConditionType conditionType,
        uint256 expiresAt
    );

    event PaymentReleased(
        bytes32 indexed paymentId,
        address indexed payee,
        uint256 amount,
        bytes32 proofOfCondition
    );

    event PaymentRefunded(
        bytes32 indexed paymentId,
        address indexed payer,
        uint256 amount,
        string reason
    );

    event PaymentDisputed(
        bytes32 indexed paymentId,
        address indexed disputedBy,
        string reason
    );

    event DisputeResolved(
        bytes32 indexed paymentId,
        address indexed resolvedBy,
        bool releasedToPayee
    );

    event DeliveryConfirmed(
        bytes32 indexed paymentId,
        address indexed confirmedBy,
        bytes32 deliveryProof
    );

    event MilestoneCompleted(
        bytes32 indexed paymentId,
        uint256 milestoneIndex,
        address indexed confirmedBy
    );

    // Core operations
    function createConditionalPayment(
        address payee,
        uint256 amount,
        ConditionType conditionType,
        bytes32 conditionData,
        uint256 expiresAt,
        address arbiter,
        bytes32 idempotencyKey
    ) external returns (bytes32 paymentId);

    function confirmDelivery(
        bytes32 paymentId,
        bytes32 deliveryProof
    ) external;

    function confirmMilestone(
        bytes32 paymentId,
        uint256 milestoneIndex
    ) external;

    function releasePayment(
        bytes32 paymentId,
        bytes32 proofOfCondition
    ) external;

    function refundPayment(
        bytes32 paymentId,
        string calldata reason
    ) external;

    function disputePayment(
        bytes32 paymentId,
        string calldata reason
    ) external;

    function resolveDispute(
        bytes32 paymentId,
        bool releaseToPayee
    ) external;

    function claimExpiredPayment(bytes32 paymentId) external;

    // Queries
    function getPayment(bytes32 paymentId) external view returns (ConditionalPayment memory);
    function getPaymentsByPayer(address payer) external view returns (bytes32[] memory);
    function getPaymentsByPayee(address payee) external view returns (bytes32[] memory);
    function isConditionMet(bytes32 paymentId) external view returns (bool);
}
