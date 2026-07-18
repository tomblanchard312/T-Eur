// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/v2/EscrowControllerV2.sol";
import "../src/v2/interfaces/ITokenLedgerV2.sol";

contract MockTokenLedgerV2 is ITokenLedgerV2 {
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;
    address public controller;

    error Unauthorized();
    error InsufficientBalance();

    function setController(address account) external {
        controller = account;
    }

    function mint(address account, uint256 amount) external {
        _balances[account] += amount;
        _totalSupply += amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function controllerMove(address from, address to, uint256 amount) external {
        if (msg.sender != controller) revert Unauthorized();
        if (_balances[from] < amount) revert InsufficientBalance();
        _balances[from] -= amount;
        _balances[to] += amount;
    }

    function controllerBurn(address from, uint256 amount) external {
        if (msg.sender != controller) revert Unauthorized();
        if (_balances[from] < amount) revert InsufficientBalance();
        _balances[from] -= amount;
        _totalSupply -= amount;
    }
}

contract EscrowControllerV2Test is Test {
    MockTokenLedgerV2 internal ledger;
    EscrowControllerV2 internal controller;

    address internal authority = makeAddr("authority");
    address internal source = makeAddr("source");
    address internal beneficiary = makeAddr("beneficiary");
    address internal outsider = makeAddr("outsider");

    function setUp() public {
        ledger = new MockTokenLedgerV2();
        controller = new EscrowControllerV2(address(ledger), authority);
        ledger.setController(address(controller));
        ledger.mint(source, 100_000);
    }

    function test_CreateMultipleEscrowsForSameSource() public {
        bytes32 first = _createEscrow(10_000, 0, "case-1", "doc-1", "key-1");
        bytes32 second = _createEscrow(15_000, 0, "case-2", "doc-2", "key-2");

        assertTrue(first != second);
        assertEq(ledger.balanceOf(source), 75_000);
        assertEq(ledger.balanceOf(address(controller)), 25_000);
        assertEq(controller.activeEscrowBySource(source), 25_000);
        assertEq(controller.totalActiveEscrow(), 25_000);

        EscrowControllerV2.EscrowCase memory firstCase = controller.getEscrow(first);
        EscrowControllerV2.EscrowCase memory secondCase = controller.getEscrow(second);
        assertEq(uint256(firstCase.state), uint256(EscrowControllerV2.EscrowState.Active));
        assertEq(uint256(secondCase.state), uint256(EscrowControllerV2.EscrowState.Active));
    }

    function test_ReleaseMovesFundsToBeneficiaryAndClosesCase() public {
        bytes32 escrowId = _createEscrow(12_500, 0, "release-case", "release-doc", "create-release");

        vm.prank(authority);
        controller.releaseEscrow(escrowId, keccak256("release-key"));

        EscrowControllerV2.EscrowCase memory escrowCase = controller.getEscrow(escrowId);
        assertEq(uint256(escrowCase.state), uint256(EscrowControllerV2.EscrowState.Released));
        assertEq(ledger.balanceOf(beneficiary), 12_500);
        assertEq(ledger.balanceOf(address(controller)), 0);
        assertEq(controller.totalActiveEscrow(), 0);
        assertEq(controller.activeEscrowBySource(source), 0);
    }

    function test_ExpiryReturnsFundsToSourceAndCanBeTriggeredByAnyone() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes32 escrowId = _createEscrow(20_000, expiry, "expiry-case", "expiry-doc", "create-expiry");
        uint256 sourceAfterCreate = ledger.balanceOf(source);

        vm.warp(expiry);
        vm.prank(outsider);
        controller.expireEscrow(escrowId);

        EscrowControllerV2.EscrowCase memory escrowCase = controller.getEscrow(escrowId);
        assertEq(uint256(escrowCase.state), uint256(EscrowControllerV2.EscrowState.Expired));
        assertEq(ledger.balanceOf(source), sourceAfterCreate + 20_000);
        assertEq(ledger.balanceOf(address(controller)), 0);
        assertEq(controller.totalActiveEscrow(), 0);
    }

    function test_AuthorityCannotReleaseAfterExpiry() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes32 escrowId = _createEscrow(5_000, expiry, "past-expiry", "doc", "create-past-expiry");

        vm.warp(expiry);
        vm.prank(authority);
        vm.expectRevert(EscrowControllerV2.PastExpiry.selector);
        controller.releaseEscrow(escrowId, keccak256("late-release"));
    }

    function test_NoExpiryCaseCannotBeExpired() public {
        bytes32 escrowId = _createEscrow(5_000, 0, "indefinite", "doc", "create-indefinite");

        vm.warp(block.timestamp + 365 days);
        vm.expectRevert(EscrowControllerV2.NotExpired.selector);
        controller.expireEscrow(escrowId);
    }

    function test_BurnReducesSupplyAndClosesCase() public {
        uint256 supplyBefore = ledger.totalSupply();
        bytes32 escrowId = _createEscrow(8_000, 0, "burn-case", "burn-doc", "create-burn");

        vm.prank(authority);
        controller.burnEscrow(escrowId, keccak256("burn-key"));

        EscrowControllerV2.EscrowCase memory escrowCase = controller.getEscrow(escrowId);
        assertEq(uint256(escrowCase.state), uint256(EscrowControllerV2.EscrowState.Burned));
        assertEq(ledger.totalSupply(), supplyBefore - 8_000);
        assertEq(ledger.balanceOf(address(controller)), 0);
        assertEq(controller.totalActiveEscrow(), 0);
    }

    function test_CancelReturnsFundsToSource() public {
        bytes32 escrowId = _createEscrow(9_000, 0, "cancel-case", "cancel-doc", "create-cancel");

        vm.prank(authority);
        controller.cancelEscrow(escrowId, keccak256("cancel-key"));

        EscrowControllerV2.EscrowCase memory escrowCase = controller.getEscrow(escrowId);
        assertEq(uint256(escrowCase.state), uint256(EscrowControllerV2.EscrowState.Cancelled));
        assertEq(ledger.balanceOf(source), 100_000);
        assertEq(controller.totalActiveEscrow(), 0);
    }

    function test_ScopedIdempotencyAllowsSameClientKeyForDifferentOperations() public {
        bytes32 sharedKey = keccak256("shared-client-key");

        vm.prank(authority);
        bytes32 escrowId = controller.createEscrow(
            source,
            beneficiary,
            7_000,
            0,
            keccak256("scoped-case"),
            keccak256("scoped-doc"),
            sharedKey
        );

        vm.prank(authority);
        controller.releaseEscrow(escrowId, sharedKey);

        assertEq(ledger.balanceOf(beneficiary), 7_000);
    }

    function test_DuplicateCreateDigestIsRejected() public {
        bytes32 clientKey = keccak256("duplicate-create");

        vm.prank(authority);
        controller.createEscrow(
            source,
            beneficiary,
            3_000,
            0,
            keccak256("case-a"),
            keccak256("doc-a"),
            clientKey
        );

        vm.prank(authority);
        vm.expectRevert(EscrowControllerV2.OperationAlreadyUsed.selector);
        controller.createEscrow(
            source,
            beneficiary,
            3_000,
            0,
            keccak256("case-b"),
            keccak256("doc-b"),
            clientKey
        );
    }

    function test_NonAuthorityCannotCreateOrResolve() public {
        vm.prank(outsider);
        vm.expectRevert(EscrowControllerV2.Unauthorized.selector);
        controller.createEscrow(
            source,
            beneficiary,
            1_000,
            0,
            keccak256("unauthorized"),
            bytes32(0),
            keccak256("unauthorized-key")
        );

        bytes32 escrowId = _createEscrow(1_000, 0, "authorized", "doc", "authorized-key");
        vm.prank(outsider);
        vm.expectRevert(EscrowControllerV2.Unauthorized.selector);
        controller.releaseEscrow(escrowId, keccak256("unauthorized-release"));
    }

    function test_CannotTransitionClosedCaseTwice() public {
        bytes32 escrowId = _createEscrow(4_000, 0, "closed-case", "doc", "create-closed");

        vm.prank(authority);
        controller.releaseEscrow(escrowId, keccak256("release-closed"));

        vm.prank(authority);
        vm.expectRevert(EscrowControllerV2.InvalidState.selector);
        controller.cancelEscrow(escrowId, keccak256("cancel-closed"));
    }

    function testFuzz_CreateAndCancelConservesSupply(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 100_000);
        uint256 supplyBefore = ledger.totalSupply();

        bytes32 escrowId = _createEscrow(
            amount,
            0,
            "fuzz-case",
            "fuzz-doc",
            string(abi.encodePacked("key-", vm.toString(amount)))
        );

        vm.prank(authority);
        controller.cancelEscrow(escrowId, keccak256(abi.encodePacked("cancel-", amount)));

        assertEq(ledger.totalSupply(), supplyBefore);
        assertEq(ledger.balanceOf(source), 100_000);
        assertEq(ledger.balanceOf(address(controller)), 0);
        assertEq(controller.totalActiveEscrow(), 0);
    }

    function _createEscrow(
        uint256 amount,
        uint256 expiry,
        string memory caseRef,
        string memory documentRef,
        string memory clientRef
    ) internal returns (bytes32 escrowId) {
        vm.prank(authority);
        escrowId = controller.createEscrow(
            source,
            beneficiary,
            amount,
            expiry,
            keccak256(bytes(caseRef)),
            keccak256(bytes(documentRef)),
            keccak256(bytes(clientRef))
        );
    }
}
