/**
 * Time-Series Monitoring Endpoint
 *
 * This endpoint fetches time-series data from Prometheus for monitoring charts
 * Supports caching with Redis for better performance
 */

export function createTimeSeriesEndpoint(server, PROMETHEUS_URL, getCached, setCached, isRedisConnected, dbPool) {

  server.get('/api/monitoring/timeseries', async (request, reply) => {
    const { pipelineId, metric, range = '5m', step = '15s' } = request.query;

    if (!pipelineId || !metric) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required parameters: pipelineId and metric'
      });
    }

    try {
      // Check Redis cache first
      const cacheKey = `timeseries:${pipelineId}:${metric}:${range}:${step}`;
      if (isRedisConnected()) {
        const cached = await getCached(cacheKey);
        if (cached) {
          return { success: true, data: cached, cached: true };
        }
      }

      // Calculate time range
      const endTime = Math.floor(Date.now() / 1000);
      const rangeSeconds = parseTimeRange(range);
      const startTime = endTime - rangeSeconds;

      // Get connector names from database
      const dbResult = await dbPool.query(
        'SELECT name, type FROM pipeline_connectors WHERE pipeline_id = $1',
        [pipelineId]
      );
      const connectors = dbResult.rows;

      const sourceConnector = connectors?.find(c => c.type === 'source');
      const sinkConnector = connectors?.find(c => c.type === 'sink');

      if (!sourceConnector) {
        return reply.code(404).send({
          success: false,
          error: 'Source connector not found'
        });
      }

      // Build Prometheus query based on metric type
      let query = '';
      switch (metric) {
        case 'throughput':
          query = `rate(kafka_connect_source_task_metrics_source_record_poll_total{connector="${sourceConnector.name}"}[1m])`;
          break;
        case 'latency':
          query = `kafka_connect_source_task_metrics_poll_batch_avg_time_ms{connector="${sourceConnector.name}"}`;
          break;
        case 'errors':
          query = `rate(kafka_connect_task_error_metrics_total_errors_logged{connector="${sourceConnector.name}"}[1m])`;
          break;
        case 'commit_success':
          query = `kafka_connect_connector_task_metrics_offset_commit_success_percentage{connector="${sourceConnector.name}"}`;
          break;
        case 'sink_throughput':
          if (!sinkConnector) {
            return reply.code(404).send({ success: false, error: 'Sink connector not found' });
          }
          query = `rate(kafka_connect_sink_task_metrics_sink_record_send_total{connector="${sinkConnector.name}"}[1m])`;
          break;
        case 'sink_latency':
          if (!sinkConnector) {
            return reply.code(404).send({ success: false, error: 'Sink connector not found' });
          }
          query = `kafka_connect_sink_task_metrics_put_batch_avg_time_ms{connector="${sinkConnector.name}"}`;
          break;
        default:
          return reply.code(400).send({
            success: false,
            error: `Unknown metric: ${metric}. Supported: throughput, latency, errors, commit_success, sink_throughput, sink_latency`
          });
      }

      // Query Prometheus
      const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${startTime}&end=${endTime}&step=${step}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        throw new Error(`Prometheus returned error: ${data.error || 'Unknown error'}`);
      }

      // Format response
      const responseData = {
        metric,
        range,
        step,
        series: data.data.result.map(series => ({
          labels: series.metric,
          values: series.values.map(([timestamp, value]) => ({
            timestamp: timestamp * 1000, // Convert to milliseconds
            value: parseFloat(value)
          }))
        }))
      };

      // Cache for 10 seconds
      if (isRedisConnected()) {
        await setCached(cacheKey, responseData, 10);
      }

      return { success: true, data: responseData, cached: false };
    } catch (error) {
      console.error('Error fetching time-series data:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });
}

/**
 * Parse time range string to seconds
 */
function parseTimeRange(range) {
  const match = range.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 300; // Default 5 minutes
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 300;
  }
}
