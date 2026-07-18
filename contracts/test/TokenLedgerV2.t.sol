// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/v2/TokenLedgerV2.sol";
import "../src/v2/interfaces/ITransferPolicyV2.sol";

contract MockTransferPolicyV2 is ITransferPolicyV2 {
    bool public blocked;
    address public blockedAccount;

    error TransferBlocked();

    function setBlocked(bool value) external {
        blocked = value;
    }

    function setBlockedAccount(address account) external {
        blockedAccount = account;
    }

    function validateTransfer(address, address from, address to, uint256) external view {
        if (blocked || from == blockedAccount || to == blockedAccount) revert TransferBlocked();
    }
}

contract TokenLedgerV2Test is Test {
    TokenLedgerV2 internal ledger;
    MockTransferPolicyV2 internal policy;

    address internal governance = makeAddr("governance");
    address internal mintController = makeAddr("mintController");
    address internal burnController = makeAddr("burnController");
    address internal moveController = makeAddr("moveController");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal spender = makeAddr("spender");

    function setUp() public {
        ledger = new TokenLedgerV2(governance);
        policy = new MockTransferPolicyV2();

        vm.startPrank(governance);
        ledger.setControllerCapabilities(mintController, ledger.CAPABILITY_MINT());
        ledger.setControllerCapabilities(burnController, ledger.CAPABILITY_BURN());
        ledger.setControllerCapabilities(moveController, ledger.CAPABILITY_MOVE());
        ledger.setTransferPolicy(address(policy));
        vm.stopPrank();

        _mint(alice, 100_000, "initial-mint");
    }

    function test_MintUsesScopedIdempotency() public {
        bytes32 key = keccak256("mint-key");

        vm.prank(mintController);
        ledger.controllerMint(bob, 5_000, key);

        assertEq(ledger.balanceOf(bob), 5_000);
        assertEq(ledger.totalSupply(), 105_000);

        vm.prank(mintController);
        vm.expectRevert(TokenLedgerV2.OperationAlreadyUsed.selector);
        ledger.controllerMint(bob, 5_000, key);
    }

    function test_SameClientKeyCanBeUsedForDifferentOperation() public {
        bytes32 sharedKey = keccak256("shared-key");

        vm.prank(mintController);
        ledger.controllerMint(bob, 2_000, sharedKey);

        vm.prank(burnController);
        ledger.controllerBurn(alice, 2_000, sharedKey);

        assertEq(ledger.balanceOf(bob), 2_000);
        assertEq(ledger.balanceOf(alice), 98_000);
        assertEq(ledger.totalSupply(), 100_000);
    }

    function test_ControllerCapabilitiesAreLeastPrivilege() public {
        vm.prank(moveController);
        ledger.controllerMove(alice, bob, 1_000);

        vm.prank(moveController);
        vm.expectRevert(TokenLedgerV2.Unauthorized.selector);
        ledger.controllerMint(bob, 1_000, keccak256("unauthorized-mint"));

        vm.prank(moveController);
        vm.expectRevert(TokenLedgerV2.Unauthorized.selector);
        ledger.controllerBurn(bob, 1_000, keccak256("unauthorized-burn"));
    }

    function test_OnlyGovernanceCanAssignCapabilities() public {
        vm.prank(alice);
        vm.expectRevert(TokenLedgerV2.Unauthorized.selector);
        ledger.setControllerCapabilities(alice, ledger.CAPABILITY_MINT());
    }

    function test_TransferAndTransferFromPreserveSupply() public {
        uint256 supplyBefore = ledger.totalSupply();

        vm.prank(alice);
        ledger.transfer(bob, 10_000);

        vm.prank(alice);
        ledger.approve(spender, 7_500);

        vm.prank(spender);
        ledger.transferFrom(alice, bob, 7_500);

        assertEq(ledger.balanceOf(alice), 82_500);
        assertEq(ledger.balanceOf(bob), 17_500);
        assertEq(ledger.allowance(alice, spender), 0);
        assertEq(ledger.totalSupply(), supplyBefore);
    }

    function test_TransferPolicyCanBlockTransfers() public {
        policy.setBlockedAccount(bob);

        vm.prank(alice);
        vm.expectRevert(MockTransferPolicyV2.TransferBlocked.selector);
        ledger.transfer(bob, 1_000);

        vm.prank(moveController);
        vm.expectRevert(MockTransferPolicyV2.TransferBlocked.selector);
        ledger.controllerMove(alice, bob, 1_000);
    }

    function test_BurnReducesSupplyAndBalance() public {
        vm.prank(burnController);
        ledger.controllerBurn(alice, 12_000, keccak256("burn-key"));

        assertEq(ledger.balanceOf(alice), 88_000);
        assertEq(ledger.totalSupply(), 88_000);
    }

    function test_InvalidInputsAreRejected() public {
        vm.prank(mintController);
        vm.expectRevert(TokenLedgerV2.ZeroAddress.selector);
        ledger.controllerMint(address(0), 1_000, keccak256("zero-address"));

        vm.prank(mintController);
        vm.expectRevert(TokenLedgerV2.InvalidAmount.selector);
        ledger.controllerMint(bob, 0, keccak256("zero-mint"));

        vm.prank(alice);
        vm.expectRevert(TokenLedgerV2.InvalidAmount.selector);
        ledger.transfer(bob, 0);
    }

    function testFuzz_TransfersPreserveSupply(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 100_000);
        uint256 supplyBefore = ledger.totalSupply();

        vm.prank(alice);
        ledger.transfer(bob, amount);

        assertEq(ledger.totalSupply(), supplyBefore);
        assertEq(ledger.balanceOf(alice) + ledger.balanceOf(bob), supplyBefore);
    }

    function testFuzz_MintThenBurnRestoresSupply(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, type(uint96).max);
        uint256 supplyBefore = ledger.totalSupply();
        bytes32 key = keccak256(abi.encode(amount));

        vm.prank(mintController);
        ledger.controllerMint(bob, amount, key);

        vm.prank(burnController);
        ledger.controllerBurn(bob, amount, key);

        assertEq(ledger.totalSupply(), supplyBefore);
        assertEq(ledger.balanceOf(bob), 0);
    }

    function _mint(address to, uint256 amount, string memory keyText) internal {
        vm.prank(mintController);
        ledger.controllerMint(to, amount, keccak256(bytes(keyText)));
    }
}
