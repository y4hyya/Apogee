#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
};

/// Storage keys for the lending pool
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Admin address
    Admin,
    /// Total deposits in the pool (scaled by 7 decimals)
    TotalDeposits,
    /// Total borrows from the pool (scaled by 7 decimals)
    TotalBorrows,
    /// User deposit balance
    UserDeposit(Address),
    /// User borrow balance
    UserBorrow(Address),
    /// User collateral (XLM deposited)
    UserCollateral(Address),
    /// USDC token contract address
    UsdcToken,
    /// XLM token contract address (wrapped)
    XlmToken,
    /// Interest rate model contract address
    InterestRateModel,
    /// Price oracle contract address
    PriceOracle,
    /// LTV ratio (75% = 7500, scaled by 10000)
    LtvRatio,
    /// Liquidation threshold (80% = 8000, scaled by 10000)
    LiquidationThreshold,
    /// Last accrual timestamp
    LastAccrualTime,
    /// Accumulated borrow index (for interest)
    BorrowIndex,
}

/// Stellend Lending Pool Contract
/// 
/// This is the main contract for the Stellend lending protocol.
/// It handles:
/// - Deposits (supply liquidity to earn interest)
/// - Withdrawals (remove supplied liquidity)
/// - Borrowing (borrow against collateral)
/// - Repayment (repay borrowed assets)
/// - Collateral management (deposit/withdraw XLM as collateral)
#[contract]
pub struct LendingPool;

#[contractimpl]
impl LendingPool {
    /// Initialize the lending pool
    /// 
    /// # Arguments
    /// * `admin` - Admin address for protocol management
    /// * `usdc_token` - USDC token contract address
    /// * `xlm_token` - Wrapped XLM token contract address
    /// * `interest_rate_model` - Interest rate model contract address
    /// * `price_oracle` - Price oracle contract address
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        xlm_token: Address,
        interest_rate_model: Address,
        price_oracle: Address,
    ) {
        // Ensure not already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }

        // Store configuration
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::InterestRateModel, &interest_rate_model);
        env.storage().instance().set(&DataKey::PriceOracle, &price_oracle);
        
        // Set default parameters
        // LTV: 75% (7500 / 10000)
        env.storage().instance().set(&DataKey::LtvRatio, &7500u32);
        // Liquidation threshold: 80% (8000 / 10000)
        env.storage().instance().set(&DataKey::LiquidationThreshold, &8000u32);
        
        // Initialize pool state
        env.storage().instance().set(&DataKey::TotalDeposits, &0i128);
        env.storage().instance().set(&DataKey::TotalBorrows, &0i128);
        env.storage().instance().set(&DataKey::BorrowIndex, &1_000_000_000i128); // 1.0 scaled by 1e9
        env.storage().instance().set(&DataKey::LastAccrualTime, &env.ledger().timestamp());
    }

    // ========== SUPPLY FUNCTIONS ==========

    /// Deposit USDC into the lending pool to earn interest
    /// 
    /// # Arguments
    /// * `user` - The depositor's address
    /// * `amount` - Amount of USDC to deposit (in base units)
    /// 
    /// # Returns
    /// The amount deposited
    pub fn deposit(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Transfer USDC from user to pool
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Update user deposit balance
        let current_deposit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserDeposit(user.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::UserDeposit(user.clone()), &(current_deposit + amount));

        // Update total deposits
        let total_deposits: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalDeposits, &(total_deposits + amount));

        // Emit event
        env.events().publish((symbol_short!("deposit"), user), amount);

        amount
    }

    /// Withdraw USDC from the lending pool
    /// 
    /// # Arguments
    /// * `user` - The user's address
    /// * `amount` - Amount of USDC to withdraw (in base units)
    /// 
    /// # Returns
    /// The amount withdrawn
    pub fn withdraw(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Check user has sufficient deposit
        let current_deposit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserDeposit(user.clone()))
            .unwrap_or(0);
        if current_deposit < amount {
            panic!("Insufficient deposit balance");
        }

        // Check pool has sufficient liquidity
        let total_deposits: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);
        let total_borrows: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBorrows)
            .unwrap_or(0);
        let available_liquidity = total_deposits - total_borrows;
        if available_liquidity < amount {
            panic!("Insufficient pool liquidity");
        }

        // Update user deposit balance
        env.storage()
            .persistent()
            .set(&DataKey::UserDeposit(user.clone()), &(current_deposit - amount));

        // Update total deposits
        env.storage()
            .instance()
            .set(&DataKey::TotalDeposits, &(total_deposits - amount));

        // Transfer USDC from pool to user
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), &user, &amount);

        // Emit event
        env.events().publish((symbol_short!("withdraw"), user), amount);

        amount
    }

    // ========== COLLATERAL FUNCTIONS ==========

    /// Deposit XLM as collateral for borrowing
    /// 
    /// # Arguments
    /// * `user` - The user's address
    /// * `amount` - Amount of XLM to deposit as collateral
    pub fn deposit_collateral(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Transfer XLM from user to pool
        let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Update user collateral balance
        let current_collateral: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserCollateral(user.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::UserCollateral(user.clone()), &(current_collateral + amount));

        // Emit event
        env.events().publish((symbol_short!("coll_dep"), user), amount);

        amount
    }

    /// Withdraw XLM collateral
    /// 
    /// # Arguments
    /// * `user` - The user's address
    /// * `amount` - Amount of XLM to withdraw
    pub fn withdraw_collateral(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let current_collateral: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserCollateral(user.clone()))
            .unwrap_or(0);
        if current_collateral < amount {
            panic!("Insufficient collateral");
        }

        // Check health factor after withdrawal
        let new_collateral = current_collateral - amount;
        let user_borrow: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserBorrow(user.clone()))
            .unwrap_or(0);
        
        if user_borrow > 0 {
            // TODO: Get XLM price from oracle and check health factor
            // For now, simple check: new collateral must cover borrow with LTV
            let ltv_ratio: u32 = env.storage().instance().get(&DataKey::LtvRatio).unwrap();
            let max_borrow = (new_collateral * ltv_ratio as i128) / 10000;
            if user_borrow > max_borrow {
                panic!("Withdrawal would make position unhealthy");
            }
        }

        // Update user collateral balance
        env.storage()
            .persistent()
            .set(&DataKey::UserCollateral(user.clone()), &new_collateral);

        // Transfer XLM from pool to user
        let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&env.current_contract_address(), &user, &amount);

        // Emit event
        env.events().publish((symbol_short!("coll_wth"), user), amount);

        amount
    }

    // ========== BORROW FUNCTIONS ==========

    /// Borrow USDC against deposited collateral
    /// 
    /// # Arguments
    /// * `user` - The borrower's address
    /// * `amount` - Amount of USDC to borrow
    pub fn borrow(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Check available liquidity
        let total_deposits: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);
        let total_borrows: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBorrows)
            .unwrap_or(0);
        let available_liquidity = total_deposits - total_borrows;
        if available_liquidity < amount {
            panic!("Insufficient pool liquidity");
        }

        // Check user's borrowing capacity
        let user_collateral: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserCollateral(user.clone()))
            .unwrap_or(0);
        let user_borrow: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserBorrow(user.clone()))
            .unwrap_or(0);
        
        let ltv_ratio: u32 = env.storage().instance().get(&DataKey::LtvRatio).unwrap();
        // TODO: Get XLM price from oracle for proper USD value calculation
        let max_borrow = (user_collateral * ltv_ratio as i128) / 10000;
        
        if user_borrow + amount > max_borrow {
            panic!("Borrow amount exceeds capacity");
        }

        // Update user borrow balance
        env.storage()
            .persistent()
            .set(&DataKey::UserBorrow(user.clone()), &(user_borrow + amount));

        // Update total borrows
        env.storage()
            .instance()
            .set(&DataKey::TotalBorrows, &(total_borrows + amount));

        // Transfer USDC from pool to user
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), &user, &amount);

        // Emit event
        env.events().publish((symbol_short!("borrow"), user), amount);

        amount
    }

    /// Repay borrowed USDC
    /// 
    /// # Arguments
    /// * `user` - The borrower's address
    /// * `amount` - Amount of USDC to repay
    pub fn repay(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let user_borrow: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserBorrow(user.clone()))
            .unwrap_or(0);
        
        // Cap repayment at outstanding borrow
        let repay_amount = if amount > user_borrow { user_borrow } else { amount };
        
        if repay_amount == 0 {
            panic!("No outstanding borrow");
        }

        // Transfer USDC from user to pool
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&user, &env.current_contract_address(), &repay_amount);

        // Update user borrow balance
        env.storage()
            .persistent()
            .set(&DataKey::UserBorrow(user.clone()), &(user_borrow - repay_amount));

        // Update total borrows
        let total_borrows: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBorrows)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalBorrows, &(total_borrows - repay_amount));

        // Emit event
        env.events().publish((symbol_short!("repay"), user), repay_amount);

        repay_amount
    }

    // ========== VIEW FUNCTIONS ==========

    /// Get total deposits in the pool
    pub fn get_total_deposits(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0)
    }

    /// Get total borrows from the pool
    pub fn get_total_borrows(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalBorrows)
            .unwrap_or(0)
    }

    /// Get pool utilization rate (scaled by 1e7, so 50% = 5_000_000)
    pub fn get_utilization_rate(env: Env) -> i128 {
        let total_deposits: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);
        let total_borrows: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBorrows)
            .unwrap_or(0);
        
        if total_deposits == 0 {
            return 0;
        }
        
        (total_borrows * 10_000_000) / total_deposits
    }

    /// Get user's deposit balance
    pub fn get_user_deposit(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::UserDeposit(user))
            .unwrap_or(0)
    }

    /// Get user's borrow balance
    pub fn get_user_borrow(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::UserBorrow(user))
            .unwrap_or(0)
    }

    /// Get user's collateral balance
    pub fn get_user_collateral(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::UserCollateral(user))
            .unwrap_or(0)
    }

    /// Get user's health factor (scaled by 1e7, so 1.5 = 15_000_000)
    /// Health Factor = (Collateral Value * Liquidation Threshold) / Borrow Value
    pub fn get_health_factor(env: Env, user: Address) -> i128 {
        let user_collateral: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserCollateral(user.clone()))
            .unwrap_or(0);
        let user_borrow: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserBorrow(user))
            .unwrap_or(0);
        
        if user_borrow == 0 {
            return 999_000_000; // Infinite health factor
        }
        
        let liq_threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::LiquidationThreshold)
            .unwrap();
        
        // TODO: Get actual USD values from price oracle
        // For now, assume 1:1 ratio
        (user_collateral * liq_threshold as i128 * 10_000_000) / (user_borrow * 10000)
    }
}

#[cfg(test)]
mod test;

