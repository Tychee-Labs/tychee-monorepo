-- Tychee Database Schema for Vercel Postgres

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User accounts + wallet binding
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  account_abstraction_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Encrypted card token records
CREATE TABLE card_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,  -- Hash of encrypted token (indexable)
  encrypted_payload BYTEA NOT NULL,  -- Encrypted PAN+CVV+Exp (ring AES-GCM)
  soroban_contract_address TEXT,     -- Reference to on-chain token contract
  soroban_transaction_id TEXT,       -- Stellar transaction ID
  status TEXT DEFAULT 'active',      -- active, revoked, expired
  card_network TEXT,                 -- visa, mastercard, rupay, etc.
  last_4_digits TEXT,                -- Last 4 digits for display
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_card_tokens_user_id ON card_tokens(user_id);
CREATE INDEX idx_card_tokens_status ON card_tokens(status);
CREATE INDEX idx_card_tokens_token_hash ON card_tokens(token_hash);

-- Points/rewards ledger
CREATE TABLE rewards_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  points INT NOT NULL,
  tx_type TEXT NOT NULL,  -- earn, redeem, transfer, bonus
  reference_id TEXT,       -- Reference to transaction/offer
  description TEXT,
  metadata JSONB,          -- Additional context
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rewards_user_id ON rewards_ledger(user_id);
CREATE INDEX idx_rewards_created_at ON rewards_ledger(created_at DESC);

-- User points balance (materialized view for performance)
CREATE TABLE user_points_balance (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INT DEFAULT 0,
  tier TEXT DEFAULT 'bronze',  -- bronze, silver, gold, platinum
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product/service catalog
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  category TEXT,           -- dining, travel, shopping, etc.
  partner_id UUID REFERENCES partners(id),
  image_url TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_address TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_partner ON products(partner_id);
CREATE INDEX idx_products_location ON products(location_lat, location_lng);

-- Vouchers
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT,      -- percent, fixed, points
  discount_value DECIMAL(10,2),
  min_purchase DECIMAL(10,2),
  max_discount DECIMAL(10,2),
  partner_id UUID REFERENCES partners(id),
  product_id UUID REFERENCES products(id),
  user_id UUID REFERENCES users(id),  -- NULL if unclaimed
  soroban_voucher_id TEXT,  -- On-chain voucher token ID
  total_quantity INT,
  claimed_quantity INT DEFAULT 0,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vouchers_user ON vouchers(user_id);
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_valid ON vouchers(valid_from, valid_until);

-- Spend data (aggregated for ML/research)
CREATE TABLE spend_clusters (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,  -- e.g., "dining", "travel", "shopping"
  subcategory TEXT,
  total_spend DECIMAL(12,2) DEFAULT 0,
  transaction_count INT DEFAULT 0,
  avg_transaction DECIMAL(12,2),
  month_year DATE NOT NULL,  -- YYYY-MM-01 for bucketing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category, month_year)
);

CREATE INDEX idx_spend_clusters_user ON spend_clusters(user_id);
CREATE INDEX idx_spend_clusters_month ON spend_clusters(month_year DESC);

-- Individual transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_token_id UUID REFERENCES card_tokens(id),
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  category TEXT,
  subcategory TEXT,
  merchant_name TEXT,
  merchant_id TEXT,
  description TEXT,
  soroban_tx_id TEXT,      -- On-chain transaction ID
  status TEXT DEFAULT 'completed',  -- pending, completed, failed
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_card ON transactions(card_token_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- Partner integrations
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  category TEXT,
  api_key TEXT UNIQUE,
  webhook_url TEXT,
  commission_rate DECIMAL(5,2),  -- Percentage
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_address TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_partners_slug ON partners(slug);
CREATE INDEX idx_partners_category ON partners(category);

-- Partner analytics
CREATE TABLE partner_analytics (
  id BIGSERIAL PRIMARY KEY,
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_transactions INT DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_commission DECIMAL(12,2) DEFAULT 0,
  unique_users INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_id, date)
);

CREATE INDEX idx_partner_analytics_partner ON partner_analytics(partner_id);
CREATE INDEX idx_partner_analytics_date ON partner_analytics(date DESC);

-- ZK proofs table (for spend attestations)
CREATE TABLE zk_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL,  -- spend_threshold, category_spend, etc.
  proof_data BYTEA NOT NULL,
  public_inputs JSONB,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_zk_proofs_user ON zk_proofs(user_id);
CREATE INDEX idx_zk_proofs_type ON zk_proofs(proof_type);

-- Audit log for compliance
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,  -- token_create, token_revoke, transaction, etc.
  entity_type TEXT,      -- card_token, transaction, etc.
  entity_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spend_clusters_updated_at BEFORE UPDATE ON spend_clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
