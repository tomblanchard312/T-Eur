// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Permissioning.sol";
import "../src/WalletRegistry.sol";
import "../src/TokenizedEuro.sol";
import "../src/ConditionalPayments.sol";
import "../src/interfaces/IWalletRegistry.sol";

/**
 * @title RegisterWallet
 * @notice Script to register a new wallet in the Digital Euro system
 * 
 * Usage:
 *   WALLET=0x... WALLET_TYPE=1 BANK=0x... KYC_HASH=0x... \
 *   forge script script/Interactions.s.sol:RegisterWallet --rpc-url $RPC --broadcast
 */
contract RegisterWallet is Script {
    function run() external {
        uint256 privateKey = vm.envUint("REGISTRAR_PRIVATE_KEY");
        address walletRegistry = vm.envAddress("WALLET_REGISTRY_ADDRESS");
        
        address wallet = vm.envAddress("WALLET");
        uint8 walletType = uint8(vm.envUint("WALLET_TYPE"));
        address linkedBank = vm.envAddress("BANK");
        bytes32 kycHash = vm.envBytes32("KYC_HASH");

        console.log("Registering wallet:", wallet);
        console.log("Type:", walletType);
        console.log("Linked bank:", linkedBank);

        vm.startBroadcast(privateKey);
        
        WalletRegistry(walletRegistry).registerWallet(
            wallet,
            IWalletRegistry.WalletType(walletType),
            linkedBank,
            kycHash
        );
        
        vm.stopBroadcast();
        
        console.log("Wallet registered successfully");
    }
}

/**
 * @title MintTEUR
 * @notice Script to mint tEUR to an address
 * 
 * Usage:
 *   TO=0x... AMOUNT=10000 \
 *   forge script script/Interactions.s.sol:MintTEUR --rpc-url $RPC --broadcast
 */
contract MintTEUR is Script {
    function run() external {
        uint256 privateKey = vm.envUint("MINTER_PRIVATE_KEY");
        address teur = vm.envAddress("TEUR_ADDRESS");
        
        address to = vm.envAddress("TO");
        uint256 amount = vm.envUint("AMOUNT");
        bytes32 idempotencyKey = keccak256(abi.encodePacked(
            block.timestamp,
            to,
            amount,
            "mint"
        ));

        console.log("Minting tEUR:");
        console.log("  To:", to);
        console.log("  Amount:", amount, "(cents)");
        console.log("  Idempotency key:", vm.toString(idempotencyKey));

        vm.startBroadcast(privateKey);
        
        TokenizedEuro(teur).mint(to, amount, idempotencyKey);
        
        vm.stopBroadcast();
        
        console.log("Minted successfully");
    }
}

/**
 * @title CreateConditionalPayment
 * @notice Script to create a conditional payment (e.g., pay-on-delivery)
 * 
 * Usage:
 *   PAYEE=0x... AMOUNT=5000 CONDITION_TYPE=1 EXPIRES_IN=86400 \
 *   forge script script/Interactions.s.sol:CreateConditionalPayment --rpc-url $RPC --broadcast
 */
contract CreateConditionalPayment is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PAYER_PRIVATE_KEY");
        address conditionalPayments = vm.envAddress("CONDITIONAL_PAYMENTS_ADDRESS");
        address teur = vm.envAddress("TEUR_ADDRESS");
        
        address payee = vm.envAddress("PAYEE");
        uint256 amount = vm.envUint("AMOUNT");
        uint8 conditionType = uint8(vm.envOr("CONDITION_TYPE", uint256(1))); // DELIVERY
        uint256 expiresIn = vm.envOr("EXPIRES_IN", uint256(86400)); // 24 hours
        address arbiter = vm.envOr("ARBITER", address(0));
        
        bytes32 idempotencyKey = keccak256(abi.encodePacked(
            block.timestamp,
            payee,
            amount,
            "conditional"
        ));

        console.log("Creating conditional payment:");
        console.log("  Payee:", payee);
        console.log("  Amount:", amount, "(cents)");
        console.log("  Condition type:", conditionType);
        console.log("  Expires at:", block.timestamp + expiresIn);

        vm.startBroadcast(privateKey);
        
        // First approve the ConditionalPayments contract
        TokenizedEuro(teur).approve(conditionalPayments, amount);
        
        // Create the conditional payment
        bytes32 paymentId = ConditionalPayments(conditionalPayments).createConditionalPayment(
            payee,
            amount,
            IConditionalPayments.ConditionType(conditionType),
            bytes32(0), // conditionData
            block.timestamp + expiresIn,
            arbiter,
            idempotencyKey
        );
        
        vm.stopBroadcast();
        
        console.log("Conditional payment created:");
        console.log("  Payment ID:", vm.toString(paymentId));
    }
}

/**
 * @title ConfirmDelivery
 * @notice Script to confirm delivery and release escrowed payment
 * 
 * Usage:
 *   PAYMENT_ID=0x... DELIVERY_PROOF=0x... \
 *   forge script script/Interactions.s.sol:ConfirmDelivery --rpc-url $RPC --broadcast
 */
contract ConfirmDelivery is Script {
    function run() external {
        uint256 privateKey = vm.envUint("CONFIRMER_PRIVATE_KEY");
        address conditionalPayments = vm.envAddress("CONDITIONAL_PAYMENTS_ADDRESS");
        
        bytes32 paymentId = vm.envBytes32("PAYMENT_ID");
        bytes32 deliveryProof = vm.envOr("DELIVERY_PROOF", keccak256("confirmed"));

        console.log("Confirming delivery for payment:", vm.toString(paymentId));

        vm.startBroadcast(privateKey);
        
        ConditionalPayments(conditionalPayments).confirmDelivery(paymentId, deliveryProof);
        
        vm.stopBroadcast();
        
        console.log("Delivery confirmed, payment released");
    }
}

/**
 * @title CheckBalances
 * @notice Script to check tEUR balances and wallet info
 * 
 * Usage:
 *   ADDRESS=0x... forge script script/Interactions.s.sol:CheckBalances --rpc-url $RPC
 */
contract CheckBalances is Script {
    function run() external view {
        address teur = vm.envAddress("TEUR_ADDRESS");
        address walletRegistry = vm.envAddress("WALLET_REGISTRY_ADDRESS");
        address account = vm.envAddress("ADDRESS");

        console.log("=== Account Info ===");
        console.log("Address:", account);
        
        // tEUR balance
        uint256 balance = TokenizedEuro(teur).balanceOf(account);
        console.log("tEUR Balance:", balance, "cents");
        console.log("tEUR Balance (EUR):", balance / 100);
        
        // Wallet info
        IWalletRegistry.WalletInfo memory info = WalletRegistry(walletRegistry).getWalletInfo(account);
        
        console.log("");
        console.log("=== Wallet Registry ===");
        if (info.registrationTime == 0) {
            console.log("Status: NOT REGISTERED");
        } else {
            console.log("Status:", info.isActive ? "ACTIVE" : "DEACTIVATED");
            console.log("Wallet Type:", uint256(info.walletType));
            console.log("Linked Bank:", info.linkedBankAccount);
            console.log("Holding Limit:", WalletRegistry(walletRegistry).getHoldingLimit(account), "cents");
            console.log("Registration Time:", info.registrationTime);
        }
    }
}

/**
 * @title EmergencyPause
 * @notice Script to pause the tEUR contract in emergencies
 * 
 * Usage:
 *   forge script script/Interactions.s.sol:EmergencyPause --rpc-url $RPC --broadcast
 */
contract EmergencyPause is Script {
    function run() external {
        uint256 privateKey = vm.envUint("EMERGENCY_PRIVATE_KEY");
        address teur = vm.envAddress("TEUR_ADDRESS");

        console.log("!!! EMERGENCY PAUSE !!!");
        console.log("Pausing tEUR contract at:", teur);

        vm.startBroadcast(privateKey);
        
        TokenizedEuro(teur).pause();
        
        vm.stopBroadcast();
        
        console.log("tEUR contract is now PAUSED");
        console.log("No transfers, minting, or burning possible");
    }
}

/**
 * @title EmergencyUnpause
 * @notice Script to unpause the tEUR contract
 * 
 * Usage:
 *   forge script script/Interactions.s.sol:EmergencyUnpause --rpc-url $RPC --broadcast
 */
contract EmergencyUnpause is Script {
    function run() external {
        uint256 privateKey = vm.envUint("EMERGENCY_PRIVATE_KEY");
        address teur = vm.envAddress("TEUR_ADDRESS");

        console.log("Unpausing tEUR contract at:", teur);

        vm.startBroadcast(privateKey);
        
        TokenizedEuro(teur).unpause();
        
        vm.stopBroadcast();
        
        console.log("tEUR contract is now ACTIVE");
    }
}
