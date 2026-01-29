#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, String, Vec};

/// Account abstraction modes
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AAMode {
    Standard,       // No AA - user pays gas
    Sponsored,      // Gas sponsored by sponsor
    SessionKey,     // Temporary session key
    MultiSig,       // Multi-signature required
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Mode(Address),          // User -> AA mode
    Sponsor(Address),       // User -> sponsor address
    SessionKey(Address),    // User -> session keys
    Signers(Address),       // User -> multi-sig signers
    Threshold(Address),     // User -> multi-sig threshold
    GasPool,                // Total gas pool for sponsorship
    Owner,                  // Contract owner
}

/// Session key data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SessionKey {
    pub key: BytesN<32>,
    pub expires_at: u64,
    pub permissions: Vec<String>,  // List of allowed operations
}

#[contract]
pub struct AccountAbstraction;

#[contractimpl]
impl AccountAbstraction {
    /// Initialize the contract
    pub fn initialize(env: Env, owner: Address, initial_gas_pool: i128) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Already initialized");
        }
        
        owner.require_auth();
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::GasPool, &initial_gas_pool);
    }

    /// Set AA mode for user
    pub fn set_mode(env: Env, user: Address, mode: AAMode) {
        user.require_auth();
        env.storage().persistent().set(&DataKey::Mode(user.clone()), &mode);
        
        env.events().publish(
            (symbol_short!("aa_mode"), user),
            mode
        );
    }

    /// Get AA mode for user
    pub fn get_mode(env: Env, user: Address) -> AAMode {
        env.storage().persistent()
            .get(&DataKey::Mode(user))
            .unwrap_or(AAMode::Standard)
    }

    /// Set gas sponsor for user
    pub fn set_sponsor(env: Env, user: Address, sponsor: Address) {
        sponsor.require_auth();
        
        env.storage().persistent().set(&DataKey::Sponsor(user.clone()), &sponsor);
        env.storage().persistent().set(&DataKey::Mode(user.clone()), &AAMode::Sponsored);
        
        env.events().publish(
            (symbol_short!("sponsor"), user),
            sponsor
        );
    }

    /// Add session key (temporary key for gasless tx)
    pub fn add_session_key(
        env: Env,
        user: Address,
        session_key: BytesN<32>,
        duration: u64,
        permissions: Vec<String>,
    ) {
        user.require_auth();
        
        let expires_at = env.ledger().timestamp() + duration;
        
        let key_data = SessionKey {
            key: session_key,
            expires_at,
            permissions,
        };
        
        // Store session key
        let mut session_keys: Vec<SessionKey> = env.storage().persistent()
            .get(&DataKey::SessionKey(user.clone()))
            .unwrap_or(Vec::new(&env));
        
        session_keys.push_back(key_data);
        env.storage().persistent().set(&DataKey::SessionKey(user.clone()), &session_keys);
        
        // Update mode
        env.storage().persistent().set(&DataKey::Mode(user.clone()), &AAMode::SessionKey);
        
        env.events().publish(
            (symbol_short!("session"), user),
            expires_at
        );
    }

    /// Verify session key
    pub fn verify_session_key(env: Env, user: Address, key: BytesN<32>) -> bool {
        let session_keys: Option<Vec<SessionKey>> = env.storage().persistent()
            .get(&DataKey::SessionKey(user.clone()));
        
        if let Some(keys) = session_keys {
            let current_time = env.ledger().timestamp();
            
            for i in 0..keys.len() {
                if let Some(sk) = keys.get(i) {
                    if sk.key == key && current_time < sk.expires_at {
                        return true;
                    }
                }
            }
        }
        
        false
    }

    /// Setup multi-sig
    pub fn setup_multisig(
        env: Env,
        user: Address,
        signers: Vec<Address>,
        threshold: u32,
    ) {
        user.require_auth();
        
        if threshold == 0 || threshold > signers.len() {
            panic!("Invalid threshold");
        }
        
        env.storage().persistent().set(&DataKey::Signers(user.clone()), &signers);
        env.storage().persistent().set(&DataKey::Threshold(user.clone()), &threshold);
        env.storage().persistent().set(&DataKey::Mode(user.clone()), &AAMode::MultiSig);
        
        env.events().publish(
            (symbol_short!("multisig"), user),
            (threshold, signers.len())
        );
    }

    /// Verify multi-sig
    pub fn verify_multisig(env: Env, user: Address, signatures: Vec<Address>) -> bool {
        let signers: Option<Vec<Address>> = env.storage().persistent().get(&DataKey::Signers(user.clone()));
        let threshold: Option<u32> = env.storage().persistent().get(&DataKey::Threshold(user.clone()));
        
        if let (Some(valid_signers), Some(required_threshold)) = (signers, threshold) {
            let mut valid_count = 0u32;
            
            for i in 0..signatures.len() {
                if let Some(sig_addr) = signatures.get(i) {
                    // Check if signer is in valid signers list
                    for j in 0..valid_signers.len() {
                        if let Some(valid_addr) = valid_signers.get(j) {
                            if sig_addr == valid_addr {
                                valid_count += 1;
                                break;
                            }
                        }
                    }
                }
            }
            
            valid_count >= required_threshold
        } else {
            false
        }
    }

    /// Execute meta-transaction (gas sponsored)
    pub fn execute_metatx(
        env: Env,
        user: Address,
        target: Address,
        function: String,
        args: Bytes,
    ) -> Bytes {
        // Verify AA mode allows meta-tx
        let mode = Self::get_mode(env.clone(), user.clone());
        
        match mode {
            AAMode::Sponsored => {
                // Verify sponsor exists
                let sponsor: Option<Address> = env.storage().persistent().get(&DataKey::Sponsor(user.clone()));
                if sponsor.is_none() {
                    panic!("No sponsor set");
                }
            },
            AAMode::SessionKey => {
                // Session key verification done separately
            },
            _ => {
                panic!("AA mode does not support meta-tx");
            }
        }
        
        // Deduct from gas pool
        let mut gas_pool: i128 = env.storage().instance().get(&DataKey::GasPool).unwrap_or(0);
        let gas_cost = 1000i128; // Simplified gas cost
        
        if gas_pool < gas_cost {
            panic!("Insufficient gas pool");
        }
        
        gas_pool -= gas_cost;
        env.storage().instance().set(&DataKey::GasPool, &gas_pool);
        
        // Emit meta-tx event
        env.events().publish(
            (symbol_short!("metatx"), user),
            (target, function, env.ledger().timestamp())
        );
        
        // Return empty bytes (actual execution would happen here)
        Bytes::new(&env)
    }

    /// Add funds to gas pool (owner only)
    pub fn fund_gas_pool(env: Env, amount: i128) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();
        
        let mut gas_pool: i128 = env.storage().instance().get(&DataKey::GasPool).unwrap_or(0);
        gas_pool += amount;
        env.storage().instance().set(&DataKey::GasPool, &gas_pool);
        
        env.events().publish(
            (symbol_short!("fund"), owner),
            amount
        );
    }

    /// Get gas pool balance
    pub fn get_gas_pool(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::GasPool).unwrap_or(0)
    }
}
