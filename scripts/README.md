# Stellend Scripts

Utility scripts for deploying, seeding, and managing the Stellend lending protocol.

## Quick Start

```bash
cd scripts
npm install

# Set your deployer secret key
export SECRET_KEY="SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Deploy everything in one command
npm run deploy-all

# Seed the pool with liquidity
npm run seed-pool

# Create a funded test user
npm run fund-user -- --new
```

## Prerequisites

1. **Build the contracts first:**
   ```bash
   cd contracts
   cargo build --target wasm32-unknown-unknown --release
   ```

2. **Install Node.js dependencies:**
   ```bash
   cd scripts
   npm install
   ```

3. **Set environment variables:**
   ```bash
   export SECRET_KEY="SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
   export NETWORK="futurenet"  # optional, default: futurenet
   ```

## Available Scripts

### 🚀 Deploy All (`deploy_all.ts`)

One-click deployment of all Stellend contracts:
- Deploys Price Oracle, Interest Rate Model, and Lending Pool contracts
- Sets up XLM and USDC tokens (Stellar Asset Contract)
- Initializes all contracts with proper parameters
- Sets initial prices on the oracle
- Saves all contract IDs to `deployment.json`

```bash
# Deploy all contracts
npm run deploy-all

# Deploy and seed pool with liquidity
npm run deploy-all:seed
```

### 🪙 Setup Tokens (`setup_tokens.ts`)

Creates and wraps tokens for use with Stellend:
- Wraps native XLM as a Soroban token (SAC)
- Creates custom USDC asset and wraps it
- Stores token contract IDs in `deployment.json`

```bash
npm run setup-tokens
```

### 🌊 Seed Pool (`seed_pool.ts`)

Seeds the lending pool with initial liquidity:
- Creates a "whale" account
- Mints 1,000,000 USDC to the whale
- Deposits 500,000 USDC into the pool via `supply()`
- Prints pool state summary

```bash
# Requires deployment.json from deploy-all
npm run seed-pool

# Or set contract ID manually
export POOL_CONTRACT_ID="CXXXXXX..."
npm run seed-pool
```

### 👤 Fund User (`fund_user.ts`)

Funds demo user accounts with XLM and USDC:
- XLM via Friendbot (10,000 XLM)
- USDC minted from issuer (10,000 USDC)

```bash
# Fund a specific user address
npm run fund-user -- GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Create a new random user and fund it
npm run fund-user -- --new

# Custom amounts
npm run fund-user -- --new --xlm 50000 --usdc 25000
```

### 📊 Update Oracle Price (`update_price.ts`)

Fetches prices from CoinGecko and updates the on-chain oracle:

```bash
# Normal mode - real price from CoinGecko
npm run update-price

# Chaos mode - simulate 50% price crash
npm run update-price:crash

# Mock mode - use hardcoded price ($0.30)
npm run update-price:mock

# Chaos + mock combined
npm run update-price:crash-mock
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Deployer/admin wallet secret key |
| `NETWORK` | No | `futurenet` (default) or `testnet` |
| `POOL_CONTRACT_ID` | No* | Lending pool contract ID |
| `ORACLE_CONTRACT_ID` | No* | Price oracle contract ID |

*Required if not using `deployment.json`

## Deployment Flow

```
1. npm run deploy-all
   └── Deploys: Oracle → Interest Rate Model → Pool
   └── Sets up: XLM token, USDC token
   └── Initializes all contracts
   └── Sets initial prices
   └── Saves to deployment.json

2. npm run seed-pool
   └── Creates whale account
   └── Mints 1M USDC to whale
   └── Supplies 500K USDC to pool

3. npm run fund-user -- --new
   └── Creates new user account
   └── Funds with 10K XLM + 10K USDC
   └── Prints address and secret key
```

## Output Files

### `deployment.json`

Contains all deployed contract IDs and token addresses:

```json
{
  "network": "futurenet",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "contracts": {
    "pool": "CXXXXXX...",
    "oracle": "CXXXXXX...",
    "interestRateModel": "CXXXXXX..."
  },
  "tokens": {
    "xlm": "CXXXXXX...",
    "usdc": "CXXXXXX...",
    "usdcIssuer": "GXXXXXX..."
  },
  "accounts": {
    "deployer": "GXXXXXX...",
    "whale": "GXXXXXX..."
  }
}
```

## Token Details

### XLM (Native)
- Wrapped using Stellar Asset Contract (SAC)
- Contract ID is deterministic based on network

### USDC (Mock)
- Custom asset issued by deployer account
- Wrapped using SAC
- Unlimited minting for testing
- 7 decimal places (Stellar standard)

## Troubleshooting

### "WASM files not found"
Build the contracts first:
```bash
cd contracts && cargo build --target wasm32-unknown-unknown --release
```

### "Account not funded"
Fund your account via Friendbot:
```bash
curl "https://friendbot-futurenet.stellar.org/?addr=$(soroban keys address deployer)"
```

### "USDC minting failed"
User needs USDC trustline. Add it with:
```bash
stellar trustline add --asset USDC:<ISSUER_ADDRESS>
```

### "Transaction failed"
- Check SECRET_KEY is correct
- Ensure account has enough XLM for fees
- Verify contract IDs in deployment.json

## Network Configuration

| Network | RPC URL | Friendbot |
|---------|---------|-----------|
| Futurenet | https://rpc-futurenet.stellar.org | https://friendbot-futurenet.stellar.org |
| Testnet | https://soroban-testnet.stellar.org | https://friendbot.stellar.org |
