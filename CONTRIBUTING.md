# Contributing to Stellend

Thank you for your interest in contributing to Stellend! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/Stellend.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes thoroughly
6. Submit a pull request

## Development Setup

### Prerequisites

- Rust (latest stable)
- Node.js (v18+)
- Soroban CLI
- Stellar CLI

### Setup

```bash
# Install Rust dependencies
cd contracts
cargo build

# Install SDK dependencies
cd ../sdk
npm install
```

## Code Style

### Rust (Smart Contracts)

- Follow Rust conventions
- Use `cargo fmt` to format code
- Use `cargo clippy` to check for issues
- Write tests for all new functionality

### TypeScript (SDK)

- Follow TypeScript best practices
- Use ESLint for linting
- Write JSDoc comments for public APIs
- Include type definitions

## Testing

### Smart Contracts

```bash
cd contracts/lending_pool
cargo test
```

### SDK

```bash
cd sdk
npm test
```

## Pull Request Process

1. Update the README.md if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update documentation
5. Create a clear PR description

## Security

If you discover a security vulnerability, please email the maintainers directly instead of opening a public issue.

## Questions?

Feel free to open an issue for questions or discussions.

