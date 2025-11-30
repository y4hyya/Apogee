import type { Position, Transaction, MarketAsset } from "@/types/dashboard"

// Note: These are placeholder functions for UI demonstration.
// In production, transaction history and chart data should come from on-chain events.

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
  // This is replaced by real data from stellendContractAPI.getMarkets()
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

export function generateMockChartData() {
  // Generate placeholder chart data for position history
  // In production, this should come from indexed on-chain events
  const data = []
  const now = new Date()

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    data.push({
      date: date.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      collateral: 0,
      debt: 0,
    })
  }

  return data
}
