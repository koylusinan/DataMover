# Troubleshooting Guide

Common issues and solutions for local Debezium setup.

## Quick Diagnostics

Run this command to test everything:

```bash
./test-debezium.sh
```

Or manually:

```bash
# Test Debezium Backend
curl http://localhost:5002/api/health

# Test Kafka Connect
curl http://127.0.0.1:8083/

# Test Integration
curl http://localhost:5002/api/kafka-connect/info
```

---

## Common Issues

### Issue 1: "Cannot connect to Debezium Backend"

**Symptoms:**
```
curl: (7) Failed to connect to localhost port 5002
```

**Diagnosis:**
```bash
# Check if backend is running
lsof -i :5002

# Check backend logs
npm run debezium:dev
```

**Solutions:**

1. **Backend not started:**
   ```bash
   npm run debezium:dev
   ```

2. **Port already in use:**
   ```bash
   # Find what's using port 5002
   lsof -i :5002

   # Kill the process
   kill -9 <PID>

   # Or use different port
   DEBEZIUM_BACKEND_PORT=5003 npm run debezium:dev
   ```

3. **Wrong environment variable:**
   ```bash
   # Check .env
   cat .env | grep DEBEZIUM_BACKEND_PORT

   # Should be:
   DEBEZIUM_BACKEND_PORT=5002
   ```

---

### Issue 2: "Kafka Connect not available"

**Symptoms:**
```json
{
  "success": false,
  "error": "Kafka Connect not available"
}
```

**Diagnosis:**
```bash
# Test Kafka Connect directly
curl http://127.0.0.1:8083/

# Check if running
docker ps | grep kafka-connect
```

**Solutions:**

1. **Kafka Connect not running:**
   ```bash
   # Start with Docker Compose
   docker-compose up -d kafka-connect

   # Or from docker-compose.debezium.yml
   docker-compose -f docker-compose.debezium.yml up -d
   ```

2. **Wrong URL in backend:**
   ```bash
   # Check backend env
   cat .env | grep KAFKA_CONNECT_URL

   # Should be:
   KAFKA_CONNECT_URL=http://127.0.0.1:8083

   # If using Docker network:
   KAFKA_CONNECT_URL=http://kafka-connect:8083
   ```

3. **Kafka Connect starting up:**
   ```bash
   # Wait 30-60 seconds, then check logs
   docker logs kafka-connect

   # Look for:
   # "Kafka Connect started"
   ```

---

### Issue 3: "Failed to deploy pipeline"

**Symptoms:**
```json
{
  "success": false,
  "error": "Failed to create connector"
}
```

**Diagnosis:**
```bash
# Check Kafka Connect logs
docker logs kafka-connect | tail -50

# Check connector config
curl http://localhost:5002/api/kafka-connect/connector-plugins
```

**Solutions:**

1. **Missing connector plugin:**
   ```bash
   # List available plugins
   curl http://127.0.0.1:8083/connector-plugins

   # Install Debezium connectors
   # Add to Dockerfile or use Debezium Docker image
   ```

2. **Invalid configuration:**
   ```bash
   # Validate config before deploying
   curl -X PUT http://localhost:5002/api/kafka-connect/connector-plugins/io.debezium.connector.oracle.OracleConnector/config/validate \
     -H "Content-Type: application/json" \
     -d @connector-config.json
   ```

3. **Database not accessible:**
   ```bash
   # Test database connection
   curl -X POST http://localhost:5001/api/test-connection \
     -H "Content-Type: application/json" \
     -d '{
       "connectionType": "oracle",
       "host": "oracle.example.com",
       "port": 1521,
       "username": "user",
       "password": "pass",
       "serviceName": "ORCLPDB1"
     }'
   ```

---

### Issue 4: "Database connection failed"

**Symptoms:**
```
ECONNREFUSED 127.0.0.1:5432
```

**Diagnosis:**
```bash
# Test database connection
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Check backend logs
npm run debezium:dev
```

**Solutions:**

1. **Wrong database password:**
   ```bash
   # Update .env
   SUPABASE_DB_PASSWORD=correct-password-here

   # Restart backend
   npm run debezium:dev
   ```

2. **Firewall blocking:**
   ```bash
   # Check if port 5432 is accessible
   telnet db.xxx.supabase.co 5432

   # Or
   nc -zv db.xxx.supabase.co 5432
   ```

3. **SSL configuration:**
   ```bash
   # Try different SSL modes
   SUPABASE_DB_SSL=disable  # For local testing
   SUPABASE_DB_SSL=require  # For production
   ```

---

### Issue 5: "CORS error in browser"

**Symptoms:**
```
Access to fetch at 'http://localhost:5002' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

**Diagnosis:**
Check browser console for exact CORS error.

**Solutions:**

1. **Update CORS origins:**
   ```bash
   # In .env
   BACKEND_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174

   # Restart backend
   npm run debezium:dev
   ```

2. **Check backend CORS config:**
   ```javascript
   // backend/debezium-backend.js should have:
   await server.register(cors, {
     origin: ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',') : true,
   });
   ```

---

### Issue 6: "Connector stuck in FAILED state"

**Symptoms:**
```json
{
  "connector": { "state": "FAILED", "worker_id": "connect:8083" },
  "tasks": []
}
```

**Diagnosis:**
```bash
# Get connector status
curl http://localhost:5002/api/kafka-connect/connectors/my-connector/status

# Check Kafka Connect logs
docker logs kafka-connect | grep ERROR
```

**Solutions:**

1. **Restart connector:**
   ```bash
   curl -X POST http://localhost:5002/api/kafka-connect/connectors/my-connector/restart
   ```

2. **Restart only failed tasks:**
   ```bash
   curl -X POST "http://localhost:5002/api/kafka-connect/connectors/my-connector/restart?onlyFailed=true"
   ```

3. **Delete and recreate:**
   ```bash
   # Delete
   curl -X DELETE http://localhost:5002/api/kafka-connect/connectors/my-connector

   # Recreate via UI or API
   ```

4. **Check connector logs:**
   ```bash
   docker logs kafka-connect 2>&1 | grep "my-connector"
   ```

---

### Issue 7: "Task execution failed"

**Symptoms:**
```json
{
  "tasks": [
    {
      "id": 0,
      "state": "FAILED",
      "trace": "org.apache.kafka.connect.errors.ConnectException: ..."
    }
  ]
}
```

**Solutions:**

1. **Check task trace:**
   ```bash
   curl http://localhost:5002/api/kafka-connect/connectors/my-connector/tasks/0/status
   ```

2. **Common errors:**
   - **"Table not found"** → Check table.include.list
   - **"Access denied"** → Check database permissions
   - **"Unknown column"** → Schema changed, restart connector
   - **"Connection refused"** → Database not accessible

3. **Restart specific task:**
   ```bash
   curl -X POST http://localhost:5002/api/kafka-connect/connectors/my-connector/tasks/0/restart
   ```

---

### Issue 8: "Pipeline shows 'ready' but can't deploy"

**Symptoms:**
Pipeline status is "ready" but deploy button doesn't work.

**Solutions:**

1. **Check browser console:**
   Open DevTools (F12) → Console → Look for errors

2. **Check network requests:**
   DevTools → Network → Filter: Fetch/XHR → Look for failed requests

3. **Verify environment variable:**
   ```javascript
   // In browser console:
   console.log(import.meta.env.VITE_DEBEZIUM_BACKEND_URL)

   // Should print:
   // http://localhost:5002
   ```

4. **Rebuild frontend:**
   ```bash
   # Environment variables are embedded at build time
   npm run build

   # Or restart dev server
   npm run dev
   ```

---

### Issue 9: "No connectors showing in Kafka Connect"

**Diagnosis:**
```bash
# Check connectors
curl http://127.0.0.1:8083/connectors

# Should return array of connector names
```

**Solutions:**

1. **Deploy hasn't been called:**
   - Create pipeline in UI
   - Click "Deploy Pipeline"

2. **Check deployment logs:**
   ```bash
   # In Debezium backend terminal
   # Look for deployment success/failure
   ```

3. **Manually create connector:**
   ```bash
   curl -X POST http://127.0.0.1:8083/connectors \
     -H "Content-Type: application/json" \
     -d '{
       "name": "test-connector",
       "config": {
         "connector.class": "io.debezium.connector.oracle.OracleConnector",
         "database.hostname": "oracle.example.com",
         "database.port": "1521",
         "database.user": "debezium",
         "database.password": "secret",
         "database.dbname": "ORCLPDB1",
         "database.server.name": "oracle-server",
         "tasks.max": "1"
       }
     }'
   ```

---

### Issue 10: "High memory usage"

**Symptoms:**
Kafka Connect or Node.js using too much memory.

**Solutions:**

1. **Limit Node.js memory:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=2048" npm run debezium:dev
   ```

2. **Limit Kafka Connect memory:**
   ```yaml
   # docker-compose.yml
   kafka-connect:
     environment:
       KAFKA_HEAP_OPTS: "-Xms512M -Xmx2G"
   ```

3. **Reduce connector tasks:**
   ```json
   {
     "tasks.max": "1"  // Reduce from higher number
   }
   ```

---

## Useful Commands

### Check Service Status

```bash
# Debezium Backend
curl http://localhost:5002/api/health

# Kafka Connect
curl http://127.0.0.1:8083/

# Frontend
curl http://localhost:5173

# Registry Backend
curl http://localhost:5001/api/health
```

### List Everything

```bash
# List connectors
curl http://localhost:5002/api/kafka-connect/connectors

# List connector plugins
curl http://localhost:5002/api/kafka-connect/connector-plugins

# List pipelines (from database)
psql "postgresql://..." -c "SELECT id, name, status FROM pipelines;"
```

### Monitoring

```bash
# Watch connector status
watch -n 2 'curl -s http://localhost:5002/api/kafka-connect/connectors'

# Watch Kafka Connect logs
docker logs -f kafka-connect

# Watch backend logs
npm run debezium:dev  # Terminal output
```

### Cleanup

```bash
# Delete all connectors
for conn in $(curl -s http://127.0.0.1:8083/connectors | jq -r '.[]'); do
  curl -X DELETE http://127.0.0.1:8083/connectors/$conn
  echo "Deleted $conn"
done

# Reset Kafka Connect (nuclear option)
docker-compose down -v
docker-compose up -d
```

---

## Getting Help

### Collect Diagnostic Information

```bash
# Save to file
./test-debezium.sh > diagnostic.txt 2>&1

# Add logs
echo "=== Backend Logs ===" >> diagnostic.txt
# Copy last 50 lines from backend terminal

echo "=== Kafka Connect Logs ===" >> diagnostic.txt
docker logs kafka-connect --tail 50 >> diagnostic.txt

echo "=== Environment ===" >> diagnostic.txt
cat .env >> diagnostic.txt
```

### Check Versions

```bash
# Node.js
node --version

# npm
npm --version

# Docker
docker --version

# Kafka Connect
curl -s http://127.0.0.1:8083/ | jq '.version'
```

---

## Prevention

### Pre-flight Checklist

Before starting development:

- [ ] `.env` file configured
- [ ] Database password set
- [ ] Kafka Connect running
- [ ] All environment variables correct
- [ ] Ports 5001, 5002, 5173, 8083 available
- [ ] Node modules installed (`npm install`)

### Health Check Script

Add to your startup script:

```bash
#!/bin/bash
./test-debezium.sh || exit 1
npm run dev &
npm run backend:dev &
npm run debezium:dev &
wait
```

---

## Still Having Issues?

1. Check all logs (backend, Kafka Connect, frontend console)
2. Run `./test-debezium.sh` and share output
3. Verify all environment variables
4. Try restarting all services
5. Check Docker resources (memory, CPU)

If issue persists, provide:
- Output of `./test-debezium.sh`
- Backend terminal logs
- Kafka Connect logs (`docker logs kafka-connect`)
- Browser console errors (F12 → Console)
- `.env` file (with passwords removed)
