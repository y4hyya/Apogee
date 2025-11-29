#![cfg(test)]

use super::{PriceOracle, PriceOracleClient};
use soroban_sdk::{symbol_short, Env};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PriceOracle);
    let client = PriceOracleClient::new(&env, &contract_id);

    client.initialize();
}

#[test]
fn test_set_and_get_price() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PriceOracle);
    let client = PriceOracleClient::new(&env, &contract_id);

    client.initialize();

    let asset = symbol_short!("XLM");
    let price: u128 = 100; // $1.00 scaled by 100
    client.set_price(&asset, &price);

    let retrieved_price = client.get_price(&asset);
    assert_eq!(retrieved_price, price);
}

