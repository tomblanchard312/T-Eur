// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Permissioning.sol";
import "../src/WalletRegistry.sol";
import "../src/TokenizedEuro.sol";
import "../src/interfaces/IWalletRegistry.sol";

/**
 * @title SovereignMonetaryControlsTest
 * @notice Comprehensive test suite for tEUR sovereign monetary controls
 * @dev Validates ECB-exclusive powers, role enforcement, and audit integrity
 */
contract SovereignMonetaryControlsTest is Test {
    Permissioning public permissioning;
    WalletRegistry public walletRegistry;
    TokenizedEuro public teur;
    
    address public admin = makeAddr("admin");
    address public ecb = makeAddr("ecb");
    address public stateBank = makeAddr("stateBank");
    address public localBank = makeAddr("localBank");
    address public psp = makeAddr("psp");
    address public merchant = makeAddr("merchant");
    address public user = makeAddr("user");
    address public reserveAccount = makeAddr("reserveAccount");
    
    bytes32 public kycHash = keccak256("kyc-data");

    // Events for audit validation
    event Mint(address indexed to, uint256 value, bytes32 indexed idempotencyKey);
    event Burn(address indexed from, uint256 value, bytes32 indexed idempotencyKey);
    event AccountFrozen(address indexed account, address indexed by, string reason);
    event AccountUnfrozen(address indexed account, address indexed by);
    event FundsEscrowed(address indexed account, uint256 amount, string legalBasis, uint256 expiry);
    event FundsReleased(address indexed account, uint256 amount, address indexed to);
    event FundsBurnedFromEscrow(address indexed account, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        // Deploy core contracts
        permissioning = new Permissioning(admin);
        walletRegistry = new WalletRegistry(address(permissioning));
        teur = new TokenizedEuro(address(permissioning));
        
        vm.prank(admin);
        teur.setWalletRegistry(address(walletRegistry));
        
        // Grant roles
        vm.startPrank(admin);
        permissioning.grantRole(permissioning.ECB_ROLE(), ecb);
        permissioning.grantRole(permissioning.STATE_BANK_ROLE(), stateBank);
        permissioning.grantRole(permissioning.LOCAL_BANK_ROLE(), localBank);
        permissioning.grantRole(permissioning.PSP_ROLE(), psp);
        permissioning.grantRole(permissioning.MERCHANT_ROLE(), merchant);
        permissioning.grantRole(permissioning.REGISTRAR_ROLE(), admin);
        vm.stopPrank();

        // Register wallets
        vm.startPrank(admin);
        walletRegistry.registerWallet(user, IWalletRegistry.WalletType.INDIVIDUAL, address(0), kycHash);
        walletRegistry.registerWallet(merchant, IWalletRegistry.WalletType.MERCHANT, address(0), kycHash);
        walletRegistry.registerWallet(reserveAccount, IWalletRegistry.WalletType.BANK, address(0), kycHash);
        vm.stopPrank();
    }

    // ============ 1) Minting Tests ============

    function test_ECB_CanMintToReserve() public {
        bytes32 key = keccak256("mint-1");
        uint256 amount = 1000000; // 10,000.00 EUR

        vm.expectEmit(true, true, true, true);
        emit Mint(reserveAccount, amount, key);
        
        vm.prank(ecb);
        teur.mint(reserveAccount, amount, key);
        
        assertEq(teur.balanceOf(reserveAccount), amount);
    }

    function test_StateBank_Mint_Rejected() public {
        bytes32 key = keccak256("mint-fail");
        
        vm.prank(stateBank);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.mint(reserveAccount, 1000, key);
    }

    function test_Mint_Idempotency() public {
        bytes32 key = keccak256("mint-idempotent");
        uint256 amount = 5000;

        vm.prank(ecb);
        teur.mint(user, amount, key);

        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.IdempotencyKeyUsed.selector);
        teur.mint(user, amount, key);
    }

    // ============ 2) Burning Tests ============

    function test_ECB_CanBurnFunds() public {
        bytes32 mintKey = keccak256("mint-for-burn");
        bytes32 burnKey = keccak256("burn-1");
        uint256 amount = 1000;

        vm.startPrank(ecb);
        teur.mint(user, amount, mintKey);
        
        vm.expectEmit(true, true, true, true);
        emit Burn(user, amount, burnKey);
        
        teur.burn(user, amount, burnKey);
        vm.stopPrank();

        assertEq(teur.balanceOf(user), 0);
    }

    function test_ECB_CannotBurnNonExistentBalance() public {
        bytes32 key = keccak256("burn-fail");
        
        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.InsufficientBalance.selector);
        teur.burn(user, 1000, key);
    }

    function test_NonECB_Burn_Rejected() public {
        bytes32 key = keccak256("burn-unauth");
        
        vm.prank(psp);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.burn(user, 0, key);
    }

    // ============ 3) Sanctions Tests ============

    function test_ECB_Freeze_Successfully() public {
        vm.expectEmit(true, true, true, true);
        emit AccountFrozen(user, ecb, "Sanction list match");
        
        vm.prank(ecb);
        teur.freezeAccount(user, "Sanction list match");
        
        assertTrue(teur.frozenAccounts(user));
    }

    function test_FrozenWallet_CannotTransact() public {
        // Fund user
        vm.prank(ecb);
        teur.mint(user, 1000, keccak256("fund"));

        // Freeze user
        vm.prank(ecb);
        teur.freezeAccount(user, "Sanctioned");

        // Attempt transfer
        vm.prank(user);
        vm.expectRevert(TokenizedEuro.AccountIsFrozen.selector);
        teur.transfer(merchant, 100);
    }

    function test_FrozenWallet_CanBeQueried() public {
        vm.prank(ecb);
        teur.freezeAccount(user, "Sanctioned");
        
        assertEq(teur.balanceOf(user), 0);
        assertTrue(teur.frozenAccounts(user));
    }

    function test_Unfreeze_RestoresAbility() public {
        vm.prank(ecb);
        teur.mint(user, 1000, keccak256("fund"));
        
        vm.startPrank(ecb);
        teur.freezeAccount(user, "Temporary freeze");
        teur.unfreezeAccount(user);
        vm.stopPrank();

        vm.prank(user);
        teur.transfer(merchant, 100);
        assertEq(teur.balanceOf(merchant), 100);
    }

    function test_NonECB_Freeze_Rejected() public {
        vm.prank(localBank);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.freezeAccount(user, "Unauthorized freeze");
    }

    // ============ 4) Escrow Tests ============

    function test_ECB_EscrowFunds() public {
        uint256 amount = 5000;
        vm.prank(ecb);
        teur.mint(user, amount, keccak256("fund"));

        vm.expectEmit(true, true, true, true);
        emit FundsEscrowed(user, amount, "Court Order #123", block.timestamp + 1 days);

        vm.prank(ecb);
        teur.escrowFunds(user, amount, "Court Order #123", block.timestamp + 1 days);

        assertEq(teur.balanceOf(user), 0);
        (uint256 escrowedAmount, , ) = teur.escrowedBalances(user);
        assertEq(escrowedAmount, amount);
    }

    function test_EscrowedFunds_CannotBeSpent() public {
        uint256 amount = 5000;
        vm.prank(ecb);
        teur.mint(user, amount, keccak256("fund"));

        vm.prank(ecb);
        teur.escrowFunds(user, 2500, "Partial escrow", 0);

        vm.prank(user);
        vm.expectRevert(TokenizedEuro.InsufficientBalance.selector);
        teur.transfer(merchant, 3000); // Only 2500 left
    }

    function test_ECB_ReleaseEscrow() public {
        uint256 amount = 5000;
        vm.prank(ecb);
        teur.mint(user, amount, keccak256("fund"));

        vm.startPrank(ecb);
        teur.escrowFunds(user, amount, "Investigation", 0);
        
        vm.expectEmit(true, true, true, true);
        emit FundsReleased(user, amount, user);
        
        teur.releaseEscrowedFunds(user, user);
        vm.stopPrank();

        assertEq(teur.balanceOf(user), amount);
    }

    function test_ECB_BurnEscrowedFunds() public {
        uint256 amount = 5000;
        vm.prank(ecb);
        teur.mint(user, amount, keccak256("fund"));

        vm.startPrank(ecb);
        teur.escrowFunds(user, amount, "Confiscation", 0);
        
        vm.expectEmit(true, true, true, true);
        emit FundsBurnedFromEscrow(user, amount);
        
        teur.burnEscrowedFunds(user);
        vm.stopPrank();

        assertEq(teur.balanceOf(user), 0);
        assertEq(teur.totalSupply(), 0);
    }

    function test_EscrowExpiry_Enforced() public {
        uint256 amount = 5000;
        uint256 expiry = block.timestamp + 1 hours;
        
        vm.prank(ecb);
        teur.mint(user, amount, keccak256("fund"));

        vm.prank(ecb);
        teur.escrowFunds(user, amount, "Timed escrow", expiry);

        // Warp past expiry
        vm.warp(expiry + 1);

        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.EscrowExpired.selector);
        teur.releaseEscrowedFunds(user, user);
    }

    // ============ 5) Cross-role Enforcement ============

    function test_PSP_CannotBypassSanctions() public {
        vm.prank(ecb);
        teur.mint(user, 1000, keccak256("fund"));

        vm.prank(ecb);
        teur.freezeAccount(user, "Sanctioned");

        // PSP tries to transfer on behalf of user
        vm.prank(user);
        teur.approve(psp, 500);

        vm.prank(psp);
        vm.expectRevert(TokenizedEuro.AccountIsFrozen.selector);
        teur.transferFrom(user, merchant, 500);
    }

    function test_LocalBank_CannotOverrideEscrow() public {
        vm.prank(ecb);
        teur.mint(user, 1000, keccak256("fund"));

        vm.prank(ecb);
        teur.escrowFunds(user, 1000, "ECB Control", 0);

        // Local bank tries to release
        vm.prank(localBank);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.releaseEscrowedFunds(user, user);
    }

    function test_MerchantSettlement_RespectsFreeze() public {
        vm.prank(ecb);
        teur.mint(user, 1000, keccak256("fund"));

        vm.prank(ecb);
        teur.freezeAccount(merchant, "Merchant under investigation");

        vm.prank(user);
        vm.expectRevert(TokenizedEuro.AccountIsFrozen.selector);
        teur.transfer(merchant, 500);
    }

    // ============ 6) Audit Integrity ============

    function test_Audit_RoleActionOutcome() public {
        // This is implicitly tested by vm.expectEmit in other tests,
        // but we can do a specific one for a complex flow.
        
        bytes32 key = keccak256("audit-test");
        
        // ECB Mints (Action: Mint, Role: ECB, Outcome: Success)
        vm.expectEmit(true, true, true, true);
        emit Mint(user, 100, key);
        vm.prank(ecb);
        teur.mint(user, 100, key);

        // ECB Freezes (Action: Freeze, Role: ECB, Outcome: Success)
        vm.expectEmit(true, true, true, true);
        emit AccountFrozen(user, ecb, "Audit reason");
        vm.prank(ecb);
        teur.freezeAccount(user, "Audit reason");
    }

    // ============ 7) Global Mint Suspension ============

    function test_ECB_CanPauseContract() public {
        vm.expectEmit(true, false, false, false);
        emit Paused(ecb);
        
        vm.prank(ecb);
        teur.pause();
        
        assertTrue(teur.paused());
    }

    function test_PausedContract_BlocksTransfers() public {
        vm.prank(ecb);
        teur.mint(user, 1000, keccak256("fund"));

        vm.prank(ecb);
        teur.pause();

        vm.prank(user);
        vm.expectRevert(TokenizedEuro.ContractPaused.selector);
        teur.transfer(merchant, 100);
    }

    function test_PausedContract_BlocksMinting() public {
        vm.prank(ecb);
        teur.pause();

        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.ContractPaused.selector);
        teur.mint(user, 1000, keccak256("mint-fail"));
    }

    function test_ECB_CanUnpauseContract() public {
        vm.prank(ecb);
        teur.pause();
        
        vm.expectEmit(true, false, false, false);
        emit Unpaused(ecb);
        
        vm.prank(ecb);
        teur.unpause();
        
        assertFalse(teur.paused());
    }

    // ============ 8) Key Compromise / Role Revocation ============

    function test_Admin_CanRevokeECBRole() public {
        // Verify ECB has role
        assertTrue(permissioning.hasRole(permissioning.ECB_ROLE(), ecb));

        vm.expectEmit(true, true, true, true);
        emit RoleRevoked(permissioning.ECB_ROLE(), ecb, admin);

        vm.prank(admin);
        permissioning.revokeRole(permissioning.ECB_ROLE(), ecb);

        assertFalse(permissioning.hasRole(permissioning.ECB_ROLE(), ecb));
    }

    function test_RevokedKey_CannotMint() public {
        vm.prank(admin);
        permissioning.revokeRole(permissioning.ECB_ROLE(), ecb);

        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.mint(user, 1000, keccak256("revoked-mint"));
    }

    function test_RevokedKey_CannotFreeze() public {
        vm.prank(admin);
        permissioning.revokeRole(permissioning.ECB_ROLE(), ecb);

        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.freezeAccount(user, "Revoked key attempt");
    }
}
