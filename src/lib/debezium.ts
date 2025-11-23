const debeziumBackendUrl = import.meta.env.VITE_DEBEZIUM_BACKEND_URL;

if (!debeziumBackendUrl) {
  console.warn('VITE_DEBEZIUM_BACKEND_URL is not configured');
}

export interface PipelineDeployResult {
  success: boolean;
  message?: string;
  results?: {
    source: { action: string; connector: any } | null;
    sink: { action: string; connector: any } | null;
    errors: Array<{ connector: string; error: string }>;
  };
  error?: string;
}

export interface PipelineStatusResult {
  success: boolean;
  status?: {
    source: {
      name: string;
      connector: { state: string; worker_id: string };
      tasks: Array<{ id: number; state: string; worker_id: string }>;
    } | null;
    sink: {
      name: string;
      connector: { state: string; worker_id: string };
      tasks: Array<{ id: number; state: string; worker_id: string }>;
    } | null;
    errors: Array<{ connector: string; error: string }>;
  };
  error?: string;
}

export interface ConnectorStatus {
  success: boolean;
  status?: {
    name: string;
    connector: { state: string; worker_id: string };
    tasks: Array<{ id: number; state: string; worker_id: string; trace?: string }>;
    type: string;
  };
  error?: string;
}

export interface PipelineProgressEvent {
  event_type: 'source_connected' | 'ingesting_started' | 'staging_events' | 'loading_started';
  event_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
  occurred_at: string;
}

export interface PipelineProgress {
  source_connected?: PipelineProgressEvent;
  ingesting_started?: PipelineProgressEvent;
  staging_events?: PipelineProgressEvent;
  loading_started?: PipelineProgressEvent;
}

export interface ActivityMetric {
  total: number;
  rate: number;
}

export interface PipelineActivity {
  ingestion: ActivityMetric;
  transformations: ActivityMetric;
  schemaMapper: ActivityMetric;
  load: ActivityMetric;
  timeRange: string;
}

export interface MetricData {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
}

export interface ConnectorTaskMetric {
  id: string;
  lag: string;
  status: 'healthy' | 'warning' | 'error';
  records: string;
}

export interface SlowTable {
  table: string;
  lag: string;
  records: string;
  status: string;
}

export interface PipelineMonitoring {
  state: {
    status: string;
    errorRate: string;
    commitRate: string;
    queueUsage: string;
  };
  lagMetrics: MetricData[];
  throughputMetrics: { label: string; value: string }[];
  connectorTasks: ConnectorTaskMetric[];
  slowTables: SlowTable[];
  flowMetrics?: {
    sourceToKafka: string;
    kafkaToSink: string;
    sinkToDestination: string;
  };
}

async function retryableFetch(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      if (i === maxRetries - 1) throw error;
      if (error.name === 'AbortError') {
        throw new Error('Request timeout after 30 seconds');
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Retry exhausted');
}

export async function deployPipeline(pipelineId: string): Promise<PipelineDeployResult> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await retryableFetch(`${debeziumBackendUrl}/api/pipelines/${pipelineId}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to deploy pipeline');
  }

  return data;
}

export async function startPipeline(pipelineId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await retryableFetch(`${debeziumBackendUrl}/api/pipelines/${pipelineId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to start pipeline');
  }

  return data;
}

export async function pausePipeline(pipelineId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!debeziumBackendUrl) {
    console.error('Debezium backend URL not configured');
    return { success: false, error: 'Debezium backend URL is not configured. Check VITE_DEBEZIUM_BACKEND_URL in .env' };
  }

  try {
    console.log('Calling pause endpoint:', `${debeziumBackendUrl}/api/pipelines/${pipelineId}/pause`);

    const response = await retryableFetch(`${debeziumBackendUrl}/api/pipelines/${pipelineId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    console.log('Pause response status:', response.status);

    const data = await response.json();
    console.log('Pause response data:', data);

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}: Failed to pause pipeline` };
    }

    return data;
  } catch (error: any) {
    console.error('Pause fetch error:', error);
    return {
      success: false,
      error: `Network error: ${error.message}. Make sure the debezium backend is running on ${debeziumBackendUrl}`
    };
  }
}

export async function deletePipelineConnectors(pipelineId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await fetch(`${debeziumBackendUrl}/api/pipelines/${pipelineId}/connectors`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete connectors');
  }

  return data;
}

export async function getPipelineStatus(pipelineId: string): Promise<PipelineStatusResult> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await retryableFetch(`${debeziumBackendUrl}/api/pipelines/${pipelineId}/status`, {
    method: 'GET',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get pipeline status');
  }

  return data;
}

export async function getConnectorStatus(connectorName: string): Promise<ConnectorStatus> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await fetch(`${debeziumBackendUrl}/api/kafka-connect/connectors/${encodeURIComponent(connectorName)}/status`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get connector status');
  }

  return data;
}

export async function calculatePipelineProgress(pipelineId: string): Promise<PipelineProgress> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  try {
    const response = await retryableFetch(`${debeziumBackendUrl}/api/pipelines/${pipelineId}/progress`, {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get pipeline progress');
    }

    return data.progress || {};
  } catch (error) {
    console.error('Error fetching pipeline progress:', error);
    return {};
  }
}

export async function getPipelineActivity(pipelineId: string, timeRange: '2h' | '12h' | '24h' = '24h'): Promise<PipelineActivity | null> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  try {
    const response = await retryableFetch(
      `${debeziumBackendUrl}/api/pipelines/${pipelineId}/activity?timeRange=${timeRange}`,
      { method: 'GET' }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get pipeline activity');
    }

    return data.activity || null;
  } catch (error) {
    console.error('Error fetching pipeline activity:', error);
    return null;
  }
}

export async function getPipelineMonitoring(pipelineId: string): Promise<PipelineMonitoring | null> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  try {
    const response = await retryableFetch(
      `${debeziumBackendUrl}/api/pipelines/${pipelineId}/monitoring`,
      { method: 'GET' }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get pipeline monitoring data');
    }

    return data.monitoring || null;
  } catch (error) {
    console.error('Error fetching pipeline monitoring:', error);
    return null;
  }
}

export async function restartConnector(connectorName: string, includeTasks = false, onlyFailed = false): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const params = new URLSearchParams();
  if (includeTasks) params.append('includeTasks', 'true');
  if (onlyFailed) params.append('onlyFailed', 'true');

  const response = await fetch(
    `${debeziumBackendUrl}/api/kafka-connect/connectors/${encodeURIComponent(connectorName)}/restart?${params.toString()}`,
    { method: 'POST' }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to restart connector');
  }

  return data;
}

export async function restartTask(connectorName: string, taskId: number): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await fetch(
    `${debeziumBackendUrl}/api/kafka-connect/connectors/${encodeURIComponent(connectorName)}/tasks/${taskId}/restart`,
    { method: 'POST' }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to restart task');
  }

  return data;
}

export async function listConnectors(): Promise<{ success: boolean; connectors?: Record<string, any>; error?: string }> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await fetch(`${debeziumBackendUrl}/api/kafka-connect/connectors`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to list connectors');
  }

  return data;
}

export async function getKafkaConnectInfo(): Promise<{ success: boolean; info?: any; error?: string }> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await fetch(`${debeziumBackendUrl}/api/kafka-connect/info`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get Kafka Connect info');
  }

  return data;
}

export async function checkDebeziumBackendHealth(): Promise<{ status: string; kafkaConnect?: string }> {
  if (!debeziumBackendUrl) {
    throw new Error('Debezium backend URL is not configured');
  }

  const response = await fetch(`${debeziumBackendUrl}/api/health`);

  if (!response.ok) {
    throw new Error('Debezium backend is not available');
  }

  return response.json();
}
