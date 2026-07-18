// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/v2/TokenLedgerV2.sol";
import "../src/v2/MintBurnControllerV2.sol";

contract MintBurnControllerV2Test is Test {
    TokenLedgerV2 internal ledger;
    MintBurnControllerV2 internal controller;

    address internal governance = makeAddr("governance");
    address internal mintAuthority = makeAddr("mintAuthority");
    address internal burnAuthority = makeAddr("burnAuthority");
    address internal alice = makeAddr("alice");
    address internal outsider = makeAddr("outsider");

    function setUp() public {
        ledger = new TokenLedgerV2(governance);
        controller = new MintBurnControllerV2(
            address(ledger), governance, mintAuthority, burnAuthority, 1_000_000, 100_000, 75_000
        );

        vm.prank(governance);
        ledger.setControllerCapabilities(
            address(controller), ledger.CAPABILITY_MINT() | ledger.CAPABILITY_BURN()
        );
    }

    function test_MintAndBurnUpdateSupply() public {
        vm.prank(mintAuthority);
        controller.mint(alice, 80_000, keccak256("issuance-1"), keccak256("mint-key"));

        assertEq(ledger.balanceOf(alice), 80_000);
        assertEq(ledger.totalSupply(), 80_000);

        vm.prank(burnAuthority);
        controller.burn(alice, 30_000, keccak256("redemption-1"), keccak256("burn-key"));

        assertEq(ledger.balanceOf(alice), 50_000);
        assertEq(ledger.totalSupply(), 50_000);
    }

    function test_UnauthorizedAuthoritiesCannotMintOrBurn() public {
        vm.prank(outsider);
        vm.expectRevert(MintBurnControllerV2.Unauthorized.selector);
        controller.mint(alice, 1_000, keccak256("ref"), keccak256("key"));

        vm.prank(outsider);
        vm.expectRevert(MintBurnControllerV2.Unauthorized.selector);
        controller.burn(alice, 1_000, keccak256("ref"), keccak256("key"));
    }

    function test_MintSupplyCapAndOperationLimitAreEnforced() public {
        vm.prank(mintAuthority);
        vm.expectRevert(MintBurnControllerV2.OperationLimitExceeded.selector);
        controller.mint(alice, 100_001, keccak256("too-large"), keccak256("large-key"));

        vm.prank(governance);
        controller.setLimits(50_000, 100_000, 75_000);

        vm.prank(mintAuthority);
        vm.expectRevert(MintBurnControllerV2.SupplyCapExceeded.selector);
        controller.mint(alice, 50_001, keccak256("cap"), keccak256("cap-key"));
    }

    function test_BurnOperationLimitIsEnforced() public {
        vm.prank(mintAuthority);
        controller.mint(alice, 100_000, keccak256("fund"), keccak256("fund-key"));

        vm.prank(burnAuthority);
        vm.expectRevert(MintBurnControllerV2.OperationLimitExceeded.selector);
        controller.burn(alice, 75_001, keccak256("too-large-burn"), keccak256("burn-large-key"));
    }

    function test_PauseControlsAreIndependent() public {
        vm.prank(governance);
        controller.setMintingPaused(true);

        vm.prank(mintAuthority);
        vm.expectRevert(MintBurnControllerV2.MintingPaused.selector);
        controller.mint(alice, 1_000, keccak256("paused-mint"), keccak256("paused-mint-key"));

        vm.prank(governance);
        controller.setMintingPaused(false);

        vm.prank(mintAuthority);
        controller.mint(alice, 10_000, keccak256("mint"), keccak256("mint-key"));

        vm.prank(governance);
        controller.setBurningPaused(true);

        vm.prank(burnAuthority);
        vm.expectRevert(MintBurnControllerV2.BurningPaused.selector);
        controller.burn(alice, 1_000, keccak256("paused-burn"), keccak256("paused-burn-key"));
    }

    function test_GovernanceCanRotateAuthorities() public {
        address newMintAuthority = makeAddr("newMintAuthority");
        address newBurnAuthority = makeAddr("newBurnAuthority");

        vm.startPrank(governance);
        controller.setMintAuthority(newMintAuthority);
        controller.setBurnAuthority(newBurnAuthority);
        vm.stopPrank();

        vm.prank(newMintAuthority);
        controller.mint(alice, 10_000, keccak256("rotated-mint"), keccak256("rotated-mint-key"));

        vm.prank(newBurnAuthority);
        controller.burn(alice, 5_000, keccak256("rotated-burn"), keccak256("rotated-burn-key"));

        assertEq(ledger.balanceOf(alice), 5_000);
    }

    function test_DuplicateOperationDigestIsRejected() public {
        bytes32 clientKey = keccak256("duplicate");

        vm.prank(mintAuthority);
        controller.mint(alice, 10_000, keccak256("first"), clientKey);

        vm.prank(mintAuthority);
        vm.expectRevert(MintBurnControllerV2.OperationAlreadyUsed.selector);
        controller.mint(alice, 10_000, keccak256("second"), clientKey);
    }

    function test_SameClientKeyIsScopedAcrossMintAndBurn() public {
        bytes32 sharedKey = keccak256("shared");

        vm.prank(mintAuthority);
        controller.mint(alice, 10_000, keccak256("mint"), sharedKey);

        vm.prank(burnAuthority);
        controller.burn(alice, 5_000, keccak256("burn"), sharedKey);

        assertEq(ledger.balanceOf(alice), 5_000);
    }

    function test_CannotSetSupplyCapBelowCurrentSupply() public {
        vm.prank(mintAuthority);
        controller.mint(alice, 10_000, keccak256("mint"), keccak256("mint-key"));

        vm.prank(governance);
        vm.expectRevert(MintBurnControllerV2.SupplyCapExceeded.selector);
        controller.setLimits(9_999, 100_000, 75_000);
    }

    function testFuzz_MintThenBurnPreservesExpectedSupply(uint96 rawMint, uint96 rawBurn) public {
        uint256 mintAmount = bound(uint256(rawMint), 1, 100_000);
        uint256 burnAmount = bound(uint256(rawBurn), 1, mintAmount);

        vm.prank(mintAuthority);
        controller.mint(
            alice,
            mintAmount,
            keccak256(abi.encode("mint-ref", mintAmount)),
            keccak256(abi.encode("mint-key", mintAmount))
        );

        vm.prank(burnAuthority);
        controller.burn(
            alice,
            burnAmount,
            keccak256(abi.encode("burn-ref", burnAmount)),
            keccak256(abi.encode("burn-key", mintAmount, burnAmount))
        );

        assertEq(ledger.totalSupply(), mintAmount - burnAmount);
        assertEq(ledger.balanceOf(alice), mintAmount - burnAmount);
    }
}
