import pg from 'pg';

const { Pool: PgPool } = pg;

// Database connection
const dbPool = new PgPool({
  host: process.env.SUPABASE_DB_HOST || '127.0.0.1',
  port: Number(process.env.SUPABASE_DB_PORT || 54322),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'postgres',
  ssl: process.env.SUPABASE_DB_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

const KAFKA_CONNECT_URL = process.env.KAFKA_CONNECT_URL || 'http://127.0.0.1:8083';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';

/**
 * Proactive Monitoring Service
 * Runs every N seconds to check all running pipelines
 * Thresholds are loaded from database
 */
class MonitoringService {
  constructor() {
    this.previousMetrics = new Map(); // Store previous values for comparison
    this.pauseTracking = new Map(); // Track when connectors were paused
    this.isRunning = false;
    this.thresholds = {
      // Default values (will be overridden from database)
      lag_ms: 5000,
      throughput_drop_percent: 50,
      error_rate_percent: 1,
      dlq_count: 0,
      check_interval_ms: 60000,
      pause_duration_seconds: 5,
    };
  }

  /**
   * Load thresholds from database
   */
  async loadThresholds() {
    const client = await dbPool.connect();
    try {
      const result = await client.query(`
        SELECT lag_ms, throughput_drop_percent, error_rate_percent,
               dlq_count, check_interval_ms, pause_duration_seconds
        FROM monitoring_settings
        ORDER BY updated_at DESC
        LIMIT 1
      `);

      if (result.rows.length > 0) {
        this.thresholds = result.rows[0];
        console.log('📊 Loaded monitoring thresholds:', this.thresholds);
      } else {
        console.log('⚠️  No thresholds found in database, using defaults');
      }
    } catch (error) {
      console.error('❌ Failed to load thresholds from database:', error.message);
      console.log('⚠️  Using default thresholds');
    } finally {
      client.release();
    }
  }

  /**
   * Start the monitoring service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Monitoring service already running');
      return;
    }

    this.isRunning = true;
    console.log('🔍 Starting proactive monitoring service...');

    // Load thresholds from database
    await this.loadThresholds();

    // Run immediately on start
    this.checkAllPipelines();

    // Then run every N seconds (configurable from database)
    this.interval = setInterval(() => {
      this.checkAllPipelines();
    }, this.thresholds.check_interval_ms);

    console.log(`✅ Monitoring service started (${this.thresholds.check_interval_ms / 1000}s interval)`);
  }

  /**
   * Stop the monitoring service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('🛑 Monitoring service stopped');
    }
  }

  /**
   * Check all running/paused pipelines
   */
  async checkAllPipelines() {
    const client = await dbPool.connect();
    try {
      // Get all running or paused pipelines
      const result = await client.query(
        `SELECT p.id, p.name, p.status
         FROM pipelines p
         WHERE p.status IN ('running', 'paused')
         ORDER BY p.name`
      );

      console.log(`🔍 Checking ${result.rows.length} pipelines...`);

      for (const pipeline of result.rows) {
        await this.checkPipeline(client, pipeline);
      }
    } catch (error) {
      console.error('❌ Error checking pipelines:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Check a single pipeline for issues
   */
  async checkPipeline(client, pipeline) {
    try {
      // Get connectors for this pipeline
      const connectorsRes = await client.query(
        'SELECT name, type FROM pipeline_connectors WHERE pipeline_id = $1',
        [pipeline.id]
      );

      if (connectorsRes.rows.length === 0) {
        return; // No connectors to check
      }

      const sourceConnector = connectorsRes.rows.find(c => c.type === 'source');
      const sinkConnector = connectorsRes.rows.find(c => c.type === 'sink');

      // Check 1: Connector Failed
      await this.checkConnectorStatus(client, pipeline, sourceConnector, 'source');
      await this.checkConnectorStatus(client, pipeline, sinkConnector, 'sink');

      // Check 2-5: Only for running pipelines with source connector
      if (pipeline.status === 'running' && sourceConnector) {
        await this.checkLag(client, pipeline, sourceConnector.name);
        await this.checkThroughput(client, pipeline, sourceConnector.name);
        await this.checkDLQ(client, pipeline, sourceConnector.name);
        await this.checkErrorRate(client, pipeline, sourceConnector.name);
      }
    } catch (error) {
      console.error(`❌ Error checking pipeline ${pipeline.name}:`, error.message);
    }
  }

  /**
   * Check 1: Connector Failed
   */
  async checkConnectorStatus(client, pipeline, connector, type) {
    if (!connector) return;

    try {
      const response = await fetch(`${KAFKA_CONNECT_URL}/connectors/${connector.name}/status`, {
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) return;

      const status = await response.json();
      const connectorState = status.connector?.state;

      // Check if connector is FAILED
      if (connectorState === 'FAILED') {
        await this.createAlert(client, {
          pipeline_id: pipeline.id,
          alert_type: 'CONNECTOR_FAILED',
          severity: 'critical',
          message: `${type.toUpperCase()} connector "${connector.name}" is FAILED`,
          metadata: {
            connector_name: connector.name,
            connector_type: type,
            error_trace: status.connector?.trace,
            worker_id: status.connector?.worker_id
          }
        });
      } else {
        // Connector is now running - do not auto-resolve alerts
      }

      // Check if connector is PAUSED (check pause duration threshold)
      if (connectorState === 'PAUSED') {
        const trackingKey = `${pipeline.id}-${type}`;
        const now = Date.now();
        let pausedDurationSec = 0;

        if (!this.pauseTracking.has(trackingKey)) {
          // First time we see this connector paused
          // Assume it was just paused now and track it
          this.pauseTracking.set(trackingKey, now);
          pausedDurationSec = 0;
        } else {
          // Calculate how long it's been paused
          const pausedAt = this.pauseTracking.get(trackingKey);
          pausedDurationSec = (now - pausedAt) / 1000;
        }

        // Create alert if threshold exceeded
        if (pausedDurationSec > this.thresholds.pause_duration_seconds) {
          await this.createAlert(client, {
            pipeline_id: pipeline.id,
            alert_type: 'CONNECTOR_PAUSED',
            severity: 'warning',
            message: `${type.toUpperCase()} connector "${connector.name}" has been PAUSED for ${Math.floor(pausedDurationSec)}s (threshold: ${this.thresholds.pause_duration_seconds}s)`,
            metadata: {
              connector_name: connector.name,
              connector_type: type,
              paused_duration_seconds: Math.floor(pausedDurationSec),
              threshold_seconds: this.thresholds.pause_duration_seconds
            }
          });
        }
      } else {
        // Connector is not paused, clear tracking (do not auto-resolve alerts)
        const trackingKey = `${pipeline.id}-${type}`;
        this.pauseTracking.delete(trackingKey);
      }

      // Check task states
      if (status.tasks && Array.isArray(status.tasks)) {
        const failedTasks = status.tasks.filter(t => t.state === 'FAILED');
        if (failedTasks.length > 0) {
          await this.createAlert(client, {
            pipeline_id: pipeline.id,
            alert_type: 'TASK_FAILED',
            severity: 'critical',
            message: `${failedTasks.length} ${type} task(s) FAILED for connector "${connector.name}"`,
            metadata: {
              connector_name: connector.name,
              connector_type: type,
              failed_tasks: failedTasks.map(t => ({
                id: t.id,
                worker_id: t.worker_id,
                trace: t.trace
              }))
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error checking ${type} connector ${connector.name}:`, error.message);
    }
  }

  /**
   * Check 2: High Lag
   */
  async checkLag(client, pipeline, connectorName) {
    try {
      const lagQuery = `kafka_connect_source_task_metrics_source_record_write_rate{connector="${connectorName}"}`;
      const pollQuery = `kafka_connect_source_task_metrics_source_record_poll_rate{connector="${connectorName}"}`;

      const [lagRes, pollRes] = await Promise.all([
        fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(lagQuery)}`),
        fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(pollQuery)}`)
      ]);

      if (!lagRes.ok || !pollRes.ok) return;

      const lagData = await lagRes.json();
      const pollData = await pollRes.json();

      if (lagData.data?.result?.[0] && pollData.data?.result?.[0]) {
        const writeRate = parseFloat(lagData.data.result[0].value[1]);
        const pollRate = parseFloat(pollData.data.result[0].value[1]);

        // Calculate lag in ms (simplified)
        const lagMs = Math.abs(pollRate - writeRate) * 100;

        if (lagMs > this.thresholds.lag_ms) {
          await this.createAlert(client, {
            pipeline_id: pipeline.id,
            alert_type: 'HIGH_LAG',
            severity: 'warning',
            message: `Connector "${connectorName}" lag is ${lagMs.toFixed(0)}ms (threshold: ${this.thresholds.lag_ms}ms)`,
            metadata: {
              connector_name: connectorName,
              lag_ms: lagMs,
              threshold_ms: this.thresholds.lag_ms,
              poll_rate: pollRate,
              write_rate: writeRate
            }
          });
        } else {
          // Lag is normal - do not auto-resolve alerts
        }
      }
    } catch (error) {
      console.error(`Error checking lag for ${connectorName}:`, error.message);
    }
  }

  /**
   * Check 3: Throughput Drop
   */
  async checkThroughput(client, pipeline, connectorName) {
    try {
      const query = `kafka_connect_source_task_metrics_source_record_poll_rate{connector="${connectorName}"}`;
      const response = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);

      if (!response.ok) return;

      const data = await response.json();

      if (data.data?.result?.[0]) {
        const currentThroughput = parseFloat(data.data.result[0].value[1]) * 60; // records per minute

        const previousKey = `${pipeline.id}_throughput`;
        const previousThroughput = this.previousMetrics.get(previousKey);

        if (previousThroughput && previousThroughput > 0) {
          const dropPercent = ((previousThroughput - currentThroughput) / previousThroughput) * 100;

          if (dropPercent > this.thresholds.throughput_drop_percent) {
            await this.createAlert(client, {
              pipeline_id: pipeline.id,
              alert_type: 'THROUGHPUT_DROP',
              severity: 'warning',
              message: `Connector "${connectorName}" throughput dropped ${dropPercent.toFixed(1)}% (from ${previousThroughput.toFixed(0)} to ${currentThroughput.toFixed(0)} rec/min)`,
              metadata: {
                connector_name: connectorName,
                previous_throughput: previousThroughput,
                current_throughput: currentThroughput,
                drop_percent: dropPercent,
                threshold_percent: this.thresholds.throughput_drop_percent
              }
            });
          } else {
            // Throughput is normal - do not auto-resolve alerts
          }
        }

        // Store current value for next comparison
        this.previousMetrics.set(previousKey, currentThroughput);
      }
    } catch (error) {
      console.error(`Error checking throughput for ${connectorName}:`, error.message);
    }
  }

  /**
   * Check 4: DLQ Messages
   */
  async checkDLQ(client, pipeline, connectorName) {
    try {
      // Query Kafka topics for DLQ messages
      const dlqTopic = `${pipeline.name}-source-dlq`;

      // Note: This is a placeholder - actual implementation would need Kafka admin client
      // For now, we'll skip DLQ check or implement with Kafka REST API

      // TODO: Implement DLQ message count check using Kafka Admin API

    } catch (error) {
      console.error(`Error checking DLQ for ${connectorName}:`, error.message);
    }
  }

  /**
   * Check 5: High Error Rate
   */
  async checkErrorRate(client, pipeline, connectorName) {
    try {
      const query = `kafka_connect_task_error_metrics_total_errors_logged{connector="${connectorName}"}`;
      const response = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);

      if (!response.ok) return;

      const data = await response.json();

      if (data.data?.result?.[0]) {
        const errorCount = parseFloat(data.data.result[0].value[1]);

        if (errorCount > 0) {
          // Calculate error rate (simplified)
          const errorRate = (errorCount / (errorCount + 100)) * 100;

          if (errorRate > this.thresholds.error_rate_percent) {
            await this.createAlert(client, {
              pipeline_id: pipeline.id,
              alert_type: 'HIGH_ERROR_RATE',
              severity: 'warning',
              message: `Connector "${connectorName}" error rate is ${errorRate.toFixed(2)}% (${errorCount} errors)`,
              metadata: {
                connector_name: connectorName,
                error_count: errorCount,
                error_rate_percent: errorRate,
                threshold_percent: this.thresholds.error_rate_percent
              }
            });
          } else {
            // Error rate is normal - do not auto-resolve alerts
          }
        }
      }
    } catch (error) {
      console.error(`Error checking error rate for ${connectorName}:`, error.message);
    }
  }

  /**
   * Create an alert (only if not already exists)
   */
  async createAlert(client, alert) {
    try {
      // Check if similar unresolved alert already exists
      // For connector-specific alerts (CONNECTOR_FAILED, CONNECTOR_PAUSED, TASK_FAILED),
      // also check connector_type to allow separate alerts for source and sink
      let query = `
        SELECT id FROM alert_events
        WHERE pipeline_id = $1
        AND alert_type = $2
        AND resolved = false
      `;
      const params = [alert.pipeline_id, alert.alert_type];

      // For connector-specific alert types, also filter by connector_type
      if (alert.metadata?.connector_type) {
        query += ` AND metadata->>'connector_type' = $3`;
        params.push(alert.metadata.connector_type);
      }

      query += ` ORDER BY created_at DESC LIMIT 1`;

      const existingAlert = await client.query(query, params);

      if (existingAlert.rows.length > 0) {
        // Alert already exists, just update metadata and message
        await client.query(
          `UPDATE alert_events
           SET metadata = $1, message = $2, updated_at = now()
           WHERE id = $3`,
          [JSON.stringify(alert.metadata), alert.message, existingAlert.rows[0].id]
        );
        return;
      }

      // Create new alert
      await client.query(
        `INSERT INTO alert_events (pipeline_id, alert_type, severity, message, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [alert.pipeline_id, alert.alert_type, alert.severity, alert.message, JSON.stringify(alert.metadata)]
      );

      console.log(`🚨 ALERT: ${alert.severity.toUpperCase()} - ${alert.message}`);
    } catch (error) {
      console.error('Error creating alert:', error.message);
    }
  }

  /**
   * Note: Auto-resolve functionality has been disabled.
   * Alerts must be manually resolved by users through the UI.
   */
}

// Export singleton instance
export const monitoringService = new MonitoringService();
