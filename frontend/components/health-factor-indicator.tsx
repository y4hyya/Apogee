"use client"

import { useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertTriangle, CheckCircle, AlertCircle, TrendingDown, Loader2, Zap } from "lucide-react"

interface HealthFactorIndicatorProps {
  healthFactor: number
  collateralValue: number
  borrowedValue: number
  xlmPrice?: number
  onRepay?: (amount: number) => Promise<void>
  isRepaying?: boolean
}

export function HealthFactorIndicator({ 
  healthFactor, 
  collateralValue, 
  borrowedValue,
  xlmPrice,
  onRepay,
  isRepaying = false
}: HealthFactorIndicatorProps) {
  const [repayAmount, setRepayAmount] = useState("")
  const [showQuickRepay, setShowQuickRepay] = useState(false)

  const getHealthStatus = () => {
    if (healthFactor >= 2) return { 
      color: "text-green-500", 
      bg: "bg-green-500", 
      bgLight: "bg-green-500/20",
      border: "border-green-500/30",
      icon: CheckCircle, 
      label: "Safe",
      description: "Your position is healthy"
    }
    if (healthFactor >= 1.5) return { 
      color: "text-yellow-500", 
      bg: "bg-yellow-500", 
      bgLight: "bg-yellow-500/20",
      border: "border-yellow-500/30",
      icon: AlertCircle, 
      label: "Caution",
      description: "Monitor your position"
    }
    if (healthFactor >= 1.2) return { 
      color: "text-orange-500", 
      bg: "bg-orange-500", 
      bgLight: "bg-orange-500/20",
      border: "border-orange-500/30",
      icon: AlertTriangle, 
      label: "At Risk",
      description: "Consider repaying debt"
    }
    if (healthFactor >= 1.0) return { 
      color: "text-red-500", 
      bg: "bg-red-500", 
      bgLight: "bg-red-500/20",
      border: "border-red-500/30",
      icon: AlertTriangle, 
      label: "Danger",
      description: "Liquidation imminent!"
    }
    return { 
      color: "text-red-600", 
      bg: "bg-red-600", 
      bgLight: "bg-red-600/30",
      border: "border-red-600/50",
      icon: Zap, 
      label: "LIQUIDATABLE",
      description: "Position can be liquidated NOW"
    }
  }

  const status = getHealthStatus()
  const StatusIcon = status.icon

  // Progress value (100% at HF=2, 0% at HF=1)
  const progressValue = Math.min(100, Math.max(0, ((healthFactor - 1) / 1) * 100))
  
  // Calculate how much needs to be repaid to reach safe zone (HF >= 1.5)
  const suggestedRepay = borrowedValue > 0 && healthFactor < 1.5 
    ? Math.ceil((borrowedValue - (collateralValue * 0.8 / 1.5)) * 1.1) // 10% buffer
    : 0

  const handleQuickRepay = async () => {
    const amount = parseFloat(repayAmount)
    if (!amount || amount <= 0 || !onRepay) return
    await onRepay(amount)
    setRepayAmount("")
    setShowQuickRepay(false)
  }

  const isLiquidatable = healthFactor < 1.0
  const isDanger = healthFactor < 1.2

  return (
    <div className={`glass-panel p-6 space-y-4 transition-all duration-500 ${
      isLiquidatable ? "ring-2 ring-red-500 animate-pulse" : 
      isDanger ? "ring-1 ring-orange-500/50" : ""
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Health Factor</h3>
          {xlmPrice !== undefined && (
            <span className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
              XLM: ${xlmPrice.toFixed(4)}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-2 ${status.color}`}>
          <StatusIcon className={`w-5 h-5 ${isLiquidatable ? "animate-bounce" : ""}`} />
          <span className="font-semibold">{status.label}</span>
        </div>
      </div>

      {/* Health Factor Display */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold transition-colors duration-300 ${status.color}`}>
            {healthFactor > 100 ? "∞" : healthFactor.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">/ 2.00+ safe</span>
        </div>
        
        {/* Custom gradient progress bar */}
        <div className="relative h-4 rounded-full bg-muted/30 overflow-hidden">
          {/* Zone indicators */}
          <div className="absolute inset-0 flex">
            <div className="w-1/4 bg-red-500/20" title="Liquidation Zone" />
            <div className="w-1/4 bg-orange-500/20" title="Danger Zone" />
            <div className="w-1/4 bg-yellow-500/20" title="Caution Zone" />
            <div className="w-1/4 bg-green-500/20" title="Safe Zone" />
          </div>
          {/* Progress indicator */}
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-500 ${status.bg}`}
            style={{ width: `${progressValue}%` }}
          />
          {/* Marker lines */}
          <div className="absolute top-0 left-1/4 w-px h-full bg-white/20" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-white/20" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-white/20" />
        </div>
        
        {/* Zone labels */}
        <div className="flex text-xs text-muted-foreground">
          <div className="w-1/4 text-center text-red-400">≤1.0</div>
          <div className="w-1/4 text-center text-orange-400">1.2</div>
          <div className="w-1/4 text-center text-yellow-400">1.5</div>
          <div className="w-1/4 text-center text-green-400">2.0+</div>
        </div>
      </div>

      {/* Collateral & Debt Values */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-sm text-muted-foreground">Collateral Value</p>
          <p className="text-xl font-semibold">${collateralValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Debt Value</p>
          <p className="text-xl font-semibold">${borrowedValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Liquidation Warning */}
      <div className={`text-sm p-3 rounded-lg ${status.bgLight} ${status.border} border`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className={`w-4 h-4 mt-0.5 ${status.color} flex-shrink-0`} />
          <div>
            <p className={`font-medium ${status.color}`}>{status.description}</p>
            <p className="text-muted-foreground mt-1">
              If Health Factor falls below 1.0, your position can be liquidated. 
              Liquidators can repay up to 50% of your debt and claim your collateral + 5% bonus.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Repay Section (for crash demo) */}
      {isDanger && borrowedValue > 0 && onRepay && (
        <div className="space-y-3 pt-2">
          {!showQuickRepay ? (
            <Button 
              onClick={() => setShowQuickRepay(true)}
              variant="destructive"
              className="w-full"
            >
              <TrendingDown className="w-4 h-4 mr-2" />
              Quick Repay to Improve Health
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quick Repay USDC</span>
                {suggestedRepay > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setRepayAmount(suggestedRepay.toString())}
                    className="text-xs"
                  >
                    Suggest: ${suggestedRepay}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount to repay"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="flex-1"
                  disabled={isRepaying}
                />
                <Button 
                  onClick={handleQuickRepay}
                  disabled={isRepaying || !repayAmount}
                  variant="destructive"
                  className="min-w-[100px]"
                >
                  {isRepaying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Repaying...
                    </>
                  ) : (
                    "Repay"
                  )}
                </Button>
              </div>
              {isRepaying && (
                <p className="text-xs text-muted-foreground text-center">
                  Please confirm the transaction in your wallet...
                </p>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setShowQuickRepay(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Liquidation Alert Banner */}
      {isLiquidatable && (
        <div className="mt-4 p-4 rounded-lg bg-red-600/20 border-2 border-red-500 animate-pulse">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-bold text-red-500">⚠️ LIQUIDATION RISK</p>
              <p className="text-sm text-red-400">
                Your Health Factor is below 1.0! Repay debt immediately or add collateral to avoid liquidation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
