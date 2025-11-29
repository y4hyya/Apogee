"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthFactorIndicator } from "@/components/health-factor-indicator"
import { PositionChart } from "@/components/position-chart"
import { TransactionHistory } from "@/components/transaction-history"
import { MarketsOverview } from "@/components/markets-overview"
import { stellendContractAPI, sorobanService, type DashboardData, type MarketData } from "@/services/soroban-service"
import { generateMockTransactions, generateMockChartData } from "@/services/mock-data-generator"
import { useWallet } from "@/hooks/use-wallet"
import { useTransaction } from "@/hooks/use-transaction"
import { parseContractError } from "@/utils/errors"
import { TrendingUp, TrendingDown, DollarSign, Shield, RefreshCw, Wifi, WifiOff, Zap, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function DashboardPage() {
  const { publicKey, isConnected, network, signTx } = useWallet()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [markets, setMarkets] = useState<MarketData[]>([])
  const [xlmPrice, setXlmPrice] = useState<number>(0.35)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [priceChange, setPriceChange] = useState<"up" | "down" | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Use transaction hook for repay
  const repayTx = useTransaction({
    successMessage: "Successfully repaid debt!",
    onSuccess: async () => {
      await loadData()
    }
  })

  const loadData = useCallback(async () => {
    try {
      setLoadError(null)
      const [data, marketData, price] = await Promise.all([
        stellendContractAPI.getDashboardData(publicKey || ""),
        stellendContractAPI.getMarkets(),
        sorobanService.getPrice("XLM"),
      ])
      
      // Track price changes for visual feedback
      if (xlmPrice > 0 && price !== xlmPrice) {
        setPriceChange(price > xlmPrice ? "up" : "down")
        setTimeout(() => setPriceChange(null), 2000)
      }
      
      setDashboardData(data)
      setMarkets(marketData)
      setXlmPrice(price)
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
      const errorMessage = parseContractError(error)
      setLoadError(errorMessage)
      toast.error("Failed to load data", {
        description: errorMessage
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [publicKey, xlmPrice])

  useEffect(() => {
    loadData()
    
    // Auto-refresh every 10 seconds for demo (faster price updates)
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
  }

  // Quick repay handler for crash demo
  const handleRepay = async (amount: number) => {
    if (!publicKey || !signTx) {
      toast.error("Wallet not connected")
      return
    }

    await repayTx.execute(() =>
      stellendContractAPI.repay(publicKey, amount, signTx)
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading on-chain data...
        </div>
      </div>
    )
  }

  if (loadError && !dashboardData) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p>Failed to load dashboard data</p>
          <p className="text-sm">{loadError}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">No data available</div>
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

  // Check if health factor is critical
  const isCritical = dashboardData.healthFactor < 1.2 && dashboardData.userDebt_sUSDC > 0

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-background via-background/95 to-primary/3 min-h-screen">
      {/* Header with network status */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your lending positions and market activity</p>
        </div>
        <div className="flex items-center gap-3">
          {/* XLM Price Badge with change indicator */}
          <Badge 
            variant="outline" 
            className={`flex items-center gap-2 transition-colors duration-300 ${
              priceChange === "down" ? "bg-red-500/20 border-red-500/50 text-red-400" :
              priceChange === "up" ? "bg-green-500/20 border-green-500/50 text-green-400" : ""
            }`}
          >
            <span className="font-mono">XLM: ${xlmPrice.toFixed(4)}</span>
            {priceChange === "down" && <TrendingDown className="w-3 h-3 text-red-500 animate-bounce" />}
            {priceChange === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
          </Badge>
          
          {/* Network Badge */}
          <Badge variant="outline" className="flex items-center gap-2">
            {network === "TESTNET" ? (
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
          Last updated: {lastUpdated.toLocaleTimeString()} (auto-refresh every 10s)
        </p>
      )}

      {/* Critical Health Factor Alert Banner */}
      {isCritical && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-4">
          <Zap className="w-8 h-8 text-red-500 animate-pulse" />
          <div className="flex-1">
            <h3 className="font-bold text-red-500">Position at Risk!</h3>
            <p className="text-sm text-red-400">
              Your health factor is {dashboardData.healthFactor.toFixed(2)}. 
              {dashboardData.healthFactor < 1.0 
                ? " You can be liquidated NOW!" 
                : " Consider repaying debt or adding collateral."}
            </p>
          </div>
          <Button 
            variant="destructive"
            onClick={() => {
              const repayElement = document.querySelector('[data-quick-repay]')
              repayElement?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Quick Repay
          </Button>
        </div>
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
            <p className="text-xs text-muted-foreground">
              {dashboardData.userCollateral_sXLM.toLocaleString()} XLM @ ${xlmPrice.toFixed(4)}
            </p>
          </CardContent>
        </Card>

        <Card className={`glass-panel border-white/10 ${isCritical ? "ring-1 ring-red-500/50" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Borrowed</CardTitle>
            <TrendingDown className={`h-4 w-4 ${isCritical ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isCritical ? "text-red-500" : ""}`}>
              ${dashboardData.userDebt_sUSDC.toLocaleString()}
            </div>
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

      {/* Health Factor with repay capability */}
      <div data-quick-repay>
        <HealthFactorIndicator
          healthFactor={dashboardData.healthFactor}
          collateralValue={dashboardData.userCollateral_USD}
          borrowedValue={dashboardData.userDebt_sUSDC}
          xlmPrice={xlmPrice}
          onRepay={isConnected ? handleRepay : undefined}
          isRepaying={repayTx.isLoading}
        />
      </div>

      {/* Demo Instructions Card */}
      {dashboardData.userDebt_sUSDC > 0 && (
        <Card className="glass-panel border-white/10 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              Crash Demo Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>To simulate a price crash and see liquidation risk:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Run <code className="bg-muted px-1 rounded">npm run update-price:crash</code> in the scripts folder</li>
              <li>Watch the XLM price drop by 50% (shown in header)</li>
              <li>See your Health Factor turn red as collateral value drops</li>
              <li>Use "Quick Repay" to recover your position</li>
              <li>Run <code className="bg-muted px-1 rounded">npm run update-price</code> to restore normal prices</li>
            </ol>
          </CardContent>
        </Card>
      )}

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
