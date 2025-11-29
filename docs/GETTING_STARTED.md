# Getting Started with Stellend

This guide will help you get started developing on the Stellend lending protocol.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Rust**: Install from [rustup.rs](https://rustup.rs/)
- **Node.js**: v18 or higher from [nodejs.org](https://nodejs.org/)
- **Soroban CLI**: Install via `cargo install --locked soroban-cli`
- **Stellar CLI**: Follow instructions at [Stellar Docs](https://developers.stellar.org/docs/tools/stellar-cli)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/y4hyya/Stellend.git
cd Stellend
```

2. Build the smart contracts:
```bash
cd contracts/lending_pool
cargo build --target wasm32-unknown-unknown --release
```

3. Install SDK dependencies:
```bash
cd ../../sdk
npm install
npm run build
```

## Development Workflow

### Smart Contracts

1. Navigate to a contract directory:
```bash
cd contracts/lending_pool
```

2. Make your changes to `src/lib.rs`

3. Run tests:
```bash
cargo test
```

4. Build the contract:
```bash
cargo build --target wasm32-unknown-unknown --release
```

5. Deploy to testnet:
```bash
soroban deploy \
  --wasm target/wasm32-unknown-unknown/release/lending_pool.wasm \
  --network testnet
```

### SDK Development

1. Navigate to the SDK directory:
```bash
cd sdk
```

2. Make your changes

3. Build:
```bash
npm run build
```

4. Run tests:
```bash
npm test
```

## Testing on Stellar Testnet

1. Get testnet XLM from the [Friendbot](https://developers.stellar.org/docs/encyclopedia/testnet)

2. Deploy contracts:
```bash
soroban deploy --wasm <contract.wasm> --network testnet
```

3. Interact with contracts using the SDK or Soroban CLI

## Next Steps

- Read the [Architecture Documentation](./ARCHITECTURE.md)
- Check out the example implementations
- Join the community discussions

## Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar Discord](https://discord.gg/stellar)

