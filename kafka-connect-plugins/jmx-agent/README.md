# JMX Prometheus Exporter for Kafka Connect

This directory contains the JMX Prometheus Java Agent configuration for exposing Kafka Connect metrics in Prometheus format.

## 📁 Files

- **config.yml** - JMX Exporter configuration
- **jmx_prometheus_javaagent-0.17.2.jar** - JMX Prometheus Java Agent ✅ (included)
- **download-jmx-agent.sh** - Re-download script (if needed)
- **README.md** - This documentation

## ✅ Ready to Use

The JMX agent is already included in this directory. No additional setup required!

Just start the services:

```bash
cd prometheus
./start-local.sh
```

## 🔧 Configuration

### config.yml

The configuration file defines:

1. **Whitelist patterns** - Which JMX metrics to expose
2. **Metric rules** - How to transform JMX metrics to Prometheus format

### Key Metrics Exposed

#### Kafka Connect Metrics
- `kafka_connect_worker_*` - Worker metrics
- `kafka_connect_connector_*` - Connector-level metrics
- `kafka_connect_source_task_*` - Source task metrics
- `kafka_connect_sink_task_*` - Sink task metrics

#### Debezium Metrics
- `debezium_metrics_*` - Debezium-specific metrics

#### Kafka Client Metrics
- `kafka_consumer_*` - Consumer metrics
- `kafka_producer_*` - Producer metrics

## 🚀 Usage

The Java agent is automatically loaded via Docker Compose:

```yaml
KAFKA_OPTS: |-
  -javaagent:/kafka/connect/plugins/jmx-agent/jmx_prometheus_javaagent-0.17.2.jar=9097:/kafka/connect/plugins/jmx-agent/config.yml
```

### Access Metrics

```bash
# Check if metrics endpoint is accessible
curl http://localhost:9097/metrics

# Sample output:
# kafka_connect_source_task_poll_records_total{connector="my-source",task="0"} 12345.0
# kafka_connect_sink_task_put_batch_records_total{connector="my-sink",task="0"} 67890.0
```

## 📊 Prometheus Integration

Prometheus scrapes these metrics via the configuration in `prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'kafka-connect-jmx'
    static_configs:
      - targets: ['kafka-connect:9097']
```

## 🔍 Available Metrics Examples

### Source Connector Metrics

```promql
# Records polled per second
rate(kafka_connect_source_task_poll_records_total[5m])

# Poll latency
kafka_connect_source_task_poll_batch_time_ms

# Records written to Kafka
rate(kafka_connect_source_task_source_record_write_total[5m])
```

### Sink Connector Metrics

```promql
# Records consumed per second
rate(kafka_connect_sink_task_put_batch_records_total[5m])

# Put batch latency
kafka_connect_sink_task_put_batch_time_ms

# Offset commits
rate(kafka_connect_sink_task_offset_commit_success_total[5m])
```

### Error Metrics

```promql
# Task errors
kafka_connect_task_error_count

# Connector failures
kafka_connect_connector_failed_task_count
```

### Debezium-Specific Metrics

```promql
# CDC events captured
rate(debezium_metrics_captured_tables[5m])

# Snapshot progress
debezium_metrics_snapshot_completed

# Queue size
debezium_metrics_queue_total_capacity
```

## 🛠️ Troubleshooting

### Metrics Not Available

```bash
# 1. Check if Java agent is loaded
docker logs kafka-connect | grep jmx_prometheus

# Should see: -javaagent:/kafka/connect/plugins/jmx-agent/...

# 2. Check if port 9097 is accessible
curl http://localhost:9097/metrics

# 3. Check Prometheus targets
open http://localhost:9090/targets
# Should see kafka-connect-jmx (UP)
```

### Missing Metrics

```bash
# Check JMX object names
docker exec kafka-connect java -jar /kafka/connect/plugins/jmx-agent/jmx_prometheus_javaagent-0.17.2.jar

# Verify config.yml whitelist patterns match your metrics
```

## 📝 Customization

### Add Custom Metrics

Edit `config.yml` to add more metrics:

```yaml
whitelistObjectNames:
  - "your.custom:type=*"

rules:
  - pattern: 'your.custom<type=([^>]+)><>([^:]+)'
    name: your_custom_$2
    labels:
      type: "$1"
    type: GAUGE
```

### Filter Metrics

To reduce noise, comment out unused patterns:

```yaml
whitelistObjectNames:
  - "kafka.connect:type=connector-metrics,connector=*"
  # - "kafka.consumer:type=*,client-id=*"  # Disabled
```

## 🔗 Links

- [JMX Exporter GitHub](https://github.com/prometheus/jmx_exporter)
- [Kafka Connect Monitoring](https://docs.confluent.io/platform/current/connect/monitoring.html)
- [Debezium Monitoring](https://debezium.io/documentation/reference/operations/monitoring.html)
- [Prometheus JMX Exporter Config](https://github.com/prometheus/jmx_exporter#configuration)

## ⚠️ Important Notes

1. **JAR File Required** - The `jmx_prometheus_javaagent-0.17.2.jar` must be downloaded
2. **Port 9097** - Metrics are exposed on port 9097 (mapped in docker-compose.yml)
3. **Performance** - JMX exporter has minimal performance impact
4. **Security** - No authentication on metrics endpoint (use firewall rules in production)
