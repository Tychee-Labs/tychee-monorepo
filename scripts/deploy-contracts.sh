#!/bin/bash
# Tychee Contracts Deployment Script
# 
# This script deploys Soroban smart contracts for the Tychee platform.
# - Account Abstraction: Deployed once as shared infrastructure
# - Token Vault: Deployed per-SDK implementation
#
# Usage:
#   ./scripts/deploy-contracts.sh [aa|vault|all] [testnet|mainnet]
#
# Examples:
#   ./scripts/deploy-contracts.sh aa testnet        # Deploy Account Abstraction only
#   ./scripts/deploy-contracts.sh vault testnet     # Deploy Token Vault only
#   ./scripts/deploy-contracts.sh all testnet       # Deploy both contracts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEPLOY_TYPE="${1:-all}"
NETWORK="${2:-testnet}"
KEY_NAME="${KEY_NAME:-deployer}"
GAS_POOL_AMOUNT="${GAS_POOL_AMOUNT:-10000000}"  # 1 XLM in stroops

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOROBAN_DIR="$PROJECT_ROOT/soroban"
WASM_DIR="$SOROBAN_DIR/target/wasm32-unknown-unknown/release"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Tychee Contracts Deployment             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Deploy type: ${YELLOW}$DEPLOY_TYPE${NC}"
echo -e "Network:     ${YELLOW}$NETWORK${NC}"
echo -e "Key name:    ${YELLOW}$KEY_NAME${NC}"
echo ""

# Function to check if command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed${NC}"
        exit 1
    fi
}

# Function to build contracts
build_contracts() {
    echo -e "${BLUE}📦 Building Soroban contracts...${NC}"
    cd "$SOROBAN_DIR"
    
    cargo build --target wasm32-unknown-unknown --release
    
    echo -e "${GREEN}✅ Contracts built successfully${NC}"
    ls -la "$WASM_DIR"/*.wasm
    echo ""
}

# Function to setup deployer key
setup_deployer() {
    echo -e "${BLUE}🔑 Setting up deployer key...${NC}"
    
    # Check if key exists
    if stellar keys address "$KEY_NAME" 2>/dev/null; then
        echo -e "${YELLOW}Key '$KEY_NAME' already exists${NC}"
        DEPLOYER_ADDRESS=$(stellar keys address "$KEY_NAME")
    else
        echo "Generating new keypair..."
        stellar keys generate "$KEY_NAME" --network "$NETWORK"
        DEPLOYER_ADDRESS=$(stellar keys address "$KEY_NAME")
        
        echo -e "${YELLOW}Funding account on $NETWORK...${NC}"
        stellar account fund "$KEY_NAME" --network "$NETWORK" || true
    fi
    
    echo -e "Deployer address: ${GREEN}$DEPLOYER_ADDRESS${NC}"
    echo ""
}

# Function to deploy Account Abstraction contract
deploy_account_abstraction() {
    echo -e "${BLUE}🚀 Deploying Account Abstraction contract...${NC}"
    
    AA_WASM="$WASM_DIR/account_abstraction.wasm"
    
    if [ ! -f "$AA_WASM" ]; then
        echo -e "${RED}Error: $AA_WASM not found. Run build first.${NC}"
        exit 1
    fi
    
    # Deploy
    AA_CONTRACT_ID=$(stellar contract deploy \
        --wasm "$AA_WASM" \
        --source "$KEY_NAME" \
        --network "$NETWORK")
    
    echo -e "${GREEN}✅ Account Abstraction deployed: $AA_CONTRACT_ID${NC}"
    
    # Initialize
    echo -e "${BLUE}Initializing Account Abstraction...${NC}"
    stellar contract invoke \
        --id "$AA_CONTRACT_ID" \
        --source "$KEY_NAME" \
        --network "$NETWORK" \
        -- \
        initialize \
        --owner "$DEPLOYER_ADDRESS" \
        --initial_gas_pool "$GAS_POOL_AMOUNT"
    
    echo -e "${GREEN}✅ Account Abstraction initialized with gas pool: $GAS_POOL_AMOUNT stroops${NC}"
    
    # Save to file
    echo "$AA_CONTRACT_ID" > "$PROJECT_ROOT/.aa-contract-id-$NETWORK"
    echo ""
    
    export AA_CONTRACT_ID
}

# Function to deploy Token Vault contract
deploy_token_vault() {
    echo -e "${BLUE}🚀 Deploying Token Vault contract...${NC}"
    
    VAULT_WASM="$WASM_DIR/token_vault.wasm"
    
    if [ ! -f "$VAULT_WASM" ]; then
        echo -e "${RED}Error: $VAULT_WASM not found. Run build first.${NC}"
        exit 1
    fi
    
    # Deploy
    VAULT_CONTRACT_ID=$(stellar contract deploy \
        --wasm "$VAULT_WASM" \
        --source "$KEY_NAME" \
        --network "$NETWORK")
    
    echo -e "${GREEN}✅ Token Vault deployed: $VAULT_CONTRACT_ID${NC}"
    
    # Initialize
    echo -e "${BLUE}Initializing Token Vault...${NC}"
    stellar contract invoke \
        --id "$VAULT_CONTRACT_ID" \
        --source "$KEY_NAME" \
        --network "$NETWORK" \
        -- \
        initialize \
        --owner "$DEPLOYER_ADDRESS"
    
    echo -e "${GREEN}✅ Token Vault initialized${NC}"
    
    # Save to file
    echo "$VAULT_CONTRACT_ID" > "$PROJECT_ROOT/.vault-contract-id-$NETWORK"
    echo ""
    
    # Setup AA mode if AA contract exists
    if [ -f "$PROJECT_ROOT/.aa-contract-id-$NETWORK" ]; then
        AA_CONTRACT_ID=$(cat "$PROJECT_ROOT/.aa-contract-id-$NETWORK")
        
        echo -e "${BLUE}Setting up Account Abstraction for Token Vault...${NC}"
        stellar contract invoke \
            --id "$AA_CONTRACT_ID" \
            --source "$KEY_NAME" \
            --network "$NETWORK" \
            -- \
            set_mode \
            --user "$DEPLOYER_ADDRESS" \
            --mode Sponsored
        
        echo -e "${GREEN}✅ AA mode set to Sponsored${NC}"
    fi
    
    export VAULT_CONTRACT_ID
}

# Function to print final configuration
print_config() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           Deployment Complete!                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Add the following to your .env.local:${NC}"
    echo ""
    echo "# Contract Addresses ($NETWORK)"
    
    if [ -f "$PROJECT_ROOT/.vault-contract-id-$NETWORK" ]; then
        echo "SOROBAN_CONTRACT_ADDRESS=$(cat "$PROJECT_ROOT/.vault-contract-id-$NETWORK")"
    fi
    
    if [ -f "$PROJECT_ROOT/.aa-contract-id-$NETWORK" ]; then
        echo "ACCOUNT_ABSTRACTION_ADDRESS=$(cat "$PROJECT_ROOT/.aa-contract-id-$NETWORK")"
    fi
    
    echo "USE_ACCOUNT_ABSTRACTION=true"
    echo ""
}

# Verify prerequisites
check_command "stellar"
check_command "cargo"

# Build contracts
build_contracts

# Setup deployer
setup_deployer

# Deploy based on type
case "$DEPLOY_TYPE" in
    aa)
        deploy_account_abstraction
        ;;
    vault)
        deploy_token_vault
        ;;
    all)
        deploy_account_abstraction
        deploy_token_vault
        ;;
    *)
        echo -e "${RED}Unknown deploy type: $DEPLOY_TYPE${NC}"
        echo "Usage: $0 [aa|vault|all] [testnet|mainnet]"
        exit 1
        ;;
esac

# Print configuration
print_config

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
