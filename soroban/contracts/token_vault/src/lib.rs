#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, String};

/// Storage keys
#[contracttype]
pub enum DataKey {
    TokenData(Address),     // User address -> encrypted token data
    Permissions(Address),   // User address -> access permissions
    Owner,                  // Contract owner
    TokenCount,             // Total tokens stored
}

/// Token metadata structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub user: Address,
    pub encrypted_payload: Bytes,  // Ring AES-GCM encrypted card data
    pub token_hash: BytesN<32>,    // SHA-256 hash for indexing
    pub last_4_digits: String,     // Last 4 digits for display
    pub card_network: String,      // visa, mastercard, rupay
    pub status: String,            // active, revoked, expired
    pub created_at: u64,           // Unix timestamp
    pub expires_at: u64,           // Unix timestamp
}

/// Access permission levels
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Permission {
    Owner,      // Full access
    Read,       // Can read own tokens
    Revoked,    // No access
}

#[contract]
pub struct TokenVault;

#[contractimpl]
impl TokenVault {
    /// Initialize the contract with an owner
    pub fn initialize(env: Env, owner: Address) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Already initialized");
        }
        
        owner.require_auth();
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::TokenCount, &0u32);
    }

    /// Store encrypted card token
    /// encrypted_payload: AES-GCM encrypted card data (ring library used client-side)
    /// token_hash: SHA-256 hash of the original card data for indexing
    pub fn store_token(
        env: Env,
        user: Address,
        encrypted_payload: Bytes,
        token_hash: BytesN<32>,
        last_4_digits: String,
        card_network: String,
        expires_at: u64,
    ) -> TokenMetadata {
        user.require_auth();

        // Check if token already exists
        if env.storage().persistent().has(&DataKey::TokenData(user.clone())) {
            panic!("Token already exists for this user");
        }

        let current_time = env.ledger().timestamp();
        
        if expires_at <= current_time {
            panic!("Expiration date must be in the future");
        }

        let metadata = TokenMetadata {
            user: user.clone(),
            encrypted_payload: encrypted_payload.clone(),
            token_hash: token_hash.clone(),
            last_4_digits: last_4_digits.clone(),
            card_network: card_network.clone(),
            status: String::from_str(&env, "active"),
            created_at: current_time,
            expires_at,
        };

        // Store token data (persistent storage for long-term retention)
        env.storage().persistent().set(&DataKey::TokenData(user.clone()), &metadata);
        
        // Set permission
        env.storage().persistent().set(&DataKey::Permissions(user.clone()), &Permission::Owner);

        // Increment token count
        let mut count: u32 = env.storage().instance().get(&DataKey::TokenCount).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::TokenCount, &count);

        // Emit event
        env.events().publish(
            (symbol_short!("store"), user.clone()),
            (token_hash, card_network, current_time)
        );

        metadata
    }

    /// Retrieve encrypted token (only owner can access)
    pub fn retrieve_token(env: Env, user: Address) -> Option<TokenMetadata> {
        user.require_auth();

        // Check permissions
        let permission: Option<Permission> = env.storage().persistent().get(&DataKey::Permissions(user.clone()));
        
        match permission {
            Some(Permission::Owner) | Some(Permission::Read) => {
                let metadata: Option<TokenMetadata> = env.storage().persistent().get(&DataKey::TokenData(user.clone()));
                
                if let Some(ref token) = metadata {
                    // Check if token is expired
                    let current_time = env.ledger().timestamp();
                    if current_time > token.expires_at {
                        // Auto-revoke expired tokens
                        let mut expired_token = token.clone();
                        expired_token.status = String::from_str(&env, "expired");
                        env.storage().persistent().set(&DataKey::TokenData(user.clone()), &expired_token);
                        return Some(expired_token);
                    }
                    
                    // Emit access event
                    env.events().publish(
                        (symbol_short!("access"), user),
                        current_time
                    );
                }
                
                metadata
            },
            _ => None
        }
    }

    /// Revoke token (user can revoke their own token)
    pub fn revoke_token(env: Env, user: Address) -> bool {
        user.require_auth();

        let metadata: Option<TokenMetadata> = env.storage().persistent().get(&DataKey::TokenData(user.clone()));
        
        if let Some(mut token) = metadata {
            token.status = String::from_str(&env, "revoked");
            env.storage().persistent().set(&DataKey::TokenData(user.clone()), &token);
            
            // Update permission
            env.storage().persistent().set(&DataKey::Permissions(user.clone()), &Permission::Revoked);
            
            // Emit revocation event
            env.events().publish(
                (symbol_short!("revoke"), user),
                env.ledger().timestamp()
            );
            
            true
        } else {
            false
        }
    }

    /// Update token permissions (owner only)
    pub fn update_permissions(env: Env, user: Address, permission: Permission) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();
        
        env.storage().persistent().set(&DataKey::Permissions(user.clone()), &permission);
        
        env.events().publish(
            (symbol_short!("perm"), user),
            env.ledger().timestamp()
        );
    }

    /// Get token count
    pub fn get_token_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TokenCount).unwrap_or(0)
    }

    /// Get token status (public - doesn't reveal encrypted data)
    pub fn get_token_status(env: Env, user: Address) -> Option<String> {
        let metadata: Option<TokenMetadata> = env.storage().persistent().get(&DataKey::TokenData(user));
        metadata.map(|m| m.status)
    }

    /// Emergency pause (owner only) - for security incidents
    pub fn pause(env: Env) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();
        
        env.storage().instance().set(&symbol_short!("paused"), &true);
        
        env.events().publish(
            (symbol_short!("pause"), owner),
            env.ledger().timestamp()
        );
    }

    /// Unpause (owner only)
    pub fn unpause(env: Env) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();
        
        env.storage().instance().set(&symbol_short!("paused"), &false);
        
        env.events().publish(
            (symbol_short!("unpause"), owner),
            env.ledger().timestamp()
        );
    }

    /// Check if contract is paused
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&symbol_short!("paused")).unwrap_or(false)
    }
}

#[cfg(test)]
mod test;
