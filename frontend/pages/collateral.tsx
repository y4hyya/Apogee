"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HealthFactorIndicator } from "@/components/health-factor-indicator"
import { stellendContractAPI, type DashboardData } from "@/services/soroban-service"
import { useWallet } from "@/hooks/use-wallet"
import { Shield, ArrowDown, ArrowUp, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function CollateralPage() {
  const { publicKey, isConnected, signTx } = useWallet()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [walletBalances, setWalletBalances] = useState<{ sXLM: number; sUSDC: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [dashboard, balances] = await Promise.all([
        stellendContractAPI.getDashboardData(publicKey || ""),
        stellendContractAPI.getWalletBalances(publicKey || ""),
      ])
      setDashboardData(dashboard)
      setWalletBalances(balances)
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

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount)
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
      await stellendContractAPI.depositCollateral(publicKey, amount, signTx)
      toast.success(`Successfully deposited ${amount} XLM as collateral`)
      setDepositAmount("")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to deposit collateral")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
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
      await stellendContractAPI.withdrawCollateral(publicKey, amount, signTx)
      toast.success(`Successfully withdrew ${amount} XLM from collateral`)
      setWithdrawAmount("")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to withdraw collateral")
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

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-background via-background/95 to-primary/3 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">Collateral Management</h1>
        <p className="text-muted-foreground">Manage your collateral to secure your borrowing position</p>
      </div>

      {/* Health Factor */}
      <HealthFactorIndicator
        healthFactor={dashboardData.healthFactor}
        collateralValue={dashboardData.userCollateral_USD}
        borrowedValue={dashboardData.userDebt_sUSDC}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deposit Collateral */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDown className="w-5 h-5 text-green-500" />
              Deposit Collateral
            </CardTitle>
            <CardDescription>Add XLM to your collateral to increase your borrowing capacity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Amount (XLM)</Label>
              <Input
                id="deposit-amount"
                type="number"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={isProcessing}
              />
              <p className="text-sm text-muted-foreground">
                Wallet Balance: {walletBalances.sXLM.toLocaleString()} XLM
              </p>
            </div>
            <Button onClick={handleDeposit} disabled={isProcessing || !isConnected} className="w-full">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing Transaction...
                </>
              ) : (
                "Deposit Collateral"
              )}
            </Button>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Current Collateral</p>
                  <p className="text-muted-foreground">
                    {dashboardData.userCollateral_sXLM.toLocaleString()} XLM (${dashboardData.userCollateral_USD.toLocaleString()})
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdraw Collateral */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-orange-500" />
              Withdraw Collateral
            </CardTitle>
            <CardDescription>Remove XLM from your collateral (may affect health factor)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount (XLM)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={isProcessing}
              />
              <p className="text-sm text-muted-foreground">
                Available: {dashboardData.userCollateral_sXLM.toLocaleString()} XLM
              </p>
            </div>
            <Button onClick={handleWithdraw} disabled={isProcessing || !isConnected} variant="outline" className="w-full">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing Transaction...
                </>
              ) : (
                "Withdraw Collateral"
              )}
            </Button>
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Warning</p>
                  <p className="text-muted-foreground">
                    Withdrawing collateral will reduce your health factor. Make sure it stays above 1.5 for safety.
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
          <CardTitle>About Collateral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Collateral is used to secure your borrowing position. The more collateral you provide, the more you can borrow.
          </p>
          <p>• Your health factor must stay above 1.0 to avoid liquidation.</p>
          <p>• Withdrawing collateral reduces your borrowing capacity and may affect your health factor.</p>
          <p>• Collateral value is calculated based on current on-chain oracle prices.</p>
        </CardContent>
      </Card>
    </div>
  )
}
