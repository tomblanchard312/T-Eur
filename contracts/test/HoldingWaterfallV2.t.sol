// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/v2/TokenLedgerV2.sol";
import "../src/v2/HoldingLimitPolicyV2.sol";
import "../src/v2/WaterfallControllerV2.sol";

contract HoldingWaterfallV2Test is Test {
    TokenLedgerV2 internal ledger;
    HoldingLimitPolicyV2 internal policy;
    WaterfallControllerV2 internal waterfall;

    address internal governance = makeAddr("governance");
    address internal policyAuthority = makeAddr("policyAuthority");
    address internal operator = makeAddr("operator");
    address internal minter = makeAddr("minter");
    address internal source = makeAddr("source");
    address internal wallet = makeAddr("wallet");
    address internal settlement = makeAddr("settlement");
    address internal outsider = makeAddr("outsider");

    function setUp() public {
        ledger = new TokenLedgerV2(governance);
        policy = new HoldingLimitPolicyV2(address(ledger), governance, policyAuthority);
        waterfall = new WaterfallControllerV2(address(ledger), address(policy), governance, operator);

        vm.startPrank(governance);
        ledger.setControllerCapabilities(minter, ledger.CAPABILITY_MINT());
        ledger.setControllerCapabilities(address(waterfall), ledger.CAPABILITY_MOVE());
        ledger.setTransferPolicy(address(policy));
        waterfall.linkSettlementAccount(wallet, settlement);
        vm.stopPrank();

        vm.startPrank(policyAuthority);
        policy.setHoldingLimit(wallet, 10_000);
        policy.setExempt(source, true);
        policy.setExempt(settlement, true);
        vm.stopPrank();

        vm.prank(minter);
        ledger.controllerMint(source, 100_000, keccak256("initial-source-funding"));
    }

    function test_DirectTransferOverLimitIsRejected() public {
        vm.prank(source);
        vm.expectRevert(
            abi.encodeWithSelector(HoldingLimitPolicyV2.HoldingLimitExceeded.selector, wallet, 12_000, 10_000)
        );
        ledger.transfer(wallet, 12_000);
    }

    function test_WaterfallSplitsExcessToSettlement() public {
        vm.prank(operator);
        (uint256 walletAmount, uint256 sweptAmount) =
            waterfall.executeWaterfall(source, wallet, 25_000, keccak256("waterfall-1"));

        assertEq(walletAmount, 10_000);
        assertEq(sweptAmount, 15_000);
        assertEq(ledger.balanceOf(wallet), 10_000);
        assertEq(ledger.balanceOf(settlement), 15_000);
        assertEq(ledger.balanceOf(source), 75_000);
        assertEq(ledger.totalSupply(), 100_000);
    }

    function test_WaterfallUsesRemainingCapacity() public {
        vm.prank(source);
        ledger.transfer(wallet, 4_000);

        vm.prank(operator);
        (uint256 walletAmount, uint256 sweptAmount) =
            waterfall.executeWaterfall(source, wallet, 10_000, keccak256("waterfall-remaining"));

        assertEq(walletAmount, 6_000);
        assertEq(sweptAmount, 4_000);
        assertEq(ledger.balanceOf(wallet), 10_000);
        assertEq(ledger.balanceOf(settlement), 4_000);
    }

    function test_ReverseWaterfallCapsAtAvailableCapacity() public {
        vm.prank(operator);
        waterfall.executeWaterfall(source, wallet, 20_000, keccak256("seed-settlement"));

        vm.prank(wallet);
        ledger.transfer(source, 3_000);

        vm.prank(operator);
        uint256 transferred =
            waterfall.executeReverseWaterfall(wallet, 8_000, keccak256("reverse-waterfall"));

        assertEq(transferred, 3_000);
        assertEq(ledger.balanceOf(wallet), 10_000);
        assertEq(ledger.balanceOf(settlement), 7_000);
    }

    function test_OnlyOperatorCanExecuteWaterfall() public {
        vm.prank(outsider);
        vm.expectRevert(WaterfallControllerV2.Unauthorized.selector);
        waterfall.executeWaterfall(source, wallet, 1_000, keccak256("unauthorized"));
    }

    function test_DuplicateWaterfallOperationIsRejected() public {
        bytes32 key = keccak256("duplicate-waterfall");

        vm.prank(operator);
        waterfall.executeWaterfall(source, wallet, 1_000, key);

        vm.prank(operator);
        vm.expectRevert(WaterfallControllerV2.OperationAlreadyUsed.selector);
        waterfall.executeWaterfall(source, wallet, 1_000, key);
    }

    function test_PolicyAuthorityCanChangeLimitAndExemption() public {
        vm.prank(policyAuthority);
        policy.setHoldingLimit(wallet, 20_000);

        vm.prank(source);
        ledger.transfer(wallet, 15_000);
        assertEq(ledger.balanceOf(wallet), 15_000);

        vm.prank(policyAuthority);
        policy.setExempt(wallet, true);

        vm.prank(source);
        ledger.transfer(wallet, 50_000);
        assertEq(ledger.balanceOf(wallet), 65_000);
    }

    function testFuzz_WaterfallConservesSupply(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 100_000);
        uint256 supplyBefore = ledger.totalSupply();

        vm.prank(operator);
        waterfall.executeWaterfall(source, wallet, amount, keccak256(abi.encodePacked("fuzz", amount)));

        assertEq(ledger.totalSupply(), supplyBefore);
        assertEq(
            ledger.balanceOf(source) + ledger.balanceOf(wallet) + ledger.balanceOf(settlement),
            supplyBefore
        );
        assertLe(ledger.balanceOf(wallet), 10_000);
    }
}
