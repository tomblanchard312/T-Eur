// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Permissioning.sol";
import "../src/WalletRegistry.sol";
import "../src/TokenizedEuro.sol";
import "../src/ConditionalPayments.sol";

/**
 * @title DeployDigitalEuro
 * @notice Deployment script for the complete Digital Euro infrastructure
 * @dev Deploys all contracts in correct order and configures roles
 * 
 * Usage:
 *   forge script script/DeployDigitalEuro.s.sol:DeployDigitalEuro \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify
 * 
 * Environment variables required:
 *   - DEPLOYER_PRIVATE_KEY: Private key for deployment
 *   - ADMIN_ADDRESS: Address to receive ADMIN role
 *   - ECB_ADDRESS: Address for ECB (emergency control)
 *   - NCB_ADDRESS: Address for NCB (minter/burner)
 */
contract DeployDigitalEuro is Script {
    // Deployed contract addresses
    Permissioning public permissioning;
    WalletRegistry public walletRegistry;
    TokenizedEuro public tokenizedEuro;
    ConditionalPayments public conditionalPayments;

    // Configuration
    struct DeploymentConfig {
        address admin;
        address ecbController;
        address ncbMinter;
        address pspRegistrar;
        address oracleService;
        bool enableWaterfall;
    }

    function run() external {
        // Load configuration from environment
        DeploymentConfig memory config = loadConfig();
        
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Digital Euro Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Admin:", config.admin);
        console.log("ECB Controller:", config.ecbController);
        console.log("NCB Minter:", config.ncbMinter);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Permissioning (with deployer as initial admin)
        console.log("1. Deploying Permissioning...");
        permissioning = new Permissioning(deployer);
        console.log("   Permissioning deployed at:", address(permissioning));

        // 2. Deploy WalletRegistry
        console.log("2. Deploying WalletRegistry...");
        walletRegistry = new WalletRegistry(address(permissioning));
        console.log("   WalletRegistry deployed at:", address(walletRegistry));

        // 3. Deploy TokenizedEuro
        console.log("3. Deploying TokenizedEuro...");
        tokenizedEuro = new TokenizedEuro(address(permissioning));
        console.log("   TokenizedEuro deployed at:", address(tokenizedEuro));

        // 4. Deploy ConditionalPayments
        console.log("4. Deploying ConditionalPayments...");
        conditionalPayments = new ConditionalPayments(
            address(tokenizedEuro),
            address(permissioning)
        );
        console.log("   ConditionalPayments deployed at:", address(conditionalPayments));

        // 5. Configure TokenizedEuro
        console.log("5. Configuring TokenizedEuro...");
        tokenizedEuro.setWalletRegistry(address(walletRegistry));
        if (config.enableWaterfall) {
            tokenizedEuro.setWaterfallEnabled(true);
            console.log("   Waterfall enabled");
        }

        // 6. Grant roles
        console.log("6. Granting roles...");
        _grantRoles(config, deployer);

        vm.stopBroadcast();

        // Output deployment summary
        _printSummary(config);
    }

    function loadConfig() internal view returns (DeploymentConfig memory) {
        // Load from environment with sensible defaults for lab
        address admin = vm.envOr("ADMIN_ADDRESS", msg.sender);
        address ecb = vm.envOr("ECB_ADDRESS", admin);
        address ncb = vm.envOr("NCB_ADDRESS", admin);
        address psp = vm.envOr("PSP_ADDRESS", admin);
        address oracle = vm.envOr("ORACLE_ADDRESS", admin);
        bool waterfall = vm.envOr("ENABLE_WATERFALL", true);

        return DeploymentConfig({
            admin: admin,
            ecbController: ecb,
            ncbMinter: ncb,
            pspRegistrar: psp,
            oracleService: oracle,
            enableWaterfall: waterfall
        });
    }

    function _grantRoles(DeploymentConfig memory config, address deployer) internal {
        // Grant ADMIN to configured admin (if different from deployer)
        if (config.admin != deployer) {
            permissioning.grantRole(permissioning.ADMIN_ROLE(), config.admin);
            console.log("   ADMIN granted to:", config.admin);
        }

        // ECB roles
        permissioning.grantRole(permissioning.EMERGENCY_ROLE(), config.ecbController);
        console.log("   EMERGENCY granted to:", config.ecbController);

        // NCB roles
        permissioning.grantRole(permissioning.MINTER_ROLE(), config.ncbMinter);
        permissioning.grantRole(permissioning.BURNER_ROLE(), config.ncbMinter);
        console.log("   MINTER/BURNER granted to:", config.ncbMinter);

        // PSP roles
        permissioning.grantRole(permissioning.REGISTRAR_ROLE(), config.pspRegistrar);
        permissioning.grantRole(permissioning.WATERFALL_ROLE(), config.pspRegistrar);
        console.log("   REGISTRAR/WATERFALL granted to:", config.pspRegistrar);

        // Oracle role
        permissioning.grantRole(permissioning.ORACLE_ROLE(), config.oracleService);
        console.log("   ORACLE granted to:", config.oracleService);

        // Revoke deployer admin if different from target admin
        if (config.admin != deployer) {
            permissioning.revokeRole(permissioning.ADMIN_ROLE(), deployer);
            console.log("   ADMIN revoked from deployer");
        }
    }

    function _printSummary(DeploymentConfig memory config) internal view {
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  Permissioning:       ", address(permissioning));
        console.log("  WalletRegistry:      ", address(walletRegistry));
        console.log("  TokenizedEuro:       ", address(tokenizedEuro));
        console.log("  ConditionalPayments: ", address(conditionalPayments));
        console.log("");
        console.log("Configuration:");
        console.log("  Waterfall Enabled:   ", config.enableWaterfall);
        console.log("  Individual Limit:    ", walletRegistry.INDIVIDUAL_DEFAULT_LIMIT(), "(cents)");
        console.log("  Merchant Limit:      ", walletRegistry.MERCHANT_DEFAULT_LIMIT(), "(cents)");
        console.log("");
        console.log("Save these addresses for frontend/backend integration!");
    }
}

/**
 * @title DeployLabEnvironment
 * @notice Simplified deployment for local lab testing
 * @dev Deploys with a single address as all roles for easy testing
 */
contract DeployLabEnvironment is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Lab Environment Deployment ===");
        console.log("Deployer (all roles):", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy all contracts
        Permissioning permissioning = new Permissioning(deployer);
        WalletRegistry walletRegistry = new WalletRegistry(address(permissioning));
        TokenizedEuro tokenizedEuro = new TokenizedEuro(address(permissioning));
        ConditionalPayments conditionalPayments = new ConditionalPayments(
            address(tokenizedEuro),
            address(permissioning)
        );

        // Configure
        tokenizedEuro.setWalletRegistry(address(walletRegistry));
        tokenizedEuro.setWaterfallEnabled(true);

        // Grant all roles to deployer for testing
        permissioning.grantRole(permissioning.MINTER_ROLE(), deployer);
        permissioning.grantRole(permissioning.BURNER_ROLE(), deployer);
        permissioning.grantRole(permissioning.EMERGENCY_ROLE(), deployer);
        permissioning.grantRole(permissioning.REGISTRAR_ROLE(), deployer);
        permissioning.grantRole(permissioning.ORACLE_ROLE(), deployer);
        permissioning.grantRole(permissioning.WATERFALL_ROLE(), deployer);

        vm.stopBroadcast();

        // Output for easy copy-paste
        console.log("");
        console.log("export PERMISSIONING_ADDRESS=", address(permissioning));
        console.log("export WALLET_REGISTRY_ADDRESS=", address(walletRegistry));
        console.log("export TEUR_ADDRESS=", address(tokenizedEuro));
        console.log("export CONDITIONAL_PAYMENTS_ADDRESS=", address(conditionalPayments));
    }
}
