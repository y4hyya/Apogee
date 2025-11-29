# Stellend Scripts

Utility scripts for managing and interacting with the Stellend protocol.

## Setup

```bash
cd scripts
npm install
```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Oracle contract ID (deployed to Futurenet)
ORACLE_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Admin secret key (for signing transactions)
SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Available Scripts

### Update Oracle Price

Fetches the current XLM/USD price from CoinGecko and updates the on-chain oracle.

```bash
# Normal mode - fetch real price from CoinGecko
npm run update-price

# Chaos mode - simulate 50% price crash (for demo/testing liquidations)
npm run update-price:crash
```

### Seed Pool (Coming Soon)

Seed the lending pool with initial liquidity.

```bash
npm run seed-pool
```

### Initialize Protocol (Coming Soon)

Deploy and initialize all contracts.

```bash
npm run init-protocol
```

## Script Details

### `update_price.ts`

The price oracle keeper script:
- Fetches XLM/USD price from CoinGecko API
- Submits transaction to update on-chain oracle
- Supports "chaos mode" for demo purposes (50% price drop)

**Usage:**
```bash
# Set environment variables
export ORACLE_CONTRACT_ID="your_contract_id"
export SECRET_KEY="your_secret_key"

# Run the script
npm run update-price

# Or with chaos mode
npm run update-price:crash
```

## Adding New Scripts

1. Create a new TypeScript file in the `scripts/` directory
2. Add the script command to `package.json`
3. Document the script in this README
