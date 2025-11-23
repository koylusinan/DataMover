# CDCStream Setup Guide

Complete guide for setting up and running the CDCStream application with Debezium integration.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Variables:**

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Database Connection (Backend)
SUPABASE_DB_HOST=db.your-project.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-password
SUPABASE_DB_SSL=require

# Backend URLs
VITE_BACKEND_URL=http://localhost:5001
VITE_DEBEZIUM_BACKEND_URL=http://localhost:5002

# Kafka Connect
KAFKA_CONNECT_URL=http://127.0.0.1:8083
```

### 3. Start Services

You need **3 terminals** for full operation:

**Terminal 1 - Frontend:**
```bash
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 - Registry Backend:**
```bash
npm run backend:dev
# Runs on http://localhost:5001
```

**Terminal 3 - Debezium Backend:**
```bash
npm run debezium:dev
# Runs on http://localhost:5002
```

### 4. Verify Setup

**Check Frontend:**
```bash
curl http://localhost:5173
```

**Check Registry Backend:**
```bash
curl http://localhost:5001/api/health
# {"status":"ok"}
```

**Check Debezium Backend:**
```bash
curl http://localhost:5002/api/health
# {"status":"ok","kafkaConnect":"http://127.0.0.1:8083"}
```

**Check Kafka Connect:**
```bash
curl http://127.0.0.1:8083/
# {"version":"3.5.0",...}
```

---

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │  React + TypeScript + Vite
│   (Port 5173)   │  • Pipeline UI
│                 │  • Wizard
└────────┬────────┘  • Monitoring
         │
    ┌────┴────────────────────────────┐
    │                                 │
┌───▼────────┐    ┌──────────┐    ┌──▼──────────────┐
│  Registry  │    │ Debezium │    │   Supabase      │
│  Backend   │    │ Backend  │    │   PostgreSQL    │
│ (Port 5001)│    │(Port 5002)│◄───┤                 │
│            │    │          │    │ • Pipelines     │
│ • Oracle   │    │ • Kafka  │    │ • Connectors    │
│   Test     │    │  Connect │    │ • Logs          │
│ • Postgres │    │  Proxy   │    │ • Registry      │
│   List     │    │ • Deploy │    │                 │
│ • Registry │    │ • Monitor│    │                 │
│ • Validate │    │          │    │                 │
└────────────┘    └────┬─────┘    └─────────────────┘
                       │
              ┌────────▼────────┐
              │ Kafka Connect   │
              │  (Port 8083)    │
              │                 │
              │ • Debezium      │
              │   Connectors    │
              │ • JDBC Sink     │
              └─────────────────┘
```

---

## Service Responsibilities

### Frontend (Port 5173)
- Pipeline creation wizard
- Connector configuration UI
- Status monitoring dashboard
- Real-time updates

### Registry Backend (Port 5001)
- Oracle connection testing (native driver)
- PostgreSQL table listing
- Connector registry management
- Version control
- Schema validation
- Policy checks

### Debezium Backend (Port 5002)
- Kafka Connect REST API proxy
- Pipeline deployment
- Connector lifecycle (start/pause/restart)
- Status monitoring
- Task management
- Configuration validation

### Supabase PostgreSQL
- Pipeline metadata storage
- Connector configurations
- Version history
- Deployment records
- Logs and metrics

### Kafka Connect (Port 8083)
- Debezium source connectors
- JDBC sink connectors
- Change data capture
- Data streaming

---

## Development Workflow

### Creating a Pipeline

1. **Frontend:** User creates pipeline via wizard
2. **Registry Backend:** Validates connector config
3. **Supabase:** Stores pipeline metadata
4. **Debezium Backend:** Deploys to Kafka Connect
5. **Kafka Connect:** Creates and runs connectors

### Starting a Pipeline

1. **Frontend:** User clicks "Start"
2. **Debezium Backend:** Calls Kafka Connect resume API
3. **Kafka Connect:** Resumes connectors
4. **Supabase:** Updates pipeline status to "running"

### Monitoring

1. **Debezium Backend:** Polls Kafka Connect status
2. **Supabase:** Stores metrics and logs
3. **Frontend:** Displays real-time status

---

## API Endpoints Summary

### Registry Backend (Port 5001)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/test-connection` | POST | Test Oracle connection |
| `/api/list-tables` | POST | List database tables |
| `/api/oracle/list-tables` | POST | List Oracle tables |
| `/api/registry/connectors/:name/versions` | POST | Create version |
| `/api/registry/connectors/:name/versions/:version/activate` | POST | Activate version |
| `/api/registry/deployments` | POST | Create deployment |
| `/api/registry/deployments/:id/apply` | POST | Apply deployment |

### Debezium Backend (Port 5002)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/kafka-connect/info` | GET | Cluster info |
| `/api/kafka-connect/connectors` | GET | List all connectors |
| `/api/kafka-connect/connectors/:name` | GET | Get connector |
| `/api/kafka-connect/connectors/:name/status` | GET | Get status |
| `/api/kafka-connect/connectors` | POST | Create connector |
| `/api/kafka-connect/connectors/:name/config` | PUT | Update config |
| `/api/kafka-connect/connectors/:name` | DELETE | Delete connector |
| `/api/kafka-connect/connectors/:name/pause` | PUT | Pause connector |
| `/api/kafka-connect/connectors/:name/resume` | PUT | Resume connector |
| `/api/kafka-connect/connectors/:name/restart` | POST | Restart connector |
| `/api/pipelines/:id/deploy` | POST | Deploy pipeline |
| `/api/pipelines/:id/start` | POST | Start pipeline |
| `/api/pipelines/:id/pause` | POST | Pause pipeline |
| `/api/pipelines/:id/status` | GET | Get pipeline status |

---

## Database Setup

### Apply Migrations

All migrations are in `supabase/migrations/`. Apply them via Supabase CLI or Dashboard:

```bash
supabase db push
```

**Or manually via SQL Editor in Supabase Dashboard.**

### Key Tables

- `pipelines` - Pipeline configurations
- `pipeline_connectors` - Source and sink connectors
- `connectors` - Registry connectors
- `connector_versions` - Version history
- `deployments` - Deployment records
- `pipeline_restore_staging` - Restore staging area

---

## Kafka Connect Setup

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - 2181:2181

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    ports:
      - 9092:9092

  kafka-connect:
    image: debezium/connect:2.4
    depends_on:
      - kafka
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: 1
      CONFIG_STORAGE_TOPIC: connect_configs
      OFFSET_STORAGE_TOPIC: connect_offsets
      STATUS_STORAGE_TOPIC: connect_status
    ports:
      - 8083:8083
```

**Start:**
```bash
docker-compose up -d
```

**Check:**
```bash
curl http://localhost:8083/
```

---

## Oracle Instant Client Setup

For Oracle connections, install Oracle Instant Client:

### macOS

```bash
# Download from Oracle website
# Extract to /opt/oracle/instantclient_19_8

export ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient_19_8
```

### Linux

```bash
# Download from Oracle website
sudo mkdir -p /opt/oracle
sudo unzip instantclient-basic-linux.x64-19.8.0.0.0dbru.zip -d /opt/oracle

export ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient_19_8
```

### .env Configuration

```env
ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient_19_8
```

---

## Production Deployment

### Build

```bash
npm run build
```

### Serve Frontend

```bash
npm run preview
# Or use nginx, apache, etc.
```

### Run Backends

```bash
# Registry Backend
NODE_ENV=production node backend/server.js

# Debezium Backend
NODE_ENV=production node backend/debezium-backend.js
```

### Use Process Manager

```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start backend/server.js --name registry-backend
pm2 start backend/debezium-backend.js --name debezium-backend

# Save configuration
pm2 save

# Setup startup script
pm2 startup
```

---

## Troubleshooting

### Frontend Can't Connect to Backend

**Check CORS:**
```env
BACKEND_ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
```

**Verify URLs:**
```bash
echo $VITE_BACKEND_URL
echo $VITE_DEBEZIUM_BACKEND_URL
```

### Backend Can't Connect to Database

**Test Connection:**
```bash
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

**Check SSL:**
```env
SUPABASE_DB_SSL=require
```

### Debezium Backend Can't Connect to Kafka

**Verify Kafka Connect:**
```bash
curl http://127.0.0.1:8083/
```

**Check Docker:**
```bash
docker ps
docker logs kafka-connect
```

### Oracle Connection Fails

**Check Instant Client:**
```bash
ls -la $ORACLE_CLIENT_LIB_DIR
```

**Test Connection:**
```bash
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

## Testing

### Test Registry Backend

```bash
# Health check
curl http://localhost:5001/api/health

# List connectors
curl http://localhost:5001/api/registry/connectors
```

### Test Debezium Backend

```bash
# Health check
curl http://localhost:5002/api/health

# List connectors
curl http://localhost:5002/api/kafka-connect/connectors

# Get connector status
curl http://localhost:5002/api/kafka-connect/connectors/my-connector/status
```

### Test Full Pipeline

1. Create pipeline via UI
2. Deploy via Debezium backend
3. Check status in Kafka Connect
4. Monitor in UI dashboard

---

## Monitoring

### Application Logs

**Registry Backend:**
```bash
tail -f registry-backend.log
```

**Debezium Backend:**
```bash
tail -f debezium-backend.log
```

### Kafka Connect Logs

```bash
docker logs -f kafka-connect
```

### Database Queries

```sql
-- Active pipelines
SELECT * FROM pipelines WHERE status = 'running';

-- Recent deployments
SELECT * FROM deployments ORDER BY created_at DESC LIMIT 10;

-- Connector versions
SELECT c.name, cv.version, cv.is_active
FROM connectors c
JOIN connector_versions cv ON cv.connector_id = c.id;
```

---

## Performance Tips

1. **Connection Pooling:** Already configured in backends
2. **Task Parallelism:** Set `tasks.max` appropriately
3. **Batch Size:** Tune `max.batch.size` for throughput
4. **Memory:** Allocate sufficient memory to Kafka Connect
5. **Monitoring:** Use Prometheus + Grafana for metrics

---

## Security Checklist

- [ ] Change default database passwords
- [ ] Use SSL for database connections
- [ ] Restrict CORS origins in production
- [ ] Use environment variables for secrets
- [ ] Enable authentication in Kafka Connect
- [ ] Use VPN/firewall for database access
- [ ] Regular security updates
- [ ] Audit logs enabled

---

## Support & Documentation

- **Application Docs:** See `README.md`
- **Debezium Backend API:** See `DEBEZIUM_BACKEND.md`
- **Backend Architecture:** See `BACKEND_ARCHITECTURE.md`
- **Debezium Docs:** https://debezium.io/documentation/
- **Kafka Connect API:** https://docs.confluent.io/platform/current/connect/references/restapi.html

---

## License

MIT
