"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { parseContractError, type TransactionState, getTransactionMessage } from "@/utils/errors"

interface UseTransactionOptions {
  onSuccess?: () => void | Promise<void>
  successMessage?: string
  errorMessage?: string
}

interface UseTransactionReturn {
  state: TransactionState
  isLoading: boolean
  execute: <T>(fn: () => Promise<T>) => Promise<T | null>
  reset: () => void
}

/**
 * Custom hook for handling transactions with proper loading states and error handling
 */
export function useTransaction(options: UseTransactionOptions = {}): UseTransactionReturn {
  const [state, setState] = useState<TransactionState>("idle")

  const execute = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setState("signing")
    
    // Show signing toast
    const toastId = toast.loading("Waiting for wallet signature...", {
      description: "Please confirm the transaction in your wallet"
    })

    try {
      // Execute the transaction function
      setState("submitting")
      toast.loading("Submitting transaction...", { id: toastId })
      
      const result = await fn()
      
      setState("confirming")
      toast.loading("Confirming on-chain...", { id: toastId })
      
      // Small delay to show confirming state
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setState("success")
      toast.success(options.successMessage || "Transaction confirmed!", {
        id: toastId,
        description: "Your transaction was successful"
      })
      
      // Call onSuccess callback
      if (options.onSuccess) {
        await options.onSuccess()
      }
      
      // Reset state after success
      setTimeout(() => setState("idle"), 2000)
      
      return result
    } catch (error) {
      setState("error")
      
      // Parse the error for a user-friendly message
      const errorMessage = parseContractError(error)
      
      toast.error(options.errorMessage || "Transaction Failed", {
        id: toastId,
        description: errorMessage,
        duration: 5000,
      })
      
      console.error("Transaction error:", error)
      
      // Reset state after error
      setTimeout(() => setState("idle"), 3000)
      
      return null
    }
  }, [options])

  const reset = useCallback(() => {
    setState("idle")
  }, [])

  return {
    state,
    isLoading: state !== "idle" && state !== "success" && state !== "error",
    execute,
    reset,
  }
}

/**
 * Get button text based on transaction state
 */
export function getButtonText(
  state: TransactionState,
  defaultText: string,
  options?: {
    signingText?: string
    submittingText?: string
    confirmingText?: string
  }
): string {
  switch (state) {
    case "signing":
      return options?.signingText || "Waiting for Wallet..."
    case "submitting":
      return options?.submittingText || "Submitting..."
    case "confirming":
      return options?.confirmingText || "Confirming..."
    default:
      return defaultText
  }
}

