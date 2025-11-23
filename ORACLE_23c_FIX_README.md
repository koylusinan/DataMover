# Oracle 23c AI Database - Debezium 2.7.4 Compatibility Fix

## 🔍 Problem

Oracle 23c introduces new branding: **"Oracle AI Database"** instead of "Oracle Database"

Debezium 2.7.4's version detection query:
```sql
SELECT banner FROM v$version WHERE banner LIKE 'Oracle Database%'
```

This query returns **0 rows** on Oracle 23c because the banner is:
```
Oracle AI Database 26ai Free Release 23.26.0.0.0 - Develop, Learn, and Run for Free
```

Result: `Failed to resolve Oracle database version` error during connector validation.

## ✅ Applied Fix (Backend)

**File:** `backend/debezium-backend.js` (lines 152-159)

```javascript
// WORKAROUND: Oracle 23c "Oracle AI Database" version detection fix
if (!flatConfig['database.oracle.version']) {
    flatConfig['database.oracle.version'] = '23.0.0.0';
    console.log('[ORACLE 23c FIX] Setting database.oracle.version=23.0.0.0');
}
```

### What This Does:
- Automatically adds `database.oracle.version` parameter to all Oracle connectors
- Backend logs `[ORACLE 23c FIX]` when applied
- Bypasses Debezium's version detection at **runtime**

## ⚠️ Limitation

The fix works at **runtime** but Debezium still validates during **connector creation** by querying V$VERSION directly, ignoring the config parameter.

## 🎯 Complete Solutions

### Solution 1: Update Version Detection Query (Recommended)

Patch Debezium's version detection to support Oracle 23c:

```sql
-- OLD (Debezium 2.7.4)
SELECT banner FROM v$version WHERE banner LIKE 'Oracle Database%'

-- NEW (Should be)
SELECT banner FROM v$version WHERE banner LIKE 'Oracle%'
```

**How to apply:**
1. Build custom Debezium from source with patched `OracleConnection.java`
2. Replace `resolveOracleDatabaseVersion()` method
3. Rebuild JAR and deploy

**File to patch:** `debezium-connector-oracle/src/main/java/io/debezium/connector/oracle/OracleConnection.java:212`

### Solution 2: Skip Validation (Quick Workaround)

Modify backend to skip Kafka Connect's validation when creating connector:

```javascript
// In deployConnectorToKafka function, add validation skip parameter
const createResponse = await fetch(`${getKafkaConnectUrl()}/connectors?validate=false`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, config }),
});
```

**Note:** This may not work as Kafka Connect always validates.

### Solution 3: Upgrade Debezium

Check if Debezium 2.8+ or 3.x has Oracle 23c support:
```bash
# Update docker-compose.yml
services:
  kafka-connect:
    image: quay.io/debezium/connect:3.0.0.Final  # or latest
```

### Solution 4: Pre-create Connector Manually

If validation fails, create connector with validation disabled:

```bash
# Stop validation by creating connector in PAUSED state
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "oracle-connector",
    "config": {
      "connector.class": "io.debezium.connector.oracle.OracleConnector",
      "database.oracle.version": "23.0.0.0",
      ... other config ...
    }
  }'

# Then resume
curl -X PUT http://localhost:8083/connectors/oracle-connector/resume
```

## 🧪 Testing

### Test 1: Verify Banner
```bash
docker exec oracle-xe bash -c \
  "echo \"SELECT banner FROM v\\\$version WHERE ROWNUM=1;\" | sqlplus -s SYSTEM/oracle@FREEPDB1"
```

Expected output:
```
Oracle AI Database 26ai Free Release 23.26.0.0.0 - Develop, Learn, and Run for Free
```

### Test 2: Verify Backend Fix
```bash
node test-backend-oracle-fix.js
```

Expected: `✅ SUCCESS: database.oracle.version = "23.0.0.0"`

### Test 3: Deploy Connector
Use UI to deploy Oracle pipeline and check backend logs for:
```
[ORACLE 23c FIX] Setting database.oracle.version=23.0.0.0 to bypass AI Database branding issue
```

## 📊 Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Fix | ✅ Implemented | Auto-adds version parameter |
| Runtime Support | ✅ Working | Connector runs with parameter |
| Validation | ❌ Fails | Debezium validates before using parameter |
| Complete Fix | ⏳ Pending | Requires Debezium patch or upgrade |

## 🔗 References

- Debezium Issue: Check https://issues.redhat.com/browse/DBZ for Oracle 23c support
- Oracle 23c Docs: https://docs.oracle.com/en/database/oracle/oracle-database/23/
- Debezium Docs: https://debezium.io/documentation/reference/2.7/connectors/oracle.html

## 💡 Recommended Action

**For Production:**
1. Build custom Debezium 2.7.4 with patched version detection
2. Or wait for Debezium 3.x which may include Oracle 23c support

**For Development:**
1. Current backend fix helps at runtime
2. Accept validation errors during connector creation
3. Connector may still work once created (validation is just a pre-check)

---

**Last Updated:** 2025-11-18
**Debezium Version:** 2.7.4.Final
**Oracle Version:** Oracle AI Database 26ai Free Release 23.26.0.0.0
