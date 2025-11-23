-- =============================================================================
-- Oracle 23c AI Database Banner Fix for Debezium 2.7.4
-- =============================================================================
-- Problem: Debezium's version detection query uses LIKE 'Oracle Database%'
--          but Oracle 23c returns "Oracle AI Database" which doesn't match
-- Solution: We cannot override V$VERSION, so we must patch Debezium OR
--          use a different approach
-- =============================================================================

-- APPROACH 1: Grant DEBEZIUM user the ability to see the version
-- (Already done, but let's verify)

CONNECT SYSTEM/oracle@FREEPDB1

-- Verify current banner
SELECT banner FROM v$version WHERE ROWNUM = 1;

-- The banner shows: "Oracle AI Database 26ai Free Release 23.26.0.0.0..."
-- We cannot change this at database level without modifying Oracle binaries

-- APPROACH 2: Pre-set the version in config
-- This is what we did in the backend, but Debezium still validates by querying V$VERSION
-- during the connection test phase, BEFORE using the config parameter

EXIT;
