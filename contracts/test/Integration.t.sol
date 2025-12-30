// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Permissioning.sol";
import "../src/WalletRegistry.sol";
import "../src/TokenizedEuro.sol";
import "../src/ConditionalPayments.sol";
import "../src/interfaces/IWalletRegistry.sol";
import "../src/interfaces/IConditionalPayments.sol";

/**
 * @title Integration Tests for tEUR Digital Euro System
 * @notice End-to-end tests covering complete payment flows and system interactions
 */
contract IntegrationTest is Test {
    Permissioning public permissioning;
    WalletRegistry public walletRegistry;
    TokenizedEuro public teur;
    ConditionalPayments public conditionalPayments;
    
    // ECB / Central Authority
    address public ecb;
    
    // NCB nodes (National Central Banks)
    address public ncbDE;
    address public ncbFR;
    
    // Commercial Banks
    address public bankDE;
    address public bankFR;
    
    // PSPs (Payment Service Providers)
    address public pspEU;
    
    // End Users
    address public alice;   // Individual in Germany
    address public bob;     // Individual in France
    address public merchant; // Merchant in EU
    
    bytes32 public kycHash = keccak256("kyc-verified");

    function setUp() public {
        // Initialize addresses
        ecb = makeAddr("ecb");
        ncbDE = makeAddr("ncbDE");
        ncbFR = makeAddr("ncbFR");
        bankDE = makeAddr("bankDE");
        bankFR = makeAddr("bankFR");
        pspEU = makeAddr("pspEU");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        merchant = makeAddr("merchant");
        
        // Deploy core contracts
        permissioning = new Permissioning(ecb);
        walletRegistry = new WalletRegistry(address(permissioning));
        teur = new TokenizedEuro(address(permissioning));
        conditionalPayments = new ConditionalPayments(
            address(teur),
            address(permissioning)
        );
        
        // Configure token
        vm.prank(ecb);
        teur.setWalletRegistry(address(walletRegistry));
        
        // Cache role values before granting
        bytes32 minterRole = permissioning.MINTER_ROLE();
        bytes32 waterfallRole = permissioning.WATERFALL_ROLE();
        bytes32 registrarRole = permissioning.REGISTRAR_ROLE();
        bytes32 oracleRole = permissioning.ORACLE_ROLE();
        bytes32 emergencyRole = permissioning.EMERGENCY_ROLE();
        
        // Grant operational roles
        vm.startPrank(ecb);
        permissioning.grantRole(minterRole, ncbDE);
        permissioning.grantRole(minterRole, ncbFR);
        permissioning.grantRole(waterfallRole, bankDE);
        permissioning.grantRole(waterfallRole, bankFR);
        permissioning.grantRole(registrarRole, pspEU);
        permissioning.grantRole(oracleRole, pspEU);
        permissioning.grantRole(emergencyRole, ecb);
        vm.stopPrank();
        
        // Register all participants in the wallet registry
        vm.startPrank(pspEU);
        
        // NCBs
        walletRegistry.registerWallet(ncbDE, IWalletRegistry.WalletType.NCB, address(0), kycHash);
        walletRegistry.registerWallet(ncbFR, IWalletRegistry.WalletType.NCB, address(0), kycHash);
        
        // Commercial Banks
        walletRegistry.registerWallet(bankDE, IWalletRegistry.WalletType.BANK, address(0), kycHash);
        walletRegistry.registerWallet(bankFR, IWalletRegistry.WalletType.BANK, address(0), kycHash);
        
        // PSPs
        walletRegistry.registerWallet(pspEU, IWalletRegistry.WalletType.PSP, address(0), kycHash);
        walletRegistry.registerWallet(address(conditionalPayments), IWalletRegistry.WalletType.PSP, address(0), kycHash);
        
        // End users - linked to their respective banks
        walletRegistry.registerWallet(alice, IWalletRegistry.WalletType.INDIVIDUAL, bankDE, kycHash);
        walletRegistry.registerWallet(bob, IWalletRegistry.WalletType.INDIVIDUAL, bankFR, kycHash);
        walletRegistry.registerWallet(merchant, IWalletRegistry.WalletType.MERCHANT, bankDE, kycHash);
        
        vm.stopPrank();
    }

    // ============ E2E: Basic Payment Flow ============

    function test_E2E_BasicP2PPayment() public {
        // Scenario: Alice receives €2,000 and sends €500 to Bob
        
        // 1. NCB mints tEUR to Alice
        bytes32 mintKey = keccak256("alice-initial-mint");
        vm.prank(ncbDE);
        teur.mint(alice, 200000, mintKey); // €2,000
        
        assertEq(teur.balanceOf(alice), 200000);
        
        // 2. Alice transfers €500 to Bob
        vm.prank(alice);
        teur.transfer(bob, 50000);
        
        assertEq(teur.balanceOf(alice), 150000);
        assertEq(teur.balanceOf(bob), 50000);
    }

    function test_E2E_MerchantPayment() public {
        // Scenario: Alice buys from merchant for €100
        
        // 1. Mint to Alice
        bytes32 mintKey = keccak256("alice-mint");
        vm.prank(ncbDE);
        teur.mint(alice, 100000, mintKey);
        
        // 2. Alice pays merchant
        vm.prank(alice);
        teur.transfer(merchant, 10000);
        
        assertEq(teur.balanceOf(alice), 90000);
        assertEq(teur.balanceOf(merchant), 10000);
    }

    // ============ E2E: Waterfall Mechanism ============

    function test_E2E_WaterfallOnExcessHoldings() public {
        // Scenario: Alice receives €4,000 but limit is €3,000
        // Excess €1,000 should waterfall to linked bank
        
        vm.prank(ecb);
        teur.setWaterfallEnabled(true);
        
        bytes32 mintKey = keccak256("alice-large-mint");
        vm.prank(ncbDE);
        teur.mint(alice, 400000, mintKey); // €4,000
        
        // Before waterfall, Alice has full amount
        assertEq(teur.balanceOf(alice), 400000);
        
        // Execute waterfall manually (it's not automatic on mint)
        vm.prank(bankDE);
        teur.executeWaterfall(alice);
        
        // Alice should have €3,000 (limit)
        assertEq(teur.balanceOf(alice), 300000);
        
        // Bank should have €1,000 (excess)
        assertEq(teur.balanceOf(bankDE), 100000);
    }

    function test_E2E_ManualWaterfall() public {
        // Scenario: Alice has €2,500 and bank triggers waterfall for €500
        
        vm.prank(ecb);
        teur.setWaterfallEnabled(true);
        
        bytes32 mintKey = keccak256("alice-mint");
        vm.prank(ncbDE);
        teur.mint(alice, 250000, mintKey);
        
        // Bank manually triggers waterfall (sweeps excess to bank)
        vm.prank(bankDE);
        teur.executeWaterfall(alice);
        
        // No excess since 250000 < 300000 limit
        assertEq(teur.balanceOf(alice), 250000);
        assertEq(teur.balanceOf(bankDE), 0);
    }

    function test_E2E_ReverseWaterfall() public {
        // Scenario: Alice needs more tEUR for a purchase, bank provides from linked account
        
        // 1. Mint to Alice and bank
        vm.prank(ncbDE);
        teur.mint(alice, 100000, keccak256("alice-mint"));
        
        vm.prank(ncbDE);
        teur.mint(bankDE, 500000, keccak256("bank-mint"));
        
        // 2. NCB triggers reverse waterfall to fund Alice
        vm.prank(ncbDE);
        teur.executeReverseWaterfall(alice, 100000, keccak256("reverse-waterfall-1"));
        
        assertEq(teur.balanceOf(alice), 200000);
        assertEq(teur.balanceOf(bankDE), 400000);
    }

    // ============ E2E: Conditional Payments ============

    function test_E2E_ConditionalPayment_HappyPath() public {
        // Scenario: Alice buys from merchant with pay-on-delivery
        
        // 1. Mint to Alice
        vm.prank(ncbDE);
        teur.mint(alice, 200000, keccak256("alice-mint"));
        
        // 2. Alice approves and creates conditional payment
        vm.prank(alice);
        teur.approve(address(conditionalPayments), type(uint256).max);
        
        bytes32 idempotencyKey = keccak256("alice-payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(alice);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            merchant,
            50000,  // €500
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            pspEU, // arbiter
            idempotencyKey
        );
        
        // Funds in escrow
        assertEq(teur.balanceOf(alice), 150000);
        assertEq(teur.balanceOf(address(conditionalPayments)), 50000);
        
        // 3. Delivery happens, Alice confirms (auto-releases)
        vm.prank(alice);
        conditionalPayments.confirmDelivery(paymentId, keccak256("tracking-123"));
        
        assertEq(teur.balanceOf(merchant), 50000);
        assertEq(teur.balanceOf(address(conditionalPayments)), 0);
    }

    function test_E2E_ConditionalPayment_Dispute() public {
        // Scenario: Alice disputes, PSP arbitrates
        
        // 1. Setup and create payment
        vm.prank(ncbDE);
        teur.mint(alice, 200000, keccak256("alice-mint"));
        
        vm.prank(alice);
        teur.approve(address(conditionalPayments), type(uint256).max);
        
        bytes32 idempotencyKey = keccak256("alice-payment-1");
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(alice);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            merchant,
            50000,
            IConditionalPayments.ConditionType.DELIVERY,
            bytes32(0),
            expiry,
            pspEU,
            idempotencyKey
        );
        
        // 2. Alice disputes
        vm.prank(alice);
        conditionalPayments.disputePayment(paymentId, "Item damaged on arrival");
        
        // 3. PSP resolves: release to merchant
        vm.prank(pspEU);
        conditionalPayments.resolveDispute(paymentId, true);
        
        assertEq(teur.balanceOf(merchant), 50000);
    }

    function test_E2E_MilestonePayment() public {
        // Scenario: Bob hires merchant for a 2-phase project
        
        // 1. Mint to Bob
        vm.prank(ncbFR);
        teur.mint(bob, 300000, keccak256("bob-mint"));
        
        // 2. Bob creates milestone payment
        vm.prank(bob);
        teur.approve(address(conditionalPayments), type(uint256).max);
        
        bytes32 idempotencyKey = keccak256("bob-milestone-payment");
        uint256 expiry = block.timestamp + 90 days;
        uint256 milestoneCount = 2;
        
        vm.prank(bob);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            merchant,
            100000,
            IConditionalPayments.ConditionType.MILESTONE,
            bytes32(milestoneCount),
            expiry,
            pspEU,
            idempotencyKey
        );
        
        // Total in escrow
        assertEq(teur.balanceOf(address(conditionalPayments)), 100000);
        assertEq(teur.balanceOf(bob), 200000);
        
        // 3. Complete all milestones (auto-releases on last one)
        vm.startPrank(bob);
        conditionalPayments.confirmMilestone(paymentId, 0);
        conditionalPayments.confirmMilestone(paymentId, 1);
        vm.stopPrank();
        
        // All funds released
        assertEq(teur.balanceOf(merchant), 100000);
        assertEq(teur.balanceOf(address(conditionalPayments)), 0);
    }

    // ============ E2E: Emergency Controls ============

    function test_E2E_EmergencyPause() public {
        // Scenario: ECB pauses system during incident
        // Note: EMERGENCY_ROLE already granted to ecb in setUp
        
        // 1. Normal operation
        vm.prank(ncbDE);
        teur.mint(alice, 100000, keccak256("alice-mint"));
        
        // 2. ECB pauses
        vm.prank(ecb);
        teur.pause();
        
        // 3. Transfers blocked
        vm.prank(alice);
        vm.expectRevert(TokenizedEuro.ContractPaused.selector);
        teur.transfer(bob, 10000);
        
        // 4. Minting blocked
        vm.prank(ncbDE);
        vm.expectRevert(TokenizedEuro.ContractPaused.selector);
        teur.mint(bob, 50000, keccak256("bob-mint"));
        
        // 5. ECB resumes
        vm.prank(ecb);
        teur.unpause();
        
        // 6. Normal operation resumes
        vm.prank(alice);
        teur.transfer(bob, 10000);
        
        assertEq(teur.balanceOf(bob), 10000);
    }

    function test_E2E_WalletDeactivation() public {
        // Scenario: Compliance issue requires deactivating a wallet
        
        // 1. Normal operation
        vm.prank(ncbDE);
        teur.mint(alice, 100000, keccak256("alice-mint"));
        
        // 2. PSP deactivates Alice's wallet
        vm.prank(pspEU);
        walletRegistry.deactivateWallet(alice, "AML investigation");
        
        // 3. Alice can still send (drain funds)
        vm.prank(alice);
        teur.transfer(bob, 50000);
        
        // 4. PSP reactivates after investigation
        vm.prank(pspEU);
        walletRegistry.reactivateWallet(alice);
        
        assertTrue(walletRegistry.isActive(alice));
    }

    // ============ E2E: Cross-Border Payment ============

    function test_E2E_CrossBorderPayment() public {
        // Scenario: Alice (DE) pays Bob (FR)
        
        // 1. Alice gets tEUR from German NCB
        vm.prank(ncbDE);
        teur.mint(alice, 200000, keccak256("alice-mint"));
        
        // 2. Alice pays Bob (cross-border, same token)
        vm.prank(alice);
        teur.transfer(bob, 100000);
        
        assertEq(teur.balanceOf(alice), 100000);
        assertEq(teur.balanceOf(bob), 100000);
        
        // 3. Bob can use his tEUR in France
        vm.prank(bob);
        teur.transfer(merchant, 50000);
        
        assertEq(teur.balanceOf(bob), 50000);
        assertEq(teur.balanceOf(merchant), 50000);
    }

    // ============ E2E: Holding Limit Updates ============

    function test_E2E_UpdateHoldingLimits() public {
        // Scenario: ECB updates individual holding limits
        
        // 1. Check default limit
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL), 300000);
        
        // 2. ECB updates limit to €5,000
        vm.prank(ecb);
        walletRegistry.setDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL, 500000);
        
        // 3. New limit applies
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL), 500000);
        
        // 4. Alice can now hold more
        vm.prank(ecb);
        teur.setWaterfallEnabled(true);
        
        vm.prank(ncbDE);
        teur.mint(alice, 450000, keccak256("alice-mint"));
        
        // All €4,500 stays with Alice
        assertEq(teur.balanceOf(alice), 450000);
        assertEq(teur.balanceOf(bankDE), 0);
    }

    // ============ E2E: Time-Lock Payment ============

    function test_E2E_ScheduledPayment() public {
        // Scenario: Alice schedules payment to Bob for next week
        
        // 1. Mint to Alice
        vm.prank(ncbDE);
        teur.mint(alice, 200000, keccak256("alice-mint"));
        
        // 2. Create time-locked payment
        vm.prank(alice);
        teur.approve(address(conditionalPayments), type(uint256).max);
        
        uint256 unlockTime = block.timestamp + 7 days;
        uint256 expiry = block.timestamp + 30 days;
        
        vm.prank(alice);
        bytes32 paymentId = conditionalPayments.createConditionalPayment(
            bob,
            50000,
            IConditionalPayments.ConditionType.TIME_LOCK,
            bytes32(unlockTime),
            expiry,
            address(0),
            keccak256("alice-scheduled-payment")
        );
        
        assertEq(teur.balanceOf(alice), 150000);
        assertEq(teur.balanceOf(address(conditionalPayments)), 50000);
        
        // 3. Bob cannot claim yet
        vm.prank(bob);
        vm.expectRevert(ConditionalPayments.ConditionNotMet.selector);
        conditionalPayments.releasePayment(paymentId, bytes32("proof"));
        
        // 4. Time passes
        vm.warp(unlockTime + 1);
        
        // 5. Bob claims
        vm.prank(bob);
        conditionalPayments.releasePayment(paymentId, bytes32("proof"));
        
        assertEq(teur.balanceOf(bob), 50000);
    }

    // ============ Gas Usage Tests ============

    function test_Gas_BasicTransfer() public {
        vm.prank(ncbDE);
        teur.mint(alice, 100000, keccak256("alice-mint"));
        
        vm.prank(alice);
        uint256 gasStart = gasleft();
        teur.transfer(bob, 10000);
        uint256 gasUsed = gasStart - gasleft();
        
        // Log gas usage for analysis
        emit log_named_uint("Gas used for transfer", gasUsed);
        
        // Ensure reasonable gas usage (adjust threshold as needed)
        assertLt(gasUsed, 100000, "Transfer gas too high");
    }
}
