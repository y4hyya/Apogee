"use client"

import { useEffect, useState, useCallback } from "react"
import type { Transaction } from "@/types/dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthFactorIndicator } from "@/components/health-factor-indicator"
import { PositionChart } from "@/components/position-chart"
import { TransactionHistory } from "@/components/transaction-history"
import { MarketsOverview } from "@/components/markets-overview"
import { apogeeContractAPI, sorobanService, type DashboardData, type MarketData } from "@/services/soroban-service"
import { CONTRACTS } from "@/config/contracts"
import { generateChartDataFromPosition, fetchUserTransactions } from "@/services/mock-data-generator"
import { useWallet } from "@/hooks/use-wallet"
import { useTransaction } from "@/hooks/use-transaction"
import { parseContractError } from "@/utils/errors"
import { TrendingUp, TrendingDown, DollarSign, Shield, RefreshCw, Wifi, WifiOff, Zap, Loader2, AlertCircle, FlameKindling, RotateCcw } from "lucide-react"
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
  const [crashing, setCrashing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [chartData, setChartData] = useState<Array<{ date: string; collateral: number; debt: number }>>([])

  // Use transaction hook for repay
  const repayTx = useTransaction({
    successMessage: "Successfully repaid debt!",
    onSuccess: async () => {
      await loadData()
    }
  })

  // Crash price handler - sets XLM to $0.01
  const handleCrashPrice = async () => {
    if (!signTx || !publicKey) {
      toast.error("Wallet not connected")
      return
    }

    setCrashing(true)
    try {
      const success = await sorobanService.crashPrice(publicKey, signTx)
      if (success) {
        toast.success("💥 Price crashed to $0.01!", {
          description: "XLM price has been crashed for demo"
        })
        await loadData()
      } else {
        toast.error("Failed to crash price", {
          description: "Only the deployer/admin wallet can change prices"
        })
      }
    } catch (error) {
      console.error("Crash price error:", error)
      toast.error("Failed to crash price", {
        description: error instanceof Error ? error.message : "Unknown error"
      })
    } finally {
      setCrashing(false)
    }
  }

  // Reset price handler - sets XLM back to $0.25
  const handleResetPrice = async () => {
    if (!signTx || !publicKey) {
      toast.error("Wallet not connected")
      return
    }

    setResetting(true)
    try {
      const success = await sorobanService.resetPrice(publicKey, signTx)
      if (success) {
        toast.success("✅ Price reset to $0.25!", {
          description: "XLM price has been restored"
        })
        await loadData()
      } else {
        toast.error("Failed to reset price", {
          description: "Only the deployer/admin wallet can change prices"
        })
      }
    } catch (error) {
      console.error("Reset price error:", error)
      toast.error("Failed to reset price", {
        description: error instanceof Error ? error.message : "Unknown error"
      })
    } finally {
      setResetting(false)
    }
  }

  const loadData = useCallback(async () => {
    // Wait for wallet to be connected
    if (!publicKey) {
      setLoading(false)
      return
    }

    try {
      setLoadError(null)
      const [data, marketData, price] = await Promise.all([
        apogeeContractAPI.getDashboardData(publicKey),
        apogeeContractAPI.getMarkets(),
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
      
      // Generate chart data based on current position
      const collateralValue = data.userCollateral_USD
      const debtValue = data.userDebt_sUSDC
      const generatedChartData = generateChartDataFromPosition(collateralValue, debtValue)
      setChartData(generatedChartData)
      
      // Fetch real transaction history
      const userTransactions = await fetchUserTransactions(publicKey, CONTRACTS.POOL)
      setTransactions(userTransactions)
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
      apogeeContractAPI.repay(publicKey, amount, signTx)
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground min-h-[60vh] flex-col">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>Loading on-chain data...</p>
        </div>
      </div>
    )
  }

  // Show connect wallet message if not connected
  if (!publicKey || !isConnected) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center gap-6 text-center min-h-[60vh]">
          <div className="rounded-full bg-primary/10 p-6">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
            <p className="text-muted-foreground max-w-md">
              Connect your Freighter wallet to view your dashboard and start using the protocol
            </p>
          </div>
          <Button 
            onClick={() => window.location.href = '/'}
            size="lg"
            className="gap-2"
          >
            <Shield className="w-4 h-4" />
            Go to Home
          </Button>
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

          {/* Demo Controls - Crash & Reset Price */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
            <span className="text-xs text-muted-foreground">Demo:</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCrashPrice}
              disabled={crashing || resetting}
              className="flex items-center gap-2"
            >
              {crashing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlameKindling className="w-4 h-4" />
              )}
              Crash
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPrice}
              disabled={crashing || resetting}
              className="flex items-center gap-2 border-green-500/50 text-green-500 hover:bg-green-500/10"
            >
              {resetting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reset
            </Button>
          </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        <div className="min-w-0">
          <PositionChart data={chartData} />
        </div>
        <div className="min-w-0">
          <MarketsOverview markets={marketsForOverview} />
        </div>
      </div>

      {/* Transaction History */}
      <TransactionHistory transactions={transactions} />
    </div>
  )
}
