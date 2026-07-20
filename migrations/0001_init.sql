PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('Developer', 'Admin', 'Owner'))
);

CREATE TABLE flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('Active', 'Deprecated')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE flag_states (
  flag_id TEXT NOT NULL REFERENCES flags (id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('Stage', 'Production')),
  enabled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (flag_id, brand, environment)
);

CREATE TABLE brand_configs (
  brand TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('Stage', 'Production')),
  config_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (brand, environment)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  brand TEXT,
  environment TEXT,
  flag_id TEXT,
  flag_name TEXT,
  before_val TEXT,
  after_val TEXT
);

CREATE TABLE history_snapshots (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  label TEXT NOT NULL,
  states_json TEXT NOT NULL
);

CREATE INDEX idx_audit_timestamp ON audit_log (timestamp DESC);
CREATE INDEX idx_history_brand_ts ON history_snapshots (brand, timestamp DESC);
