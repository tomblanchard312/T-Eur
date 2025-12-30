// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Permissioning.sol";

contract PermissioningTest is Test {
    Permissioning public permissioning;
    
    address public admin;
    address public user1;
    address public user2;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    function setUp() public {
        admin = makeAddr("admin");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        permissioning = new Permissioning(admin);
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsAdmin() public view {
        assertTrue(permissioning.isAdmin(admin));
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(Permissioning.ZeroAddress.selector);
        new Permissioning(address(0));
    }

    function test_Constructor_EmitsRoleGranted() public {
        vm.expectEmit(true, true, true, true);
        emit RoleGranted(permissioning.ADMIN_ROLE(), admin, address(this));
        new Permissioning(admin);
    }

    // ============ Grant Role Tests ============

    function test_GrantRole_Success() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        vm.prank(admin);
        permissioning.grantRole(minterRole, user1);
        
        assertTrue(permissioning.isMinter(user1));
    }

    function test_GrantRole_EmitsEvent() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.expectEmit(true, true, true, true);
        emit RoleGranted(minterRole, user1, admin);
        
        vm.prank(admin);
        permissioning.grantRole(minterRole, user1);
    }

    function test_GrantRole_RevertsIfNotAdmin() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(user1);
        vm.expectRevert(Permissioning.Unauthorized.selector);
        permissioning.grantRole(minterRole, user2);
    }

    function test_GrantRole_RevertsOnZeroAddress() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(admin);
        vm.expectRevert(Permissioning.ZeroAddress.selector);
        permissioning.grantRole(minterRole, address(0));
    }

    function test_GrantRole_RevertsIfAlreadyGranted() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(admin);
        permissioning.grantRole(minterRole, user1);
        
        vm.prank(admin);
        vm.expectRevert(Permissioning.RoleAlreadyGranted.selector);
        permissioning.grantRole(minterRole, user1);
    }

    // ============ Revoke Role Tests ============

    function test_RevokeRole_Success() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(admin);
        permissioning.grantRole(minterRole, user1);
        
        vm.prank(admin);
        permissioning.revokeRole(minterRole, user1);
        
        assertFalse(permissioning.isMinter(user1));
    }

    function test_RevokeRole_EmitsEvent() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(admin);
        permissioning.grantRole(minterRole, user1);
        
        vm.expectEmit(true, true, true, true);
        emit RoleRevoked(minterRole, user1, admin);
        
        vm.prank(admin);
        permissioning.revokeRole(minterRole, user1);
    }

    function test_RevokeRole_RevertsIfNotAdmin() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(admin);
        permissioning.grantRole(minterRole, user1);
        
        vm.prank(user2);
        vm.expectRevert(Permissioning.Unauthorized.selector);
        permissioning.revokeRole(minterRole, user1);
    }

    function test_RevokeRole_RevertsIfNotGranted() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(admin);
        vm.expectRevert(Permissioning.RoleNotGranted.selector);
        permissioning.revokeRole(minterRole, user1);
    }

    // ============ Role Check Tests ============

    function test_HasRole_ReturnsCorrectly() public {
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        assertFalse(permissioning.hasRole(minterRole, user1));
        
        vm.prank(admin);
        permissioning.grantRole(minterRole, user1);
        
        assertTrue(permissioning.hasRole(minterRole, user1));
    }

    function test_AllRoleChecks() public {
        // Cache all role values
        bytes32 minterRole = permissioning.MINTER_ROLE();
        bytes32 burnerRole = permissioning.BURNER_ROLE();
        bytes32 emergencyRole = permissioning.EMERGENCY_ROLE();
        bytes32 validatorRole = permissioning.VALIDATOR_ROLE();
        bytes32 registrarRole = permissioning.REGISTRAR_ROLE();
        bytes32 oracleRole = permissioning.ORACLE_ROLE();
        bytes32 waterfallRole = permissioning.WATERFALL_ROLE();
        
        vm.startPrank(admin);
        
        permissioning.grantRole(minterRole, user1);
        assertTrue(permissioning.isMinter(user1));
        
        permissioning.grantRole(burnerRole, user1);
        assertTrue(permissioning.isBurner(user1));
        
        permissioning.grantRole(emergencyRole, user1);
        assertTrue(permissioning.isEmergencyController(user1));
        
        permissioning.grantRole(validatorRole, user1);
        assertTrue(permissioning.isValidator(user1));
        
        permissioning.grantRole(registrarRole, user1);
        assertTrue(permissioning.isRegistrar(user1));
        
        permissioning.grantRole(oracleRole, user1);
        assertTrue(permissioning.isOracle(user1));
        
        permissioning.grantRole(waterfallRole, user1);
        assertTrue(permissioning.isWaterfallOperator(user1));
        
        vm.stopPrank();
    }

    // ============ Fuzz Tests ============

    function testFuzz_GrantAndRevokeRole(address account) public {
        vm.assume(account != address(0));
        
        bytes32 minterRole = permissioning.MINTER_ROLE();
        
        vm.prank(admin);
        permissioning.grantRole(minterRole, account);
        assertTrue(permissioning.isMinter(account));
        
        vm.prank(admin);
        permissioning.revokeRole(minterRole, account);
        assertFalse(permissioning.isMinter(account));
    }
}
