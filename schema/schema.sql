-- ============================================================
-- Memory-First System Design Agent — MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS memory_design_agent
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE memory_design_agent;

-- ─────────────────────────────────────────
-- Table: users
-- Tracks unique user identities
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_user_id  VARCHAR(128) NOT NULL UNIQUE,   -- e.g. "demo-user-1"
  display_name    VARCHAR(255) DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_public_user_id (public_user_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- Table: projects
-- One project per unique app idea context
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  title         VARCHAR(512) NOT NULL,
  latest_idea   TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- Table: design_runs
-- Every time the agent generates a design report
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS design_runs (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id            INT UNSIGNED NOT NULL,
  idea                  TEXT NOT NULL,
  final_report_json     LONGTEXT NOT NULL,     -- Full structured report (JSON)
  memory_recalled_json  TEXT DEFAULT NULL,     -- Hindsight memories recalled
  memory_learned_json   TEXT DEFAULT NULL,     -- New memories extracted
  model_used            VARCHAR(128) DEFAULT 'claude-sonnet-4-20250514',
  tokens_used           INT UNSIGNED DEFAULT 0,
  duration_ms           INT UNSIGNED DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_project_id (project_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- Table: hindsight_memory_cache
-- Local cache / fallback for Hindsight entries
-- (used when Hindsight cloud is unavailable)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hindsight_memory_cache (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  bank_id     VARCHAR(256) NOT NULL,             -- "user-{userId}"
  memory_key  VARCHAR(512) NOT NULL,
  memory_val  TEXT NOT NULL,
  source_run  INT UNSIGNED DEFAULT NULL,         -- design_run that produced this
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_run) REFERENCES design_runs(id) ON DELETE SET NULL,
  INDEX idx_bank_id (bank_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- Seed: example user for demos
-- ─────────────────────────────────────────
INSERT IGNORE INTO users (public_user_id, display_name)
VALUES ('demo-user-1', 'Demo Architect');
