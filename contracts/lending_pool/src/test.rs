#![cfg(test)]

use super::{LendingPool, LendingPoolClient};
use soroban_sdk::{symbol_short, testutils::Address, Env};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingPool);
    let client = LendingPoolClient::new(&env, &contract_id);

    let asset = symbol_short!("USDC");
    client.initialize(&asset);
}

#[test]
fn test_deposit() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingPool);
    let client = LendingPoolClient::new(&env, &contract_id);

    let asset = symbol_short!("USDC");
    client.initialize(&asset);

    let from = Address::generate(&env);
    let amount: u128 = 1000;
    let shares = client.deposit(&from, &amount);
    
    assert!(shares > 0);
}

