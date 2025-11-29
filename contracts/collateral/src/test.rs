#![cfg(test)]

use super::{CollateralManager, CollateralManagerClient};
use soroban_sdk::{symbol_short, testutils::Address, Env};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CollateralManager);
    let client = CollateralManagerClient::new(&env, &contract_id);

    let collateral_asset = symbol_short!("XLM");
    let borrow_asset = symbol_short!("USDC");
    client.initialize(&collateral_asset, &borrow_asset);
}

