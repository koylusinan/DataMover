# Prometheus Metrics System

## 📊 Overview

Prometheus collects and stores metrics from Kafka Connect and Kafka brokers.

**Note:** This stack uses **Kafka KRaft mode** (no Zookeeper required!)

## 🚀 Quick Start

### Start All Services (Recommended)

```bash
cd prometheus
./start-local.sh
```

### Or Use Docker Compose Directly

```bash
cd prometheus
docker-compose -f docker-compose.local.yml up -d
```

## 📁 Files

```
prometheus/
├── docker-compose.local.yml  → All services (Kafka + Prometheus)
├── start-local.sh            → Start script
├── stop-local.sh             → Stop script
├── prometheus.yml            → Scrape configuration
└── README.md                 → This file
```

## 🔧 Configuration

### prometheus.yml

Configures metric scraping from:
- **Kafka Connect JMX** (port 9097)
- **Kafka JMX** (port 9093)
- **Prometheus itself** (port 9090)

```yaml
scrape_configs:
  - job_name: 'kafka-connect-jmx'
    static_configs:
      - targets: ['kafka-connect:9097']
  
  - job_name: 'kafka-jmx'
    static_configs:
      - targets: ['kafka:9093']
```

## 📈 Access Prometheus

### Web UI

```bash
open http://localhost:9090
```

### API

```bash
# Check if Prometheus is up
curl http://localhost:9090/api/v1/query?query=up

# Query metrics
curl -g 'http://localhost:9090/api/v1/query?query=sum(rate(kafka_connect_source_task_poll_records_total[5m]))'
```

## 📊 Available Metrics

### Kafka Connect Metrics

```promql
# Source connector metrics
kafka_connect_source_task_poll_records_total
kafka_connect_source_task_source_record_write_total
kafka_connect_source_task_poll_batch_time_ms

# Sink connector metrics
kafka_connect_sink_task_put_batch_records_total
kafka_connect_sink_task_put_batch_time_ms
kafka_connect_sink_task_offset_commit_success_total

# Error metrics
kafka_connect_task_error_count

# Connector status
kafka_connect_connector_status
```

### Kafka Metrics

```promql
# Broker metrics
kafka_server_BrokerTopicMetrics_MessagesInPerSec
kafka_server_BrokerTopicMetrics_BytesInPerSec
kafka_server_BrokerTopicMetrics_BytesOutPerSec

# Topic metrics
kafka_topic_partition_current_offset

# Consumer metrics
kafka_consumer_lag
```

## 🔍 Example Queries

### Ingestion Rate (events per second)

```promql
sum(rate(kafka_connect_source_task_poll_records_total[5m]))
```

### Sink Write Rate (events per second)

```promql
sum(rate(kafka_connect_sink_task_put_batch_records_total[5m]))
```

### Error Rate

```promql
sum(rate(kafka_connect_task_error_count[5m]))
```

### Average Poll Latency

```promql
avg(kafka_connect_source_task_poll_batch_time_ms)
```

### Connector Status (1 = RUNNING, 0 = DOWN)

```promql
kafka_connect_connector_status{state="RUNNING"}
```

### Kafka Consumer Lag

```promql
sum(kafka_consumer_lag) by (topic)
```

## 🛠️ Management

### Start All Services

```bash
cd prometheus
./start-local.sh
```

### Stop All Services

```bash
cd prometheus
./stop-local.sh
```

### View Logs

```bash
cd prometheus
docker-compose -f docker-compose.local.yml logs -f
```

### Restart Services

```bash
cd prometheus
docker-compose -f docker-compose.local.yml restart
```

### Remove Data (Clean Start)

```bash
cd prometheus
docker-compose -f docker-compose.local.yml down -v
```

## 🔧 Troubleshooting

### Prometheus Not Starting

```bash
# Check logs
cd prometheus
docker-compose -f docker-compose.local.yml logs

# Check config
docker-compose -f docker-compose.local.yml config
```

### No Metrics from Kafka Connect

```bash
# Check if JMX port is accessible
curl http://localhost:9097/metrics

# Check Prometheus targets
open http://localhost:9090/targets

# Should see kafka-connect-jmx (UP)
```

### No Metrics from Kafka

```bash
# Check if Kafka JMX is accessible
telnet localhost 9093

# Check Prometheus targets
open http://localhost:9090/targets

# Should see kafka-jmx (UP)
```

### Config Validation

```bash
# Validate prometheus.yml
docker run --rm -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus:v2.48.0 \
  promtool check config /etc/prometheus/prometheus.yml
```

## 💻 Backend Integration

### Using prometheus-query

```bash
npm install prometheus-query
```

```javascript
import { PrometheusDriver } from 'prometheus-query';

const prometheus = new PrometheusDriver({
  endpoint: process.env.PROMETHEUS_URL || 'http://localhost:9090',
  baseURL: '/api/v1',
});

// Query metrics
const result = await prometheus.instantQuery(
  'sum(rate(kafka_connect_source_task_poll_records_total[5m]))'
);

console.log('Ingestion rate:', result.result[0]?.value?.value);
```

### Using fetch

```javascript
const response = await fetch(
  'http://localhost:9090/api/v1/query?query=sum(rate(kafka_connect_source_task_poll_records_total[5m]))'
);

const data = await response.json();
const rate = data.data.result[0]?.value[1];
console.log('Rate:', rate);
```

## 📊 Data Retention

Default retention: **15 days**

To change retention:

```yaml
# docker-compose.yml
command:
  - '--storage.tsdb.retention.time=30d'  # 30 days
  - '--storage.tsdb.retention.size=10GB' # or by size
```

## 🎯 Production Considerations

### For Production Use

1. **Increase retention**
   ```yaml
   --storage.tsdb.retention.time=90d
   ```

2. **Add authentication**
   ```yaml
   --web.enable-admin-api
   --web.enable-lifecycle
   ```

3. **Configure remote write** (for long-term storage)
   ```yaml
   remote_write:
     - url: "https://your-remote-storage/api/v1/write"
   ```

4. **Add alerting rules**
   ```yaml
   rule_files:
     - "alerts.yml"
   ```

5. **Use persistent storage**
   ```yaml
   volumes:
     - /data/prometheus:/prometheus
   ```

## 🔗 Useful Links

- [Prometheus Documentation](https://prometheus.io/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Kafka Connect JMX Metrics](https://docs.confluent.io/platform/current/connect/monitoring.html)
- [Debezium Monitoring](https://debezium.io/documentation/reference/operations/monitoring.html)

## 📝 Notes

- Prometheus scrapes metrics every **15 seconds** by default
- JMX exporter must be configured in Kafka Connect (already done in docker-compose.local.yml)
- Metrics are stored in time-series format
- Use `rate()` for counter metrics to get per-second rates
- Use `avg()` for gauge metrics to get average values
