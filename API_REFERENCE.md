# API Reference

Complete API reference for CDCStream backends.

## Table of Contents

- [Registry Backend (Port 5001)](#registry-backend-port-5001)
- [Debezium Backend (Port 5002)](#debezium-backend-port-5002)

---

# Registry Backend (Port 5001)

Backend for connector registry, validation, and database operations.

## Health & Info

### GET /api/health
Health check endpoint.

**Response:**
```json
{ "status": "ok" }
```

---

## Connection Testing

### POST /api/test-connection
Test Oracle database connection (native driver).

**Request:**
```json
{
  "connectionType": "oracle",
  "host": "oracle.example.com",
  "port": 1521,
  "username": "user",
  "password": "password",
  "serviceName": "ORCLPDB1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Oracle connection successful",
  "version": "Oracle Database 19c Enterprise Edition"
}
```

---

## Table Listing

### POST /api/list-tables
List tables from database (Oracle or PostgreSQL).

**Request:**
```json
{
  "connectionType": "oracle",
  "host": "oracle.example.com",
  "port": 1521,
  "username": "user",
  "password": "password",
  "serviceName": "ORCLPDB1"
}
```

**Response:**
```json
{
  "success": true,
  "tables": [
    {
      "schema": "HR",
      "table": "EMPLOYEES",
      "rowCount": 107,
      "sizeEstimate": "128.0 KB",
      "lastModified": "2025-11-15T10:30:00"
    }
  ]
}
```

### POST /api/oracle/list-tables
List Oracle tables specifically.

Same as `/api/list-tables` with `connectionType: "oracle"`.

---

## Registry Management

### POST /api/registry/connectors/:name/versions
Create new connector version in registry.

**Request:**
```json
{
  "kind": "source",
  "connectorClass": "io.debezium.connector.oracle.OracleConnector",
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "database.hostname": "oracle.example.com",
    "database.port": "1521",
    "database.user": "debezium",
    "database.password": "secret",
    "database.dbname": "ORCLPDB1",
    "database.server.name": "oracle-server",
    "table.include.list": "HR.EMPLOYEES,HR.DEPARTMENTS",
    "tasks.max": "1"
  },
  "schemaKey": "debezium-oracle-source.schema.json",
  "schemaVersion": "v1",
  "createdBy": "admin",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "connector": {
    "id": "uuid",
    "name": "my-oracle-connector",
    "kind": "source",
    "class": "io.debezium.connector.oracle.OracleConnector"
  },
  "version": {
    "id": "uuid",
    "connector_id": "uuid",
    "version": 1,
    "config": {...},
    "checksum": "sha256-hash",
    "is_active": false,
    "created_at": "2025-11-15T10:30:00Z"
  },
  "warnings": ["tasks.max exceeds recommended threshold (8)"]
}
```

### POST /api/registry/connectors/:name/versions/:version/activate
Activate a specific connector version.

**Response:**
```json
{
  "success": true,
  "connector": {...},
  "version": {
    "id": "uuid",
    "version": 1,
    "is_active": true,
    "activated_at": "2025-11-15T10:35:00Z"
  }
}
```

### GET /api/registry/connectors/:name/diff
Get diff between two connector versions.

**Query Parameters:**
- `from` (number): Source version
- `to` (number): Target version

**Response:**
```json
{
  "success": true,
  "diff": {
    "added": [
      { "path": "table.include.list", "value": "HR.EMPLOYEES" }
    ],
    "removed": [
      { "path": "old.property", "value": "old-value" }
    ],
    "changed": [
      {
        "path": "database.hostname",
        "from": "old-host.example.com",
        "to": "new-host.example.com"
      }
    ]
  }
}
```

### POST /api/registry/deployments
Create deployment record.

**Request:**
```json
{
  "connectorName": "my-oracle-connector",
  "version": 1,
  "environment": "production",
  "connectClusterUrl": "http://kafka-connect:8083",
  "createdBy": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "deployment": {
    "id": "uuid",
    "connector_version_id": "uuid",
    "environment": "production",
    "status": "pending",
    "created_at": "2025-11-15T10:40:00Z"
  },
  "connector": {...},
  "version": {...}
}
```

### POST /api/registry/deployments/:id/apply
Apply deployment to Kafka Connect.

**Response:**
```json
{
  "success": true
}
```

### POST /api/registry/connectors/:name/mark-deployed
Mark connector as deployed in pipeline.

**Request:**
```json
{
  "version": 1
}
```

**Response:**
```json
{
  "success": true,
  "updated": 2
}
```

### GET /api/registry/connectors
List all connectors in registry.

**Response:**
```json
{
  "success": true,
  "connectors": [
    {
      "id": "uuid",
      "name": "my-oracle-connector",
      "kind": "source",
      "class": "io.debezium.connector.oracle.OracleConnector",
      "active_version": 2,
      "active_checksum": "sha256-hash",
      "created_at": "2025-11-15T10:00:00Z"
    }
  ]
}
```

### GET /api/registry/connectors/:name/versions
List versions for a connector.

**Response:**
```json
{
  "success": true,
  "connector": {...},
  "versions": [
    {
      "id": "uuid",
      "version": 2,
      "config": {...},
      "is_active": true,
      "created_at": "2025-11-15T10:30:00Z"
    },
    {
      "id": "uuid",
      "version": 1,
      "config": {...},
      "is_active": false,
      "created_at": "2025-11-15T10:00:00Z"
    }
  ]
}
```

### GET /api/registry/deployments
List deployments.

**Query Parameters:**
- `connectorName` (string, optional): Filter by connector name

**Response:**
```json
{
  "success": true,
  "deployments": [
    {
      "id": "uuid",
      "connector_name": "my-oracle-connector",
      "connector_version": 2,
      "environment": "production",
      "status": "deployed",
      "status_msg": "Applied to Kafka Connect",
      "created_at": "2025-11-15T10:40:00Z",
      "deployed_at": "2025-11-15T10:41:00Z"
    }
  ]
}
```

---

# Debezium Backend (Port 5002)

Backend for Kafka Connect management and pipeline operations.

## Health & Cluster Info

### GET /api/health
Health check with Kafka Connect URL.

**Response:**
```json
{
  "status": "ok",
  "kafkaConnect": "http://127.0.0.1:8083"
}
```

### GET /api/kafka-connect/info
Get Kafka Connect cluster information.

**Response:**
```json
{
  "success": true,
  "info": {
    "version": "3.5.0",
    "commit": "c97b88d5db4de28d",
    "kafka_cluster_id": "lkc-abc123"
  }
}
```

### GET /api/kafka-connect/connector-plugins
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
    },
    {
      "class": "io.debezium.connector.jdbc.JdbcSinkConnector",
      "type": "sink",
      "version": "2.4.0"
    }
  ]
}
```

---

## Connector Management

### GET /api/kafka-connect/connectors
List all connectors with status.

**Response:**
```json
{
  "success": true,
  "connectors": {
    "my-oracle-source": {
      "info": {
        "name": "my-oracle-source",
        "config": {...},
        "tasks": [{"connector": "my-oracle-source", "task": 0}],
        "type": "source"
      },
      "status": {
        "name": "my-oracle-source",
        "connector": {"state": "RUNNING", "worker_id": "connect:8083"},
        "tasks": [{"id": 0, "state": "RUNNING", "worker_id": "connect:8083"}],
        "type": "source"
      }
    }
  }
}
```

### GET /api/kafka-connect/connectors/:name
Get connector details.

**Response:**
```json
{
  "success": true,
  "connector": {
    "name": "my-oracle-source",
    "config": {
      "connector.class": "io.debezium.connector.oracle.OracleConnector",
      "database.hostname": "oracle.example.com",
      ...
    },
    "tasks": [...],
    "type": "source"
  }
}
```

### GET /api/kafka-connect/connectors/:name/status
Get connector status.

**Response:**
```json
{
  "success": true,
  "status": {
    "name": "my-oracle-source",
    "connector": {
      "state": "RUNNING",
      "worker_id": "connect:8083"
    },
    "tasks": [
      {
        "id": 0,
        "state": "RUNNING",
        "worker_id": "connect:8083"
      }
    ],
    "type": "source"
  }
}
```

### GET /api/kafka-connect/connectors/:name/config
Get connector configuration.

**Response:**
```json
{
  "success": true,
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "database.hostname": "oracle.example.com",
    "database.port": "1521",
    ...
  }
}
```

### GET /api/kafka-connect/connectors/:name/tasks
List connector tasks.

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "id": {"connector": "my-oracle-source", "task": 0},
      "config": {
        "task.class": "io.debezium.connector.oracle.OracleConnectorTask",
        ...
      }
    }
  ]
}
```

### GET /api/kafka-connect/connectors/:name/tasks/:taskId/status
Get task status.

**Response:**
```json
{
  "success": true,
  "status": {
    "id": 0,
    "state": "RUNNING",
    "worker_id": "connect:8083",
    "trace": null
  }
}
```

---

## Connector Operations

### POST /api/kafka-connect/connectors
Create new connector.

**Request:**
```json
{
  "name": "my-oracle-source",
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "database.hostname": "oracle.example.com",
    "database.port": "1521",
    "database.user": "debezium",
    "database.password": "secret",
    "database.dbname": "ORCLPDB1",
    "database.server.name": "oracle-server",
    "table.include.list": "HR.EMPLOYEES",
    "tasks.max": "1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "connector": {
    "name": "my-oracle-source",
    "config": {...},
    "tasks": [],
    "type": "source"
  }
}
```

### PUT /api/kafka-connect/connectors/:name/config
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
  "connector": {...}
}
```

### DELETE /api/kafka-connect/connectors/:name
Delete connector.

**Response:**
```json
{
  "success": true,
  "message": "Connector deleted"
}
```

---

## Connector Lifecycle

### PUT /api/kafka-connect/connectors/:name/pause
Pause connector.

**Response:**
```json
{
  "success": true,
  "message": "Connector paused"
}
```

### PUT /api/kafka-connect/connectors/:name/resume
Resume connector.

**Response:**
```json
{
  "success": true,
  "message": "Connector resumed"
}
```

### POST /api/kafka-connect/connectors/:name/restart
Restart connector.

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

### POST /api/kafka-connect/connectors/:name/tasks/:taskId/restart
Restart specific task.

**Response:**
```json
{
  "success": true,
  "message": "Task restarted"
}
```

---

## Configuration Validation

### PUT /api/kafka-connect/connector-plugins/:pluginName/config/validate
Validate connector configuration.

**Request:**
```json
{
  "connector.class": "io.debezium.connector.oracle.OracleConnector",
  "database.hostname": "oracle.example.com",
  "database.port": "1521",
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
    "groups": ["Common", "Connection", "Connector"],
    "configs": [
      {
        "definition": {
          "name": "database.hostname",
          "type": "STRING",
          "required": true,
          "default_value": "",
          "importance": "HIGH",
          "documentation": "Database hostname",
          ...
        },
        "value": {
          "name": "database.hostname",
          "value": "oracle.example.com",
          "recommended_values": [],
          "errors": [],
          "visible": true
        }
      }
    ]
  }
}
```

---

## Pipeline Operations

### POST /api/pipelines/:id/deploy
Deploy pipeline (create source and sink connectors).

**Response:**
```json
{
  "success": true,
  "message": "Pipeline deployed",
  "results": {
    "source": {
      "action": "created",
      "connector": {...}
    },
    "sink": {
      "action": "created",
      "connector": {...}
    },
    "errors": []
  }
}
```

### POST /api/pipelines/:id/start
Start pipeline (resume connectors).

**Response:**
```json
{
  "success": true,
  "message": "Pipeline started"
}
```

### POST /api/pipelines/:id/pause
Pause pipeline (pause connectors).

**Response:**
```json
{
  "success": true,
  "message": "Pipeline paused"
}
```

### DELETE /api/pipelines/:id/connectors
Delete pipeline connectors.

**Response:**
```json
{
  "success": true,
  "message": "Connectors deleted"
}
```

### GET /api/pipelines/:id/status
Get pipeline status.

**Response:**
```json
{
  "success": true,
  "status": {
    "source": {
      "name": "my-pipeline-source",
      "connector": {"state": "RUNNING", ...},
      "tasks": [...]
    },
    "sink": {
      "name": "my-pipeline-sink",
      "connector": {"state": "RUNNING", ...},
      "tasks": [...]
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
  "error": "Error message"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error
- `502` - Bad Gateway (Kafka Connect unavailable)

---

## Authentication

Currently, no authentication is required. In production:
- Add API key authentication
- Use JWT tokens
- Implement rate limiting
- Enable HTTPS only

---

## Rate Limiting

No rate limiting currently. Consider implementing:
- Request rate limits per IP
- Burst limits for expensive operations
- Queue management for deployments

---

## Monitoring

All endpoints log to console. Consider adding:
- Prometheus metrics
- Error tracking (Sentry)
- Performance monitoring (APM)
- Audit logs
