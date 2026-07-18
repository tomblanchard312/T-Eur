// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Permissioning.sol";
import "../src/TokenizedEuro.sol";

contract EscrowAccountingHardeningTest is Test {
    Permissioning private permissioning;
    TokenizedEuro private teur;

    address private admin = makeAddr("admin");
    address private ecb = makeAddr("ecb");
    address private user = makeAddr("user");

    function setUp() public {
        permissioning = new Permissioning(admin);
        teur = new TokenizedEuro(address(permissioning));

        vm.prank(admin);
        permissioning.grantRole(permissioning.ECB_ROLE(), ecb);

        vm.prank(ecb);
        teur.mint(user, 10_000, keccak256("initial-funding"));
    }

    function test_SecondActiveEscrowIsRejectedWithoutCorruptingAccounting() public {
        vm.startPrank(ecb);
        teur.escrowFunds(user, 4_000, "case-a", 0);

        vm.expectRevert(TokenizedEuro.ActiveEscrowExists.selector);
        teur.escrowFunds(user, 2_000, "case-b", 0);
        vm.stopPrank();

        (uint256 amount, string memory legalBasis, uint256 expiry) = teur.escrowedBalances(user);
        assertEq(amount, 4_000);
        assertEq(legalBasis, "case-a");
        assertEq(expiry, 0);
        assertEq(teur.escrowTotals(user), 4_000);
        assertEq(teur.balanceOf(user), 6_000);
    }

    function test_ReleaseClearsRecordAndTotalBeforeNewEscrow() public {
        vm.startPrank(ecb);
        teur.escrowFunds(user, 4_000, "case-a", 0);
        teur.releaseEscrowedFunds(user, user);

        assertEq(teur.escrowTotals(user), 0);
        (uint256 releasedAmount,,) = teur.escrowedBalances(user);
        assertEq(releasedAmount, 0);

        teur.escrowFunds(user, 2_000, "case-b", 0);
        vm.stopPrank();

        (uint256 amount, string memory legalBasis,) = teur.escrowedBalances(user);
        assertEq(amount, 2_000);
        assertEq(legalBasis, "case-b");
        assertEq(teur.escrowTotals(user), 2_000);
    }

    function test_BurnEscrowClearsAccountingAndSupply() public {
        vm.startPrank(ecb);
        teur.escrowFunds(user, 4_000, "confiscation", 0);
        teur.burnEscrowedFunds(user);
        vm.stopPrank();

        assertEq(teur.escrowTotals(user), 0);
        (uint256 amount,,) = teur.escrowedBalances(user);
        assertEq(amount, 0);
        assertEq(teur.totalSupply(), 6_000);
    }

    function test_EscrowRejectsAlreadyExpiredRecord() public {
        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.EscrowExpired.selector);
        teur.escrowFunds(user, 1_000, "expired", block.timestamp);
    }

    function test_BurnRejectsZeroAddress() public {
        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.ZeroAddress.selector);
        teur.burn(address(0), 1, keccak256("zero-address-burn"));
    }

    function test_BurnRejectsZeroAmount() public {
        vm.prank(ecb);
        vm.expectRevert(TokenizedEuro.InvalidAmount.selector);
        teur.burn(user, 0, keccak256("zero-amount-burn"));
    }
}
