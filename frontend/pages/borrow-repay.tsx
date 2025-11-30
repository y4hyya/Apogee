"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HealthFactorIndicator } from "@/components/health-factor-indicator"
import { apogeeContractAPI, sorobanService, type DashboardData } from "@/services/soroban-service"
import { useWallet } from "@/hooks/use-wallet"
import { useTransaction, getButtonText } from "@/hooks/use-transaction"
import { OPERATION_ERRORS } from "@/utils/errors"
import { TrendingDown, TrendingUp, AlertTriangle, DollarSign, Loader2, CheckCircle, AlertCircle, Calculator } from "lucide-react"
import { toast } from "sonner"

export default function BorrowRepayPage() {
  const { publicKey, isConnected, signTx } = useWallet()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [walletBalances, setWalletBalances] = useState<{ sXLM: number; sUSDC: number } | null>(null)
  const [xlmPrice, setXlmPrice] = useState<number>(0.35)
  const [loading, setLoading] = useState(true)
  const [borrowAmount, setBorrowAmount] = useState("")
  const [repayAmount, setRepayAmount] = useState("")

  const loadData = useCallback(async () => {
    try {
      const [dashboard, balances, price] = await Promise.all([
        apogeeContractAPI.getDashboardData(publicKey || ""),
        apogeeContractAPI.getWalletBalances(publicKey || ""),
        sorobanService.getPrice("XLM"),
      ])
      setDashboardData(dashboard)
      setWalletBalances(balances)
      setXlmPrice(price)
    } catch (error) {
      console.error("Failed to load data:", error)
      toast.error("Failed to load data", {
        description: "Could not fetch on-chain data. Please refresh."
      })
    } finally {
      setLoading(false)
    }
  }, [publicKey])

  // Transaction hooks
  const borrowTx = useTransaction({
    successMessage: "Successfully borrowed USDC!",
    onSuccess: async () => {
      setBorrowAmount("")
      await loadData()
    }
  })

  const repayTx = useTransaction({
    successMessage: "Successfully repaid debt!",
    onSuccess: async () => {
      setRepayAmount("")
      await loadData()
    }
  })

  useEffect(() => {
    if (isConnected) {
      loadData()
    }
  }, [isConnected, loadData])

  // Validate borrow amount
  const validateBorrow = (amount: number): string | null => {
    if (!amount || amount <= 0) return "Please enter a valid amount"
    if (!dashboardData) return "Loading..."
    
    const availableToBorrow = dashboardData.borrowLimit - dashboardData.userDebt_sUSDC
    if (amount > availableToBorrow) {
      return OPERATION_ERRORS.borrow.ltvExceeded
    }
    
    // Check pool liquidity
    const poolLiquidity = dashboardData.poolTotalSupply_sUSDC - dashboardData.poolTotalBorrowed_sUSDC
    if (amount > poolLiquidity) {
      return OPERATION_ERRORS.borrow.insufficientLiquidity
    }
    
    // Check if user has collateral
    if (dashboardData.userCollateral_USD <= 0) {
      return OPERATION_ERRORS.borrow.insufficientCollateral
    }
    
    return null
  }

  // Validate repay amount
  const validateRepay = (amount: number): string | null => {
    if (!amount || amount <= 0) return "Please enter a valid amount"
    if (!dashboardData) return "Loading..."
    
    if (dashboardData.userDebt_sUSDC <= 0) {
      return OPERATION_ERRORS.repay.noDebt
    }
    
    if (walletBalances && amount > walletBalances.sUSDC) {
      return OPERATION_ERRORS.repay.insufficientBalance
    }
    
    return null
  }

  // Calculate new health factor after borrow
  const calculateNewHealthFactor = (borrowAmount: number): number => {
    if (!dashboardData || dashboardData.userCollateral_USD <= 0) return 0
    const newDebt = dashboardData.userDebt_sUSDC + borrowAmount
    if (newDebt <= 0) return 999
    return (dashboardData.userCollateral_USD * 0.8) / newDebt // 80% liquidation threshold
  }

  const handleBorrow = async () => {
    const amount = parseFloat(borrowAmount)
    const error = validateBorrow(amount)
    if (error) {
      toast.error("Cannot Borrow", { description: error })
      return
    }

    // Warn if health factor would be low
    const newHF = calculateNewHealthFactor(amount)
    if (newHF < 1.5) {
      toast.warning("Warning: Low Health Factor", {
        description: `Borrowing this amount would set your Health Factor to ${newHF.toFixed(2)}. This is risky!`,
        duration: 5000,
      })
    }

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    await borrowTx.execute(() =>
      apogeeContractAPI.borrow(publicKey, amount, signTx)
    )
  }

  const handleRepay = async () => {
    const amount = parseFloat(repayAmount)
    const error = validateRepay(amount)
    if (error) {
      toast.error("Cannot Repay", { description: error })
      return
    }

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    await repayTx.execute(() =>
      apogeeContractAPI.repay(publicKey, amount, signTx)
    )
  }

  const isProcessing = borrowTx.isLoading || repayTx.isLoading

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
  const poolLiquidity = dashboardData.poolTotalSupply_sUSDC - dashboardData.poolTotalBorrowed_sUSDC
  const maxBorrow = Math.min(availableToBorrow, poolLiquidity)
  const hasNoCollateral = dashboardData.userCollateral_USD <= 0
  const isAtRisk = dashboardData.healthFactor < 1.5 && dashboardData.userDebt_sUSDC > 0

  // Calculate projected HF for the borrow preview
  const borrowPreviewAmount = parseFloat(borrowAmount) || 0
  const projectedHF = borrowPreviewAmount > 0 ? calculateNewHealthFactor(borrowPreviewAmount) : null

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-background via-background/95 to-primary/3 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">Borrow & Repay</h1>
        <p className="text-muted-foreground">Borrow assets using your collateral or repay existing debt</p>
      </div>

      {/* No Collateral Warning */}
      {hasNoCollateral && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-500">No Collateral Deposited</p>
            <p className="text-sm text-muted-foreground">
              You need to deposit XLM as collateral before you can borrow. 
              Go to the Collateral page to deposit.
            </p>
          </div>
        </div>
      )}

      {/* Health Factor */}
      <HealthFactorIndicator
        healthFactor={dashboardData.healthFactor}
        collateralValue={dashboardData.userCollateral_USD}
        borrowedValue={dashboardData.userDebt_sUSDC}
        xlmPrice={xlmPrice}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Borrow */}
        <Card className={`glass-panel border-white/10 ${hasNoCollateral ? "opacity-60" : ""}`}>
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
                disabled={isProcessing || hasNoCollateral}
                className={borrowTx.state === "error" ? "border-red-500" : ""}
              />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available to borrow:</span>
                  <span className={maxBorrow <= 0 ? "text-red-500" : ""}>
                    ${maxBorrow.toLocaleString()} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Borrow APY:</span>
                  <span className="text-purple-500">{(dashboardData.borrowAPR * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Projected Health Factor Preview */}
            {projectedHF !== null && projectedHF < 999 && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                projectedHF < 1.0 ? "bg-red-500/20 border border-red-500/30" :
                projectedHF < 1.5 ? "bg-yellow-500/20 border border-yellow-500/30" :
                "bg-green-500/20 border border-green-500/30"
              }`}>
                <Calculator className="w-4 h-4" />
                <span className="text-sm">
                  Projected Health Factor: <strong>{projectedHF.toFixed(2)}</strong>
                  {projectedHF < 1.0 && " ⚠️ Position would be liquidatable!"}
                  {projectedHF >= 1.0 && projectedHF < 1.5 && " ⚠️ Risky"}
                </span>
              </div>
            )}

            <Button 
              onClick={handleBorrow} 
              disabled={isProcessing || !isConnected || maxBorrow <= 0 || hasNoCollateral || !borrowAmount} 
              className="w-full"
            >
              {borrowTx.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {getButtonText(borrowTx.state, "Borrow USDC")}
                </>
              ) : borrowTx.state === "success" ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Borrowed!
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
                    Borrow Limit: ${dashboardData.borrowLimit.toLocaleString()} (75% LTV)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repay */}
        <Card className={`glass-panel border-white/10 ${isAtRisk ? "ring-1 ring-orange-500/50" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Repay Debt
              {isAtRisk && <span className="text-xs bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded">Recommended</span>}
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
                className={repayTx.state === "error" ? "border-red-500" : ""}
              />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current debt:</span>
                  <span>{dashboardData.userDebt_sUSDC.toLocaleString()} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet balance:</span>
                  <span>{walletBalances.sUSDC.toLocaleString()} USDC</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const maxRepay = Math.min(dashboardData.userDebt_sUSDC, walletBalances.sUSDC)
                  setRepayAmount(maxRepay.toString())
                }}
                variant="outline"
                className="flex-1"
                disabled={isProcessing || dashboardData.userDebt_sUSDC <= 0}
              >
                Max
              </Button>
              <Button 
                onClick={handleRepay} 
                disabled={isProcessing || !isConnected || dashboardData.userDebt_sUSDC <= 0 || !repayAmount} 
                className={`flex-1 ${isAtRisk ? "bg-green-600 hover:bg-green-700" : ""}`}
              >
                {repayTx.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {getButtonText(repayTx.state, "Repay", { signingText: "Signing..." })}
                  </>
                ) : repayTx.state === "success" ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Repaid!
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
                    {isAtRisk && " Your position is at risk - consider repaying now!"}
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
