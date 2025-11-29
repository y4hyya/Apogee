"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { stellendContractAPI, type DashboardData } from "@/services/soroban-service"
import { useWallet } from "@/hooks/use-wallet"
import { TrendingUp, TrendingDown, DollarSign, Info, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function LendWithdrawPage() {
  const { publicKey, isConnected, signTx } = useWallet()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [walletBalances, setWalletBalances] = useState<{ sXLM: number; sUSDC: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [supplyAmount, setSupplyAmount] = useState("")
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

  const handleSupply = async () => {
    const amount = parseFloat(supplyAmount)
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
      await stellendContractAPI.supplyLiquidity(publicKey, amount, signTx)
      toast.success(`Successfully supplied ${amount} USDC to the pool`)
      setSupplyAmount("")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to supply liquidity")
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
      await stellendContractAPI.withdrawLiquidity(publicKey, amount, signTx)
      toast.success(`Successfully withdrew ${amount} USDC from the pool`)
      setWithdrawAmount("")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to withdraw liquidity")
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
        <h1 className="text-3xl font-bold mb-2">Lend & Withdraw</h1>
        <p className="text-muted-foreground">Supply assets to the lending pool and earn interest</p>
      </div>

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
              />
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Wallet Balance: {walletBalances.sUSDC.toLocaleString()} USDC
                </p>
                <p className="text-green-500 font-semibold">
                  Supply APR: {(dashboardData.supplyAPR * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            <Button onClick={handleSupply} disabled={isProcessing || !isConnected} className="w-full">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing Transaction...
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
              />
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Available to withdraw: {dashboardData.userSupply_sUSDC.toLocaleString()} USDC
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setWithdrawAmount(dashboardData.userSupply_sUSDC.toString())}
                variant="outline"
                className="flex-1"
                disabled={isProcessing}
              >
                Max
              </Button>
              <Button 
                onClick={handleWithdraw} 
                disabled={isProcessing || !isConnected || dashboardData.userSupply_sUSDC <= 0} 
                variant="outline" 
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing...
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Pool Supply</p>
              <p className="text-2xl font-bold">${dashboardData.poolTotalSupply_sUSDC.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Pool Borrowed</p>
              <p className="text-2xl font-bold">${dashboardData.poolTotalBorrowed_sUSDC.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pool Utilization</p>
              <p className="text-2xl font-bold">{(dashboardData.poolUtilization * 100).toFixed(1)}%</p>
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
