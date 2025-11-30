"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apogeeContractAPI, type DashboardData } from "@/services/soroban-service"
import { useWallet } from "@/hooks/use-wallet"
import { useTransaction, getButtonText } from "@/hooks/use-transaction"
import { OPERATION_ERRORS } from "@/utils/errors"
import { TrendingUp, TrendingDown, DollarSign, Info, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export default function LendWithdrawPage() {
  const { publicKey, isConnected, signTx } = useWallet()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [walletBalances, setWalletBalances] = useState<{ sXLM: number; sUSDC: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [supplyAmount, setSupplyAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")

  const loadData = useCallback(async () => {
    try {
      const [dashboard, balances] = await Promise.all([
        apogeeContractAPI.getDashboardData(publicKey || ""),
        apogeeContractAPI.getWalletBalances(publicKey || ""),
      ])
      setDashboardData(dashboard)
      setWalletBalances(balances)
    } catch (error) {
      console.error("Failed to load data:", error)
      toast.error("Failed to load data", {
        description: "Could not fetch on-chain data. Please refresh."
      })
    } finally {
      setLoading(false)
    }
  }, [publicKey])

  // Transaction hooks with proper success callbacks
  const supplyTx = useTransaction({
    successMessage: "Successfully supplied USDC!",
    onSuccess: async () => {
      setSupplyAmount("")
      await loadData()
    }
  })

  const withdrawTx = useTransaction({
    successMessage: "Successfully withdrew USDC!",
    onSuccess: async () => {
      setWithdrawAmount("")
      await loadData()
    }
  })

  useEffect(() => {
    if (isConnected) {
      loadData()
    }
  }, [isConnected, loadData])

  // Validate supply amount
  const validateSupply = (amount: number): string | null => {
    if (!amount || amount <= 0) return "Please enter a valid amount"
    if (amount < 1) return OPERATION_ERRORS.supply.minAmount
    if (walletBalances && amount > walletBalances.sUSDC) {
      return OPERATION_ERRORS.supply.insufficientBalance
    }
    return null
  }

  // Validate withdraw amount
  const validateWithdraw = (amount: number): string | null => {
    if (!amount || amount <= 0) return "Please enter a valid amount"
    if (dashboardData && amount > dashboardData.userSupply_sUSDC) {
      return OPERATION_ERRORS.withdraw.insufficientSupply
    }
    // Check pool liquidity
    if (dashboardData) {
      const availableLiquidity = dashboardData.poolTotalSupply_sUSDC - dashboardData.poolTotalBorrowed_sUSDC
      if (amount > availableLiquidity) {
        return OPERATION_ERRORS.withdraw.insufficientLiquidity
      }
    }
    return null
  }

  const handleSupply = async () => {
    const amount = parseFloat(supplyAmount)
    const error = validateSupply(amount)
    if (error) {
      toast.error("Invalid Amount", { description: error })
      return
    }

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    await supplyTx.execute(() => 
      apogeeContractAPI.supplyLiquidity(publicKey, amount, signTx)
    )
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    const error = validateWithdraw(amount)
    if (error) {
      toast.error("Invalid Amount", { description: error })
      return
    }

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    await withdrawTx.execute(() =>
      apogeeContractAPI.withdrawLiquidity(publicKey, amount, signTx)
    )
  }

  const isProcessing = supplyTx.isLoading || withdrawTx.isLoading

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

  // Calculate available liquidity for warnings
  const availableLiquidity = dashboardData.poolTotalSupply_sUSDC - dashboardData.poolTotalBorrowed_sUSDC
  const showLiquidityWarning = dashboardData.poolUtilization > 0.9

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-background via-background/95 to-primary/3 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">Lend & Withdraw</h1>
        <p className="text-muted-foreground">Supply assets to the lending pool and earn interest</p>
      </div>

      {/* High Utilization Warning */}
      {showLiquidityWarning && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-500">High Pool Utilization</p>
            <p className="text-sm text-muted-foreground">
              Pool is {(dashboardData.poolUtilization * 100).toFixed(0)}% utilized. 
              Only ${availableLiquidity.toLocaleString()} USDC available for withdrawal.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supply Liquidity */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Supply Liquidity
            </CardTitle>
            <CardDescription>Deposit USDC to the lending pool and earn interest</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supply-amount">Amount (USDC)</Label>
              <Input
                id="supply-amount"
                type="number"
                placeholder="0.00"
                value={supplyAmount}
                onChange={(e) => setSupplyAmount(e.target.value)}
                disabled={isProcessing}
                className={supplyTx.state === "error" ? "border-red-500" : ""}
              />
              <div className="flex justify-between text-sm">
                <p className="text-muted-foreground">
                  Balance: {walletBalances.sUSDC.toLocaleString()} USDC
                </p>
                <button 
                  className="text-primary hover:underline"
                  onClick={() => setSupplyAmount(walletBalances.sUSDC.toString())}
                  disabled={isProcessing}
                >
                  Max
                </button>
              </div>
              <p className="text-green-500 font-semibold text-sm">
                Supply APR: {(dashboardData.supplyAPR * 100).toFixed(2)}%
              </p>
            </div>
            
            <Button 
              onClick={handleSupply} 
              disabled={isProcessing || !isConnected || !supplyAmount} 
              className="w-full"
            >
              {supplyTx.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {getButtonText(supplyTx.state, "Supply USDC")}
                </>
              ) : supplyTx.state === "success" ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Success!
                </>
              ) : (
                "Supply USDC"
              )}
            </Button>

            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-2">
                <DollarSign className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Your Supply</p>
                  <p className="text-muted-foreground">
                    {dashboardData.userSupply_sUSDC.toLocaleString()} USDC
                  </p>
                  <p className="text-green-500 mt-1">
                    Earning {(dashboardData.supplyAPR * 100).toFixed(2)}% APR
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdraw Liquidity */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-500" />
              Withdraw Liquidity
            </CardTitle>
            <CardDescription>Withdraw your supplied USDC from the lending pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-liquidity-amount">Amount (USDC)</Label>
              <Input
                id="withdraw-liquidity-amount"
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={isProcessing}
                className={withdrawTx.state === "error" ? "border-red-500" : ""}
              />
              <div className="flex justify-between text-sm">
                <p className="text-muted-foreground">
                  Your supply: {dashboardData.userSupply_sUSDC.toLocaleString()} USDC
                </p>
                <p className="text-muted-foreground">
                  Available: ${Math.min(dashboardData.userSupply_sUSDC, availableLiquidity).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const maxWithdraw = Math.min(dashboardData.userSupply_sUSDC, availableLiquidity)
                  setWithdrawAmount(maxWithdraw.toString())
                }}
                variant="outline"
                className="flex-1"
                disabled={isProcessing}
              >
                Max
              </Button>
              <Button 
                onClick={handleWithdraw} 
                disabled={isProcessing || !isConnected || dashboardData.userSupply_sUSDC <= 0 || !withdrawAmount} 
                variant="outline" 
                className="flex-1"
              >
                {withdrawTx.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {getButtonText(withdrawTx.state, "Withdraw", { signingText: "Signing..." })}
                  </>
                ) : withdrawTx.state === "success" ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Done!
                  </>
                ) : (
                  "Withdraw"
                )}
              </Button>
            </div>

            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-orange-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Note</p>
                  <p className="text-muted-foreground">
                    Withdrawing will stop earning interest on the withdrawn amount.
                    {showLiquidityWarning && " Withdrawals may be limited due to high utilization."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pool Stats */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle>Pool Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Pool Supply</p>
              <p className="text-2xl font-bold">${dashboardData.poolTotalSupply_sUSDC.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Pool Borrowed</p>
              <p className="text-2xl font-bold">${dashboardData.poolTotalBorrowed_sUSDC.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available Liquidity</p>
              <p className="text-2xl font-bold">${availableLiquidity.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pool Utilization</p>
              <p className={`text-2xl font-bold ${showLiquidityWarning ? "text-yellow-500" : ""}`}>
                {(dashboardData.poolUtilization * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle>About Lending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Supply assets to the lending pool to earn interest (APR).</p>
          <p>• Interest rates are variable and adjust based on pool utilization.</p>
          <p>• You can withdraw your supplied assets at any time (subject to available liquidity).</p>
          <p>• Higher pool utilization typically leads to higher supply APR.</p>
          <p>• Your supplied assets help provide liquidity for borrowers.</p>
        </CardContent>
      </Card>
    </div>
  )
}
