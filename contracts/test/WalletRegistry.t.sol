// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Permissioning.sol";
import "../src/WalletRegistry.sol";
import "../src/interfaces/IWalletRegistry.sol";

contract WalletRegistryTest is Test {
    Permissioning public permissioning;
    WalletRegistry public walletRegistry;
    
    address public admin;
    address public registrar;
    address public user1;
    address public user2;
    address public bankAccount;
    
    bytes32 public kycHash = keccak256("user1-kyc-data");

    event WalletRegistered(
        address indexed wallet,
        IWalletRegistry.WalletType indexed walletType,
        address linkedBankAccount,
        bytes32 kycHash
    );
    event WalletDeactivated(address indexed wallet, string reason);
    event WalletReactivated(address indexed wallet);
    event LinkedBankAccountUpdated(address indexed wallet, address oldBank, address newBank);
    event HoldingLimitUpdated(IWalletRegistry.WalletType indexed walletType, uint256 oldLimit, uint256 newLimit);
    event CustomLimitSet(address indexed wallet, uint256 limit);

    function setUp() public {
        // Initialize addresses
        admin = makeAddr("admin");
        registrar = makeAddr("registrar");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        bankAccount = makeAddr("bankAccount");
        
        permissioning = new Permissioning(admin);
        walletRegistry = new WalletRegistry(address(permissioning));
        
        // Grant registrar role - use startPrank to persist across the REGISTRAR_ROLE() call
        bytes32 registrarRole = permissioning.REGISTRAR_ROLE();
        vm.prank(admin);
        permissioning.grantRole(registrarRole, registrar);
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsDefaultLimits() public view {
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.UNREGISTERED), 0);
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL), 300000); // €3,000
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.MERCHANT), 3000000);  // €30,000
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.PSP), type(uint256).max);
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.NCB), type(uint256).max);
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.BANK), type(uint256).max);
    }

    function test_Constructor_RevertsOnZeroPermissioning() public {
        vm.expectRevert(WalletRegistry.ZeroAddress.selector);
        new WalletRegistry(address(0));
    }

    // ============ Registration Tests ============

    function test_RegisterWallet_Individual() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(
            user1,
            IWalletRegistry.WalletType.INDIVIDUAL,
            bankAccount,
            kycHash
        );
        
        assertTrue(walletRegistry.isRegistered(user1));
        assertTrue(walletRegistry.isActive(user1));
        assertEq(walletRegistry.getHoldingLimit(user1), 300000);
    }

    function test_RegisterWallet_Merchant() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(
            user1,
            IWalletRegistry.WalletType.MERCHANT,
            bankAccount,
            kycHash
        );
        
        assertEq(walletRegistry.getHoldingLimit(user1), 3000000);
    }

    function test_RegisterWallet_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit WalletRegistered(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        vm.prank(registrar);
        walletRegistry.registerWallet(
            user1,
            IWalletRegistry.WalletType.INDIVIDUAL,
            bankAccount,
            kycHash
        );
    }

    function test_RegisterWallet_RevertsIfNotRegistrar() public {
        vm.prank(user2);
        vm.expectRevert(WalletRegistry.Unauthorized.selector);
        walletRegistry.registerWallet(
            user1,
            IWalletRegistry.WalletType.INDIVIDUAL,
            bankAccount,
            kycHash
        );
    }

    function test_RegisterWallet_RevertsOnZeroAddress() public {
        vm.prank(registrar);
        vm.expectRevert(WalletRegistry.ZeroAddress.selector);
        walletRegistry.registerWallet(
            address(0),
            IWalletRegistry.WalletType.INDIVIDUAL,
            bankAccount,
            kycHash
        );
    }

    function test_RegisterWallet_RevertsIfAlreadyRegistered() public {
        vm.startPrank(registrar);
        walletRegistry.registerWallet(
            user1,
            IWalletRegistry.WalletType.INDIVIDUAL,
            bankAccount,
            kycHash
        );
        
        vm.expectRevert(WalletRegistry.WalletAlreadyRegistered.selector);
        walletRegistry.registerWallet(
            user1,
            IWalletRegistry.WalletType.MERCHANT,
            bankAccount,
            kycHash
        );
        vm.stopPrank();
    }

    function test_RegisterWallet_RevertsOnUnregisteredType() public {
        vm.prank(registrar);
        vm.expectRevert(WalletRegistry.InvalidWalletType.selector);
        walletRegistry.registerWallet(
            user1,
            IWalletRegistry.WalletType.UNREGISTERED,
            bankAccount,
            kycHash
        );
    }

    // ============ Deactivation Tests ============

    function test_DeactivateWallet_Success() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        vm.prank(registrar);
        walletRegistry.deactivateWallet(user1, "Compliance issue");
        
        assertTrue(walletRegistry.isRegistered(user1));
        assertFalse(walletRegistry.isActive(user1));
    }

    function test_DeactivateWallet_EmitsEvent() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        vm.expectEmit(true, true, true, true);
        emit WalletDeactivated(user1, "Compliance issue");
        
        vm.prank(registrar);
        walletRegistry.deactivateWallet(user1, "Compliance issue");
    }

    function test_DeactivateWallet_RevertsIfNotRegistered() public {
        vm.prank(registrar);
        vm.expectRevert(WalletRegistry.WalletNotRegistered.selector);
        walletRegistry.deactivateWallet(user1, "Not registered");
    }

    // ============ Reactivation Tests ============

    function test_ReactivateWallet_Success() public {
        vm.startPrank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        walletRegistry.deactivateWallet(user1, "Temporary");
        walletRegistry.reactivateWallet(user1);
        vm.stopPrank();
        
        assertTrue(walletRegistry.isActive(user1));
    }

    function test_ReactivateWallet_EmitsEvent() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        vm.prank(registrar);
        walletRegistry.deactivateWallet(user1, "Temporary");
        
        vm.expectEmit(true, true, true, true);
        emit WalletReactivated(user1);
        
        vm.prank(registrar);
        walletRegistry.reactivateWallet(user1);
    }

    // ============ Limit Configuration Tests ============

    function test_SetDefaultHoldingLimit_Success() public {
        vm.prank(admin);
        walletRegistry.setDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL, 500000);
        
        assertEq(walletRegistry.getDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL), 500000);
    }

    function test_SetDefaultHoldingLimit_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit HoldingLimitUpdated(IWalletRegistry.WalletType.INDIVIDUAL, 300000, 500000);
        
        vm.prank(admin);
        walletRegistry.setDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL, 500000);
    }

    function test_SetDefaultHoldingLimit_RevertsIfNotAdmin() public {
        vm.prank(user1);
        vm.expectRevert(WalletRegistry.Unauthorized.selector);
        walletRegistry.setDefaultHoldingLimit(IWalletRegistry.WalletType.INDIVIDUAL, 500000);
    }

    function test_SetCustomLimit_Success() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        vm.prank(registrar);
        walletRegistry.setCustomLimit(user1, 500000);
        
        assertEq(walletRegistry.getHoldingLimit(user1), 500000);
    }

    function test_SetCustomLimit_EmitsEvent() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        vm.expectEmit(true, true, true, true);
        emit CustomLimitSet(user1, 500000);
        
        vm.prank(registrar);
        walletRegistry.setCustomLimit(user1, 500000);
    }

    // ============ Linked Bank Account Tests ============

    function test_UpdateLinkedBankAccount_Success() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        address newBank = address(0x100);
        vm.prank(registrar);
        walletRegistry.updateLinkedBankAccount(user1, newBank);
        
        IWalletRegistry.WalletInfo memory info = walletRegistry.getWalletInfo(user1);
        assertEq(info.linkedBankAccount, newBank);
    }

    function test_UpdateLinkedBankAccount_EmitsEvent() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        address newBank = address(0x100);
        vm.expectEmit(true, true, true, true);
        emit LinkedBankAccountUpdated(user1, bankAccount, newBank);
        
        vm.prank(registrar);
        walletRegistry.updateLinkedBankAccount(user1, newBank);
    }

    // ============ Query Tests ============

    function test_CanHold_ReturnsTrue_WithinLimit() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        assertTrue(walletRegistry.canHold(user1, 300000));  // Exactly at limit
        assertTrue(walletRegistry.canHold(user1, 100000));  // Below limit
    }

    function test_CanHold_ReturnsFalse_AboveLimit() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        assertFalse(walletRegistry.canHold(user1, 300001)); // Above limit
    }

    function test_CanHold_ReturnsFalse_IfNotRegistered() public {
        assertFalse(walletRegistry.canHold(user1, 100));
    }

    function test_CanHold_ReturnsFalse_IfDeactivated() public {
        vm.startPrank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        walletRegistry.deactivateWallet(user1, "Deactivated");
        vm.stopPrank();
        
        assertFalse(walletRegistry.canHold(user1, 100));
    }

    function test_GetExcessAmount_ReturnsZero_WithinLimit() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        assertEq(walletRegistry.getExcessAmount(user1, 200000, 50000), 0);
    }

    function test_GetExcessAmount_ReturnsExcess_AboveLimit() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        // Current: 200000, Incoming: 150000, Total: 350000, Limit: 300000
        // Excess = 350000 - 300000 = 50000
        assertEq(walletRegistry.getExcessAmount(user1, 200000, 150000), 50000);
    }

    function test_GetExcessAmount_ReturnsAll_IfUnregistered() public {
        assertEq(walletRegistry.getExcessAmount(user1, 100000, 50000), 150000);
    }

    function test_GetExcessAmount_ReturnsZero_ForUnlimitedType() public {
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.PSP, bankAccount, kycHash);
        
        assertEq(walletRegistry.getExcessAmount(user1, type(uint256).max - 1, 1), 0);
    }

    // ============ Fuzz Tests ============

    function testFuzz_GetExcessAmount(uint256 currentBalance, uint256 incoming) public {
        vm.assume(currentBalance < type(uint256).max / 2);
        vm.assume(incoming < type(uint256).max / 2);
        
        vm.prank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount, kycHash);
        
        uint256 limit = 300000;
        uint256 total = currentBalance + incoming;
        uint256 expectedExcess = total > limit ? total - limit : 0;
        
        assertEq(walletRegistry.getExcessAmount(user1, currentBalance, incoming), expectedExcess);
    }
}
