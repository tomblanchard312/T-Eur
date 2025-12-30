// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Permissioning.sol";
import "../src/WalletRegistry.sol";
import "../src/TokenizedEuro.sol";
import "../src/ConditionalPayments.sol";
import "../src/interfaces/IWalletRegistry.sol";
import "../src/interfaces/IConditionalPayments.sol";

contract ConditionalPaymentsTest is Test {
    Permissioning public permissioning;
    WalletRegistry public walletRegistry;
    TokenizedEuro public teur;
    ConditionalPayments public conditionalPayments;
    
    address public admin;
    address public minter;
    address public oracle;
    address public registrar;
    address public payer;
    address public payee;
    address public arbiter;
    address public bankAccount;
    
    bytes32 public kycHash = keccak256("kyc-data");

    function setUp() public {
        // Initialize addresses
        admin = makeAddr("admin");
        minter = makeAddr("minter");
        oracle = makeAddr("oracle");
        registrar = makeAddr("registrar");
        payer = makeAddr("payer");
        payee = makeAddr("payee");
        arbiter = makeAddr("arbiter");
        bankAccount = makeAddr("bankAccount");
        
        // Deploy contracts
        permissioning = new Permissioning(admin);
        walletRegistry = new WalletRegistry(address(permissioning));
        teur = new TokenizedEuro(address(permissioning));
        conditionalPayments = new ConditionalPayments(
            address(teur),
            address(permissioning)
        );
        
        // Configure token
        vm.prank(admin);
        teur.setWalletRegistry(address(walletRegistry));
        
        // Grant roles
        vm.startPrank(admin);
        permissioning.grantRole(permissioning.MINTER_ROLE(), minter);
        permissioning.grantRole(permissioning.ORACLE_ROLE(), oracle);
        permissioning.grantRole(permissioning.REGISTRAR_ROLE(), registrar);
        vm.stopPrank();
        
        // Register wallets
        vm.startPrank(registrar);
        walletRegistry.registerWallet(payer, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        walletRegistry.registerWallet(payee, IWalletRegistry.WalletType.MERCHANT, bankAccount, kycHash);
        walletRegistry.registerWallet(arbiter, IWalletRegistry.WalletType.PSP, address(0), kycHash);
        walletRegistry.registerWallet(bankAccount, IWalletRegistry.WalletType.BANK, address(0), kycHash);
        walletRegistry.registerWallet(address(conditionalPayments), IWalletRegistry.WalletType.PSP, address(0), kycHash);
        vm.stopPrank();
        
        // Mint tokens to payer
        vm.prank(minter);
        teur.mint(payer, 200000, keccak256("setup-mint"));
        
        // Approve conditional payments contract
        vm.prank(payer);
        teur.approve(address(conditionalPayments), type(uint256).max);
    }

    // ============ Payment Creation Tests ============

    function test_CreateConditionalPayment_Delivery() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        assertTrue(paymentId != bytes32(0));
        assertEq(teur.balanceOf(address(conditionalPayments)), 50000);
        assertEq(teur.balanceOf(payer), 150000);
    }

    function test_CreateConditionalPayment_Succeeds() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        assertTrue(paymentId != bytes32(0));
    }

    function test_CreateConditionalPayment_RevertsOnZeroAmount() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        
        vm.prank(payer);
        vm.expectRevert(ConditionalPayments.InvalidAmount.selector);
        conditionalPayments.createConditionalPayment(
            payee,
            0,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            block.timestamp + 30 days,
            arbiter,
            idempotencyKey
        );
    }

    function test_CreateConditionalPayment_RevertsOnZeroPayee() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        
        vm.prank(payer);
        vm.expectRevert(ConditionalPayments.ZeroAddress.selector);
        conditionalPayments.createConditionalPayment(
            address(0),
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            block.timestamp + 30 days,
            arbiter,
            idempotencyKey
        );
    }

    function test_CreateConditionalPayment_RevertsOnDuplicateIdempotencyKey() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.startPrank(payer);
        conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.expectRevert(ConditionalPayments.IdempotencyKeyUsed.selector);
        conditionalPayments.createConditionalPayment(
            payee,
            30000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        vm.stopPrank();
    }

    // ============ Time-Lock Payment Tests ============

    function test_CreateTimeLockPayment() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 unlockTime = block.timestamp + 7 days;
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.TIME_LOCK,
            bytes32(unlockTime),
            expiry,
            address(0),
            idempotencyKey
        );
        
        IConditionalPayments.ConditionalPayment memory payment = conditionalPayments.getPayment(paymentId);
        assertEq(uint256(payment.conditionType), uint256(IConditionalPayments.ConditionType.TIME_LOCK));
    }

    function test_ReleaseTimeLockPayment_AfterUnlockTime() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 unlockTime = block.timestamp + 7 days;
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.TIME_LOCK,
            bytes32(unlockTime),
            expiry,
            address(0),
            idempotencyKey
        );
        
        // Fast forward past unlock time
        vm.warp(unlockTime + 1);
        
        vm.prank(payee);
        conditionalPayments.releasePayment(paymentId, bytes32("proof"));
        
        assertEq(teur.balanceOf(payee), 50000);
    }

    function test_ReleaseTimeLockPayment_RevertsBeforeUnlockTime() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 unlockTime = block.timestamp + 7 days;
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.TIME_LOCK,
            bytes32(unlockTime),
            expiry,
            address(0),
            idempotencyKey
        );
        
        vm.prank(payee);
        vm.expectRevert(ConditionalPayments.ConditionNotMet.selector);
        conditionalPayments.releasePayment(paymentId, bytes32("proof"));
    }

    // ============ Delivery Confirmation Tests ============

    function test_ConfirmDelivery_ByPayer() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        // Payer confirms delivery
        vm.prank(payer);
        conditionalPayments.confirmDelivery(paymentId, keccak256("tracking-123"));
        
        // Payment should be automatically released
        assertEq(teur.balanceOf(payee), 50000);
    }

    function test_ConfirmDelivery_ByOracle() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        // Oracle confirms delivery
        vm.prank(oracle);
        conditionalPayments.confirmDelivery(paymentId, keccak256("delivery-proof"));
        
        assertEq(teur.balanceOf(payee), 50000);
    }

    function test_ConfirmDelivery_RevertsIfNotAuthorized() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        // Payee cannot confirm delivery
        vm.prank(payee);
        vm.expectRevert(ConditionalPayments.Unauthorized.selector);
        conditionalPayments.confirmDelivery(paymentId, keccak256("proof"));
    }

    // ============ Milestone Payment Tests ============

    function test_MilestonePayment_CompleteAll() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 90 days;
        uint256 milestoneCount = 3;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            100000,
            IConditionalPayments.ConditionType.MILESTONE,
            bytes32(milestoneCount),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        // Complete all milestones
        vm.startPrank(payer);
        conditionalPayments.confirmMilestone(paymentId, 0);
        conditionalPayments.confirmMilestone(paymentId, 1);
        conditionalPayments.confirmMilestone(paymentId, 2);
        vm.stopPrank();
        
        // Payment should be auto-released after all milestones
        assertEq(teur.balanceOf(payee), 100000);
    }

    function test_MilestonePayment_OracleCanConfirm() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 90 days;
        uint256 milestoneCount = 2;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.MILESTONE,
            bytes32(milestoneCount),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        // Oracle completes milestones
        vm.startPrank(oracle);
        conditionalPayments.confirmMilestone(paymentId, 0);
        conditionalPayments.confirmMilestone(paymentId, 1);
        vm.stopPrank();
        
        assertEq(teur.balanceOf(payee), 50000);
    }

    // ============ Dispute Tests ============

    function test_DisputePayment_ByPayer() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payer);
        conditionalPayments.disputePayment(paymentId, "Item not as described");
        
        IConditionalPayments.ConditionalPayment memory payment = conditionalPayments.getPayment(paymentId);
        assertEq(uint256(payment.status), uint256(IConditionalPayments.PaymentStatus.DISPUTED));
    }

    function test_DisputePayment_ByPayee() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payee);
        conditionalPayments.disputePayment(paymentId, "Payment not received");
        
        IConditionalPayments.ConditionalPayment memory payment = conditionalPayments.getPayment(paymentId);
        assertEq(uint256(payment.status), uint256(IConditionalPayments.PaymentStatus.DISPUTED));
    }

    function test_DisputePayment_RevertsIfNoArbiter() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        // Create payment without arbiter
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            address(0), // no arbiter
            idempotencyKey
        );
        
        vm.prank(payer);
        vm.expectRevert(ConditionalPayments.NotArbiter.selector);
        conditionalPayments.disputePayment(paymentId, "Issue");
    }

    // ============ Dispute Resolution Tests ============

    function test_ResolveDispute_ToPayee() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payer);
        conditionalPayments.disputePayment(paymentId, "Issue");
        
        vm.prank(arbiter);
        conditionalPayments.resolveDispute(paymentId, true);
        
        assertEq(teur.balanceOf(payee), 50000);
        assertEq(teur.balanceOf(payer), 150000);
    }

    function test_ResolveDispute_ToPayer() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payer);
        conditionalPayments.disputePayment(paymentId, "Never received");
        
        vm.prank(arbiter);
        conditionalPayments.resolveDispute(paymentId, false);
        
        assertEq(teur.balanceOf(payee), 0);
        assertEq(teur.balanceOf(payer), 200000);
    }

    function test_ResolveDispute_RevertsIfNotArbiter() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payer);
        conditionalPayments.disputePayment(paymentId, "Issue");
        
        vm.prank(payer);
        vm.expectRevert(ConditionalPayments.NotArbiter.selector);
        conditionalPayments.resolveDispute(paymentId, true);
    }

    // ============ Expiry/Refund Tests ============

    function test_ClaimExpiredPayment() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 2 hours; // Min is 1 hour
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        // Fast forward past expiry
        vm.warp(expiry + 1);
        
        conditionalPayments.claimExpiredPayment(paymentId);
        
        assertEq(teur.balanceOf(payer), 200000);
    }

    function test_ClaimExpiredPayment_RevertsIfNotExpired() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.expectRevert(ConditionalPayments.PaymentNotExpired.selector);
        conditionalPayments.claimExpiredPayment(paymentId);
    }

    // ============ Refund Tests ============

    function test_RefundPayment_ByPayer() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payer);
        conditionalPayments.refundPayment(paymentId, "Changed my mind");
        
        assertEq(teur.balanceOf(payer), 200000);
    }

    function test_RefundPayment_RevertsIfNotPayer() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payee);
        vm.expectRevert(ConditionalPayments.Unauthorized.selector);
        conditionalPayments.refundPayment(paymentId, "Want refund");
    }

    // ============ View Function Tests ============

    function test_GetPayment() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        IConditionalPayments.ConditionalPayment memory payment = conditionalPayments.getPayment(paymentId);
        
        assertEq(payment.payer, payer);
        assertEq(payment.payee, payee);
        assertEq(payment.amount, 50000);
        assertEq(uint256(payment.status), uint256(IConditionalPayments.PaymentStatus.PENDING));
    }

    function test_GetPaymentsByPayer() public {
        bytes32 key1 = keccak256("payment-1");
        bytes32 key2 = keccak256("payment-2");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.startPrank(payer);
        conditionalPayments.createConditionalPayment(
            payee, 25000, IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0), expiry, arbiter, key1
        );
        conditionalPayments.createConditionalPayment(
            payee, 25000, IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0), expiry, arbiter, key2
        );
        vm.stopPrank();
        
        bytes32[] memory payments = conditionalPayments.getPaymentsByPayer(payer);
        assertEq(payments.length, 2);
    }

    function test_IsConditionMet_TimeLock() public {
        bytes32 idempotencyKey = keccak256("payment-1");
        uint256 unlockTime = block.timestamp + 7 days;
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            50000,
            IConditionalPayments.ConditionType.TIME_LOCK,
            bytes32(unlockTime),
            expiry,
            address(0),
            idempotencyKey
        );
        
        // Before unlock time
        assertFalse(conditionalPayments.isConditionMet(paymentId));
        
        // After unlock time
        vm.warp(unlockTime + 1);
        assertTrue(conditionalPayments.isConditionMet(paymentId));
    }

    // ============ Fuzz Tests ============

    function testFuzz_CreateAndReleasePayment(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 200000);
        
        bytes32 idempotencyKey = keccak256(abi.encodePacked("payment-", amount));
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(payer);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            payee,
            amount,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            arbiter,
            idempotencyKey
        );
        
        vm.prank(payer);
        conditionalPayments.confirmDelivery(paymentId, keccak256("proof"));
        
        assertEq(teur.balanceOf(payee), amount);
    }
}
