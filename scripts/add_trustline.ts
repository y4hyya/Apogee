/**
 * Quick script to add USDC trustline for platform
 * 
 * Usage:
 *   export USER_SECRET_KEY="SXXXXX..."  # Your secret key
 *   export NETWORK=testnet
 *   npm run add-trustline
 */

import { loadConfig, loadDeploymentInfo } from "./config.js";
import * as StellarSdk from "@stellar/stellar-sdk";

async function main() {
  const userSecretKey = process.env.USER_SECRET_KEY;
  const networkName = process.env.NETWORK || "testnet";
  
  if (!userSecretKey) {
    console.error("❌ USER_SECRET_KEY environment variable not set");
    console.error("\nUsage:");
    console.error("  export USER_SECRET_KEY=\"SXXXXX...\"");
    console.error("  export NETWORK=testnet");
    console.error("  npm run add-trustline");
    process.exit(1);
  }

  // Load network config
  const { NETWORKS } = await import("./config.js");
  const network = NETWORKS[networkName];
  if (!network) {
    console.error(`❌ Unknown network: ${networkName}`);
    process.exit(1);
  }

  const deploymentInfo = await loadDeploymentInfo();
  const usdcIssuer = deploymentInfo?.tokens?.usdcIssuer;

  if (!usdcIssuer) {
    console.error("❌ USDC issuer not found");
    process.exit(1);
  }

  console.log("🔧 Adding USDC trustline...");
  console.log(`   User: ${StellarSdk.Keypair.fromSecret(userSecretKey).publicKey()}`);
  console.log(`   Asset: USDC`);
  console.log(`   Issuer: ${usdcIssuer}\n`);

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
  const horizonUrl = network.networkPassphrase.includes("Future")
    ? "https://horizon-futurenet.stellar.org"
    : "https://horizon-testnet.stellar.org";

  const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
  const usdcAsset = new StellarSdk.Asset("USDC", usdcIssuer);

  try {
    const sourceAccount = await horizonServer.loadAccount(userKeypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: network.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: usdcAsset,
          limit: "1000000000",
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(userKeypair);

    const result = await horizonServer.submitTransaction(transaction);
    console.log("✅ Trustline added successfully!");
    console.log(`   Transaction: ${result.hash}`);
    console.log(`   Explorer: https://stellar.expert/explorer/testnet/tx/${result.hash}\n`);
    
    console.log("🎉 You can now receive platform USDC!");
    console.log("   Run: npm run fund-user -- YOUR_ADDRESS --usdc 10000");
  } catch (error: any) {
    if (error?.response?.data?.extras?.result_codes?.operations?.[0] === "op_already_exists") {
      console.log("✅ Trustline already exists!");
    } else {
      console.error("❌ Failed to add trustline:", error?.response?.data?.extras?.result_codes || error);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error("\n❌ Script failed:", error);
  process.exit(1);
});

