#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

/// Storage keys for the price oracle
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Admin address (authorized to update prices)
    Admin,
    /// Price for an asset (scaled by 1e7, so $1.00 = 10_000_000)
    Price(Symbol),
    /// Last update timestamp for an asset
    LastUpdate(Symbol),
    /// Price staleness threshold in seconds (default: 1 hour)
    StalenessThreshold,
}

/// Asset symbols used in the protocol
pub const XLM: Symbol = symbol_short!("XLM");
pub const USDC: Symbol = symbol_short!("USDC");

/// Stellend Price Oracle Contract
/// 
/// This contract stores on-chain prices for XLM/USD and USDC/USD.
/// Prices are updated by an authorized admin (off-chain keeper script).
/// 
/// Features:
/// - Store prices with 7 decimal precision
/// - Track last update timestamp for staleness checks
/// - Support for "chaos mode" (50% price drop for demos)
#[contract]
pub struct PriceOracle;

/// Scaling factor for prices (1e7 = 10_000_000)
/// $1.00 = 10_000_000
const PRICE_SCALE: i128 = 10_000_000;

#[contractimpl]
impl PriceOracle {
    /// Initialize the price oracle
    /// 
    /// # Arguments
    /// * `admin` - Admin address authorized to update prices
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        
        // Set default staleness threshold to 1 hour (3600 seconds)
        env.storage().instance().set(&DataKey::StalenessThreshold, &3600u64);

        // Initialize USDC price to $1.00 (stable)
        env.storage().instance().set(&DataKey::Price(USDC), &PRICE_SCALE);
        env.storage().instance().set(&DataKey::LastUpdate(USDC), &env.ledger().timestamp());
    }

    /// Set price for an asset (admin only)
    /// 
    /// # Arguments
    /// * `asset` - Asset symbol (XLM or USDC)
    /// * `price` - Price in USD (scaled by 1e7, e.g., $0.30 = 3_000_000)
    pub fn set_price(env: Env, asset: Symbol, price: i128) {
        // Verify admin authorization
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if price <= 0 {
            panic!("Price must be positive");
        }

        // Store price and update timestamp
        env.storage().instance().set(&DataKey::Price(asset.clone()), &price);
        env.storage().instance().set(&DataKey::LastUpdate(asset.clone()), &env.ledger().timestamp());

        // Emit event
        env.events().publish((symbol_short!("set_price"), asset), price);
    }

    /// Set price with chaos mode (50% drop for demo purposes)
    /// 
    /// # Arguments
    /// * `asset` - Asset symbol
    /// * `price` - Original price (will be halved)
    pub fn set_price_chaos(env: Env, asset: Symbol, price: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if price <= 0 {
            panic!("Price must be positive");
        }

        // Apply 50% reduction
        let chaos_price = price / 2;
        
        env.storage().instance().set(&DataKey::Price(asset.clone()), &chaos_price);
        env.storage().instance().set(&DataKey::LastUpdate(asset.clone()), &env.ledger().timestamp());

        // Emit chaos event
        env.events().publish((symbol_short!("chaos"), asset), chaos_price);
    }

    /// Get price for an asset
    /// 
    /// # Arguments
    /// * `asset` - Asset symbol
    /// 
    /// # Returns
    /// Price in USD (scaled by 1e7)
    pub fn get_price(env: Env, asset: Symbol) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Price(asset))
            .unwrap_or(0)
    }

    /// Get price with staleness check
    /// 
    /// # Arguments
    /// * `asset` - Asset symbol
    /// 
    /// # Returns
    /// Price in USD (scaled by 1e7)
    /// 
    /// # Panics
    /// If the price is stale (older than staleness threshold)
    pub fn get_price_safe(env: Env, asset: Symbol) -> i128 {
        let price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Price(asset.clone()))
            .unwrap_or(0);
        
        if price == 0 {
            panic!("Price not set");
        }

        let last_update: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LastUpdate(asset))
            .unwrap_or(0);
        
        let staleness_threshold: u64 = env
            .storage()
            .instance()
            .get(&DataKey::StalenessThreshold)
            .unwrap_or(3600);
        
        let current_time = env.ledger().timestamp();
        if current_time - last_update > staleness_threshold {
            panic!("Price is stale");
        }

        price
    }

    /// Get the last update timestamp for an asset
    pub fn get_last_update(env: Env, asset: Symbol) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LastUpdate(asset))
            .unwrap_or(0)
    }

    /// Check if a price is stale
    pub fn is_stale(env: Env, asset: Symbol) -> bool {
        let last_update: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LastUpdate(asset))
            .unwrap_or(0);
        
        let staleness_threshold: u64 = env
            .storage()
            .instance()
            .get(&DataKey::StalenessThreshold)
            .unwrap_or(3600);
        
        let current_time = env.ledger().timestamp();
        current_time - last_update > staleness_threshold
    }

    /// Set staleness threshold (admin only)
    /// 
    /// # Arguments
    /// * `threshold` - New staleness threshold in seconds
    pub fn set_staleness_threshold(env: Env, threshold: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage().instance().set(&DataKey::StalenessThreshold, &threshold);
    }

    /// Get current admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Transfer admin role (admin only)
    /// 
    /// # Arguments
    /// * `new_admin` - New admin address
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    // ========== CONVENIENCE FUNCTIONS ==========

    /// Get XLM price in USD
    pub fn get_xlm_price(env: Env) -> i128 {
        Self::get_price(env, XLM)
    }

    /// Get USDC price in USD (should always be ~$1.00)
    pub fn get_usdc_price(env: Env) -> i128 {
        Self::get_price(env, USDC)
    }

    /// Convert XLM amount to USD value
    /// 
    /// # Arguments
    /// * `xlm_amount` - Amount of XLM (in stroops, 1e7)
    /// 
    /// # Returns
    /// USD value (scaled by 1e7)
    pub fn xlm_to_usd(env: Env, xlm_amount: i128) -> i128 {
        let xlm_price = Self::get_price(env, XLM);
        (xlm_amount * xlm_price) / PRICE_SCALE
    }

    /// Convert USD value to XLM amount
    /// 
    /// # Arguments
    /// * `usd_amount` - Amount in USD (scaled by 1e7)
    /// 
    /// # Returns
    /// XLM amount (in stroops, 1e7)
    pub fn usd_to_xlm(env: Env, usd_amount: i128) -> i128 {
        let xlm_price = Self::get_price(env, XLM);
        if xlm_price == 0 {
            panic!("XLM price not set");
        }
        (usd_amount * PRICE_SCALE) / xlm_price
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PriceOracle);
        let client = PriceOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        assert_eq!(client.get_admin(), admin);
        // USDC should be initialized to $1.00
        assert_eq!(client.get_usdc_price(), PRICE_SCALE);
    }

    #[test]
    fn test_set_and_get_price() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, PriceOracle);
        let client = PriceOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        // Set XLM price to $0.30
        let xlm_price: i128 = 3_000_000; // $0.30 scaled by 1e7
        client.set_price(&XLM, &xlm_price);

        assert_eq!(client.get_xlm_price(), xlm_price);
        assert_eq!(client.get_price(&XLM), xlm_price);
    }

    #[test]
    fn test_chaos_mode() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, PriceOracle);
        let client = PriceOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        // Set XLM price with chaos mode (50% drop)
        let original_price: i128 = 3_000_000; // $0.30
        client.set_price_chaos(&XLM, &original_price);

        // Price should be halved
        assert_eq!(client.get_xlm_price(), 1_500_000); // $0.15
    }

    #[test]
    fn test_xlm_to_usd_conversion() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, PriceOracle);
        let client = PriceOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        // Set XLM price to $0.30
        client.set_price(&XLM, &3_000_000);

        // 100 XLM should be worth $30
        let xlm_amount: i128 = 100 * PRICE_SCALE; // 100 XLM in stroops
        let usd_value = client.xlm_to_usd(&xlm_amount);
        assert_eq!(usd_value, 30 * PRICE_SCALE); // $30
    }
}

