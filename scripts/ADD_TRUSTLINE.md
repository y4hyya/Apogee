# Add Platform USDC Trustline - Step by Step

## 🎯 EASIEST METHOD: Stellar Laboratory Transaction Builder

### Step 1: Open Transaction Builder
👉 **Go to:** https://laboratory.stellar.org/#txbuilder?network=test

Make sure "Test" network is selected at the top!

### Step 2: Fill in Source Account
In the "Source Account" field, paste:
```
GBXKTFB3MTQGTLHUHK2ABDCO62GXHRHYCGLWZEIMLDKES5KQ2TBOUS73
```

Then click "Fetch next sequence number for account starting with G..."

### Step 3: Add Operation
1. Click the "Add Operation" button (or the + icon)
2. From the dropdown, select: **"Change Trust"**
3. Fill in:
   - **Asset Type:** Credit Alphanum 4
   - **Asset Code:** `USDC`
   - **Asset Issuer:** `GCCZDWUNUB7OPC6AZXAAMQ4WYU2UAMV4P7I7YK6VQ4CPJGZGMSTA555B`
   - **Trust Limit:** `1000000000` (or leave default)

### Step 4: Build Transaction
Click the **"Build Transaction"** button

### Step 5: Sign with Freighter
1. Go to the **"Transaction Signer"** tab (at the top)
2. Look for the **"Sign in Freighter"** button
3. Click it - Freighter popup will appear
4. **Approve** the transaction

### Step 6: Submit
1. Go to **"Submit Transaction"** tab (or look for Submit button)
2. The signed XDR should be there
3. Click **"Submit Transaction"**

### Step 7: Wait for Confirmation
You should see a success message with transaction hash!

---

## 🚨 If That Doesn't Work:

Let me know what step fails and I'll help you fix it.

After the trustline is added, run this to get your 10,000 USDC:
```bash
cd /Users/yahya/Desktop/Stellend/scripts && \
export SECRET_KEY=$(stellar keys show deployer-testnet) && \
export NETWORK=testnet && \
npm run fund-user -- GBXKTFB3MTQGTLHUHK2ABDCO62GXHRHYCGLWZEIMLDKES5KQ2TBOUS73 --usdc 10000
```
