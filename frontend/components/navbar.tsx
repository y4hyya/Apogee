"use client"

import { useWallet } from "@/hooks/use-wallet"
import { formatAddress } from "@/utils/format"
import { Zap, LogOut, BookOpen, Wallet, Loader2, AlertCircle } from "lucide-react"

interface NavbarProps {
  onLearnMore?: () => void
}

export default function Navbar({ onLearnMore }: NavbarProps = {}) {
  const { 
    publicKey, 
    isConnected, 
    network,
    connectWallet,
    disconnectWallet,
    isLoading,
    error,
    isFreighterInstalled,
  } = useWallet()

  const getNetworkBadge = () => {
    if (!network) return null
    
    const isCorrectNetwork = network === "TESTNET"
    return (
      <span 
        className={`text-xs px-2 py-0.5 rounded-full ${
          isCorrectNetwork 
            ? "bg-green-500/20 text-green-400" 
            : "bg-yellow-500/20 text-yellow-400"
        }`}
      >
        {network}
      </span>
    )
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border/30 bg-gradient-to-b from-background via-background to-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />
            <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Apogee
            </span>
            <span className="text-xs text-muted-foreground">Peer-to-Pool Lending</span>
          </div>
        </div>

        {isConnected && publicKey ? (
          <div className="flex items-center gap-4">
            {/* Network Badge */}
            {getNetworkBadge()}
            
            {/* Address Display */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-mono">{formatAddress(publicKey)}</span>
            </div>
            
            {/* Disconnect Button */}
            <button
              onClick={disconnectWallet}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-destructive/80 to-destructive text-destructive-foreground shadow-lg shadow-destructive/30 hover:shadow-xl hover:shadow-destructive/40 hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Error Display */}
            {error && (
              <div className="hidden md:flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                <span className="max-w-[200px] truncate">{error}</span>
              </div>
            )}
            
            {/* Learn More Button */}
            {onLearnMore && (
              <button
                onClick={onLearnMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold bg-muted/50 hover:bg-muted transition-all duration-300"
              >
                <BookOpen className="w-4 h-4" />
                Learn More
              </button>
            )}
            
            {/* Connect Wallet - Direct Connection */}
            <button
              onClick={connectWallet}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  {isFreighterInstalled ? "Connect Wallet" : "Install Freighter"}
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* Network Warning Banner */}
      {isConnected && network && network !== "TESTNET" && (
        <div className="bg-yellow-500/10 border-t border-yellow-500/20 px-4 py-2 text-center text-sm text-yellow-400">
          ⚠️ Please switch to Testnet in Freighter to use Apogee
        </div>
      )}
    </nav>
  )
}
