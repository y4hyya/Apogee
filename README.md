<p align="center">
  <img src="https://img.shields.io/badge/Stellar-Soroban-7C3AED?style=for-the-badge&logo=stellar&logoColor=white" alt="Stellar Soroban"/>
  <img src="https://img.shields.io/badge/Rust-Smart%20Contracts-orange?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"/>
  <img src="https://img.shields.io/badge/Next.js-Frontend-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/Network-Testnet-blue?style=for-the-badge" alt="Testnet"/>
</p>

# 🚀 Apogee — Decentralized Lending Protocol on Stellar

> **Apogee** is a peer-to-pool lending protocol built on Stellar using Soroban smart contracts. Supply assets to earn yield, deposit collateral, and borrow against it — all on-chain.

---

## ✨ Features

- 💰 **Supply USDC** to the lending pool and earn interest
- 🔒 **Deposit XLM** as collateral for borrowing
- 📊 **Borrow USDC** against your XLM collateral (up to 75% LTV)
- 🩺 **Monitor Health Factor** to avoid liquidation
- ⚡ **Real-time price feeds** via on-chain oracle
- 🔄 **Automatic liquidation** when positions become undercollateralized

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                         │
│               Dashboard • Supply • Borrow • Repay               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Soroban Smart Contracts                       │
├─────────────────┬──────────────────────┬────────────────────────┤
│   Lending Pool  │  Interest Rate Model │     Price Oracle       │
│                 │                      │                        │
│ • supply()      │ • get_borrow_rate()  │ • set_price()          │
│ • withdraw()    │ • get_supply_rate()  │ • get_price()          │
│ • borrow()      │                      │                        │
│ • repay()       │                      │                        │
│ • liquidate()   │                      │                        │
│ • deposit_      │                      │                        │
│   collateral()  │                      │                        │
└─────────────────┴──────────────────────┴────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Stellar Testnet (Soroban)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Rust + Soroban SDK |
| **Frontend** | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| **Wallet** | Freighter Wallet |
| **Scripts** | TypeScript (deployment, price keeper) |
| **Network** | Stellar Testnet |

---

## 📁 Project Structure

```
Apogee/
├── contracts/                    # Soroban smart contracts
│   ├── Cargo.toml               # Workspace configuration
│   ├── pool/                    # Main lending pool contract
│   │   └── src/lib.rs          # Deposits, borrows, collateral, liquidation
│   ├── interest_rate_model/     # Interest rate calculations
│   │   └── src/lib.rs          # Kinked rate model
│   └── price_oracle/            # On-chain price storage
│       └── src/lib.rs          # XLM/USD, USDC/USD prices
├── scripts/                     # TypeScript utility scripts
│   ├── deploy_all.ts           # One-click deployment
│   ├── update_price.ts         # Oracle price keeper
│   └── package.json
├── frontend/                    # Next.js web application
│   ├── app/                    # App router pages
│   ├── components/             # React components
│   ├── pages/                  # Page components
│   ├── services/               # Soroban API services
│   └── context/                # Wallet context
└── docs/                       # Documentation
```

---

## 🚀 Quick Start

### Prerequisites

1. **Rust** (latest stable):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   ```

2. **Stellar CLI**:
   ```bash
   cargo install --locked stellar-cli
   ```

3. **Node.js** (v18+):
   ```bash
   nvm install 18 && nvm use 18
   ```

4. **Freighter Wallet**: Install from [freighter.app](https://www.freighter.app/) and switch to Testnet

### Installation

```bash
# Clone the repository
git clone https://github.com/y4hyya/Apogee.git
cd Apogee

# Install frontend dependencies
cd frontend && npm install

# Build contracts
cd ../contracts && cargo build --target wasm32-unknown-unknown --release
```

---

## 📜 Smart Contracts

### Building

```bash
cd contracts

# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Optimize for deployment
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/stellend_pool.wasm
```

### Testing

```bash
cd contracts
cargo test
cargo test -- --nocapture  # With output
```

---

## 🌐 Deployment (Testnet)

### Quick Deployment

```bash
# 1. Generate and fund deployer account
stellar keys generate deployer --network testnet
curl "https://friendbot.stellar.org/?addr=$(stellar keys address deployer)"

# 2. Deploy all contracts
cd scripts && npm install
npm run deploy-all

# 3. Seed pool with liquidity
npm run seed-pool
```

All contract IDs are saved to `scripts/deployment.json`.

---

## 💻 Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📊 Protocol Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| **LTV Ratio** | 75% | Maximum borrow amount relative to collateral |
| **Liquidation Threshold** | 80% | Collateral ratio below which liquidation is allowed |
| **Liquidation Bonus** | 5% | Bonus for liquidators |
| **Close Factor** | 50% | Maximum debt repayable in single liquidation |
| **Base Rate** | 0% | Minimum interest rate |
| **Slope 1** | 4% | Rate increase up to optimal utilization |
| **Slope 2** | 75% | Rate increase above optimal utilization |
| **Optimal Utilization** | 80% | Target pool utilization |

---

## 🩺 Health Factor

The **Health Factor** is the key metric that determines the safety of a borrowing position. It measures how well-collateralized a loan is.

### Formula

$$
\text{Health Factor} = \frac{\text{Collateral Value (USD)} \times \text{Liquidation Threshold}}{\text{Total Debt (USD)}}
$$

**Example:**
- Collateral: 1,000 XLM at $0.25 = **$250**
- Debt: 150 USDC = **$150**
- Liquidation Threshold: **80%**

$$
\text{Health Factor} = \frac{250 \times 0.80}{150} = \frac{200}{150} = 1.33
$$

### Health Factor Zones

| Health Factor | Status | Color | Action |
|---------------|--------|-------|--------|
| **> 1.5** | ✅ Safe | 🟢 Green | Position is healthy |
| **1.0 - 1.5** | ⚠️ Risky | 🟡 Yellow | Consider adding collateral or repaying |
| **< 1.0** | 🚨 Liquidatable | 🔴 Red | Position can be liquidated |

### What Affects Health Factor?

| Factor | Effect on HF |
|--------|-------------|
| 📈 Collateral price rises | ⬆️ Increases |
| 📉 Collateral price drops | ⬇️ Decreases |
| ➕ Add more collateral | ⬆️ Increases |
| ➖ Withdraw collateral | ⬇️ Decreases |
| 💸 Borrow more | ⬇️ Decreases |
| 💰 Repay debt | ⬆️ Increases |

### Liquidation

When Health Factor drops **below 1.0**:

1. **Anyone** can call the `liquidate()` function
2. Liquidator repays up to **50%** of the borrower's debt
3. Liquidator receives equivalent collateral **+ 5% bonus**
4. Borrower's debt is reduced, collateral is seized

```
Example Liquidation:
- Borrower debt: 150 USDC
- Liquidator repays: 75 USDC (50% max)
- Collateral seized: $75 worth of XLM + 5% bonus = $78.75 in XLM
```

---

## 📈 Interest Rate Model

Apogee uses a **multi-segment kinked interest rate model** that aggressively incentivizes optimal pool utilization. The rate increases exponentially as utilization approaches 100%.

### Variables

| Symbol | Description |
|--------|-------------|
| $U$ | Current utilization rate (0 to 1) |
| $U^*$ | Optimal utilization (default: 80%) |
| $R_{\text{opt}}$ | Rate at optimal utilization |
| $R_{\text{max}}$ | Maximum rate |
| $R_{\text{min}}$ | Minimum rate floor |
| $\Delta R$ | Rate spread = $R_{\text{max}} - R_{\text{opt}}$ |

### Formula

The final rate is:

$$
R(U) = \max\{R_{\text{min}}, R_{\text{raw}}(U)\}
$$

Where $R_{\text{raw}}(U)$ is calculated based on utilization segments:

$$
R_{\text{raw}}(U) = \begin{cases}
R_{\text{opt}} \cdot \dfrac{U}{U^*} & U \leq U^* \\[12pt]
R_{\text{opt}} + \Delta R \cdot \dfrac{50}{1000} \cdot \dfrac{U - U^*}{0.85 - U^*} & U^* < U \leq 0.85 \\[12pt]
R_{\text{opt}} + \Delta R \cdot \dfrac{50 + 100 \cdot \frac{U - 0.85}{0.05}}{1000} & 0.85 < U \leq 0.90 \\[12pt]
R_{\text{opt}} + \Delta R \cdot \dfrac{50 + 100 + 150 \cdot \frac{U - 0.90}{0.05}}{1000} & 0.90 < U \leq 0.95 \\[12pt]
R_{\text{opt}} + \Delta R \cdot \dfrac{50 + 100 + 150 + 200 \cdot \frac{U - 0.95}{0.04}}{1000} & 0.95 < U \leq 0.99 \\[12pt]
R_{\text{opt}} + \Delta R \cdot \dfrac{50 + 100 + 150 + 200 + 250 \cdot \frac{U - 0.99}{0.005}}{1000} & 0.99 < U \leq 0.995 \\[12pt]
R_{\text{opt}} + \Delta R \cdot \dfrac{50 + 100 + 150 + 200 + 250 + 250 \cdot \frac{U - 0.995}{0.005}}{1000} & 0.995 < U \leq 1
\end{cases}
$$

### Rate Segments Explained

| Utilization | Segment | Behavior |
|-------------|---------|----------|
| **0% - 80%** | Linear | Rate scales linearly to $R_{\text{opt}}$ |
| **80% - 85%** | Kink 1 | Moderate rate increase begins |
| **85% - 90%** | Kink 2 | Steeper increase (+100 basis) |
| **90% - 95%** | Kink 3 | Aggressive increase (+150 basis) |
| **95% - 99%** | Kink 4 | Very steep (+200 basis) |
| **99% - 99.5%** | Kink 5 | Extreme rates (+250 basis) |
| **99.5% - 100%** | Kink 6 | Maximum pressure (+250 basis) |

### Why Multi-Segment?

This model creates **exponentially increasing pressure** as the pool approaches full utilization:

- 📉 **Borrowers** face rapidly rising costs → incentivized to repay
- 📈 **Lenders** see attractive yields → incentivized to deposit
- ⚖️ **Pool** naturally rebalances toward optimal 80% utilization

```
Example at 95% utilization:
- Base rate: 4% (at optimal)
- Additional: (50 + 100 + 150) / 1000 × ΔR = 30% of spread
- If ΔR = 75%, additional rate = 22.5%
- Total borrow rate: ~26.5% APR
```

---

## 🔧 Network Configuration

| Network | RPC URL | Passphrase |
|---------|---------|------------|
| **Testnet** | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015` |
| Futurenet | `https://rpc-futurenet.stellar.org` | `Test SDF Future Network ; October 2022` |

---

## 🎬 Demo: Liquidation Flow

1. **User A** deposits 1,000 XLM as collateral
2. **User A** borrows 150 USDC (Health Factor: 1.33)
3. **Price Crash**: XLM drops from $0.25 to $0.01
4. **Health Factor** drops to 0.05 (below 1.0!)
5. **Liquidator** repays 9 USDC, seizes 945 XLM (+5% bonus)
6. **User A** loses collateral, debt is reduced

---

## ⚠️ Security

> **This protocol is in development and unaudited.** Do not use with real assets.

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 🔗 Links

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Freighter Wallet](https://www.freighter.app/)

---

<p align="center">
  Built with ❤️ on <b>Stellar</b>
</p>
