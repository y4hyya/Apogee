/**
 * Stellend All-in-One Deployment Script
 *
 * Deploys and initializes all Stellend contracts in one go:
 *
 * 1. Deploy Price Oracle contract
 * 2. Deploy Interest Rate Model contract
 * 3. Deploy Lending Pool contract
 * 4. Setup tokens (wrap XLM, create USDC)
 * 5. Initialize all contracts
 * 6. Set initial prices on oracle
 * 7. Seed pool with liquidity (optional)
 *
 * ## Prerequisites
 *
 * 1. Build contracts first:
 *    ```bash
 *    cd contracts && cargo build --target wasm32-unknown-unknown --release
 *    ```
 *
 * 2. Set environment variable:
 *    ```bash
 *    export SECRET_KEY="SXXXXX..."
 *    ```
 *
 * ## Usage
 *
 * ```bash
 * npm run deploy-all
 * npm run deploy-all -- --seed  # Also seed pool with liquidity
 * ```
 *
 * ## Output
 *
 * Saves all contract IDs and addresses to deployment.json
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  loadConfig,
  saveDeploymentInfo,
  fundWithFriendbot,
  truncateAddress,
  printBanner,
  printSection,
  toStroops,
  waitForTransaction,
  StellarSdk,
  SorobanRpc,
  DeploymentInfo,
  SEED_AMOUNTS,
} from "./config.js";

// ============================================================================
// WASM FILE PATHS
// ============================================================================

const WASM_DIR = "../contracts/target/wasm32-unknown-unknown/release";

const WASM_FILES = {
  pool: "stellend_pool.wasm",
  oracle: "stellend_price_oracle.wasm",
  interestRateModel: "stellend_interest_rate_model.wasm",
};

// ============================================================================
// DEPLOYMENT FUNCTIONS
// ============================================================================

/**
 * Read WASM file
 */
async function readWasmFile(filename: string): Promise<Buffer> {
  const wasmPath = path.join(import.meta.dirname || __dirname, WASM_DIR, filename);
  console.log(`   Reading: ${filename}`);
  return fs.readFile(wasmPath);
}

/**
 * Deploy a contract using soroban-cli via exec
 * This is more reliable than using the SDK directly for deployment
 */
async function deployContractViaCli(
  contractName: string,
  wasmPath: string,
  sourceSecret: string,
  networkPassphrase: string
): Promise<string> {
  console.log(`\n📦 Deploying ${contractName}...`);

  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  const network = networkPassphrase.includes("Future") ? "futurenet" : "testnet";

  try {
    // Deploy using soroban CLI
    const cmd = `soroban contract deploy --wasm ${wasmPath} --source ${sourceSecret} --network ${network}`;
    console.log(`   Running: soroban contract deploy...`);

    const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });

    if (stderr && !stderr.includes("warn")) {
      console.warn(`   Warning: ${stderr}`);
    }

    const contractId = stdout.trim();
    console.log(`   ✅ ${contractName} deployed: ${truncateAddress(contractId)}`);
    return contractId;
  } catch (error: any) {
    throw new Error(`Failed to deploy ${contractName}: ${error.message}`);
  }
}

/**
 * Alternative: Deploy contract using SDK (for environments without CLI)
 */
async function deployContractViaSdk(
  server: SorobanRpc.Server,
  sourceKeypair: StellarSdk.Keypair,
  wasmBuffer: Buffer,
  contractName: string,
  networkPassphrase: string
): Promise<string> {
  console.log(`\n📦 Deploying ${contractName} via SDK...`);

  const publicKey = sourceKeypair.publicKey();

  // Step 1: Upload WASM using invokeHostFunction
  console.log("   Uploading WASM...");
  let sourceAccount = await server.getAccount(publicKey);

  const uploadHostFunction = StellarSdk.xdr.HostFunction.hostFunctionTypeUploadContractWasm(
    wasmBuffer
  );

  const uploadOp = StellarSdk.Operation.invokeHostFunction({
    func: uploadHostFunction,
    auth: [],
  });

  let uploadTx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "10000000",
    networkPassphrase,
  })
    .addOperation(uploadOp)
    .setTimeout(300)
    .build();

  const uploadSim = await server.simulateTransaction(uploadTx);

  if (SorobanRpc.Api.isSimulationError(uploadSim)) {
    throw new Error(`WASM upload simulation failed: ${uploadSim.error}`);
  }

  const preparedUpload = SorobanRpc.assembleTransaction(uploadTx, uploadSim).build();
  preparedUpload.sign(sourceKeypair);

  const uploadResponse = await server.sendTransaction(preparedUpload);
  if (uploadResponse.status === "ERROR") {
    throw new Error(`WASM upload failed`);
  }

  const uploadResult = await waitForTransaction(server, uploadResponse.hash);
  if (uploadResult.status !== "SUCCESS") {
    throw new Error(`WASM upload failed`);
  }

  console.log("   ✅ WASM uploaded");

  // Extract WASM hash
  const resultMeta = (uploadResult as any).resultMetaXdr;
  if (!resultMeta) {
    throw new Error("No result metadata");
  }
  const txMeta = StellarSdk.xdr.TransactionMeta.fromXDR(resultMeta, "base64");
  const wasmHashBuffer = txMeta.v3().sorobanMeta()?.returnValue()?.bytes();

  if (!wasmHashBuffer) {
    throw new Error("Failed to get WASM hash");
  }

  // Step 2: Create contract
  console.log("   Creating contract instance...");
  sourceAccount = await server.getAccount(publicKey);

  const salt = Buffer.from(StellarSdk.Keypair.random().rawPublicKey());
  const wasmHash = Buffer.from(wasmHashBuffer);

  const createHostFunction = StellarSdk.xdr.HostFunction.hostFunctionTypeCreateContract(
    new StellarSdk.xdr.CreateContractArgs({
      contractIdPreimage: StellarSdk.xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new StellarSdk.xdr.ContractIdPreimageFromAddress({
          address: new StellarSdk.Address(publicKey).toScAddress(),
          salt: salt,
        })
      ),
      executable: StellarSdk.xdr.ContractExecutable.contractExecutableWasm(wasmHash),
    })
  );

  const createOp = StellarSdk.Operation.invokeHostFunction({
    func: createHostFunction,
    auth: [],
  });

  let createTx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "10000000",
    networkPassphrase,
  })
    .addOperation(createOp)
    .setTimeout(300)
    .build();

  const createSim = await server.simulateTransaction(createTx);

  if (SorobanRpc.Api.isSimulationError(createSim)) {
    throw new Error(`Contract creation simulation failed: ${createSim.error}`);
  }

  const preparedCreate = SorobanRpc.assembleTransaction(createTx, createSim).build();
  preparedCreate.sign(sourceKeypair);

  const createResponse = await server.sendTransaction(preparedCreate);
  if (createResponse.status === "ERROR") {
    throw new Error(`Contract creation failed`);
  }

  const createResult = await waitForTransaction(server, createResponse.hash);
  if (createResult.status !== "SUCCESS") {
    throw new Error(`Contract creation failed`);
  }

  // Extract contract ID
  const createMeta = (createResult as any).resultMetaXdr;
  const createTxMeta = StellarSdk.xdr.TransactionMeta.fromXDR(createMeta, "base64");
  const returnVal = createTxMeta.v3().sorobanMeta()?.returnValue();

  if (!returnVal) {
    throw new Error("No return value from contract creation");
  }

  const contractId = StellarSdk.Address.fromScVal(returnVal).toString();
  console.log(`   ✅ ${contractName} deployed: ${truncateAddress(contractId)}`);

  return contractId;
}

/**
 * Initialize the Price Oracle contract
 */
async function initializeOracle(
  server: SorobanRpc.Server,
  oracleContractId: string,
  adminKeypair: StellarSdk.Keypair,
  networkPassphrase: string
): Promise<void> {
  console.log("   Initializing Price Oracle...");

  const publicKey = adminKeypair.publicKey();
  const sourceAccount = await server.getAccount(publicKey);

  const contract = new StellarSdk.Contract(oracleContractId);

  const operation = contract.call(
    "initialize",
    StellarSdk.nativeToScVal(publicKey, { type: "address" })
  );

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (SorobanRpc.Api.isSimulationError(simulation)) {
    if (simulation.error.includes("Already initialized")) {
      console.log("   ⚠️  Oracle already initialized");
      return;
    }
    throw new Error(`Oracle init simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(transaction, simulation).build();
  preparedTx.sign(adminKeypair);

  const sendResponse = await server.sendTransaction(preparedTx);
  if (sendResponse.status === "ERROR") {
    throw new Error("Oracle initialization failed");
  }

  const result = await waitForTransaction(server, sendResponse.hash);
  if (result.status === "SUCCESS") {
    console.log("   ✅ Oracle initialized");
  }
}

/**
 * Set price on oracle
 */
async function setOraclePrice(
  server: SorobanRpc.Server,
  oracleContractId: string,
  adminKeypair: StellarSdk.Keypair,
  asset: string,
  price: bigint,
  networkPassphrase: string
): Promise<void> {
  console.log(`   Setting ${asset} price: ${Number(price) / 10_000_000}...`);

  const publicKey = adminKeypair.publicKey();
  const sourceAccount = await server.getAccount(publicKey);

  const contract = new StellarSdk.Contract(oracleContractId);

  const operation = contract.call(
    "set_price",
    StellarSdk.nativeToScVal(asset, { type: "symbol" }),
    StellarSdk.nativeToScVal(price, { type: "i128" })
  );

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Set price simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(transaction, simulation).build();
  preparedTx.sign(adminKeypair);

  const sendResponse = await server.sendTransaction(preparedTx);
  const result = await waitForTransaction(server, sendResponse.hash);

  if (result.status === "SUCCESS") {
    console.log(`   ✅ ${asset} price set`);
  }
}

/**
 * Initialize the Interest Rate Model contract
 */
async function initializeInterestRateModel(
  server: SorobanRpc.Server,
  modelContractId: string,
  adminKeypair: StellarSdk.Keypair,
  networkPassphrase: string
): Promise<void> {
  console.log("   Initializing Interest Rate Model...");

  const publicKey = adminKeypair.publicKey();
  const sourceAccount = await server.getAccount(publicKey);

  const contract = new StellarSdk.Contract(modelContractId);

  // Use initialize_default for the default parameters
  const operation = contract.call("initialize_default");

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (SorobanRpc.Api.isSimulationError(simulation)) {
    if (simulation.error.includes("Already initialized")) {
      console.log("   ⚠️  Interest Rate Model already initialized");
      return;
    }
    throw new Error(`Interest Rate Model init simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(transaction, simulation).build();
  preparedTx.sign(adminKeypair);

  const sendResponse = await server.sendTransaction(preparedTx);
  if (sendResponse.status === "ERROR") {
    throw new Error("Interest Rate Model initialization failed");
  }

  const result = await waitForTransaction(server, sendResponse.hash);
  if (result.status === "SUCCESS") {
    console.log("   ✅ Interest Rate Model initialized");
  }
}

/**
 * Initialize the Lending Pool contract
 */
async function initializePool(
  server: SorobanRpc.Server,
  poolContractId: string,
  adminKeypair: StellarSdk.Keypair,
  oracleContractId: string,
  interestRateModelId: string,
  xlmTokenId: string,
  usdcTokenId: string,
  networkPassphrase: string
): Promise<void> {
  console.log("   Initializing Lending Pool...");

  const publicKey = adminKeypair.publicKey();
  const sourceAccount = await server.getAccount(publicKey);

  const contract = new StellarSdk.Contract(poolContractId);

  const operation = contract.call(
    "initialize",
    StellarSdk.nativeToScVal(publicKey, { type: "address" }), // admin
    StellarSdk.nativeToScVal(oracleContractId, { type: "address" }), // price_oracle
    StellarSdk.nativeToScVal(interestRateModelId, { type: "address" }), // interest_rate_model
    StellarSdk.nativeToScVal(xlmTokenId, { type: "address" }), // xlm_token
    StellarSdk.nativeToScVal(usdcTokenId, { type: "address" }) // usdc_token
  );

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (SorobanRpc.Api.isSimulationError(simulation)) {
    if (simulation.error.includes("Already initialized")) {
      console.log("   ⚠️  Pool already initialized");
      return;
    }
    throw new Error(`Pool init simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(transaction, simulation).build();
  preparedTx.sign(adminKeypair);

  const sendResponse = await server.sendTransaction(preparedTx);
  if (sendResponse.status === "ERROR") {
    throw new Error("Pool initialization failed");
  }

  const result = await waitForTransaction(server, sendResponse.hash);
  if (result.status === "SUCCESS") {
    console.log("   ✅ Pool initialized");
  }
}

/**
 * Setup tokens (wrap XLM and create USDC)
 */
async function setupTokens(
  server: SorobanRpc.Server,
  sourceKeypair: StellarSdk.Keypair,
  networkPassphrase: string
): Promise<{ xlmContractId: string; usdcContractId: string }> {
  console.log("\n💰 Setting up tokens...");

  const publicKey = sourceKeypair.publicKey();

  // Wrap native XLM
  console.log("   Wrapping XLM...");
  const xlmAsset = StellarSdk.Asset.native();
  const xlmContractId = xlmAsset.contractId(networkPassphrase);

  try {
    const sourceAccount = await server.getAccount(publicKey);
    const operation = StellarSdk.Operation.createStellarAssetContract({
      asset: xlmAsset,
    });

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: "100000",
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);
    const sendResponse = await server.sendTransaction(transaction);

    if (sendResponse.status !== "ERROR") {
      await waitForTransaction(server, sendResponse.hash);
      console.log(`   ✅ XLM wrapped: ${truncateAddress(xlmContractId)}`);
    } else {
      console.log(`   ⚠️  XLM may already be wrapped: ${truncateAddress(xlmContractId)}`);
    }
  } catch {
    console.log(`   ⚠️  XLM may already be wrapped: ${truncateAddress(xlmContractId)}`);
  }

  // Create and wrap USDC
  console.log("   Creating USDC...");
  const usdcAsset = new StellarSdk.Asset("USDC", publicKey);
  const usdcContractId = usdcAsset.contractId(networkPassphrase);

  try {
    const sourceAccount = await server.getAccount(publicKey);
    const operation = StellarSdk.Operation.createStellarAssetContract({
      asset: usdcAsset,
    });

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: "100000",
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);
    const sendResponse = await server.sendTransaction(transaction);

    if (sendResponse.status !== "ERROR") {
      await waitForTransaction(server, sendResponse.hash);
      console.log(`   ✅ USDC created: ${truncateAddress(usdcContractId)}`);
    } else {
      console.log(`   ⚠️  USDC may already exist: ${truncateAddress(usdcContractId)}`);
    }
  } catch {
    console.log(`   ⚠️  USDC may already exist: ${truncateAddress(usdcContractId)}`);
  }

  return { xlmContractId, usdcContractId };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  printBanner("Stellend Full Deployment");

  const config = loadConfig();
  const args = process.argv.slice(2);
  const shouldSeed = args.includes("--seed") || args.includes("-s");

  console.log(`📡 Network: ${config.networkName}`);
  console.log(`🔑 Deployer: ${truncateAddress(config.keypair.publicKey())}`);
  console.log(`🌱 Seed pool: ${shouldSeed ? "Yes" : "No"}`);

  // Fund deployer
  printSection("Funding Deployer");
  await fundWithFriendbot(config.keypair.publicKey(), config.network.friendbotUrl);

  // Check WASM files exist
  printSection("Checking WASM Files");
  try {
    await readWasmFile(WASM_FILES.oracle);
    await readWasmFile(WASM_FILES.interestRateModel);
    await readWasmFile(WASM_FILES.pool);
    console.log("   ✅ All WASM files found");
  } catch (error) {
    console.error("❌ WASM files not found. Build contracts first:");
    console.error("   cd contracts && cargo build --target wasm32-unknown-unknown --release");
    process.exit(1);
  }

  // Setup tokens first
  printSection("Setting Up Tokens");
  const { xlmContractId, usdcContractId } = await setupTokens(
    config.server,
    config.keypair,
    config.network.networkPassphrase
  );

  // Deploy contracts
  printSection("Deploying Contracts");

  // Check if soroban CLI is available
  let useCli = true;
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    await execAsync("soroban --version");
  } catch {
    console.log("   ⚠️  soroban CLI not found, using SDK deployment");
    useCli = false;
  }

  let oracleContractId: string;
  let modelContractId: string;
  let poolContractId: string;

  const wasmDir = path.join(import.meta.dirname || __dirname, WASM_DIR);

  if (useCli) {
    // Deploy using soroban CLI (more reliable)
    oracleContractId = await deployContractViaCli(
      "Price Oracle",
      path.join(wasmDir, WASM_FILES.oracle),
      config.secretKey,
      config.network.networkPassphrase
    );

    modelContractId = await deployContractViaCli(
      "Interest Rate Model",
      path.join(wasmDir, WASM_FILES.interestRateModel),
      config.secretKey,
      config.network.networkPassphrase
    );

    poolContractId = await deployContractViaCli(
      "Lending Pool",
      path.join(wasmDir, WASM_FILES.pool),
      config.secretKey,
      config.network.networkPassphrase
    );
  } else {
    // Fallback to SDK deployment
    const oracleWasm = await readWasmFile(WASM_FILES.oracle);
    oracleContractId = await deployContractViaSdk(
      config.server,
      config.keypair,
      oracleWasm,
      "Price Oracle",
      config.network.networkPassphrase
    );

    const modelWasm = await readWasmFile(WASM_FILES.interestRateModel);
    modelContractId = await deployContractViaSdk(
      config.server,
      config.keypair,
      modelWasm,
      "Interest Rate Model",
      config.network.networkPassphrase
    );

    const poolWasm = await readWasmFile(WASM_FILES.pool);
    poolContractId = await deployContractViaSdk(
      config.server,
      config.keypair,
      poolWasm,
      "Lending Pool",
      config.network.networkPassphrase
    );
  }

  // Initialize contracts
  printSection("Initializing Contracts");

  await initializeOracle(
    config.server,
    oracleContractId,
    config.keypair,
    config.network.networkPassphrase
  );

  await initializeInterestRateModel(
    config.server,
    modelContractId,
    config.keypair,
    config.network.networkPassphrase
  );

  await initializePool(
    config.server,
    poolContractId,
    config.keypair,
    oracleContractId,
    modelContractId,
    xlmContractId,
    usdcContractId,
    config.network.networkPassphrase
  );

  // Set initial prices
  printSection("Setting Initial Prices");
  await setOraclePrice(
    config.server,
    oracleContractId,
    config.keypair,
    "XLM",
    BigInt(3_000_000), // $0.30
    config.network.networkPassphrase
  );
  await setOraclePrice(
    config.server,
    oracleContractId,
    config.keypair,
    "USDC",
    BigInt(10_000_000), // $1.00
    config.network.networkPassphrase
  );

  // Save deployment info
  const deploymentInfo: DeploymentInfo = {
    network: config.networkName,
    timestamp: new Date().toISOString(),
    contracts: {
      pool: poolContractId,
      oracle: oracleContractId,
      interestRateModel: modelContractId,
    },
    tokens: {
      xlm: xlmContractId,
      usdc: usdcContractId,
      usdcIssuer: config.keypair.publicKey(),
    },
    accounts: {
      deployer: config.keypair.publicKey(),
    },
  };

  await saveDeploymentInfo(deploymentInfo);

  // Print summary
  printSection("Deployment Summary");
  console.log("Contracts:");
  console.log(`  Pool:               ${poolContractId}`);
  console.log(`  Oracle:             ${oracleContractId}`);
  console.log(`  Interest Rate Model: ${modelContractId}`);
  console.log("\nTokens:");
  console.log(`  XLM:  ${xlmContractId}`);
  console.log(`  USDC: ${usdcContractId}`);
  console.log(`  USDC Issuer: ${config.keypair.publicKey()}`);

  console.log("\n📁 Deployment info saved to deployment.json");

  if (shouldSeed) {
    console.log("\n🌱 Run 'npm run seed-pool' to add liquidity");
  }

  console.log("\n🎉 Deployment complete!");
  console.log("\nNext steps:");
  console.log("  1. npm run seed-pool          # Add liquidity");
  console.log("  2. npm run fund-user -- --new # Create test user");
  console.log("  3. npm run update-price       # Update prices");

  // Export environment variables for convenience
  console.log("\n📋 Export these environment variables:");
  console.log(`export POOL_CONTRACT_ID="${poolContractId}"`);
  console.log(`export ORACLE_CONTRACT_ID="${oracleContractId}"`);
  console.log(`export INTEREST_RATE_MODEL_ID="${modelContractId}"`);
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:", error);
  process.exit(1);
});

