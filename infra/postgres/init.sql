-- tEUR Database Schema
-- PostgreSQL initialization script

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_address VARCHAR(42),
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  tx_hash VARCHAR(66),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_user ON audit_log(user_address);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_tx_hash ON audit_log(tx_hash);

-- Wallet registry cache
CREATE TABLE IF NOT EXISTS wallets (
  address VARCHAR(42) PRIMARY KEY,
  wallet_type VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  kyc_hash VARCHAR(66),
  linked_bank_account VARCHAR(42),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallets_type ON wallets(wallet_type);
CREATE INDEX idx_wallets_active ON wallets(is_active);

-- IBAN to wallet address mapping (for ISO 20022 adapter)
CREATE TABLE IF NOT EXISTS iban_wallet_mapping (
  iban VARCHAR(34) PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL REFERENCES wallets(address),
  bic VARCHAR(11),
  account_holder_name VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_iban_wallet ON iban_wallet_mapping(wallet_address);

-- Transaction history
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  amount BIGINT NOT NULL,
  tx_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  block_number BIGINT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key VARCHAR(100) UNIQUE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_from ON transactions(from_address);
CREATE INDEX idx_transactions_to ON transactions(to_address);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX idx_transactions_type ON transactions(tx_type);
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key);

-- Conditional payments
CREATE TABLE IF NOT EXISTS conditional_payments (
  payment_id VARCHAR(66) PRIMARY KEY,
  payer VARCHAR(42) NOT NULL,
  payee VARCHAR(42) NOT NULL,
  amount BIGINT NOT NULL,
  condition_type VARCHAR(50) NOT NULL,
  condition_data VARCHAR(66),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  tx_hash VARCHAR(66)
);

CREATE INDEX idx_conditional_payments_payer ON conditional_payments(payer);
CREATE INDEX idx_conditional_payments_payee ON conditional_payments(payee);
CREATE INDEX idx_conditional_payments_status ON conditional_payments(status);
CREATE INDEX idx_conditional_payments_expires ON conditional_payments(expires_at);

-- API keys (for authentication)
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  institution_id VARCHAR(50) UNIQUE NOT NULL,
  institution_name VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_institution ON api_keys(institution_id);

-- Insert demo API keys (hashed with SHA256)
INSERT INTO api_keys (key_hash, institution_id, institution_name, role, is_active) VALUES
  (encode(digest('demo-ecb-key', 'sha256'), 'hex'), 'ecb-core', 'European Central Bank', 'OPERATOR', true),
  (encode(digest('demo-ncb-key', 'sha256'), 'hex'), 'ncb-de', 'Deutsche Bundesbank', 'NCB', true),
  (encode(digest('demo-bank-key', 'sha256'), 'hex'), 'bank-de-01', 'Deutsche Bank', 'BANK', true),
  (encode(digest('demo-psp-key', 'sha256'), 'hex'), 'psp-eu-01', 'European Payment Services', 'PSP', true)
ON CONFLICT (institution_id) DO NOTHING;

-- System metrics
CREATE TABLE IF NOT EXISTS system_metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  labels JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iban_mapping_updated_at BEFORE UPDATE ON iban_wallet_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for production)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teur;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO teur;
