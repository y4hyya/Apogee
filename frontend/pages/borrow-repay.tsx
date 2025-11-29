"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HealthFactorIndicator } from "@/components/health-factor-indicator"
import { stellendContractAPI, sorobanService, type DashboardData } from "@/services/soroban-service"
import { useWallet } from "@/hooks/use-wallet"
import { TrendingDown, TrendingUp, AlertTriangle, DollarSign, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function BorrowRepayPage() {
  const { publicKey, isConnected, signTx } = useWallet()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [walletBalances, setWalletBalances] = useState<{ sXLM: number; sUSDC: number } | null>(null)
  const [xlmPrice, setXlmPrice] = useState<number>(0.35)
  const [loading, setLoading] = useState(true)
  const [borrowAmount, setBorrowAmount] = useState("")
  const [repayAmount, setRepayAmount] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [dashboard, balances, price] = await Promise.all([
        stellendContractAPI.getDashboardData(publicKey || ""),
        stellendContractAPI.getWalletBalances(publicKey || ""),
        sorobanService.getPrice("XLM"),
      ])
      setDashboardData(dashboard)
      setWalletBalances(balances)
      setXlmPrice(price)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }, [publicKey])

  useEffect(() => {
    if (isConnected) {
      loadData()
    }
  }, [isConnected, loadData])

  const handleBorrow = async () => {
    const amount = parseFloat(borrowAmount)
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    setIsProcessing(true)
    try {
      await stellendContractAPI.borrow(publicKey, amount, signTx)
      toast.success(`Successfully borrowed ${amount} USDC`)
      setBorrowAmount("")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to borrow")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRepay = async () => {
    const amount = parseFloat(repayAmount)
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    setIsProcessing(true)
    try {
      await stellendContractAPI.repay(publicKey, amount, signTx)
      toast.success(`Successfully repaid ${amount} USDC`)
      setRepayAmount("")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to repay")
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading || !dashboardData || !walletBalances) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading on-chain data...
        </div>
      </div>
    )
  }

  const availableToBorrow = Math.max(0, dashboardData.borrowLimit - dashboardData.userDebt_sUSDC)

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-background via-background/95 to-primary/3 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">Borrow & Repay</h1>
        <p className="text-muted-foreground">Borrow assets using your collateral or repay existing debt</p>
      </div>

      {/* Health Factor */}
      <HealthFactorIndicator
        healthFactor={dashboardData.healthFactor}
        collateralValue={dashboardData.userCollateral_USD}
        borrowedValue={dashboardData.userDebt_sUSDC}
        xlmPrice={xlmPrice}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Borrow */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-purple-500" />
              Borrow USDC
            </CardTitle>
            <CardDescription>Borrow USDC against your XLM collateral</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="borrow-amount">Amount (USDC)</Label>
              <Input
                id="borrow-amount"
                type="number"
                placeholder="0.00"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                disabled={isProcessing}
              />
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Available to borrow: ${availableToBorrow.toLocaleString()} USDC
                </p>
                <p className="text-muted-foreground">
                  Borrow APY: {(dashboardData.borrowAPR * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            <Button 
              onClick={handleBorrow} 
              disabled={isProcessing || !isConnected || availableToBorrow <= 0} 
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing Transaction...
                </>
              ) : (
                "Borrow USDC"
              )}
            </Button>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-start gap-2">
                <DollarSign className="w-5 h-5 text-purple-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Current Debt</p>
                  <p className="text-muted-foreground">
                    {dashboardData.userDebt_sUSDC.toLocaleString()} USDC
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Borrow Limit: ${dashboardData.borrowLimit.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repay */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Repay Debt
            </CardTitle>
            <CardDescription>Repay your borrowed USDC to reduce debt and improve health factor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repay-amount">Amount (USDC)</Label>
              <Input
                id="repay-amount"
                type="number"
                placeholder="0.00"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                disabled={isProcessing}
              />
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Current debt: {dashboardData.userDebt_sUSDC.toLocaleString()} USDC
                </p>
                <p className="text-muted-foreground">
                  Wallet balance: {walletBalances.sUSDC.toLocaleString()} USDC
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setRepayAmount(dashboardData.userDebt_sUSDC.toString())}
                variant="outline"
                className="flex-1"
                disabled={isProcessing}
              >
                Max
              </Button>
              <Button 
                onClick={handleRepay} 
                disabled={isProcessing || !isConnected || dashboardData.userDebt_sUSDC <= 0} 
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing...
                  </>
                ) : (
                  "Repay"
                )}
              </Button>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Tip</p>
                  <p className="text-muted-foreground">
                    Repaying debt will improve your health factor and reduce interest payments.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle>About Borrowing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• You can borrow up to 75% (LTV) of your collateral value.</p>
          <p>• Borrowing reduces your health factor. Keep it above 1.5 for safety.</p>
          <p>• You'll pay variable interest (APY) on borrowed amounts based on pool utilization.</p>
          <p>• Repaying debt improves your health factor and reduces interest costs.</p>
          <p>• If health factor drops below 1.0, your position may be liquidated.</p>
        </CardContent>
      </Card>
    </div>
  )
}
