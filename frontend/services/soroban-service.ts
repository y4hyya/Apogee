// Soroban Contract Service for Stellend
// Replaces mock-contract-api.ts with real on-chain calls

import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
  Keypair,
} from "@stellar/stellar-sdk"
import { CONTRACTS, NETWORK_CONFIG, ASSETS, SCALE } from "@/config/contracts"

// Initialize Soroban RPC client
const sorobanServer = new SorobanRpc.Server(NETWORK_CONFIG.sorobanRpcUrl)

// Helper to convert contract i128 to JS number (with decimals)
function fromContractAmount(amount: bigint, decimals: number = 7): number {
  return Number(amount) / Math.pow(10, decimals)
}

// Helper to convert JS number to contract i128
function toContractAmount(amount: number, decimals: number = 7): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)))
}

// Helper to convert scaled values (1e7 scale)
function fromScaled(value: bigint): number {
  return Number(value) / 10_000_000
}

export interface DashboardData {
  userCollateral_sXLM: number
  userCollateral_USD: number
  userDebt_sUSDC: number
  userSupply_sUSDC: number
  borrowLimit: number
  healthFactor: number
  poolTotalSupply_sUSDC: number
  poolTotalBorrowed_sUSDC: number
  poolUtilization: number
  borrowAPR: number
  supplyAPR: number
}

export interface WalletBalances {
  sXLM: number
  sUSDC: number
}

export interface MarketData {
  asset: string
  icon: string
  totalSupplied: number
  totalBorrowed: number
  supplyAPR: number
  borrowAPY: number
  utilization: number
  price: number
  priceChange24h: number
}

class SorobanContractService {
  private poolContract: Contract | null = null
  private oracleContract: Contract | null = null

  constructor() {
    if (CONTRACTS.POOL) {
      this.poolContract = new Contract(CONTRACTS.POOL)
    }
    if (CONTRACTS.PRICE_ORACLE) {
      this.oracleContract = new Contract(CONTRACTS.PRICE_ORACLE)
    }
  }

  // Check if contracts are configured
  isConfigured(): boolean {
    return !!(CONTRACTS.POOL && CONTRACTS.PRICE_ORACLE)
  }

  // Get price from oracle
  async getPrice(asset: "XLM" | "USDC"): Promise<number> {
    if (!this.oracleContract) {
      // Return mock prices if oracle not configured
      return asset === "XLM" ? 0.35 : 1.0
    }

    try {
      const result = await sorobanServer.simulateTransaction(
        await this.buildReadTransaction(
          this.oracleContract.call("get_price", nativeToScVal(asset, { type: "symbol" }))
        )
      )

      if (SorobanRpc.Api.isSimulationSuccess(result)) {
        const returnValue = result.result?.retval
        if (returnValue) {
          const price = scValToNative(returnValue) as bigint
          return fromScaled(price)
        }
      }
      return asset === "XLM" ? 0.35 : 1.0
    } catch (error) {
      console.error("Error fetching price:", error)
      return asset === "XLM" ? 0.35 : 1.0
    }
  }

  // Get user position from pool contract
  async getUserPosition(userAddress: string): Promise<{
    collateral: { xlm: number }
    debt: { usdc: number }
    supply: { usdc: number }
    healthFactor: number
  }> {
    if (!this.poolContract || !userAddress) {
      return {
        collateral: { xlm: 0 },
        debt: { usdc: 0 },
        supply: { usdc: 0 },
        healthFactor: 999,
      }
    }

    try {
      const userAddr = new Address(userAddress)

      // Get user collateral (XLM)
      const collateralResult = await this.callContract("get_user_collateral", [
        userAddr.toScVal(),
        nativeToScVal("XLM", { type: "symbol" }),
      ])
      const xlmCollateral = collateralResult ? fromContractAmount(collateralResult as bigint) : 0

      // Get user debt (USDC)
      const debtResult = await this.callContract("get_user_debt", [
        userAddr.toScVal(),
        nativeToScVal("USDC", { type: "symbol" }),
      ])
      const usdcDebt = debtResult ? fromContractAmount(debtResult as bigint) : 0

      // Get user shares/supply (USDC)
      const sharesResult = await this.callContract("get_user_shares", [
        userAddr.toScVal(),
        nativeToScVal("USDC", { type: "symbol" }),
      ])
      const usdcShares = sharesResult ? fromContractAmount(sharesResult as bigint) : 0

      // Get health factor
      const hfResult = await this.callContract("get_health_factor", [userAddr.toScVal()])
      const healthFactor = hfResult ? fromScaled(hfResult as bigint) : 999

      return {
        collateral: { xlm: xlmCollateral },
        debt: { usdc: usdcDebt },
        supply: { usdc: usdcShares },
        healthFactor,
      }
    } catch (error) {
      console.error("Error fetching user position:", error)
      return {
        collateral: { xlm: 0 },
        debt: { usdc: 0 },
        supply: { usdc: 0 },
        healthFactor: 999,
      }
    }
  }

  // Get market info from pool
  async getMarketInfo(asset: "XLM" | "USDC"): Promise<{
    totalSupply: number
    totalBorrow: number
    utilizationRate: number
    borrowRate: number
    supplyRate: number
  }> {
    if (!this.poolContract) {
      return {
        totalSupply: 0,
        totalBorrow: 0,
        utilizationRate: 0,
        borrowRate: 0.05,
        supplyRate: 0.02,
      }
    }

    try {
      const assetSymbol = nativeToScVal(asset, { type: "symbol" })

      // Get total supply
      const supplyResult = await this.callContract("get_total_supply", [assetSymbol])
      const totalSupply = supplyResult ? fromContractAmount(supplyResult as bigint) : 0

      // Get total borrow
      const borrowResult = await this.callContract("get_total_borrow", [assetSymbol])
      const totalBorrow = borrowResult ? fromContractAmount(borrowResult as bigint) : 0

      // Get utilization rate
      const utilResult = await this.callContract("get_utilization_rate", [assetSymbol])
      const utilizationRate = utilResult ? fromScaled(utilResult as bigint) : 0

      // Get borrow rate
      const borrowRateResult = await this.callContract("get_borrow_rate", [assetSymbol])
      const borrowRate = borrowRateResult ? fromScaled(borrowRateResult as bigint) : 0.05

      // Get supply rate
      const supplyRateResult = await this.callContract("get_supply_rate", [assetSymbol])
      const supplyRate = supplyRateResult ? fromScaled(supplyRateResult as bigint) : 0.02

      return {
        totalSupply,
        totalBorrow,
        utilizationRate,
        borrowRate,
        supplyRate,
      }
    } catch (error) {
      console.error("Error fetching market info:", error)
      return {
        totalSupply: 0,
        totalBorrow: 0,
        utilizationRate: 0,
        borrowRate: 0.05,
        supplyRate: 0.02,
      }
    }
  }

  // Helper to call contract and parse result
  private async callContract(method: string, args: xdr.ScVal[]): Promise<unknown> {
    if (!this.poolContract) return null

    try {
      const tx = await this.buildReadTransaction(
        this.poolContract.call(method, ...args)
      )
      const result = await sorobanServer.simulateTransaction(tx)

      if (SorobanRpc.Api.isSimulationSuccess(result)) {
        const returnValue = result.result?.retval
        if (returnValue) {
          return scValToNative(returnValue)
        }
      }
      return null
    } catch (error) {
      console.error(`Error calling ${method}:`, error)
      return null
    }
  }

  // Build a read-only transaction for simulation
  private async buildReadTransaction(operation: xdr.Operation): Promise<any> {
    // Use a dummy source account for read-only operations
    const dummyKeypair = Keypair.random()
    const dummyAccount = await sorobanServer.getAccount(dummyKeypair.publicKey()).catch(() => {
      // If account doesn't exist, create a mock one
      return {
        accountId: () => dummyKeypair.publicKey(),
        sequenceNumber: () => "0",
        incrementSequenceNumber: () => {},
      }
    })

    return new TransactionBuilder(dummyAccount as any, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_CONFIG.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build()
  }

  // Build a write transaction that needs to be signed
  async buildTransaction(
    sourceAddress: string,
    operation: xdr.Operation
  ): Promise<string> {
    const account = await sorobanServer.getAccount(sourceAddress)

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_CONFIG.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build()

    // Simulate to get the proper footprint
    const simResult = await sorobanServer.simulateTransaction(transaction)

    if (!SorobanRpc.Api.isSimulationSuccess(simResult)) {
      throw new Error("Transaction simulation failed")
    }

    // Prepare the transaction
    const preparedTx = SorobanRpc.assembleTransaction(transaction, simResult)
    return preparedTx.build().toXDR()
  }

  // Submit a signed transaction
  async submitTransaction(signedXdr: string): Promise<string> {
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_CONFIG.networkPassphrase)
    const result = await sorobanServer.sendTransaction(tx)

    if (result.status === "ERROR") {
      throw new Error("Transaction submission failed")
    }

    // Wait for transaction to complete
    let getResult = await sorobanServer.getTransaction(result.hash)
    while (getResult.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      getResult = await sorobanServer.getTransaction(result.hash)
    }

    if (getResult.status === "SUCCESS") {
      return result.hash
    }

    throw new Error(`Transaction failed with status: ${getResult.status}`)
  }

  // === Write Operations ===

  // Supply/Deposit to pool
  async buildSupplyTx(userAddress: string, asset: "XLM" | "USDC", amount: number): Promise<string> {
    if (!this.poolContract) throw new Error("Pool contract not configured")

    const operation = this.poolContract.call(
      "supply",
      new Address(userAddress).toScVal(),
      nativeToScVal(asset, { type: "symbol" }),
      nativeToScVal(toContractAmount(amount), { type: "i128" })
    )

    return this.buildTransaction(userAddress, operation)
  }

  // Withdraw from pool
  async buildWithdrawTx(userAddress: string, asset: "XLM" | "USDC", amount: number): Promise<string> {
    if (!this.poolContract) throw new Error("Pool contract not configured")

    const operation = this.poolContract.call(
      "withdraw",
      new Address(userAddress).toScVal(),
      nativeToScVal(asset, { type: "symbol" }),
      nativeToScVal(toContractAmount(amount), { type: "i128" })
    )

    return this.buildTransaction(userAddress, operation)
  }

  // Deposit collateral
  async buildDepositCollateralTx(userAddress: string, asset: "XLM" | "USDC", amount: number): Promise<string> {
    if (!this.poolContract) throw new Error("Pool contract not configured")

    const operation = this.poolContract.call(
      "deposit_collateral",
      new Address(userAddress).toScVal(),
      nativeToScVal(asset, { type: "symbol" }),
      nativeToScVal(toContractAmount(amount), { type: "i128" })
    )

    return this.buildTransaction(userAddress, operation)
  }

  // Withdraw collateral
  async buildWithdrawCollateralTx(userAddress: string, asset: "XLM" | "USDC", amount: number): Promise<string> {
    if (!this.poolContract) throw new Error("Pool contract not configured")

    const operation = this.poolContract.call(
      "withdraw_collateral",
      new Address(userAddress).toScVal(),
      nativeToScVal(asset, { type: "symbol" }),
      nativeToScVal(toContractAmount(amount), { type: "i128" })
    )

    return this.buildTransaction(userAddress, operation)
  }

  // Borrow
  async buildBorrowTx(userAddress: string, asset: "XLM" | "USDC", amount: number): Promise<string> {
    if (!this.poolContract) throw new Error("Pool contract not configured")

    const operation = this.poolContract.call(
      "borrow",
      new Address(userAddress).toScVal(),
      nativeToScVal(asset, { type: "symbol" }),
      nativeToScVal(toContractAmount(amount), { type: "i128" })
    )

    return this.buildTransaction(userAddress, operation)
  }

  // Repay
  async buildRepayTx(userAddress: string, asset: "XLM" | "USDC", amount: number): Promise<string> {
    if (!this.poolContract) throw new Error("Pool contract not configured")

    const operation = this.poolContract.call(
      "repay",
      new Address(userAddress).toScVal(),
      nativeToScVal(asset, { type: "symbol" }),
      nativeToScVal(toContractAmount(amount), { type: "i128" })
    )

    return this.buildTransaction(userAddress, operation)
  }
}

// Export singleton instance
export const sorobanService = new SorobanContractService()

// === API compatible with mock-contract-api ===
// This allows gradual migration from mock to real

export const stellendContractAPI = {
  getWalletBalances: async (userAddress: string): Promise<WalletBalances> => {
    // In a real implementation, query token contracts for balances
    // For now, return mock data if contracts not configured
    if (!sorobanService.isConfigured()) {
      return { sXLM: 10000, sUSDC: 2000 }
    }

    // TODO: Query actual token balances via SAC contracts
    return { sXLM: 10000, sUSDC: 2000 }
  },

  getDashboardData: async (userAddress: string): Promise<DashboardData> => {
    if (!sorobanService.isConfigured() || !userAddress) {
      // Return mock data if not configured
      return {
        userCollateral_sXLM: 2000,
        userCollateral_USD: 700,
        userDebt_sUSDC: 300,
        userSupply_sUSDC: 5000,
        borrowLimit: 525,
        healthFactor: 1.87,
        poolTotalSupply_sUSDC: 1500000,
        poolTotalBorrowed_sUSDC: 800000,
        poolUtilization: 0.533,
        borrowAPR: 0.08,
        supplyAPR: 0.04,
      }
    }

    try {
      // Get real data from contracts
      const [userPosition, xlmPrice, usdcMarket] = await Promise.all([
        sorobanService.getUserPosition(userAddress),
        sorobanService.getPrice("XLM"),
        sorobanService.getMarketInfo("USDC"),
      ])

      const collateralValueUSD = userPosition.collateral.xlm * xlmPrice
      const borrowLimit = collateralValueUSD * 0.75 // 75% LTV

      return {
        userCollateral_sXLM: userPosition.collateral.xlm,
        userCollateral_USD: collateralValueUSD,
        userDebt_sUSDC: userPosition.debt.usdc,
        userSupply_sUSDC: userPosition.supply.usdc,
        borrowLimit,
        healthFactor: userPosition.healthFactor,
        poolTotalSupply_sUSDC: usdcMarket.totalSupply,
        poolTotalBorrowed_sUSDC: usdcMarket.totalBorrow,
        poolUtilization: usdcMarket.utilizationRate,
        borrowAPR: usdcMarket.borrowRate,
        supplyAPR: usdcMarket.supplyRate,
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      // Return mock data on error
      return {
        userCollateral_sXLM: 0,
        userCollateral_USD: 0,
        userDebt_sUSDC: 0,
        userSupply_sUSDC: 0,
        borrowLimit: 0,
        healthFactor: 999,
        poolTotalSupply_sUSDC: 0,
        poolTotalBorrowed_sUSDC: 0,
        poolUtilization: 0,
        borrowAPR: 0.05,
        supplyAPR: 0.02,
      }
    }
  },

  getMarkets: async (): Promise<MarketData[]> => {
    const [xlmPrice, usdcPrice, xlmMarket, usdcMarket] = await Promise.all([
      sorobanService.getPrice("XLM"),
      sorobanService.getPrice("USDC"),
      sorobanService.getMarketInfo("XLM"),
      sorobanService.getMarketInfo("USDC"),
    ])

    return [
      {
        asset: "XLM",
        icon: "⭐",
        totalSupplied: xlmMarket.totalSupply * xlmPrice,
        totalBorrowed: xlmMarket.totalBorrow * xlmPrice,
        supplyAPR: xlmMarket.supplyRate * 100,
        borrowAPY: xlmMarket.borrowRate * 100,
        utilization: xlmMarket.utilizationRate * 100,
        price: xlmPrice,
        priceChange24h: 2.5, // TODO: Get from oracle or external API
      },
      {
        asset: "USDC",
        icon: "$",
        totalSupplied: usdcMarket.totalSupply,
        totalBorrowed: usdcMarket.totalBorrow,
        supplyAPR: usdcMarket.supplyRate * 100,
        borrowAPY: usdcMarket.borrowRate * 100,
        utilization: usdcMarket.utilizationRate * 100,
        price: usdcPrice,
        priceChange24h: 0.01,
      },
    ]
  },

  // Write operations that build + sign + submit
  depositCollateral: async (
    userAddress: string,
    amount: number,
    signTx: (xdr: string) => Promise<string>
  ): Promise<boolean> => {
    const txXdr = await sorobanService.buildDepositCollateralTx(userAddress, "XLM", amount)
    const signedXdr = await signTx(txXdr)
    await sorobanService.submitTransaction(signedXdr)
    return true
  },

  withdrawCollateral: async (
    userAddress: string,
    amount: number,
    signTx: (xdr: string) => Promise<string>
  ): Promise<boolean> => {
    const txXdr = await sorobanService.buildWithdrawCollateralTx(userAddress, "XLM", amount)
    const signedXdr = await signTx(txXdr)
    await sorobanService.submitTransaction(signedXdr)
    return true
  },

  borrow: async (
    userAddress: string,
    amount: number,
    signTx: (xdr: string) => Promise<string>
  ): Promise<boolean> => {
    const txXdr = await sorobanService.buildBorrowTx(userAddress, "USDC", amount)
    const signedXdr = await signTx(txXdr)
    await sorobanService.submitTransaction(signedXdr)
    return true
  },

  repay: async (
    userAddress: string,
    amount: number,
    signTx: (xdr: string) => Promise<string>
  ): Promise<boolean> => {
    const txXdr = await sorobanService.buildRepayTx(userAddress, "USDC", amount)
    const signedXdr = await signTx(txXdr)
    await sorobanService.submitTransaction(signedXdr)
    return true
  },

  supplyLiquidity: async (
    userAddress: string,
    amount: number,
    signTx: (xdr: string) => Promise<string>
  ): Promise<boolean> => {
    const txXdr = await sorobanService.buildSupplyTx(userAddress, "USDC", amount)
    const signedXdr = await signTx(txXdr)
    await sorobanService.submitTransaction(signedXdr)
    return true
  },

  withdrawLiquidity: async (
    userAddress: string,
    amount: number,
    signTx: (xdr: string) => Promise<string>
  ): Promise<boolean> => {
    const txXdr = await sorobanService.buildWithdrawTx(userAddress, "USDC", amount)
    const signedXdr = await signTx(txXdr)
    await sorobanService.submitTransaction(signedXdr)
    return true
  },
}

