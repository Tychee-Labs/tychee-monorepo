#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Events, Ledger}, Env, String as SorobanString, vec as soroban_vec};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TokenVault);
    let client = TokenVaultClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    
    env.mock_all_auths();
    client.initialize(&owner);
    
    assert_eq!(client.get_token_count(), 0);
    assert!(!client.is_paused());
}

#[test]
fn test_store_and_retrieve_token() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenVault);
    let client = TokenVaultClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    let user = Address::generate(&env);
    
    client.initialize(&owner);
    
    // Simulate encrypted payload (in real scenario, encrypted with ring AES-GCM)
    let encrypted_payload = Bytes::from_slice(&env, &[1, 2, 3, 4, 5, 6, 7, 8]);
    let token_hash = BytesN::from_array(&env, &[0u8; 32]);
    let last_4_digits = String::from_str(&env, "1234");
    let card_network = String::from_str(&env, "visa");
    
    // Set expiration to 1 year from now
    let expires_at = env.ledger().timestamp() + 31536000;
    
    let metadata = client.store_token(
        &user,
        &encrypted_payload,
        &token_hash,
        &last_4_digits,
        &card_network,
        &expires_at,
    );
    
    assert_eq!(metadata.user, user);
    assert_eq!(metadata.last_4_digits, last_4_digits);
    assert_eq!(metadata.card_network, card_network);
    assert_eq!(metadata.status, String::from_str(&env, "active"));
    assert_eq!(client.get_token_count(), 1);
    
    // Retrieve token
    let retrieved = client.retrieve_token(&user).unwrap();
    assert_eq!(retrieved.encrypted_payload, encrypted_payload);
    assert_eq!(retrieved.token_hash, token_hash);
}

#[test]
#[should_panic(expected = "Token already exists")]
fn test_store_duplicate_token() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenVault);
    let client = TokenVaultClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    let user = Address::generate(&env);
    
    client.initialize(&owner);
    
    let encrypted_payload = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    let token_hash = BytesN::from_array(&env, &[0u8; 32]);
    let last_4_digits = String::from_str(&env, "1234");
    let card_network = String::from_str(&env, "visa");
    let expires_at = env.ledger().timestamp() + 31536000;
    
    // Store first token
    client.store_token(&user, &encrypted_payload, &token_hash, &last_4_digits, &card_network, &expires_at);
    
    // Attempt to store duplicate - should panic
    client.store_token(&user, &encrypted_payload, &token_hash, &last_4_digits, &card_network, &expires_at);
}

#[test]
fn test_revoke_token() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenVault);
    let client = TokenVaultClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    let user = Address::generate(&env);
    
    client.initialize(&owner);
    
    let encrypted_payload = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    let token_hash = BytesN::from_array(&env, &[0u8; 32]);
    let last_4_digits = String::from_str(&env, "1234");
    let card_network = String::from_str(&env, "mastercard");
    let expires_at = env.ledger().timestamp() + 31536000;
    
    client.store_token(&user, &encrypted_payload, &token_hash, &last_4_digits, &card_network, &expires_at);
    
    // Revoke token
    let revoked = client.revoke_token(&user);
    assert!(revoked);
    
    let status = client.get_token_status(&user).unwrap();
    assert_eq!(status, String::from_str(&env, "revoked"));
}

#[test]
fn test_expired_token() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenVault);
    let client = TokenVaultClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    let user = Address::generate(&env);
    
    client.initialize(&owner);
    
    let encrypted_payload = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    let token_hash = BytesN::from_array(&env, &[0u8; 32]);
    let last_4_digits = String::from_str(&env, "5678");
    let card_network = String::from_str(&env, "rupay");
    
    // Set expiration to 1 second from now
    let expires_at = env.ledger().timestamp() + 1;
    
    client.store_token(&user, &encrypted_payload, &token_hash, &last_4_digits, &card_network, &expires_at);
    
    // Fast forward time by 2 seconds
    env.ledger().with_mut(|li| {
        li.timestamp += 2;
    });
    
    // Retrieve should return expired token
    let retrieved = client.retrieve_token(&user).unwrap();
    assert_eq!(retrieved.status, String::from_str(&env, "expired"));
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenVault);
    let client = TokenVaultClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    
    client.initialize(&owner);
    
    assert!(!client.is_paused());
    
    client.pause();
    assert!(client.is_paused());
    
    client.unpause();
    assert!(!client.is_paused());
}

#[test]
fn test_events() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenVault);
    let client = TokenVaultClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    let user = Address::generate(&env);
    
    client.initialize(&owner);
    
    let encrypted_payload = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    let token_hash = BytesN::from_array(&env, &[0u8; 32]);
    let last_4_digits = String::from_str(&env, "9999");
    let card_network = String::from_str(&env, "visa");
    let expires_at = env.ledger().timestamp() + 31536000;
    
    client.store_token(&user, &encrypted_payload, &token_hash, &last_4_digits, &card_network, &expires_at);
    
    // Verify events were emitted
    let events = env.events().all();
    assert!(events.len() > 0);
}
