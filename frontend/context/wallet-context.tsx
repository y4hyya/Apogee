"use client"

import type React from "react"
import { createContext, useCallback, useState, useEffect } from "react"
import {
  isConnected as freighterIsConnected,
  isAllowed,
  setAllowed,
  getPublicKey,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api"

// Network configuration
export const NETWORK = {
  name: "FUTURENET",
  networkPassphrase: "Test SDF Future Network ; October 2022",
  horizonUrl: "https://horizon-futurenet.stellar.org",
  sorobanRpcUrl: "https://rpc-futurenet.stellar.org",
}

interface WalletContextType {
  publicKey: string | null
  isConnected: boolean
  isFreighterInstalled: boolean
  network: string | null
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  signTx: (xdr: string) => Promise<string>
  error: string | null
  isLoading: boolean
}

export const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  isConnected: false,
  isFreighterInstalled: false,
  network: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  signTx: async () => "",
  error: null,
  isLoading: false,
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false)
  const [network, setNetwork] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Check if Freighter is installed and if already connected
  useEffect(() => {
    const checkFreighter = async () => {
      try {
        // Check if Freighter extension is installed
        const connected = await freighterIsConnected()
        setIsFreighterInstalled(connected)

        if (connected) {
          // Check if already allowed
          const allowed = await isAllowed()
          if (allowed) {
            // Get stored address
            const address = await getPublicKey()
            if (address) {
              setPublicKey(address)
              setIsConnected(true)

              // Get network
              const networkName = await getNetwork()
              setNetwork(networkName || null)
            }
          }
        }
      } catch (err) {
        console.error("Error checking Freighter:", err)
      }
    }

    checkFreighter()
  }, [])

  const connectWallet = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Check if Freighter is installed
      const connected = await freighterIsConnected()
      if (!connected) {
        throw new Error("Freighter wallet is not installed. Please install the Freighter browser extension.")
      }

      // Request access
      const allowed = await setAllowed()
      if (!allowed) {
        throw new Error("User denied access to Freighter wallet")
      }

      // Get address
      const address = await getPublicKey()
      if (!address) {
        throw new Error("Failed to get wallet address")
      }

      setPublicKey(address)
      setIsConnected(true)

      // Get network
      const networkName = await getNetwork()
      setNetwork(networkName || null)

      // Warn if not on Futurenet
      if (networkName && networkName !== "FUTURENET") {
        console.warn(`Warning: Connected to ${networkName}. Please switch to FUTURENET for Stellend.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet"
      setError(message)
      console.error("Wallet connection error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    setPublicKey(null)
    setIsConnected(false)
    setNetwork(null)
    setError(null)
  }, [])

  const signTx = useCallback(async (xdr: string): Promise<string> => {
    if (!isConnected || !publicKey) {
      throw new Error("Wallet not connected")
    }

    try {
      const signedXdr = await signTransaction(xdr, {
        networkPassphrase: NETWORK.networkPassphrase,
        accountToSign: publicKey,
      })

      if (!signedXdr) {
        throw new Error("Failed to sign transaction")
      }

      return signedXdr
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign transaction"
      throw new Error(message)
    }
  }, [isConnected, publicKey])

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        isConnected,
        isFreighterInstalled,
        network,
        connectWallet,
        disconnectWallet,
        signTx,
        error,
        isLoading,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}
