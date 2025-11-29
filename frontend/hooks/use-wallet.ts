"use client"

import { useContext } from "react"
import { WalletContext } from "@/context/wallet-context"

export function useWallet() {
  const context = useContext(WalletContext)
  
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  
  return context
}
