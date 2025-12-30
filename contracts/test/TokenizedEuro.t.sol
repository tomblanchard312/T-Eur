// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Permissioning.sol";
import "../src/WalletRegistry.sol";
import "../src/TokenizedEuro.sol";
import "../src/interfaces/IWalletRegistry.sol";

contract TokenizedEuroTest is Test {
    Permissioning public permissioning;
    WalletRegistry public walletRegistry;
    TokenizedEuro public teur;
    
    address public admin;
    address public minter;
    address public waterfallOp;
    address public registrar;
    address public user1;
    address public user2;
    address public bankAccount1;
    address public bankAccount2;
    
    bytes32 public kycHash = keccak256("kyc-data");

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Mint(address indexed to, uint256 amount, bytes32 indexed idempotencyKey);
    event Burn(address indexed from, uint256 amount, bytes32 indexed idempotencyKey);
    event WaterfallExecuted(address indexed wallet, address indexed bank, uint256 amount);
    event ReverseWaterfallExecuted(address indexed wallet, address indexed bank, uint256 amount);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    function setUp() public {
        // Initialize addresses
        admin = makeAddr("admin");
        minter = makeAddr("minter");
        waterfallOp = makeAddr("waterfallOp");
        registrar = makeAddr("registrar");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        bankAccount1 = makeAddr("bankAccount1");
        bankAccount2 = makeAddr("bankAccount2");
        
        // Deploy core contracts
        permissioning = new Permissioning(admin);
        walletRegistry = new WalletRegistry(address(permissioning));
        teur = new TokenizedEuro(address(permissioning));
        
        // Set wallet registry
        vm.prank(admin);
        teur.setWalletRegistry(address(walletRegistry));
        
        // Grant roles
        vm.startPrank(admin);
        permissioning.grantRole(permissioning.MINTER_ROLE(), minter);
        permissioning.grantRole(permissioning.BURNER_ROLE(), minter);  // Minter also has burner role in test
        permissioning.grantRole(permissioning.WATERFALL_ROLE(), waterfallOp);
        permissioning.grantRole(permissioning.REGISTRAR_ROLE(), registrar);
        permissioning.grantRole(permissioning.EMERGENCY_ROLE(), admin);
        vm.stopPrank();
        
        // Register test wallets with linked banks
        vm.startPrank(registrar);
        walletRegistry.registerWallet(user1, IWalletRegistry.WalletType.INDIVIDUAL, bankAccount1, kycHash);
        walletRegistry.registerWallet(user2, IWalletRegistry.WalletType.MERCHANT, bankAccount2, kycHash);
        walletRegistry.registerWallet(bankAccount1, IWalletRegistry.WalletType.BANK, address(0), kycHash);
        walletRegistry.registerWallet(bankAccount2, IWalletRegistry.WalletType.BANK, address(0), kycHash);
        vm.stopPrank();
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsNameAndSymbol() public view {
        assertEq(teur.name(), "Tokenized Euro");
        assertEq(teur.symbol(), "tEUR");
    }

    function test_Constructor_ZeroTotalSupply() public view {
        assertEq(teur.totalSupply(), 0);
    }

    // ============ Minting Tests ============

    function test_Mint_Success() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, key);
        
        assertEq(teur.balanceOf(user1), 100000);
        assertEq(teur.totalSupply(), 100000);
    }

    function test_Mint_EmitsEvent() public {
        bytes32 key = keccak256("mint-1");
        
        vm.expectEmit(true, true, true, true);
        emit Mint(user1, 100000, key);
        
        vm.prank(minter);
        teur.mint(user1, 100000, key);
    }

    function test_Mint_RevertsIfNotMinter() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(user1);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.mint(user1, 100000, key);
    }

    function test_Mint_RevertsOnDuplicateIdempotencyKey() public {
        bytes32 key = keccak256("mint-1");
        
        vm.startPrank(minter);
        teur.mint(user1, 100000, key);
        
        vm.expectRevert(TokenizedEuro.IdempotencyKeyUsed.selector);
        teur.mint(user1, 50000, key);
        vm.stopPrank();
    }

    function test_Mint_RevertsWhenPaused() public {
        vm.prank(admin);
        teur.pause();
        
        bytes32 key = keccak256("mint-1");
        vm.prank(minter);
        vm.expectRevert(TokenizedEuro.ContractPaused.selector);
        teur.mint(user1, 100000, key);
    }

    function test_Mint_TriggersWaterfallIfExceedsLimit() public {
        // Enable waterfall
        vm.prank(admin);
        teur.setWaterfallEnabled(true);
        
        // Individual limit is €3,000 (300000 with 2 decimals)
        // Minting €4,000 then manually execute waterfall
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(user1, 400000, key);
        
        // Before waterfall, user has full minted amount
        assertEq(teur.balanceOf(user1), 400000);
        
        // Execute waterfall manually (it's not automatic on mint)
        vm.prank(waterfallOp);
        teur.executeWaterfall(user1);
        
        // User should have the limit amount
        assertEq(teur.balanceOf(user1), 300000);
        // Bank should have the excess
        assertEq(teur.balanceOf(bankAccount1), 100000);
    }

    // ============ Burning Tests ============

    function test_Burn_Success() public {
        bytes32 mintKey = keccak256("mint-1");
        bytes32 burnKey = keccak256("burn-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, mintKey);
        
        vm.prank(minter);
        teur.burn(user1, 50000, burnKey);
        
        assertEq(teur.balanceOf(user1), 50000);
        assertEq(teur.totalSupply(), 50000);
    }

    function test_Burn_EmitsEvent() public {
        bytes32 mintKey = keccak256("mint-1");
        bytes32 burnKey = keccak256("burn-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, mintKey);
        
        vm.expectEmit(true, true, true, true);
        emit Burn(user1, 50000, burnKey);
        
        vm.prank(minter);
        teur.burn(user1, 50000, burnKey);
    }

    function test_Burn_RevertsIfInsufficientBalance() public {
        bytes32 mintKey = keccak256("mint-1");
        bytes32 burnKey = keccak256("burn-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, mintKey);
        
        vm.prank(minter);
        vm.expectRevert(TokenizedEuro.InsufficientBalance.selector);
        teur.burn(user1, 150000, burnKey);
    }

    // ============ Transfer Tests ============

    function test_Transfer_Success() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, key);
        
        vm.prank(user1);
        teur.transfer(user2, 50000);
        
        assertEq(teur.balanceOf(user1), 50000);
        assertEq(teur.balanceOf(user2), 50000);
    }

    function test_Transfer_EmitsEvent() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, key);
        
        vm.expectEmit(true, true, true, true);
        emit Transfer(user1, user2, 50000);
        
        vm.prank(user1);
        teur.transfer(user2, 50000);
    }

    function test_Transfer_RevertsWhenPaused() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, key);
        
        vm.prank(admin);
        teur.pause();
        
        vm.prank(user1);
        vm.expectRevert(TokenizedEuro.ContractPaused.selector);
        teur.transfer(user2, 50000);
    }

    function test_TransferFrom_Success() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(user1, 100000, key);
        
        vm.prank(user1);
        teur.approve(user2, 50000);
        
        vm.prank(user2);
        teur.transferFrom(user1, user2, 50000);
        
        assertEq(teur.balanceOf(user1), 50000);
        assertEq(teur.balanceOf(user2), 50000);
    }

    // ============ Waterfall Tests ============

    function test_ExecuteWaterfall_Success() public {
        bytes32 key = keccak256("mint-1");
        
        // Enable waterfall
        vm.prank(admin);
        teur.setWaterfallEnabled(true);
        
        // Mint more than the limit to have excess
        vm.prank(minter);
        teur.mint(user1, 350000, key); // Exceeds 300000 limit
        
        // Before waterfall, user has full minted amount
        assertEq(teur.balanceOf(user1), 350000);
        
        // Execute waterfall manually
        vm.prank(waterfallOp);
        teur.executeWaterfall(user1);
        
        // After waterfall, user has limit, bank has excess
        assertEq(teur.balanceOf(user1), 300000);
        assertEq(teur.balanceOf(bankAccount1), 50000);
    }

    function test_ExecuteWaterfall_ManualTrigger() public {
        bytes32 key = keccak256("mint-1");
        
        // Enable waterfall
        vm.prank(admin);
        teur.setWaterfallEnabled(true);
        
        vm.prank(minter);
        teur.mint(user1, 200000, key);
        
        // Manual trigger (no excess, should do nothing)
        vm.prank(waterfallOp);
        teur.executeWaterfall(user1);
        
        // No change since balance is under limit
        assertEq(teur.balanceOf(user1), 200000);
        assertEq(teur.balanceOf(bankAccount1), 0);
    }

    function test_ExecuteWaterfall_RevertsIfNotWaterfallOperator() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(admin);
        teur.setWaterfallEnabled(true);
        
        vm.prank(minter);
        teur.mint(user1, 200000, key);
        
        vm.prank(user1);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.executeWaterfall(user1);
    }

    function test_ExecuteWaterfall_RevertsIfDisabled() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(user1, 200000, key);
        
        vm.prank(waterfallOp);
        vm.expectRevert(TokenizedEuro.WaterfallDisabled.selector);
        teur.executeWaterfall(user1);
    }

    // ============ Reverse Waterfall Tests ============

    function test_ExecuteReverseWaterfall_Success() public {
        bytes32 key = keccak256("mint-1");
        
        // Mint to bank first
        vm.prank(minter);
        teur.mint(bankAccount1, 200000, key);
        
        // Minter can execute reverse waterfall
        vm.prank(minter);
        teur.executeReverseWaterfall(user1, 50000, keccak256("reverse-1"));
        
        assertEq(teur.balanceOf(user1), 50000);
        assertEq(teur.balanceOf(bankAccount1), 150000);
    }

    function test_ExecuteReverseWaterfall_EmitsEvent() public {
        bytes32 key = keccak256("mint-1");
        
        vm.prank(minter);
        teur.mint(bankAccount1, 200000, key);
        
        vm.expectEmit(true, true, true, true);
        emit ReverseWaterfallExecuted(user1, bankAccount1, 50000);
        
        vm.prank(minter);
        teur.executeReverseWaterfall(user1, 50000, keccak256("reverse-1"));
    }

    // ============ Pause Tests ============

    function test_Pause_Success() public {
        vm.prank(admin);
        teur.pause();
        
        assertTrue(teur.paused());
    }

    function test_Pause_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit Paused(admin);
        
        vm.prank(admin);
        teur.pause();
    }

    function test_Pause_RevertsIfNotAdmin() public {
        vm.prank(user1);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.pause();
    }

    function test_Unpause_Success() public {
        vm.startPrank(admin);
        teur.pause();
        teur.unpause();
        vm.stopPrank();
        
        assertFalse(teur.paused());
    }

    function test_Unpause_EmitsEvent() public {
        vm.prank(admin);
        teur.pause();
        
        vm.expectEmit(true, true, true, true);
        emit Unpaused(admin);
        
        vm.prank(admin);
        teur.unpause();
    }

    // ============ Configuration Tests ============

    function test_SetWalletRegistry_Success() public {
        WalletRegistry newRegistry = new WalletRegistry(address(permissioning));
        
        vm.prank(admin);
        teur.setWalletRegistry(address(newRegistry));
        
        assertEq(address(teur.walletRegistry()), address(newRegistry));
    }

    function test_SetWalletRegistry_RevertsIfNotAdmin() public {
        WalletRegistry newRegistry = new WalletRegistry(address(permissioning));
        
        vm.prank(user1);
        vm.expectRevert(TokenizedEuro.Unauthorized.selector);
        teur.setWalletRegistry(address(newRegistry));
    }

    function test_SetWaterfallEnabled_Success() public {
        vm.prank(admin);
        teur.setWaterfallEnabled(true);
        
        assertTrue(teur.waterfallEnabled());
    }

    // ============ Fuzz Tests ============

    function testFuzz_Mint_And_Transfer(uint256 mintAmount, uint256 transferAmount) public {
        vm.assume(mintAmount > 0 && mintAmount <= 300000); // Stay within individual limit
        vm.assume(transferAmount > 0 && transferAmount <= mintAmount);
        
        bytes32 key = keccak256(abi.encodePacked("mint-", mintAmount));
        
        vm.prank(minter);
        teur.mint(user1, mintAmount, key);
        
        vm.prank(user1);
        teur.transfer(user2, transferAmount);
        
        assertEq(teur.balanceOf(user1), mintAmount - transferAmount);
        assertEq(teur.balanceOf(user2), transferAmount);
    }

    function testFuzz_Idempotency_Keys(bytes32 key1, bytes32 key2) public {
        vm.assume(key1 != key2);
        
        vm.startPrank(minter);
        teur.mint(user1, 100000, key1);
        teur.mint(user1, 100000, key2);
        vm.stopPrank();
        
        assertEq(teur.balanceOf(user1), 200000);
    }
}
