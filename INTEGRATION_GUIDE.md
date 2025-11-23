# Frontend-Backend Integration Guide

Complete integration between frontend and Debezium backend for pipeline operations.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│                                                          │
│  ┌────────────────┐      ┌──────────────────────────┐  │
│  │ PipelineDetail │──────│   debezium.ts (API)      │  │
│  │     Page       │      │   - deployPipeline()     │  │
│  └────────────────┘      │   - startPipeline()      │  │
│                          │   - pausePipeline()      │  │
│                          │   - getPipelineStatus()  │  │
│                          └──────────┬───────────────┘  │
└─────────────────────────────────────┼───────────────────┘
                                      │
                        ┌─────────────▼──────────────┐
                        │  Debezium Backend          │
                        │  (Port 5002)               │
                        │                            │
                        │  /api/pipelines/:id/deploy │
                        │  /api/pipelines/:id/start  │
                        │  /api/pipelines/:id/pause  │
                        │  /api/pipelines/:id/status │
                        └─────────────┬──────────────┘
                                      │
                        ┌─────────────▼──────────────┐
                        │  Kafka Connect             │
                        │  (Port 8083)               │
                        │                            │
                        │  - Source Connectors       │
                        │  - Sink Connectors         │
                        └────────────────────────────┘
```

## Integration Points

### 1. Pipeline Deployment

**Frontend Flow:**
```typescript
// User clicks "Deploy Pipeline" button
handleDeployPipeline() {
  // 1. Call Debezium backend
  const result = await deployPipeline(pipelineId);

  // 2. Update Supabase status
  if (result.success) {
    await supabase.from('pipelines')
      .update({ status: 'running' })
      .eq('id', pipelineId);
  }

  // 3. Show feedback to user
  showToast('success', 'Pipeline deployed');
}
```

**Backend Flow:**
```javascript
POST /api/pipelines/:id/deploy

1. Fetch pipeline config from Supabase
2. Extract source and sink configurations
3. Create source connector in Kafka Connect
4. Create sink connector in Kafka Connect
5. Update pipeline status in Supabase
6. Return deployment results
```

### 2. Pipeline Start/Resume

**Frontend Flow:**
```typescript
// User clicks "Start/Resume Pipeline"
handleStartPipeline() {
  // 1. Call Debezium backend
  const result = await startPipeline(pipelineId);

  // 2. Update Supabase
  if (result.success) {
    await supabase.from('pipelines')
      .update({ status: 'running' })
      .eq('id', pipelineId);
  }
}
```

**Backend Flow:**
```javascript
POST /api/pipelines/:id/start

1. Fetch pipeline name from Supabase
2. Resume source connector via Kafka Connect
3. Resume sink connector via Kafka Connect
4. Update status in Supabase
5. Return result
```

### 3. Pipeline Pause

**Frontend Flow:**
```typescript
// User clicks "Pause Pipeline"
handlePausePipeline() {
  // 1. Call Debezium backend
  const result = await pausePipeline(pipelineId);

  // 2. Update Supabase
  if (result.success) {
    await supabase.from('pipelines')
      .update({ status: 'paused' })
      .eq('id', pipelineId);
  }
}
```

**Backend Flow:**
```javascript
POST /api/pipelines/:id/pause

1. Fetch pipeline name from Supabase
2. Pause source connector via Kafka Connect
3. Pause sink connector via Kafka Connect
4. Update status in Supabase
5. Return result
```

### 4. Pipeline Status Monitoring

**Frontend Flow:**
```typescript
// Auto-refresh pipeline status
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await getPipelineStatus(pipelineId);

    // Update UI with connector states
    if (status.status?.source) {
      // Display source connector state
    }
    if (status.status?.sink) {
      // Display sink connector state
    }
  }, 5000); // Every 5 seconds

  return () => clearInterval(interval);
}, [pipelineId]);
```

**Backend Flow:**
```javascript
GET /api/pipelines/:id/status

1. Fetch pipeline name from Supabase
2. Get source connector status from Kafka Connect
3. Get sink connector status from Kafka Connect
4. Aggregate and return status
```

### 5. Pipeline Deletion

**Frontend Flow:**
```typescript
// User confirms deletion
handleDeletePipeline() {
  // 1. Delete connectors from Kafka Connect
  try {
    await deletePipelineConnectors(pipelineId);
  } catch (error) {
    console.warn('Connector deletion failed:', error);
  }

  // 2. Delete from Supabase (even if step 1 fails)
  await supabase.from('pipelines').delete().eq('id', pipelineId);

  // 3. Navigate away
  navigate('/pipelines');
}
```

**Backend Flow:**
```javascript
DELETE /api/pipelines/:id/connectors

1. Fetch pipeline name from Supabase
2. Delete source connector from Kafka Connect
3. Delete sink connector from Kafka Connect
4. Return result
```

---

## Configuration

### Environment Variables

**Frontend (.env):**
```env
VITE_DEBEZIUM_BACKEND_URL=http://localhost:5002
```

**Backend (.env):**
```env
DEBEZIUM_BACKEND_PORT=5002
DEBEZIUM_BACKEND_HOST=0.0.0.0
KAFKA_CONNECT_URL=http://127.0.0.1:8083

SUPABASE_DB_HOST=db.your-project.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-password
SUPABASE_DB_SSL=require
```

---

## API Client (src/lib/debezium.ts)

### Functions

#### deployPipeline(pipelineId: string)
Deploy pipeline to Kafka Connect.

**Returns:**
```typescript
{
  success: boolean;
  message?: string;
  results?: {
    source: { action: 'created' | 'updated', connector: any };
    sink: { action: 'created' | 'updated', connector: any };
    errors: Array<{ connector: string; error: string }>;
  };
  error?: string;
}
```

#### startPipeline(pipelineId: string)
Start (resume) pipeline connectors.

**Returns:**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
}
```

#### pausePipeline(pipelineId: string)
Pause pipeline connectors.

**Returns:**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
}
```

#### getPipelineStatus(pipelineId: string)
Get real-time pipeline status from Kafka Connect.

**Returns:**
```typescript
{
  success: boolean;
  status?: {
    source: {
      name: string;
      connector: { state: 'RUNNING' | 'PAUSED' | 'FAILED', worker_id: string };
      tasks: Array<{ id: number; state: string; worker_id: string }>;
    };
    sink: {
      name: string;
      connector: { state: 'RUNNING' | 'PAUSED' | 'FAILED', worker_id: string };
      tasks: Array<{ id: number; state: string; worker_id: string }>;
    };
    errors: Array<{ connector: string; error: string }>;
  };
  error?: string;
}
```

#### deletePipelineConnectors(pipelineId: string)
Delete pipeline connectors from Kafka Connect.

**Returns:**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
}
```

---

## UI Components

### Pipeline Detail Page Actions

**Status-based Actions:**

| Status | Available Actions | Description |
|--------|------------------|-------------|
| `ready` | Deploy Pipeline | Initial deployment to Kafka Connect |
| `running` | Pause Pipeline | Pause both connectors |
| `paused` | Resume Pipeline | Resume both connectors |
| `error` | Restart Pipeline | Restart failed connectors |
| Any | Delete Pipeline | Remove connectors and database record |

**Action Menu:**
```tsx
<MoreVertical /> (Three dots menu)
  ├─ Deploy Pipeline (if status === 'ready')
  ├─ Start/Resume Pipeline (if status !== 'running')
  ├─ Pause Pipeline (if status === 'running')
  ├─ Restart Pipeline (always available)
  └─ Delete Pipeline (always available)
```

---

## Error Handling

### Frontend Error Handling

```typescript
try {
  const result = await deployPipeline(pipelineId);

  if (!result.success) {
    // Handle partial failures
    const errors = result.results?.errors || [];
    if (errors.length > 0) {
      const errorMsg = errors.map(e => `${e.connector}: ${e.error}`).join(', ');
      showToast('error', errorMsg);
    } else {
      showToast('error', result.error);
    }
  }
} catch (error) {
  // Handle network/unexpected errors
  showToast('error', error.message);
}
```

### Backend Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing parameters)
- `404` - Not Found (pipeline/connector not found)
- `500` - Internal Server Error
- `502` - Bad Gateway (Kafka Connect unavailable)

---

## Testing Integration

### Manual Testing Steps

1. **Start Services:**
   ```bash
   # Terminal 1
   npm run backend:dev

   # Terminal 2
   npm run debezium:dev

   # Terminal 3
   npm run dev
   ```

2. **Create Pipeline:**
   - Go to http://localhost:5173
   - Create new pipeline via wizard
   - Configure source and destination

3. **Deploy Pipeline:**
   - Open pipeline detail page
   - Click three-dots menu
   - Click "Deploy Pipeline"
   - Verify success toast

4. **Check Kafka Connect:**
   ```bash
   curl http://localhost:8083/connectors
   # Should list: pipeline-name-source, pipeline-name-sink
   ```

5. **Check Status:**
   ```bash
   curl http://localhost:5002/api/pipelines/{pipeline-id}/status
   ```

6. **Pause Pipeline:**
   - Click "Pause Pipeline"
   - Verify connectors are paused in Kafka Connect

7. **Resume Pipeline:**
   - Click "Resume Pipeline"
   - Verify connectors are running

8. **Delete Pipeline:**
   - Click "Delete Pipeline"
   - Verify connectors removed from Kafka Connect
   - Verify pipeline removed from database

### Automated Testing

```typescript
// Example integration test
describe('Pipeline Operations', () => {
  it('should deploy pipeline successfully', async () => {
    const result = await deployPipeline('test-pipeline-id');
    expect(result.success).toBe(true);
    expect(result.results?.source).toBeDefined();
    expect(result.results?.sink).toBeDefined();
  });

  it('should handle deployment failure', async () => {
    const result = await deployPipeline('invalid-id');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

## Troubleshooting

### "Debezium backend URL is not configured"

**Problem:** Frontend can't find backend.

**Solution:**
```bash
# Check .env file
cat .env | grep VITE_DEBEZIUM_BACKEND_URL

# Should be:
VITE_DEBEZIUM_BACKEND_URL=http://localhost:5002
```

### "Failed to connect to Kafka Connect"

**Problem:** Backend can't reach Kafka Connect.

**Solution:**
```bash
# Check Kafka Connect
curl http://localhost:8083/

# Check backend env
cat .env | grep KAFKA_CONNECT_URL

# Should be:
KAFKA_CONNECT_URL=http://127.0.0.1:8083
```

### "Pipeline not found"

**Problem:** Pipeline doesn't exist in database.

**Solution:**
```sql
-- Check Supabase
SELECT * FROM pipelines WHERE id = 'pipeline-id';

-- Check connectors
SELECT * FROM pipeline_connectors WHERE pipeline_id = 'pipeline-id';
```

### Partial Deployment Failure

**Problem:** Source deployed but sink failed.

**Solution:**
- Check error message in toast
- Review Kafka Connect logs
- Delete failed connector manually
- Fix configuration
- Redeploy

---

## Best Practices

1. **Always check backend health:**
   ```typescript
   const health = await checkDebeziumBackendHealth();
   if (health.status !== 'ok') {
     showToast('warning', 'Debezium backend unavailable');
   }
   ```

2. **Handle partial failures:**
   - Show specific error for source/sink
   - Allow manual retry
   - Provide cleanup options

3. **Update UI optimistically:**
   ```typescript
   // Update UI immediately
   setPipeline({ ...pipeline, status: 'running' });

   // Then call backend
   const result = await startPipeline(id);

   // Revert if failed
   if (!result.success) {
     setPipeline({ ...pipeline, status: 'paused' });
   }
   ```

4. **Poll status regularly:**
   - Every 5-10 seconds for active pipelines
   - Stop polling when page unmounts
   - Show last update timestamp

5. **Graceful degradation:**
   - If backend unavailable, disable actions
   - Show warning message
   - Allow view-only mode

---

## Future Enhancements

### Real-time Status Updates

Use WebSocket for live updates:

```typescript
const ws = new WebSocket(`ws://localhost:5002/ws/pipelines/${pipelineId}`);

ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  updatePipelineStatus(status);
};
```

### Connector Health Metrics

Display metrics from Kafka Connect:

```typescript
const metrics = await getConnectorMetrics(connectorName);
// Display: throughput, lag, errors, etc.
```

### Automated Retry

Auto-retry failed deployments:

```typescript
async function deployWithRetry(pipelineId: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await deployPipeline(pipelineId);
    if (result.success) return result;

    await sleep(5000 * (i + 1)); // Exponential backoff
  }
  throw new Error('Deployment failed after retries');
}
```

---

## Summary

✅ Frontend integrated with Debezium backend
✅ Pipeline deployment flow complete
✅ Start/pause/resume operations working
✅ Status monitoring implemented
✅ Error handling comprehensive
✅ UI actions status-aware
✅ Build successful

**Integration is complete and production-ready!** 🚀
