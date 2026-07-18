// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/v2/TokenLedgerV2.sol";
import "../src/v2/MigrationControllerV2.sol";

contract MigrationControllerV2Test is Test {
    TokenLedgerV2 internal ledger;
    MigrationControllerV2 internal migration;

    address internal governance = makeAddr("governance");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal outsider = makeAddr("outsider");

    bytes32 internal snapshotId = keccak256("snapshot-1000");
    bytes32 internal manifestHash = keccak256("signed-manifest");
    uint256 internal aliceAmount = 60_000;
    uint256 internal bobAmount = 40_000;
    bytes32 internal aliceLeaf;
    bytes32 internal bobLeaf;
    bytes32 internal root;

    function setUp() public {
        ledger = new TokenLedgerV2(governance);
        aliceLeaf = keccak256(abi.encode(snapshotId, uint256(0), alice, aliceAmount));
        bobLeaf = keccak256(abi.encode(snapshotId, uint256(1), bob, bobAmount));
        root = _hashPair(aliceLeaf, bobLeaf);

        migration = new MigrationControllerV2(
            address(ledger),
            governance,
            snapshotId,
            manifestHash,
            root,
            aliceAmount + bobAmount,
            block.timestamp + 7 days
        );

        vm.prank(governance);
        ledger.setControllerCapabilities(address(migration), ledger.CAPABILITY_MINT());
    }

    function test_ClaimsBalancesAndReconcilesSupply() public {
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
        migration.claimBalance(1, bob, bobAmount, _proof(aliceLeaf));

        assertEq(ledger.balanceOf(alice), aliceAmount);
        assertEq(ledger.balanceOf(bob), bobAmount);
        assertEq(ledger.totalSupply(), aliceAmount + bobAmount);
        assertEq(migration.claimedTotal(), aliceAmount + bobAmount);
        assertEq(migration.claimedAccounts(), 2);
        assertTrue(migration.isClaimed(0));
        assertTrue(migration.isClaimed(1));
    }

    function test_AnyoneCanSubmitAValidClaimForAccount() public {
        vm.prank(outsider);
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
        assertEq(ledger.balanceOf(alice), aliceAmount);
    }

    function test_DuplicateClaimIsRejected() public {
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
        vm.expectRevert(MigrationControllerV2.AlreadyClaimed.selector);
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
    }

    function test_InvalidProofIsRejected() public {
        bytes32[] memory badProof = _proof(keccak256("wrong"));
        vm.expectRevert(MigrationControllerV2.InvalidProof.selector);
        migration.claimBalance(0, alice, aliceAmount, badProof);
    }

    function test_PauseBlocksClaimsUntilGovernanceResumes() public {
        vm.prank(governance);
        migration.pauseClaims();

        vm.expectRevert(MigrationControllerV2.ClaimsArePaused.selector);
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));

        vm.prank(governance);
        migration.unpauseClaims();
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
        assertEq(ledger.balanceOf(alice), aliceAmount);
    }

    function test_OnlyGovernanceCanPauseFinalizeOrCancel() public {
        vm.startPrank(outsider);
        vm.expectRevert(MigrationControllerV2.Unauthorized.selector);
        migration.pauseClaims();
        vm.expectRevert(MigrationControllerV2.Unauthorized.selector);
        migration.finalize();
        vm.expectRevert(MigrationControllerV2.Unauthorized.selector);
        migration.cancelBeforeClaims();
        vm.stopPrank();
    }

    function test_CannotFinalizeBeforeExactReconciliation() public {
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
        vm.prank(governance);
        vm.expectRevert(MigrationControllerV2.ReconciliationMismatch.selector);
        migration.finalize();
    }

    function test_FinalizationPermanentlyDisablesClaims() public {
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
        migration.claimBalance(1, bob, bobAmount, _proof(aliceLeaf));

        vm.prank(governance);
        migration.finalize();

        assertEq(uint256(migration.state()), uint256(MigrationControllerV2.MigrationState.Finalized));
        vm.expectRevert(MigrationControllerV2.InvalidState.selector);
        migration.claimBalance(2, outsider, 1, new bytes32[](0));
    }

    function test_CancelAllowedOnlyBeforeFirstClaim() public {
        vm.prank(governance);
        migration.cancelBeforeClaims();
        assertEq(uint256(migration.state()), uint256(MigrationControllerV2.MigrationState.Cancelled));
    }

    function test_CannotCancelAfterClaimsBegin() public {
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
        vm.prank(governance);
        vm.expectRevert(MigrationControllerV2.ClaimsAlreadyStarted.selector);
        migration.cancelBeforeClaims();
    }

    function test_ClaimDeadlineIsEnforced() public {
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert(MigrationControllerV2.ClaimWindowClosed.selector);
        migration.claimBalance(0, alice, aliceAmount, _proof(bobLeaf));
    }

    function testFuzz_SingleLeafMigrationPreservesExactSupply(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, type(uint96).max);
        address account = makeAddr("fuzz-account");
        bytes32 fuzzSnapshot = keccak256(abi.encode("fuzz", amount));
        bytes32 leaf = keccak256(abi.encode(fuzzSnapshot, uint256(0), account, amount));

        TokenLedgerV2 fuzzLedger = new TokenLedgerV2(governance);
        MigrationControllerV2 fuzzMigration = new MigrationControllerV2(
            address(fuzzLedger),
            governance,
            fuzzSnapshot,
            keccak256(abi.encode("manifest", amount)),
            leaf,
            amount,
            block.timestamp + 1 days
        );

        vm.prank(governance);
        fuzzLedger.setControllerCapabilities(address(fuzzMigration), fuzzLedger.CAPABILITY_MINT());

        fuzzMigration.claimBalance(0, account, amount, new bytes32[](0));
        vm.prank(governance);
        fuzzMigration.finalize();

        assertEq(fuzzLedger.balanceOf(account), amount);
        assertEq(fuzzLedger.totalSupply(), amount);
        assertEq(fuzzMigration.claimedTotal(), amount);
    }

    function _proof(bytes32 sibling) internal pure returns (bytes32[] memory proof) {
        proof = new bytes32[](1);
        proof[0] = sibling;
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
}
