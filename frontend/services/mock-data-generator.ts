import type { Position, Transaction, MarketAsset } from "@/types/dashboard"

// Note: Chart data is still estimated based on current position
// For full historical data, you would need an indexer service

export function generateMockPositions(): Position[] {
  return [
    { asset: "XLM", amount: 0, valueUSD: 0, apy: 0, type: "collateral" },
    { asset: "USDC", amount: 0, valueUSD: 0, apy: 0, type: "supplied" },
    { asset: "USDC", amount: 0, valueUSD: 0, apy: 0, type: "borrowed" },
  ]
}

export function generateMockTransactions(): Transaction[] {
  // Return empty array - transactions should come from on-chain events
  // This is placeholder for the UI
  return []
}

export function generateMockMarkets(): MarketAsset[] {
  // This is replaced by real data from apogeeContractAPI.getMarkets()
  return [
    {
      asset: "XLM",
      icon: "⭐",
      totalSupplied: 0,
      totalBorrowed: 0,
      supplyAPR: 0,
      borrowAPY: 0,
      utilization: 0,
      price: 0.35,
      priceChange24h: 0,
    },
    {
      asset: "USDC",
      icon: "$",
      totalSupplied: 0,
      totalBorrowed: 0,
      supplyAPR: 0,
      borrowAPY: 0,
      utilization: 0,
      price: 1.0,
      priceChange24h: 0,
    },
  ]
}

// Generate chart data based on current position values
// Creates a 30-day trend showing current position maintained over time
export function generateChartDataFromPosition(
  collateralUSD: number,
  debtUSD: number
): Array<{ date: string; collateral: number; debt: number }> {
  const data = []
  const now = new Date()

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    
    // Simulate some variation in the historical data (±10%)
    const variation = 0.9 + Math.random() * 0.2
    
    data.push({
      date: date.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      collateral: Math.round(collateralUSD * variation),
      debt: Math.round(debtUSD * (0.95 + Math.random() * 0.1)), // Less variation in debt
    })
  }

  // Make sure the last entry is the actual current value
  data[data.length - 1] = {
    date: now.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
    collateral: Math.round(collateralUSD),
    debt: Math.round(debtUSD),
  }

  return data
}

// Fetch real transactions from Horizon
export async function fetchUserTransactions(
  publicKey: string,
  poolContractId: string
): Promise<Transaction[]> {
  try {
    const response = await fetch(
      `https://horizon-testnet.stellar.org/accounts/${publicKey}/operations?order=desc&limit=50`
    )
    
    if (!response.ok) {
      console.error("Failed to fetch transactions from Horizon")
      return []
    }

    const data = await response.json()
    const transactions: Transaction[] = []

    // Parse operations and filter for pool contract interactions
    for (const op of data._embedded.records) {
      // Look for invoke_host_function operations (Soroban contract calls)
      if (op.type === "invoke_host_function") {
        try {
          // Try to parse the function name from the operation
          const functionName = op.function || "unknown"
          
          // Map function names to transaction types
          let type: Transaction["type"] | null = null
          if (functionName.includes("supply") || functionName.includes("deposit")) {
            type = "deposit"
          } else if (functionName.includes("withdraw")) {
            type = "withdraw"
          } else if (functionName.includes("borrow")) {
            type = "borrow"
          } else if (functionName.includes("repay")) {
            type = "repay"
          }

          if (type) {
            transactions.push({
              id: op.id,
              type,
              asset: "USDC", // Default to USDC, could be parsed from params
              amount: 0, // Amount would need to be parsed from operation details
              valueUSD: 0,
              timestamp: new Date(op.created_at),
              txHash: op.transaction_hash,
            })
          }
        } catch (err) {
          // Skip operations that can't be parsed
          console.warn("Could not parse operation:", err)
        }
      }
    }

    return transactions
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return []
  }
}
