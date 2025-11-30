/**
 * Generate a trustline transaction XDR that can be signed with Freighter
 * 
 * Usage:
 *   export NETWORK=testnet
 *   npm run generate-trustline-xdr
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { NETWORKS, loadDeploymentInfo } from "./config.js";

async function main() {
  const networkName = process.env.NETWORK || "testnet";
  const userAddress = process.env.USER_ADDRESS || "GBXKTFB3MTQGTLHUHK2ABDCO62GXHRHYCGLWZEIMLDKES5KQ2TBOUS73";

  const network = NETWORKS[networkName];
  if (!network) {
    console.error(`❌ Unknown network: ${networkName}`);
    process.exit(1);
  }

  const deploymentInfo = await loadDeploymentInfo();
  const usdcIssuer = deploymentInfo?.tokens?.usdcIssuer;

  if (!usdcIssuer) {
    console.error("❌ USDC issuer not found in deployment.json");
    process.exit(1);
  }

  console.log("🔧 Generating trustline transaction...");
  console.log(`   User: ${userAddress}`);
  console.log(`   Asset: USDC`);
  console.log(`   Issuer: ${usdcIssuer}\n`);

  const horizonUrl = network.networkPassphrase.includes("Future")
    ? "https://horizon-futurenet.stellar.org"
    : "https://horizon-testnet.stellar.org";

  const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
  const usdcAsset = new StellarSdk.Asset("USDC", usdcIssuer);

  try {
    // Load account to get sequence number
    const sourceAccount = await horizonServer.loadAccount(userAddress);

    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: network.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: usdcAsset,
          limit: "1000000000", // 1 billion USDC limit
        })
      )
      .setTimeout(30)
      .build();

    // Export as XDR (unsigned)
    const xdr = transaction.toXDR();
    
    console.log("✅ Transaction XDR generated!\n");
    console.log("📋 Copy this XDR and sign it with one of these methods:\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(xdr);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    console.log("🔐 Method 1: Sign with Freighter (Browser Extension)");
    console.log("   1. Open browser console (F12) on any page");
    console.log("   2. Run this JavaScript:");
    console.log(`      await window.freighterApi.signTransaction("${xdr}")`);
    console.log("   3. Approve in Freighter popup\n");
    
    console.log("🔐 Method 2: Use Stellar Laboratory");
    console.log("   1. Go to: https://laboratory.stellar.org/#txsigner?network=test");
    console.log("   2. Paste the XDR above");
    console.log("   3. Click 'Sign in Freighter' button");
    console.log("   4. Approve in Freighter popup\n");
    
    // Also save to file
    const fs = await import("fs/promises");
    await fs.writeFile("trustline_transaction.xdr", xdr);
    console.log("💾 XDR saved to: trustline_transaction.xdr\n");
    
  } catch (error: any) {
    if (error?.response?.data?.detail?.includes("not found")) {
      console.error("❌ Account not found. Make sure the address is correct.");
    } else {
      console.error("❌ Failed to generate transaction:", error?.response?.data || error);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Script failed:", error);
  process.exit(1);
});

