"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthFactorIndicator } from "@/components/health-factor-indicator"
import { PositionChart } from "@/components/position-chart"
import { TransactionHistory } from "@/components/transaction-history"
import { MarketsOverview } from "@/components/markets-overview"
import { stellendContractAPI, type DashboardData, type MarketData } from "@/services/soroban-service"
import { generateMockTransactions, generateMockChartData } from "@/services/mock-data-generator"
import { useWallet } from "@/hooks/use-wallet"
import { TrendingUp, TrendingDown, DollarSign, Shield, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function DashboardPage() {
  const { publicKey, isConnected, network } = useWallet()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [markets, setMarkets] = useState<MarketData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [data, marketData] = await Promise.all([
        stellendContractAPI.getDashboardData(publicKey || ""),
        stellendContractAPI.getMarkets(),
      ])
      setDashboardData(data)
      setMarkets(marketData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [publicKey])

  useEffect(() => {
    loadData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
  }

  if (loading || !dashboardData) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Loading on-chain data...</div>
      </div>
    )
  }

  const transactions = generateMockTransactions()
  const chartData = generateMockChartData()

  // Convert markets to the format expected by MarketsOverview
  const marketsForOverview = markets.map(m => ({
    asset: m.asset,
    icon: m.icon,
    totalSupplied: m.totalSupplied,
    totalBorrowed: m.totalBorrowed,
    supplyAPR: m.supplyAPR,
    borrowAPY: m.borrowAPY,
    utilization: m.utilization,
    price: m.price,
    priceChange24h: m.priceChange24h,
  }))

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-background via-background/95 to-primary/3 min-h-screen">
      {/* Header with network status */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your lending positions and market activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            {network === "FUTURENET" ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-yellow-500" />
            )}
            {network || "Not connected"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-panel border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collateral</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardData.userCollateral_USD.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{dashboardData.userCollateral_sXLM.toLocaleString()} XLM</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Borrowed</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardData.userDebt_sUSDC.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">USDC</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Borrow Limit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardData.borrowLimit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.borrowLimit > 0
                ? `${((dashboardData.userDebt_sUSDC / dashboardData.borrowLimit) * 100).toFixed(1)}% used`
                : "0% used"}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Supplied</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardData.userSupply_sUSDC.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Earning {(dashboardData.supplyAPR * 100).toFixed(2)}% APR
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Health Factor */}
      <HealthFactorIndicator
        healthFactor={dashboardData.healthFactor}
        collateralValue={dashboardData.userCollateral_USD}
        borrowedValue={dashboardData.userDebt_sUSDC}
      />

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PositionChart data={chartData} />
        <MarketsOverview markets={marketsForOverview} />
      </div>

      {/* Transaction History */}
      <TransactionHistory transactions={transactions} />
    </div>
  )
}
