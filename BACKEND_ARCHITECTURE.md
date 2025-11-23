# Backend Architecture Design

## Overview

This document outlines the backend architecture for a CDC (Change Data Capture) platform built on Debezium and Kafka Connect. The architecture provides a comprehensive API layer for managing data pipelines, connectors, and monitoring.

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend                      │
│            (Current App - Supabase)                  │
└────────────────┬────────────────────────────────────┘
                 │ HTTPS/WSS
                 │
┌────────────────┴────────────────────────────────────┐
│          API Gateway / Backend Service              │
│         (Supabase Edge Functions +                   │
│          Node.js/Python/Go Service)                 │
├─────────────────────────────────────────────────────┤
│  • Authentication & Authorization                    │
│  • Request Validation                                │
│  • Business Logic                                    │
│  • Orchestration                                     │
│  • Real-time Updates                                │
└────┬──────────┬──────────┬───────────┬──────────────┘
     │          │          │           │
     ▼          ▼          ▼           ▼
┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐
│ Kafka   │ │ Debezium │ │Schema  │ │  Supabase    │
│ Connect │ │  Server  │ │Registry│ │  (Metadata)  │
│   API   │ │          │ │  API   │ │              │
└─────────┘ └──────────┘ └────────┘ └──────────────┘
     │          │          │           │
     ▼          ▼          ▼           ▼
┌─────────────────────────────────────────────────────┐
│              Kafka Cluster                           │
│  • Topics                                            │
│  • Partitions                                        │
│  • Consumer Groups                                   │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│          Source Databases                            │
│  • Oracle                                            │
│  • PostgreSQL                                        │
│  • SQL Server                                        │
│  • MySQL                                             │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│        Destination/Sink Systems                      │
│  • Data Warehouses (Snowflake, BigQuery)            │
│  • Databases (PostgreSQL, MySQL)                     │
│  • Object Storage (S3, GCS)                          │
│  • Analytics Platforms                               │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Backend Service Options

### Option A: Supabase Edge Functions (Lightweight Proxy)

**Use Case:** Simple API proxy operations, lightweight business logic

**Technology Stack:**
- Deno runtime
- TypeScript
- Supabase Auth integration

**Example Implementation:**

```typescript
// supabase/functions/kafka-connect-proxy/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const KAFKA_CONNECT_URL = Deno.env.get('KAFKA_CONNECT_URL')!;
    const { path, method, body } = await req.json();

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Proxy to Kafka Connect REST API
    const response = await fetch(`${KAFKA_CONNECT_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

**Pros:**
- ✅ Serverless architecture (auto-scaling)
- ✅ Built-in Supabase authentication
- ✅ Easy deployment
- ✅ Cost-effective for low to medium traffic
- ✅ No infrastructure management

**Cons:**
- ❌ Cold start latency
- ❌ Limited execution time (varies by plan)
- ❌ Complex orchestration logic is harder to implement
- ❌ Limited to Deno ecosystem

---

### Option B: Standalone API Service (Full-Featured Backend)

**Use Case:** Complex business logic, orchestration, background jobs, WebSocket support

**Technology Stack Options:**

#### Node.js + Express
```javascript
// server.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const KAFKA_CONNECT_URL = process.env.KAFKA_CONNECT_URL;

// Middleware: Authentication
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}

// Connector Management
app.post('/api/connectors', authenticate, async (req, res) => {
  try {
    const connectorConfig = req.body;

    // Create connector in Kafka Connect
    const response = await fetch(`${KAFKA_CONNECT_URL}/connectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connectorConfig)
    });

    const connector = await response.json();

    // Store metadata in Supabase
    await supabase.from('pipeline_connectors').insert({
      name: connector.name,
      type: connectorConfig.type,
      connector_class: connectorConfig.config['connector.class'],
      config: connectorConfig.config,
      user_id: req.user.id
    });

    res.json(connector);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/connectors/:name/status', authenticate, async (req, res) => {
  try {
    const response = await fetch(
      `${KAFKA_CONNECT_URL}/connectors/${req.params.name}/status`
    );
    const status = await response.json();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('API Gateway running on port 3000');
});
```

#### Python + FastAPI
```python
# main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
KAFKA_CONNECT_URL = os.getenv("KAFKA_CONNECT_URL")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user

@app.post("/api/connectors")
async def create_connector(
    connector_config: dict,
    user = Depends(get_current_user)
):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{KAFKA_CONNECT_URL}/connectors",
            json=connector_config
        )

        connector = response.json()

        # Store metadata
        supabase.table("pipeline_connectors").insert({
            "name": connector["name"],
            "type": connector_config["type"],
            "connector_class": connector_config["config"]["connector.class"],
            "config": connector_config["config"],
            "user_id": user.id
        }).execute()

        return connector

@app.get("/api/connectors/{name}/status")
async def get_connector_status(
    name: str,
    user = Depends(get_current_user)
):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{KAFKA_CONNECT_URL}/connectors/{name}/status"
        )
        return response.json()
```

**Pros:**
- ✅ Full control over business logic
- ✅ WebSocket support for real-time updates
- ✅ Background job processing
- ✅ Complex orchestration capabilities
- ✅ Rich ecosystem of libraries
- ✅ Better debugging and testing tools

**Cons:**
- ❌ Infrastructure management required
- ❌ Scaling complexity
- ❌ Higher operational costs
- ❌ Deployment pipeline setup needed

---

### Recommended Approach: Hybrid Architecture

**Best of both worlds:**

1. **Supabase Edge Functions** for:
   - Simple CRUD operations
   - Authentication proxy
   - Lightweight data transformations

2. **Standalone Service** for:
   - Pipeline orchestration
   - Background monitoring
   - Metrics collection
   - Complex validation logic
   - WebSocket connections

3. **Supabase Database** for:
   - User authentication
   - Metadata storage
   - Configuration management
   - Historical metrics

---

## 📋 Core Backend Services

### 1. Connector Service

**Responsibilities:**
- Manage Debezium connector lifecycle
- Interface with Kafka Connect REST API
- Handle connector configurations

```javascript
class ConnectorService {
  constructor(kafkaConnectUrl) {
    this.baseUrl = kafkaConnectUrl;
  }

  async createConnector(config) {
    const response = await fetch(`${this.baseUrl}/connectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create connector: ${error.message}`);
    }

    return response.json();
  }

  async getConnector(name) {
    const response = await fetch(`${this.baseUrl}/connectors/${name}`);
    return response.json();
  }

  async updateConnectorConfig(name, config) {
    const response = await fetch(
      `${this.baseUrl}/connectors/${name}/config`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }
    );
    return response.json();
  }

  async deleteConnector(name) {
    await fetch(`${this.baseUrl}/connectors/${name}`, {
      method: 'DELETE'
    });
  }

  async pauseConnector(name) {
    await fetch(`${this.baseUrl}/connectors/${name}/pause`, {
      method: 'PUT'
    });
  }

  async resumeConnector(name) {
    await fetch(`${this.baseUrl}/connectors/${name}/resume`, {
      method: 'PUT'
    });
  }

  async restartConnector(name) {
    await fetch(`${this.baseUrl}/connectors/${name}/restart`, {
      method: 'POST'
    });
  }

  async getConnectorStatus(name) {
    const response = await fetch(
      `${this.baseUrl}/connectors/${name}/status`
    );
    return response.json();
  }

  async getConnectorTasks(name) {
    const response = await fetch(
      `${this.baseUrl}/connectors/${name}/tasks`
    );
    return response.json();
  }

  async restartTask(connectorName, taskId) {
    await fetch(
      `${this.baseUrl}/connectors/${connectorName}/tasks/${taskId}/restart`,
      { method: 'POST' }
    );
  }

  async listConnectors() {
    const response = await fetch(`${this.baseUrl}/connectors`);
    return response.json();
  }

  async getConnectorPlugins() {
    const response = await fetch(`${this.baseUrl}/connector-plugins`);
    return response.json();
  }

  async validateConnectorConfig(pluginName, config) {
    const response = await fetch(
      `${this.baseUrl}/connector-plugins/${pluginName}/config/validate`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }
    );
    return response.json();
  }
}
```

---

### 2. Pipeline Service

**Responsibilities:**
- Orchestrate end-to-end pipeline creation
- Coordinate source and sink connectors
- Manage pipeline state
- Handle pipeline lifecycle events

```javascript
class PipelineService {
  constructor(connectorService, supabase) {
    this.connectorService = connectorService;
    this.supabase = supabase;
  }

  async createPipeline(userId, pipelineData) {
    try {
      // 1. Store pipeline metadata
      const { data: pipeline, error } = await this.supabase
        .from('pipelines')
        .insert({
          user_id: userId,
          name: pipelineData.name,
          source_type: pipelineData.source_type,
          source_config: pipelineData.source_config,
          destination_type: pipelineData.destination_type,
          destination_config: pipelineData.destination_config,
          mode: pipelineData.mode,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Create source connector
      const sourceConnector = await this.createSourceConnector(
        pipeline,
        pipelineData.source_config
      );

      // 3. Create sink connector
      const sinkConnector = await this.createSinkConnector(
        pipeline,
        pipelineData.destination_config
      );

      // 4. Store connector metadata
      await this.supabase.from('pipeline_connectors').insert([
        {
          pipeline_id: pipeline.id,
          name: sourceConnector.name,
          type: 'source',
          connector_class: sourceConnector.config['connector.class'],
          config: sourceConnector.config
        },
        {
          pipeline_id: pipeline.id,
          name: sinkConnector.name,
          type: 'sink',
          connector_class: sinkConnector.config['connector.class'],
          config: sinkConnector.config
        }
      ]);

      // 5. Update pipeline status
      await this.supabase
        .from('pipelines')
        .update({ status: 'idle' })
        .eq('id', pipeline.id);

      return pipeline;
    } catch (error) {
      console.error('Pipeline creation failed:', error);
      throw error;
    }
  }

  async createSourceConnector(pipeline, sourceConfig) {
    const connectorName = `${pipeline.name}-source-${Date.now()}`;

    const config = {
      name: connectorName,
      config: {
        'connector.class': this.getConnectorClass(pipeline.source_type, 'source'),
        'tasks.max': sourceConfig['tasks.max'] || '1',
        'database.hostname': sourceConfig['database.hostname'],
        'database.port': sourceConfig['database.port'],
        'database.user': sourceConfig['database.user'],
        'database.password': sourceConfig['database.password'],
        'database.dbname': sourceConfig['database.dbname'],
        'database.server.name': sourceConfig['database.server.name'],
        'table.include.list': sourceConfig['table.include.list'],
        'snapshot.mode': sourceConfig['snapshot.mode'] || 'initial',
        // Additional connector-specific configurations
        ...sourceConfig
      }
    };

    return await this.connectorService.createConnector(config);
  }

  async createSinkConnector(pipeline, destinationConfig) {
    const connectorName = `${pipeline.name}-sink-${Date.now()}`;

    const config = {
      name: connectorName,
      config: {
        'connector.class': this.getConnectorClass(pipeline.destination_type, 'sink'),
        'tasks.max': destinationConfig['tasks.max'] || '1',
        'topics': destinationConfig['topics'],
        'connection.url': destinationConfig['connection.url'],
        'connection.user': destinationConfig['connection.user'],
        'connection.password': destinationConfig['connection.password'],
        'auto.create': destinationConfig['auto.create'] || 'true',
        'insert.mode': destinationConfig['insert.mode'] || 'upsert',
        ...destinationConfig
      }
    };

    return await this.connectorService.createConnector(config);
  }

  async startPipeline(pipelineId) {
    // Get pipeline connectors
    const { data: connectors } = await this.supabase
      .from('pipeline_connectors')
      .select('*')
      .eq('pipeline_id', pipelineId);

    // Resume all connectors
    for (const connector of connectors) {
      await this.connectorService.resumeConnector(connector.name);
    }

    // Update pipeline status
    await this.supabase
      .from('pipelines')
      .update({ status: 'running' })
      .eq('id', pipelineId);
  }

  async stopPipeline(pipelineId) {
    const { data: connectors } = await this.supabase
      .from('pipeline_connectors')
      .select('*')
      .eq('pipeline_id', pipelineId);

    for (const connector of connectors) {
      await this.connectorService.pauseConnector(connector.name);
    }

    await this.supabase
      .from('pipelines')
      .update({ status: 'paused' })
      .eq('id', pipelineId);
  }

  async deletePipeline(pipelineId) {
    const { data: connectors } = await this.supabase
      .from('pipeline_connectors')
      .select('*')
      .eq('pipeline_id', pipelineId);

    // Delete all connectors from Kafka Connect
    for (const connector of connectors) {
      await this.connectorService.deleteConnector(connector.name);
    }

    // Delete from database
    await this.supabase
      .from('pipelines')
      .delete()
      .eq('id', pipelineId);
  }

  getConnectorClass(dbType, connectorType) {
    const connectorMap = {
      oracle: {
        source: 'io.debezium.connector.oracle.OracleConnector'
      },
      postgres: {
        source: 'io.debezium.connector.postgresql.PostgresConnector',
        sink: 'io.confluent.connect.jdbc.JdbcSinkConnector'
      },
      sqlserver: {
        source: 'io.debezium.connector.sqlserver.SqlServerConnector'
      },
      mysql: {
        source: 'io.debezium.connector.mysql.MySqlConnector'
      }
    };

    return connectorMap[dbType][connectorType];
  }
}
```

---

### 3. Validation Service

**Responsibilities:**
- Validate database connections
- Run Debezium pre-checks
- Verify connector configurations

```javascript
class ValidationService {
  async validateSourceConnection(config) {
    try {
      const connection = await this.connectToDatabase(config);
      await connection.query('SELECT 1');

      const checks = await this.runDebeziumChecks(
        connection,
        config.db_type
      );

      await connection.close();

      return {
        success: true,
        message: 'Connection successful',
        checks
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async runDebeziumChecks(connection, dbType) {
    switch (dbType) {
      case 'oracle':
        return await this.checkOracleRequirements(connection);
      case 'postgres':
        return await this.checkPostgresRequirements(connection);
      case 'sqlserver':
        return await this.checkSqlServerRequirements(connection);
      default:
        return {};
    }
  }

  async checkOracleRequirements(connection) {
    const checks = {};

    // Check supplemental logging
    const suppLogResult = await connection.query(
      "SELECT SUPPLEMENTAL_LOG_DATA_MIN FROM V$DATABASE"
    );
    checks.supplementalLogging = {
      passed: suppLogResult.rows[0].SUPPLEMENTAL_LOG_DATA_MIN === 'YES',
      message: 'Database-level supplemental logging'
    };

    // Check archive log mode
    const archiveResult = await connection.query(
      "SELECT LOG_MODE FROM V$DATABASE"
    );
    checks.archiveLogMode = {
      passed: archiveResult.rows[0].LOG_MODE === 'ARCHIVELOG',
      message: 'Archive log mode enabled'
    };

    // Check LogMiner privileges
    try {
      await connection.query(
        "SELECT * FROM V$LOGMNR_CONTENTS WHERE ROWNUM = 1"
      );
      checks.logMinerAccess = {
        passed: true,
        message: 'LogMiner access granted'
      };
    } catch (error) {
      checks.logMinerAccess = {
        passed: false,
        message: 'LogMiner access denied'
      };
    }

    return checks;
  }

  async checkPostgresRequirements(connection) {
    const checks = {};

    // Check replication slot support
    const walLevel = await connection.query(
      "SHOW wal_level"
    );
    checks.walLevel = {
      passed: walLevel.rows[0].wal_level === 'logical',
      message: 'WAL level set to logical'
    };

    // Check replication privileges
    try {
      await connection.query(
        "SELECT * FROM pg_create_logical_replication_slot('test_slot', 'pgoutput')"
      );
      await connection.query(
        "SELECT pg_drop_replication_slot('test_slot')"
      );
      checks.replicationPrivileges = {
        passed: true,
        message: 'Replication privileges granted'
      };
    } catch (error) {
      checks.replicationPrivileges = {
        passed: false,
        message: 'Replication privileges missing'
      };
    }

    return checks;
  }

  async validateConnectorConfig(pluginName, config) {
    // Use Kafka Connect's built-in validation
    const validation = await this.connectorService.validateConnectorConfig(
      pluginName,
      config
    );

    return {
      valid: validation.error_count === 0,
      errors: validation.configs
        .filter(c => c.value.errors.length > 0)
        .map(c => ({
          field: c.value.name,
          errors: c.value.errors
        }))
    };
  }
}
```

---

### 4. Monitoring Service

**Responsibilities:**
- Collect connector and pipeline metrics
- Track Kafka consumer lag
- Aggregate logs
- Send alerts

```javascript
class MonitoringService {
  constructor(connectorService, supabase) {
    this.connectorService = connectorService;
    this.supabase = supabase;
    this.activePollers = new Map();
  }

  async collectPipelineMetrics(pipelineId) {
    // Get pipeline connectors
    const { data: connectors } = await this.supabase
      .from('pipeline_connectors')
      .select('*')
      .eq('pipeline_id', pipelineId);

    const metrics = {
      timestamp: new Date(),
      connectors: {}
    };

    // Collect metrics for each connector
    for (const connector of connectors) {
      try {
        const status = await this.connectorService.getConnectorStatus(
          connector.name
        );

        metrics.connectors[connector.name] = {
          state: status.connector.state,
          worker_id: status.connector.worker_id,
          tasks: status.tasks.map(t => ({
            id: t.id,
            state: t.state,
            worker_id: t.worker_id
          }))
        };

        // Get JMX metrics if available
        const jmxMetrics = await this.getJMXMetrics(connector.name);
        if (jmxMetrics) {
          metrics.connectors[connector.name].jmx = jmxMetrics;
        }
      } catch (error) {
        console.error(`Failed to collect metrics for ${connector.name}:`, error);
      }
    }

    // Store metrics in Supabase
    await this.supabase.from('pipeline_metrics').insert({
      pipeline_id: pipelineId,
      metrics: metrics
    });

    return metrics;
  }

  async getJMXMetrics(connectorName) {
    // This would connect to Kafka Connect's JMX endpoint
    // Implementation depends on your monitoring setup
    // Could use Prometheus, Jolokia, or direct JMX
    return null;
  }

  async getConsumerLag(pipelineId) {
    // Query Kafka consumer group lag
    // This would typically use kafka-admin client
    // or query a metrics system like Prometheus
    return {
      lag: 0,
      rate: 0
    };
  }

  startMetricsPolling(pipelineId, intervalMs = 30000) {
    if (this.activePollers.has(pipelineId)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        await this.collectPipelineMetrics(pipelineId);
      } catch (error) {
        console.error(`Metrics collection failed for pipeline ${pipelineId}:`, error);
      }
    }, intervalMs);

    this.activePollers.set(pipelineId, intervalId);
  }

  stopMetricsPolling(pipelineId) {
    const intervalId = this.activePollers.get(pipelineId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activePollers.delete(pipelineId);
    }
  }

  async aggregateLogs(pipelineId, options = {}) {
    const { limit = 100, level = null, startTime = null } = options;

    let query = this.supabase
      .from('pipeline_logs')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('ts', { ascending: false })
      .limit(limit);

    if (level) {
      query = query.eq('level', level);
    }

    if (startTime) {
      query = query.gte('ts', startTime);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  }
}
```

---

## 🔌 API Endpoints

### Complete REST API Specification

```yaml
# Connector Management
POST   /api/connectors
  Description: Create a new connector
  Body: ConnectorConfig
  Response: Connector

GET    /api/connectors
  Description: List all connectors
  Query: ?type=source|sink
  Response: Connector[]

GET    /api/connectors/:name
  Description: Get connector details
  Response: Connector

PUT    /api/connectors/:name/config
  Description: Update connector configuration
  Body: ConnectorConfig
  Response: Connector

DELETE /api/connectors/:name
  Description: Delete a connector
  Response: 204 No Content

PUT    /api/connectors/:name/pause
  Description: Pause a connector
  Response: 200 OK

PUT    /api/connectors/:name/resume
  Description: Resume a connector
  Response: 200 OK

POST   /api/connectors/:name/restart
  Description: Restart a connector
  Response: 200 OK

GET    /api/connectors/:name/status
  Description: Get connector status
  Response: ConnectorStatus

GET    /api/connectors/:name/tasks
  Description: Get connector tasks
  Response: Task[]

POST   /api/connectors/:name/tasks/:taskId/restart
  Description: Restart a specific task
  Response: 200 OK

GET    /api/connector-plugins
  Description: List available connector plugins
  Response: Plugin[]

PUT    /api/connector-plugins/:name/config/validate
  Description: Validate connector configuration
  Body: ConnectorConfig
  Response: ValidationResult

# Pipeline Management
POST   /api/pipelines
  Description: Create a new pipeline
  Body: PipelineCreateRequest
  Response: Pipeline

GET    /api/pipelines
  Description: List all pipelines
  Query: ?status=running|paused|error
  Response: Pipeline[]

GET    /api/pipelines/:id
  Description: Get pipeline details
  Response: PipelineDetail

PUT    /api/pipelines/:id
  Description: Update pipeline configuration
  Body: PipelineUpdateRequest
  Response: Pipeline

DELETE /api/pipelines/:id
  Description: Delete a pipeline
  Response: 204 No Content

POST   /api/pipelines/:id/start
  Description: Start a pipeline
  Response: 200 OK

POST   /api/pipelines/:id/stop
  Description: Stop a pipeline
  Response: 200 OK

GET    /api/pipelines/:id/status
  Description: Get comprehensive pipeline status
  Response: PipelineStatus

GET    /api/pipelines/:id/metrics
  Description: Get pipeline metrics
  Query: ?start_time=ISO8601&end_time=ISO8601
  Response: Metrics

GET    /api/pipelines/:id/connectors
  Description: List pipeline connectors
  Response: Connector[]

# Validation & Pre-checks
POST   /api/validate/source
  Description: Validate source database connection
  Body: SourceConfig
  Response: ValidationResult

POST   /api/validate/destination
  Description: Validate destination connection
  Body: DestinationConfig
  Response: ValidationResult

POST   /api/validate/debezium
  Description: Run Debezium-specific checks
  Body: DebeziumConfig
  Response: DebeziumChecks

# Schema & Discovery
GET    /api/schemas/:connectionId/databases
  Description: List databases
  Response: string[]

GET    /api/schemas/:connectionId/tables
  Description: List tables in a database
  Query: ?database=name&schema=name
  Response: Table[]

GET    /api/schemas/:connectionId/columns
  Description: Get table columns
  Query: ?database=name&schema=name&table=name
  Response: Column[]

# Kafka Topics
GET    /api/topics
  Description: List Kafka topics
  Response: Topic[]

GET    /api/topics/:name
  Description: Get topic details
  Response: TopicDetail

GET    /api/topics/:name/messages
  Description: Sample topic messages
  Query: ?limit=10&offset=0
  Response: Message[]

# Monitoring & Logs
GET    /api/pipelines/:id/logs
  Description: Get pipeline logs
  Query: ?level=info|warn|error&limit=100&start_time=ISO8601
  Response: LogEntry[]

GET    /api/pipelines/:id/lag
  Description: Get consumer lag metrics
  Response: LagMetrics

GET    /api/pipelines/:id/throughput
  Description: Get throughput metrics
  Query: ?window=1h|24h|7d
  Response: ThroughputMetrics

# System Health
GET    /api/health
  Description: Health check endpoint
  Response: HealthStatus

GET    /api/health/kafka
  Description: Kafka cluster health
  Response: KafkaHealth

GET    /api/health/connect
  Description: Kafka Connect health
  Response: ConnectHealth
```

---

## 📊 Data Models

### Pipeline
```typescript
interface Pipeline {
  id: string;
  user_id: string;
  name: string;
  source_type: 'oracle' | 'postgres' | 'sqlserver' | 'mysql';
  source_config: Record<string, any>;
  destination_type: string;
  destination_config: Record<string, any>;
  mode: 'batch' | 'log' | 'micro-batch';
  frequency_minutes: number;
  status: 'draft' | 'running' | 'seeding' | 'incremental' | 'idle' | 'error' | 'paused';
  created_at: string;
  updated_at: string;
}
```

### Connector
```typescript
interface Connector {
  id: string;
  pipeline_id: string;
  name: string;
  type: 'source' | 'sink';
  connector_class: string;
  config: Record<string, any>;
  status: 'running' | 'paused' | 'failed';
  tasks_max: number;
  created_at: string;
  updated_at: string;
}
```

### ConnectorStatus
```typescript
interface ConnectorStatus {
  name: string;
  connector: {
    state: 'RUNNING' | 'PAUSED' | 'FAILED';
    worker_id: string;
  };
  tasks: Array<{
    id: number;
    state: 'RUNNING' | 'PAUSED' | 'FAILED';
    worker_id: string;
    trace?: string;
  }>;
  type: 'source' | 'sink';
}
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up backend project structure
- [ ] Implement authentication middleware
- [ ] Create Kafka Connect client wrapper
- [ ] Build basic CRUD endpoints for connectors
- [ ] Set up Supabase integration

### Phase 2: Pipeline Orchestration (Week 3-4)
- [ ] Implement PipelineService
- [ ] Build pipeline creation workflow
- [ ] Add pipeline lifecycle management
- [ ] Implement configuration validation
- [ ] Add error handling and rollback

### Phase 3: Validation & Pre-checks (Week 5)
- [ ] Implement ValidationService
- [ ] Add database connection testing
- [ ] Build Debezium pre-check logic
- [ ] Create connector config validation

### Phase 4: Monitoring & Metrics (Week 6-7)
- [ ] Implement MonitoringService
- [ ] Set up metrics collection
- [ ] Build log aggregation
- [ ] Add real-time status updates
- [ ] Implement alerting system

### Phase 5: Advanced Features (Week 8-10)
- [ ] Schema discovery API
- [ ] Table/column metadata caching
- [ ] Data preview functionality
- [ ] Performance optimization
- [ ] Comprehensive testing

### Phase 6: Production Ready (Week 11-12)
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation
- [ ] Deployment automation
- [ ] Monitoring dashboards

---

## 🔒 Security Considerations

### Authentication & Authorization
- Use Supabase Auth for user management
- Implement JWT-based authentication
- Add role-based access control (RBAC)
- Secure sensitive configuration (passwords, keys)

### Data Protection
- Encrypt sensitive data at rest
- Use secure connections (TLS/SSL)
- Implement audit logging
- Sanitize user inputs

### API Security
- Rate limiting
- CORS configuration
- Input validation
- SQL injection prevention
- XSS protection

---

## 📈 Monitoring & Observability

### Key Metrics to Track
- Pipeline throughput (records/sec)
- Connector lag
- Error rates
- API latency
- Resource utilization

### Logging Strategy
- Structured logging (JSON)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Centralized log aggregation
- Log retention policies

### Alerting
- Pipeline failures
- High lag warnings
- Connector errors
- Resource exhaustion
- Authentication failures

---

## 🛠️ Technology Stack Recommendations

### Primary Option: Node.js
```
- Runtime: Node.js 18+ LTS
- Framework: Express.js
- Database Client: @supabase/supabase-js
- HTTP Client: node-fetch or axios
- WebSocket: ws or socket.io
- Testing: Jest
- Validation: Joi or Zod
- Process Manager: PM2
```

### Alternative: Python
```
- Runtime: Python 3.10+
- Framework: FastAPI
- Database Client: supabase-py
- HTTP Client: httpx
- WebSocket: FastAPI WebSocket
- Testing: pytest
- Validation: Pydantic
- Process Manager: Gunicorn + Uvicorn
```

### Alternative: Go
```
- Runtime: Go 1.20+
- Framework: Gin or Echo
- Database: supabase-go
- HTTP Client: net/http
- WebSocket: gorilla/websocket
- Testing: testing package
- Process Manager: systemd
```

---

## 📦 Deployment Options

### Docker Compose (Development)
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - KAFKA_CONNECT_URL=${KAFKA_CONNECT_URL}
    depends_on:
      - kafka-connect
```

### Kubernetes (Production)
- Deploy as microservice
- Use Horizontal Pod Autoscaler
- Configure health checks
- Set resource limits

### Serverless (Supabase Edge Functions)
- Deploy individual functions
- Use environment variables
- Configure secrets management
- Set up monitoring

---

## 💡 Best Practices

1. **Use connection pooling** for database connections
2. **Implement circuit breakers** for external API calls
3. **Cache frequently accessed data** (connector configs, schemas)
4. **Use async/await** for non-blocking operations
5. **Implement proper error handling** with meaningful messages
6. **Add request/response logging** for debugging
7. **Version your API** (/v1/api/...)
8. **Document your API** (OpenAPI/Swagger)
9. **Write comprehensive tests** (unit, integration, e2e)
10. **Monitor performance metrics** continuously

---

## 📚 Additional Resources

- [Kafka Connect REST API Documentation](https://docs.confluent.io/platform/current/connect/references/restapi.html)
- [Debezium Documentation](https://debezium.io/documentation/)
- [Supabase Documentation](https://supabase.com/docs)
- [Kafka Consumer Lag Monitoring](https://docs.confluent.io/platform/current/kafka/monitoring.html)

---

## 📞 Next Steps

To proceed with implementation:

1. Choose your preferred technology stack
2. Set up the development environment
3. Start with Phase 1 (Foundation)
4. Iterate and add features progressively
5. Test thoroughly at each phase

**Ready to start building?** Let me know which technology stack you prefer, and I can provide detailed implementation code for specific services!
