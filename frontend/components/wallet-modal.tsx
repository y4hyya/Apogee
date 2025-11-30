"use client"

import { useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { X, Wallet, ExternalLink, Loader2, CheckCircle, AlertCircle, Rocket } from "lucide-react"

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connectWallet, isLoading, error, isFreighterInstalled } = useWallet()
  const [connecting, setConnecting] = useState(false)

  const handleConnectFreighter = async () => {
    if (!isFreighterInstalled) {
      window.open("https://www.freighter.app/", "_blank")
      return
    }
    
    setConnecting(true)
    try {
      await connectWallet()
      onClose()
    } catch (err) {
      console.error("Connection failed:", err)
    } finally {
      setConnecting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Connect Wallet</h2>
              <p className="text-sm text-muted-foreground">Connect with Freighter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Freighter Connection */}
        <div className="p-6">
          <button
            onClick={handleConnectFreighter}
            disabled={connecting || isLoading}
            className={`w-full flex items-center justify-between p-5 rounded-xl border-2 transition-all duration-200 ${
              isFreighterInstalled 
                ? "border-primary/50 hover:border-primary bg-primary/5 hover:bg-primary/10" 
                : "border-border hover:border-primary/30"
            } ${connecting ? "bg-primary/10 border-primary" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Rocket className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">Freighter</span>
                  {isFreighterInstalled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      Installed
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isFreighterInstalled 
                    ? "Click to connect your Freighter wallet" 
                    : "Click to install Freighter extension"
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {connecting || isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : isFreighterInstalled ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <ExternalLink className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* Connection Instructions */}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">How to connect:</h3>
            <ol className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">1</span>
                <span>{isFreighterInstalled ? "Click the Freighter button above" : "Install the Freighter browser extension"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">2</span>
                <span>Approve the connection request in Freighter</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">3</span>
                <span>Start using Apogee!</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Network Note */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Make sure Freighter is set to <strong>TESTNET</strong> network</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

