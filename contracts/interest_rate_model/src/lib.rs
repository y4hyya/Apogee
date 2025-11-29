#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env};

/// Storage keys for the interest rate model
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Base rate (scaled by 1e7, e.g., 0% = 0, 5% = 500_000)
    BaseRate,
    /// Multiplier for utilization below optimal (scaled by 1e7)
    Slope1,
    /// Multiplier for utilization above optimal (scaled by 1e7)
    Slope2,
    /// Optimal utilization rate (scaled by 1e7, e.g., 80% = 8_000_000)
    OptimalUtilization,
}

/// Stellend Interest Rate Model Contract
/// 
/// This contract implements a kinked interest rate model based on utilization.
/// 
/// The formula is:
/// - If utilization <= optimal:
///   rate = base_rate + (utilization / optimal) * slope1
/// - If utilization > optimal:
///   rate = base_rate + slope1 + ((utilization - optimal) / (1 - optimal)) * slope2
/// 
/// This creates a "kink" at the optimal utilization point, where rates
/// increase more steeply to incentivize deposits and discourage borrowing.
#[contract]
pub struct InterestRateModel;

/// Scaling factor for percentages (1e7 = 10_000_000)
const SCALE: i128 = 10_000_000;

#[contractimpl]
impl InterestRateModel {
    /// Initialize the interest rate model with parameters
    /// 
    /// # Arguments
    /// * `base_rate` - Base interest rate (scaled by 1e7, e.g., 0% = 0)
    /// * `slope1` - Rate multiplier below optimal utilization (scaled by 1e7)
    /// * `slope2` - Rate multiplier above optimal utilization (scaled by 1e7)
    /// * `optimal_utilization` - Optimal utilization rate (scaled by 1e7, e.g., 80% = 8_000_000)
    pub fn initialize(
        env: Env,
        base_rate: i128,
        slope1: i128,
        slope2: i128,
        optimal_utilization: i128,
    ) {
        if env.storage().instance().has(&DataKey::BaseRate) {
            panic!("Already initialized");
        }

        if optimal_utilization <= 0 || optimal_utilization >= SCALE {
            panic!("Invalid optimal utilization");
        }

        env.storage().instance().set(&DataKey::BaseRate, &base_rate);
        env.storage().instance().set(&DataKey::Slope1, &slope1);
        env.storage().instance().set(&DataKey::Slope2, &slope2);
        env.storage().instance().set(&DataKey::OptimalUtilization, &optimal_utilization);
    }

    /// Calculate the borrow rate based on current utilization
    /// 
    /// # Arguments
    /// * `utilization` - Current pool utilization rate (scaled by 1e7)
    /// 
    /// # Returns
    /// The annualized borrow rate (scaled by 1e7, e.g., 5% = 500_000)
    pub fn get_borrow_rate(env: Env, utilization: i128) -> i128 {
        let base_rate: i128 = env.storage().instance().get(&DataKey::BaseRate).unwrap_or(0);
        let slope1: i128 = env.storage().instance().get(&DataKey::Slope1).unwrap_or(0);
        let slope2: i128 = env.storage().instance().get(&DataKey::Slope2).unwrap_or(0);
        let optimal: i128 = env.storage().instance().get(&DataKey::OptimalUtilization).unwrap_or(8_000_000);

        if utilization <= optimal {
            // Below or at optimal: linear increase with slope1
            // rate = base_rate + (utilization / optimal) * slope1
            base_rate + (utilization * slope1) / optimal
        } else {
            // Above optimal: base + slope1 + excess rate with slope2
            // excess_utilization = (utilization - optimal) / (1 - optimal)
            // rate = base_rate + slope1 + excess_utilization * slope2
            let excess_utilization = ((utilization - optimal) * SCALE) / (SCALE - optimal);
            base_rate + slope1 + (excess_utilization * slope2) / SCALE
        }
    }

    /// Calculate the supply rate based on current utilization and borrow rate
    /// 
    /// Supply rate = Borrow rate * Utilization * (1 - Reserve Factor)
    /// For simplicity, we assume no reserve factor for now.
    /// 
    /// # Arguments
    /// * `utilization` - Current pool utilization rate (scaled by 1e7)
    /// 
    /// # Returns
    /// The annualized supply rate (scaled by 1e7)
    pub fn get_supply_rate(env: Env, utilization: i128) -> i128 {
        let borrow_rate = Self::get_borrow_rate(env, utilization);
        // Supply rate = borrow_rate * utilization (simplified, no reserve factor)
        (borrow_rate * utilization) / SCALE
    }

    /// Get the current base rate
    pub fn get_base_rate(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::BaseRate).unwrap_or(0)
    }

    /// Get the slope1 parameter
    pub fn get_slope1(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Slope1).unwrap_or(0)
    }

    /// Get the slope2 parameter
    pub fn get_slope2(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Slope2).unwrap_or(0)
    }

    /// Get the optimal utilization rate
    pub fn get_optimal_utilization(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::OptimalUtilization).unwrap_or(8_000_000)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, InterestRateModel);
        let client = InterestRateModelClient::new(&env, &contract_id);

        // Initialize with:
        // - Base rate: 0%
        // - Slope1: 4% (400_000)
        // - Slope2: 75% (7_500_000) 
        // - Optimal: 80% (8_000_000)
        client.initialize(&0, &400_000, &7_500_000, &8_000_000);

        assert_eq!(client.get_base_rate(), 0);
        assert_eq!(client.get_slope1(), 400_000);
        assert_eq!(client.get_slope2(), 7_500_000);
        assert_eq!(client.get_optimal_utilization(), 8_000_000);
    }

    #[test]
    fn test_borrow_rate_below_optimal() {
        let env = Env::default();
        let contract_id = env.register_contract(None, InterestRateModel);
        let client = InterestRateModelClient::new(&env, &contract_id);

        // Base: 0%, Slope1: 4%, Slope2: 75%, Optimal: 80%
        client.initialize(&0, &400_000, &7_500_000, &8_000_000);

        // At 40% utilization (half of optimal)
        // Rate = 0% + (40% / 80%) * 4% = 2%
        let rate = client.get_borrow_rate(&4_000_000);
        assert_eq!(rate, 200_000); // 2%

        // At 80% utilization (optimal)
        // Rate = 0% + (80% / 80%) * 4% = 4%
        let rate = client.get_borrow_rate(&8_000_000);
        assert_eq!(rate, 400_000); // 4%
    }

    #[test]
    fn test_borrow_rate_above_optimal() {
        let env = Env::default();
        let contract_id = env.register_contract(None, InterestRateModel);
        let client = InterestRateModelClient::new(&env, &contract_id);

        // Base: 0%, Slope1: 4%, Slope2: 75%, Optimal: 80%
        client.initialize(&0, &400_000, &7_500_000, &8_000_000);

        // At 90% utilization
        // excess = (90% - 80%) / (100% - 80%) = 50%
        // Rate = 0% + 4% + 50% * 75% = 4% + 37.5% = 41.5%
        let rate = client.get_borrow_rate(&9_000_000);
        assert_eq!(rate, 4_150_000); // 41.5%

        // At 100% utilization
        // excess = (100% - 80%) / (100% - 80%) = 100%
        // Rate = 0% + 4% + 100% * 75% = 79%
        let rate = client.get_borrow_rate(&10_000_000);
        assert_eq!(rate, 7_900_000); // 79%
    }

    #[test]
    fn test_supply_rate() {
        let env = Env::default();
        let contract_id = env.register_contract(None, InterestRateModel);
        let client = InterestRateModelClient::new(&env, &contract_id);

        // Base: 0%, Slope1: 4%, Slope2: 75%, Optimal: 80%
        client.initialize(&0, &400_000, &7_500_000, &8_000_000);

        // At 80% utilization, borrow rate = 4%
        // Supply rate = 4% * 80% = 3.2%
        let supply_rate = client.get_supply_rate(&8_000_000);
        assert_eq!(supply_rate, 320_000); // 3.2%
    }
}

