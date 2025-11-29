# Stellend Architecture

## Overview

Stellend is a decentralized lending protocol built on Stellar using Soroban smart contracts. The protocol enables users to lend assets and earn interest, or borrow assets by providing collateral.

## Core Components

### 1. Lending Pool Contract

The main contract that manages:
- Asset deposits and withdrawals
- Borrowing and repayment
- Interest rate calculations
- Pool state management

**Key Functions:**
- `deposit()`: Users deposit assets to earn interest
- `withdraw()`: Users withdraw their deposits
- `borrow()`: Users borrow assets (requires collateral)
- `repay()`: Users repay borrowed assets
- `utilization_rate()`: Calculates current pool utilization

### 2. Collateral Manager Contract

Manages collateral deposits and liquidation logic:
- Collateral deposits and withdrawals
- Health ratio calculations
- Liquidation mechanism

**Key Functions:**
- `deposit_collateral()`: Deposit collateral for borrowing
- `withdraw_collateral()`: Withdraw collateral (with health check)
- `get_health_ratio()`: Calculate position health
- `liquidate()`: Liquidate undercollateralized positions

### 3. Price Oracle Contract

Provides price feeds for assets:
- Asset price storage
- Price updates (authorized addresses only)
- Price queries

**Key Functions:**
- `set_price()`: Update asset price
- `get_price()`: Query asset price
- `get_price_scaled()`: Get price with decimals

## Interest Rate Model

The protocol uses a dynamic interest rate model based on utilization:

```
if utilization < optimal_utilization:
    rate = base_rate + (utilization / optimal_utilization) * slope1
else:
    rate = base_rate + slope1 + ((utilization - optimal_utilization) / (1 - optimal_utilization)) * slope2
```

## Health Ratio

Health ratio determines if a position can be liquidated:

```
health_ratio = (collateral_value * collateral_factor) / borrowed_value
```

If health_ratio < 1.0, the position can be liquidated.

## Security Considerations

1. **Overflow Protection**: All arithmetic operations use checked math
2. **Access Control**: Critical functions restricted to authorized addresses
3. **Reentrancy Protection**: Use of Soroban's built-in protections
4. **Price Oracle Security**: Multiple price sources and staleness checks
5. **Liquidation Incentives**: Liquidators receive bonus for liquidating positions

## Future Enhancements

- Governance token and DAO
- Multi-asset pools
- Flash loans
- Cross-chain integration
- Advanced interest rate models

