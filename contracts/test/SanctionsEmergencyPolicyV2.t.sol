// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/v2/TokenLedgerV2.sol";
import "../src/v2/SanctionsEmergencyPolicyV2.sol";

contract SanctionsEmergencyPolicyV2Test is Test {
    TokenLedgerV2 internal ledger;
    SanctionsEmergencyPolicyV2 internal policy;

    address internal governance = makeAddr("governance");
    address internal sanctionsAuthority = makeAddr("sanctionsAuthority");
    address internal emergencyAuthority = makeAddr("emergencyAuthority");
    address internal minter = makeAddr("minter");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal outsider = makeAddr("outsider");

    function setUp() public {
        ledger = new TokenLedgerV2(governance);
        policy = new SanctionsEmergencyPolicyV2(governance, sanctionsAuthority, emergencyAuthority);

        vm.startPrank(governance);
        ledger.setControllerCapabilities(minter, ledger.CAPABILITY_MINT());
        ledger.setTransferPolicy(address(policy));
        vm.stopPrank();

        vm.prank(minter);
        ledger.controllerMint(alice, 100_000, keccak256("initial-mint"));
    }

    function test_FrozenSenderCannotTransfer() public {
        vm.prank(sanctionsAuthority);
        policy.freezeAccount(alice, keccak256("case-123"));

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SanctionsEmergencyPolicyV2.AccountFrozenForTransfer.selector, alice)
        );
        ledger.transfer(bob, 1_000);
    }

    function test_FrozenRecipientCannotReceive() public {
        vm.prank(sanctionsAuthority);
        policy.freezeAccount(bob, keccak256("case-456"));

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SanctionsEmergencyPolicyV2.AccountFrozenForTransfer.selector, bob)
        );
        ledger.transfer(bob, 1_000);
    }

    function test_UnfreezeRestoresTransfersAndClearsReference() public {
        bytes32 referenceHash = keccak256("case-789");
        vm.prank(sanctionsAuthority);
        policy.freezeAccount(alice, referenceHash);

        vm.prank(sanctionsAuthority);
        policy.unfreezeAccount(alice);

        vm.prank(alice);
        ledger.transfer(bob, 1_000);

        assertEq(ledger.balanceOf(bob), 1_000);
        assertFalse(policy.frozenAccounts(alice));
        assertEq(policy.freezeReferenceHash(alice), bytes32(0));
    }

    function test_EmergencyPauseBlocksAllTransfers() public {
        vm.prank(emergencyAuthority);
        policy.pause();

        vm.prank(alice);
        vm.expectRevert(SanctionsEmergencyPolicyV2.TransfersPaused.selector);
        ledger.transfer(bob, 1_000);

        vm.prank(emergencyAuthority);
        policy.unpause();

        vm.prank(alice);
        ledger.transfer(bob, 1_000);
        assertEq(ledger.balanceOf(bob), 1_000);
    }

    function test_OnlySanctionsAuthorityCanFreeze() public {
        vm.prank(outsider);
        vm.expectRevert(SanctionsEmergencyPolicyV2.Unauthorized.selector);
        policy.freezeAccount(alice, keccak256("unauthorized"));
    }

    function test_OnlyEmergencyAuthorityCanPause() public {
        vm.prank(outsider);
        vm.expectRevert(SanctionsEmergencyPolicyV2.Unauthorized.selector);
        policy.pause();
    }

    function test_GovernanceCanRotateAuthorities() public {
        address newSanctions = makeAddr("newSanctions");
        address newEmergency = makeAddr("newEmergency");

        vm.startPrank(governance);
        policy.setSanctionsAuthority(newSanctions);
        policy.setEmergencyAuthority(newEmergency);
        vm.stopPrank();

        vm.prank(newSanctions);
        policy.freezeAccount(alice, keccak256("rotated-sanctions"));
        assertTrue(policy.frozenAccounts(alice));

        vm.prank(newEmergency);
        policy.pause();
        assertTrue(policy.paused());
    }

    function test_RepeatedFreezeAndUnfreezeAreRejected() public {
        vm.prank(sanctionsAuthority);
        policy.freezeAccount(alice, keccak256("case"));

        vm.prank(sanctionsAuthority);
        vm.expectRevert(SanctionsEmergencyPolicyV2.AlreadyFrozen.selector);
        policy.freezeAccount(alice, keccak256("case-2"));

        vm.prank(sanctionsAuthority);
        policy.unfreezeAccount(alice);

        vm.prank(sanctionsAuthority);
        vm.expectRevert(SanctionsEmergencyPolicyV2.NotFrozen.selector);
        policy.unfreezeAccount(alice);
    }

    function testFuzz_UnfrozenTransfersPreserveSupply(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 100_000);
        uint256 supplyBefore = ledger.totalSupply();

        vm.prank(alice);
        ledger.transfer(bob, amount);

        assertEq(ledger.totalSupply(), supplyBefore);
        assertEq(ledger.balanceOf(alice) + ledger.balanceOf(bob), supplyBefore);
    }
}
