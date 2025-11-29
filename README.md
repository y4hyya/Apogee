# Stellend - Lending Protocol on Stellar

A decentralized lending protocol built on the Stellar blockchain, enabling users to lend and borrow assets with transparent interest rates and collateral management.

## Overview

Stellend is a lending protocol that leverages Stellar's fast, low-cost transactions and Soroban smart contracts to provide a secure and efficient lending marketplace. Users can:

- **Lend assets** and earn interest
- **Borrow assets** by providing collateral
- **Manage positions** with real-time health ratios
- **Liquidate** undercollateralized positions

## Architecture

### Smart Contracts (Soroban)
- **Lending Pool**: Manages asset deposits and withdrawals
- **Collateral Manager**: Handles collateral deposits and liquidation logic
- **Interest Rate Model**: Calculates dynamic interest rates based on utilization
- **Oracle**: Price feeds for collateral valuation

### SDK
- JavaScript/TypeScript SDK for interacting with the protocol
- Helper functions for common operations
- Type definitions

### Frontend (Optional)
- Web interface for interacting with the protocol
- Dashboard for monitoring positions and market data

## Tech Stack

- **Smart Contracts**: Rust (Soroban)
- **SDK**: TypeScript/JavaScript
- **Frontend**: React/Next.js (optional)
- **Testing**: Stellar Testnet

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Stellar CLI](https://soroban.stellar.org/docs/getting-started/setup)
- [Node.js](https://nodejs.org/) (v18+)
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/y4hyya/Stellend.git
cd Stellend
```

2. Install dependencies:
```bash
# Install Rust dependencies (for smart contracts)
cd contracts
cargo build

# Install SDK dependencies
cd ../sdk
npm install

# Install frontend dependencies (if using frontend)
cd ../frontend
npm install
```

### Development

#### Smart Contracts

```bash
cd contracts
# Build contracts
cargo build --target wasm32-unknown-unknown --release

# Test contracts
cargo test

# Deploy to testnet
soroban deploy --wasm target/wasm32-unknown-unknown/release/lending_pool.wasm
```

#### SDK

```bash
cd sdk
npm run build
npm test
```

## Project Structure

```
Stellend/
├── contracts/          # Soroban smart contracts
│   ├── lending_pool/  # Main lending pool contract
│   ├── collateral/    # Collateral management
│   └── oracle/        # Price oracle
├── sdk/               # TypeScript SDK
├── frontend/          # Web interface (optional)
├── tests/             # Integration tests
└── docs/              # Documentation
```

## Features

- [ ] Asset deposit and withdrawal
- [ ] Collateral management
- [ ] Borrowing with collateral
- [ ] Interest rate calculation
- [ ] Liquidation mechanism
- [ ] Governance (future)

## Security

This protocol is currently under development. Do not use with mainnet assets until audited.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License

## Links

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar Testnet](https://developers.stellar.org/docs/encyclopedia/testnet)

