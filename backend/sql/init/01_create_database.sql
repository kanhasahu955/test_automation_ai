-- =============================================================================
-- QualityForge AI — local-MySQL bootstrap.
-- Run this ONCE against your locally-installed MySQL to create the database
-- and the application user that `make api` / `make worker` will connect with.
--
-- It's safe to re-run: every statement is idempotent.
--
-- Run via the helper:
--
--     make db-create-local                                      # uses root w/ no password
--     make db-create-local MYSQL_LOCAL_ROOT_PASSWORD=secret      # if root is protected
--
-- Or directly:
--
--     mysql -u root -p < backend/sql/init/01_create_database.sql
--
-- Defaults below match `backend/.env.host`. Change them in BOTH places if
-- you want different credentials.
-- =============================================================================

-- 1) Database -----------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `qualityforge`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 2) Application user (loopback only) -----------------------------------------
--    MySQL 8 distinguishes 'qfuser'@'localhost' from 'qfuser'@'127.0.0.1';
--    PyMySQL connects over TCP so '127.0.0.1' is the one we MUST grant.
--    We create both for convenience (CLI access uses 'localhost' over socket).
CREATE USER IF NOT EXISTS 'qfuser'@'localhost'  IDENTIFIED BY 'qfpass';
CREATE USER IF NOT EXISTS 'qfuser'@'127.0.0.1'  IDENTIFIED BY 'qfpass';

-- 3) Privileges ---------------------------------------------------------------
GRANT ALL PRIVILEGES ON `qualityforge`.* TO 'qfuser'@'localhost';
GRANT ALL PRIVILEGES ON `qualityforge`.* TO 'qfuser'@'127.0.0.1';

FLUSH PRIVILEGES;

-- 4) Sanity ------------------------------------------------------------------
SELECT 'qualityforge database ready' AS status;
