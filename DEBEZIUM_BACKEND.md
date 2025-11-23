# Debezium Backend API Documentation

Complete backend service for managing Debezium connectors via Kafka Connect REST API.

## Overview

The Debezium Backend runs on **port 5002** and provides a comprehensive API for:
- Managing Kafka Connect cluster
- Deploying and configuring Debezium connectors
- Monitoring connector health and status
- Pipeline lifecycle management (start, pause, delete)
- Integrating with Supabase database for pipeline metadata

## Architecture

```
┌─────────────────┐
│   Frontend      │  React + TypeScript + Vite
│   (Port 5173)   │
└────────┬────────┘
         │
    ┌────┴────────────────────────────┐
    │                                 │
┌───▼────────┐    ┌──────────┐    ┌──▼──────────────┐
│  Registry  │    │ Debezium │    │   Supabase      │
│  Backend   │    │ Backend  │    │   PostgreSQL    │
│ (Port 5001)│    │(Port 5002)│    │                 │
│            │    │          │◄───┤ • Pipelines     │
│ • Oracle   │    │ • Kafka  │    │ • Connectors    │
│ • Postgres │    │  Connect │    │ • Logs          │
│ • Registry │    │ • Deploy │    │ • Metrics       │
│ • Validate │    │ • Monitor│    │                 │
└────────────┘    └────┬─────┘    └─────────────────┘
                       │
              ┌────────▼────────┐
              │ Kafka Connect   │
              │  (Port 8083)    │
              │                 │
              │ • Source        │
              │   Connectors    │
              │ • Sink          │
              │   Connectors    │
              └─────────────────┘
```

## Environment Variables

```env
# Debezium Backend Configuration
DEBEZIUM_BACKEND_PORT=5002
DEBEZIUM_BACKEND_HOST=0.0.0.0
VITE_DEBEZIUM_BACKEND_URL=http://localhost:5002

# Kafka Connect Configuration
KAFKA_CONNECT_URL=http://127.0.0.1:8083

# Supabase Database (for pipeline metadata)
SUPABASE_DB_HOST=db.your-project.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-password
SUPABASE_DB_SSL=require
```

## Starting the Backend

```bash
# Development mode
npm run debezium:dev

# Or directly
node backend/debezium-backend.js
```

## API Endpoints

### Health & Info

#### GET /api/health
Check backend health and Kafka Connect URL.

**Response:**
```json
{
  "status": "ok",
  "kafkaConnect": "http://127.0.0.1:8083"
}
```

#### GET /api/kafka-connect/info
Get Kafka Connect cluster information.

**Response:**
```json
{
  "success": true,
  "info": {
    "version": "3.5.0",
    "commit": "...",
    "kafka_cluster_id": "..."
  }
}
```

#### GET /api/kafka-connect/connector-plugins
List available connector plugins.

**Response:**
```json
{
  "success": true,
  "plugins": [
    {
      "class": "io.debezium.connector.oracle.OracleConnector",
      "type": "source",
      "version": "2.4.0"
    }
  ]
}
```

---

### Connector Management

#### GET /api/kafka-connect/connectors
List all connectors with status.

**Response:**
```json
{
  "success": true,
  "connectors": {
    "connector-name": {
      "info": { "name": "...", "config": {...} },
      "status": { "name": "...", "connector": {...}, "tasks": [...] }
    }
  }
}
```

#### GET /api/kafka-connect/connectors/:name
Get connector details.

**Response:**
```json
{
  "success": true,
  "connector": {
    "name": "my-oracle-connector",
    "config": { ... },
    "tasks": [ ... ],
    "type": "source"
  }
}
```

#### GET /api/kafka-connect/connectors/:name/status
Get connector status.

**Response:**
```json
{
  "success": true,
  "status": {
    "name": "my-oracle-connector",
    "connector": {
      "state": "RUNNING",
      "worker_id": "kafka-connect:8083"
    },
    "tasks": [
      {
        "id": 0,
        "state": "RUNNING",
        "worker_id": "kafka-connect:8083"
      }
    ]
  }
}
```

#### GET /api/kafka-connect/connectors/:name/config
Get connector configuration.

**Response:**
```json
{
  "success": true,
  "config": {
    "name": "my-oracle-connector",
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "database.hostname": "oracle.example.com",
    ...
  }
}
```

#### GET /api/kafka-connect/connectors/:name/tasks
List connector tasks.

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "id": { "connector": "my-oracle-connector", "task": 0 },
      "config": { ... }
    }
  ]
}
```

#### GET /api/kafka-connect/connectors/:name/tasks/:taskId/status
Get task status.

**Response:**
```json
{
  "success": true,
  "status": {
    "id": 0,
    "state": "RUNNING",
    "worker_id": "kafka-connect:8083"
  }
}
```

---

### Connector Operations

#### POST /api/kafka-connect/connectors
Create a new connector.

**Request:**
```json
{
  "name": "my-oracle-source",
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "database.hostname": "oracle.example.com",
    "database.port": 1521,
    "database.user": "debezium",
    "database.password": "secret",
    "database.dbname": "ORCLPDB1",
    "database.server.name": "oracle-server",
    "table.include.list": "SCHEMA.TABLE1,SCHEMA.TABLE2",
    "tasks.max": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "connector": { ... }
}
```

#### PUT /api/kafka-connect/connectors/:name/config
Update connector configuration.

**Request:**
```json
{
  "connector.class": "io.debezium.connector.oracle.OracleConnector",
  "database.hostname": "new-oracle.example.com",
  ...
}
```

**Response:**
```json
{
  "success": true,
  "connector": { ... }
}
```

#### DELETE /api/kafka-connect/connectors/:name
Delete a connector.

**Response:**
```json
{
  "success": true,
  "message": "Connector deleted"
}
```

---

### Connector Lifecycle

#### PUT /api/kafka-connect/connectors/:name/pause
Pause a running connector.

**Response:**
```json
{
  "success": true,
  "message": "Connector paused"
}
```

#### PUT /api/kafka-connect/connectors/:name/resume
Resume a paused connector.

**Response:**
```json
{
  "success": true,
  "message": "Connector resumed"
}
```

#### POST /api/kafka-connect/connectors/:name/restart
Restart a connector.

**Query Parameters:**
- `includeTasks` (boolean): Restart tasks as well
- `onlyFailed` (boolean): Restart only failed tasks

**Response:**
```json
{
  "success": true,
  "message": "Connector restarted"
}
```

#### POST /api/kafka-connect/connectors/:name/tasks/:taskId/restart
Restart a specific task.

**Response:**
```json
{
  "success": true,
  "message": "Task restarted"
}
```

---

### Configuration Validation

#### PUT /api/kafka-connect/connector-plugins/:pluginName/config/validate
Validate connector configuration.

**Request:**
```json
{
  "connector.class": "io.debezium.connector.oracle.OracleConnector",
  "database.hostname": "oracle.example.com",
  ...
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "name": "io.debezium.connector.oracle.OracleConnector",
    "error_count": 0,
    "groups": [...],
    "configs": [
      {
        "definition": { ... },
        "value": { ... },
        "errors": []
      }
    ]
  }
}
```

---

### Pipeline Operations

#### POST /api/pipelines/:id/deploy
Deploy a pipeline (create source and sink connectors).

**Response:**
```json
{
  "success": true,
  "message": "Pipeline deployed",
  "results": {
    "source": { "action": "created", "connector": {...} },
    "sink": { "action": "created", "connector": {...} },
    "errors": []
  }
}
```

#### POST /api/pipelines/:id/start
Start a pipeline (resume connectors).

**Response:**
```json
{
  "success": true,
  "message": "Pipeline started"
}
```

#### POST /api/pipelines/:id/pause
Pause a pipeline (pause connectors).

**Response:**
```json
{
  "success": true,
  "message": "Pipeline paused"
}
```

#### DELETE /api/pipelines/:id/connectors
Delete pipeline connectors from Kafka Connect.

**Response:**
```json
{
  "success": true,
  "message": "Connectors deleted"
}
```

#### GET /api/pipelines/:id/status
Get pipeline status (source and sink connectors).

**Response:**
```json
{
  "success": true,
  "status": {
    "source": {
      "name": "pipeline-name-source",
      "connector": { "state": "RUNNING", ... },
      "tasks": [ ... ]
    },
    "sink": {
      "name": "pipeline-name-sink",
      "connector": { "state": "RUNNING", ... },
      "tasks": [ ... ]
    },
    "errors": []
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing parameters)
- `404` - Not Found (connector/pipeline not found)
- `500` - Internal Server Error
- `502` - Bad Gateway (Kafka Connect unavailable)

---

## Usage Examples

### Deploy a New Pipeline

```javascript
const response = await fetch('http://localhost:5002/api/pipelines/abc-123/deploy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const result = await response.json();
console.log(result);
```

### Check Connector Status

```javascript
const response = await fetch('http://localhost:5002/api/kafka-connect/connectors/my-connector/status');
const { status } = await response.json();

console.log('Connector State:', status.connector.state);
console.log('Task States:', status.tasks.map(t => t.state));
```

### Restart Failed Tasks

```javascript
const response = await fetch(
  'http://localhost:5002/api/kafka-connect/connectors/my-connector/restart?onlyFailed=true',
  { method: 'POST' }
);
```

### Validate Configuration

```javascript
const config = {
  'connector.class': 'io.debezium.connector.oracle.OracleConnector',
  'database.hostname': 'oracle.example.com',
  'database.port': '1521',
  'database.user': 'debezium',
  'database.password': 'secret',
  'database.dbname': 'ORCLPDB1'
};

const response = await fetch(
  'http://localhost:5002/api/kafka-connect/connector-plugins/io.debezium.connector.oracle.OracleConnector/config/validate',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  }
);

const { validation } = await response.json();
console.log('Errors:', validation.error_count);
```

---

## Monitoring & Health Checks

The backend automatically syncs pipeline status with Supabase database:
- Updates pipeline status when deploying/starting/pausing
- Tracks connector deployment state
- Logs errors for troubleshooting

## Troubleshooting

### Backend Won't Start

1. **Check Kafka Connect:**
   ```bash
   curl http://127.0.0.1:8083/
   ```

2. **Verify Database Connection:**
   ```bash
   psql "postgresql://user:pass@db.xxx.supabase.co:5432/postgres"
   ```

3. **Check Environment Variables:**
   ```bash
   echo $KAFKA_CONNECT_URL
   ```

### Connector Deployment Fails

1. **Validate Config First:**
   Use `/connector-plugins/:pluginName/config/validate` endpoint

2. **Check Kafka Connect Logs:**
   ```bash
   docker logs kafka-connect
   ```

3. **Verify Database Connectivity:**
   - Ensure source database is accessible from Kafka Connect
   - Check credentials and permissions

### Task Failures

1. **Get Task Status:**
   ```bash
   curl http://localhost:5002/api/kafka-connect/connectors/my-connector/tasks/0/status
   ```

2. **Restart Failed Task:**
   ```bash
   curl -X POST http://localhost:5002/api/kafka-connect/connectors/my-connector/tasks/0/restart
   ```

---

## Best Practices

1. **Always Validate** configurations before deploying
2. **Monitor Task Status** regularly for failures
3. **Use Descriptive Names** for connectors (e.g., `pipeline-name-source`)
4. **Set Appropriate `tasks.max`** based on parallelism needs
5. **Enable Error Tolerance** carefully (can hide data issues)
6. **Test Connections** before creating connectors
7. **Use Pause Instead of Delete** when troubleshooting

---

## Integration with Frontend

Frontend should use `VITE_DEBEZIUM_BACKEND_URL` environment variable:

```typescript
const debeziumUrl = import.meta.env.VITE_DEBEZIUM_BACKEND_URL;

// Deploy pipeline
await fetch(`${debeziumUrl}/api/pipelines/${pipelineId}/deploy`, {
  method: 'POST'
});

// Get connector status
await fetch(`${debeziumUrl}/api/kafka-connect/connectors/${name}/status`);
```

---

## License

MIT
