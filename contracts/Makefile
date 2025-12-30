# Digital Euro Smart Contracts - Makefile
# Provides convenient commands for development and deployment

.PHONY: all build test clean deploy-lab deploy-int help

# Default target
all: build test

# ============================================
# Development
# ============================================

## Install Foundry dependencies
install:
	forge install foundry-rs/forge-std --no-commit

## Build contracts
build:
	forge build

## Run tests
test:
	forge test -vvv

## Run tests with gas report
test-gas:
	forge test -vvv --gas-report

## Run coverage
coverage:
	forge coverage

## Format code
fmt:
	forge fmt

## Check formatting
fmt-check:
	forge fmt --check

## Clean build artifacts
clean:
	forge clean

# ============================================
# Local Development
# ============================================

## Start local Anvil node
anvil:
	anvil --chain-id 31337 --block-time 2

## Deploy to local Anvil
deploy-local:
	@echo "Deploying to local Anvil..."
	forge script script/DeployDigitalEuro.s.sol:DeployLabEnvironment \
		--rpc-url http://localhost:8545 \
		--broadcast \
		-vvv

# ============================================
# Lab Environment (Kind + Besu)
# ============================================

## Port-forward to Besu RPC in Kind cluster
port-forward:
	kubectl port-forward svc/besu-validator-rpc -n ledger-ecb-core 8545:8545

## Deploy to lab environment
deploy-lab:
	@echo "Deploying to Lab (Kind + Besu)..."
	@echo "Ensure port-forward is running: make port-forward"
	forge script script/DeployDigitalEuro.s.sol:DeployLabEnvironment \
		--rpc-url http://localhost:8545 \
		--broadcast \
		-vvv

# ============================================
# Integration Environment
# ============================================

## Deploy to integration environment
deploy-int:
	@echo "Deploying to Integration..."
	@test -n "$(INT_RPC_URL)" || (echo "INT_RPC_URL not set" && exit 1)
	forge script script/DeployDigitalEuro.s.sol:DeployDigitalEuro \
		--rpc-url $(INT_RPC_URL) \
		--broadcast \
		-vvv

# ============================================
# Staging Environment
# ============================================

## Deploy to staging environment
deploy-stg:
	@echo "Deploying to Staging..."
	@test -n "$(STG_RPC_URL)" || (echo "STG_RPC_URL not set" && exit 1)
	@echo "⚠️  Staging deployment - ensure proper approvals"
	forge script script/DeployDigitalEuro.s.sol:DeployDigitalEuro \
		--rpc-url $(STG_RPC_URL) \
		--broadcast \
		-vvv

# ============================================
# Production - MANUAL ONLY
# ============================================

## Generate production deployment transaction (DO NOT BROADCAST)
deploy-prd-dry-run:
	@echo "⚠️  PRODUCTION DRY RUN - Review carefully!"
	@test -n "$(PRD_RPC_URL)" || (echo "PRD_RPC_URL not set" && exit 1)
	forge script script/DeployDigitalEuro.s.sol:DeployDigitalEuro \
		--rpc-url $(PRD_RPC_URL) \
		-vvv
	@echo ""
	@echo "⚠️  To deploy to production:"
	@echo "   1. Review the simulation above"
	@echo "   2. Get multi-sig approval"
	@echo "   3. Execute via governance process"

# ============================================
# Utilities
# ============================================

## Check account balance
balance:
	@test -n "$(ADDRESS)" || (echo "ADDRESS not set" && exit 1)
	cast balance $(ADDRESS) --rpc-url $(RPC_URL)

## Get chain ID
chain-id:
	cast chain-id --rpc-url $(RPC_URL)

## Check tEUR balance
teur-balance:
	@test -n "$(ADDRESS)" || (echo "ADDRESS not set" && exit 1)
	@test -n "$(TEUR_ADDRESS)" || (echo "TEUR_ADDRESS not set" && exit 1)
	cast call $(TEUR_ADDRESS) "balanceOf(address)(uint256)" $(ADDRESS) --rpc-url $(RPC_URL)

## Verify contracts on explorer
verify:
	@echo "Contract verification not implemented for private networks"

# ============================================
# Help
# ============================================

## Show this help
help:
	@echo "Digital Euro Smart Contracts"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  install       Install Foundry dependencies"
	@echo "  build         Build contracts"
	@echo "  test          Run tests"
	@echo "  test-gas      Run tests with gas report"
	@echo "  coverage      Run coverage"
	@echo "  fmt           Format code"
	@echo "  clean         Clean build artifacts"
	@echo ""
	@echo "Local:"
	@echo "  anvil         Start local Anvil node"
	@echo "  deploy-local  Deploy to local Anvil"
	@echo ""
	@echo "Lab:"
	@echo "  port-forward  Port-forward to Besu in Kind"
	@echo "  deploy-lab    Deploy to lab environment"
	@echo ""
	@echo "Environments:"
	@echo "  deploy-int    Deploy to integration"
	@echo "  deploy-stg    Deploy to staging"
	@echo "  deploy-prd-dry-run  Dry run for production"
	@echo ""
	@echo "Utilities:"
	@echo "  balance       Check account balance"
	@echo "  teur-balance  Check tEUR balance"
	@echo "  chain-id      Get chain ID"
