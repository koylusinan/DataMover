# 🚀 Local Development Setup

Bu guide, sistemi local makinenizde SASL authentication olmadan çalıştırmanızı sağlar.

## 📋 Gereksinimler

- Docker Desktop (veya Docker + Docker Compose)
- Minimum 8GB RAM
- Minimum 20GB disk space

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────┐
│                   Local Development                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │ Frontend │  │ Backend  │  │  Supabase Local  │     │
│  │  :5173   │  │  :5002   │  │                  │     │
│  └──────────┘  └──────────┘  └──────────────────┘     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │ Kafka    │  │ Kafka    │  │  Kafka Connect   │     │
│  │  :9092   │  │ UI:8080  │  │      :8083       │     │
│  └──────────┘  └──────────┘  └──────────────────┘     │
│                                                          │
│  ┌──────────┐  ┌──────────┐                            │
│  │Prometheus│  │   │                            │
│  │  :9090   │  │     │                            │
│  └──────────┘  └──────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Quick Start

### 1. Kafka Stack'i Başlat

```bash
# Tüm servisleri başlat
docker-compose -f docker-compose.local.yml up -d

# Logları takip et
docker-compose -f docker-compose.local.yml logs -f

# Sadece belirli servisleri başlat (opsiyonel)
docker-compose -f docker-compose.local.yml up -d zookeeper kafka kafka-connect
```

### 2. Servislerin Hazır Olduğunu Kontrol Et

```bash
# Kafka Connect
curl http://localhost:8083/

# Kafka UI
open http://localhost:8080

# Prometheus
open http://localhost:9090

# 
open http://localhost
# Kullanıcı: admin
# Şifre: admin
```

### 3. Backend'i Başlat

```bash
# Backend ortam değişkenlerini ayarla
export KAFKA_CONNECT_URL=http://localhost:8083
export DEBEZIUM_BACKEND_PORT=5002

# Backend'i çalıştır
npm run debezium:dev
```

### 4. Frontend'i Başlat

```bash
# Frontend ortam değişkenlerini ayarla (.env dosyasında)
VITE_DEBEZIUM_BACKEND_URL=http://localhost:5002

# Frontend'i çalıştır
npm run dev
```

## 📊 Servis Portları

| Servis        | Port | URL                      | Açıklama                    |
|---------------|------|--------------------------|----------------------------|
| Frontend      | 5173 | http://localhost:5173    | React UI                   |
| Backend       | 5002 | http://localhost:5002    | Debezium Backend API       |
| Kafka         | 9092 | localhost:9092           | Kafka Broker               |
| Kafka Connect | 8083 | http://localhost:8083    | Kafka Connect REST API     |
| Kafka UI      | 8080 | http://localhost:8080    | Kafka Management UI        |
| Prometheus    | 9090 | http://localhost:9090    | Metrics Storage            |
|        | 3001 | http://localhost    | Metrics Visualization      |
| Zookeeper     | 2181 | localhost:2181           | Kafka Coordination         |

## 🔧 Configuration

### Environment Variables

**.env** dosyasını güncelleyin:

```env
# Debezium Backend
DEBEZIUM_BACKEND_PORT=5002
DEBEZIUM_BACKEND_HOST=0.0.0.0
KAFKA_CONNECT_URL=http://localhost:8083

# Kafka Connect (SASL yok!)
# CONNECT_SASL_MECHANISM=PLAIN  ← KALDIRILDI
# CONNECT_SASL_JAAS_CONFIG=...   ← KALDIRILDI

# Prometheus
PROMETHEUS_URL=http://localhost:9090

# Frontend
VITE_DEBEZIUM_BACKEND_URL=http://localhost:5002
```

### Kafka Connect Plugins

Connector plugin'lerini `/kafka-connect-plugins` klasörüne koyun:

```bash
kafka-connect-plugins/
├── debezium-connector-mysql/
├── debezium-connector-postgres/
├── debezium-connector-oracle/
├── debezium-connector-sqlserver/
└── jdbc-connector/
```

## 🧪 Test Pipeline

### 1. Test Source Connector (PostgreSQL)

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-postgres-source",
    "config": {
      "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
      "database.hostname": "localhost",
      "database.port": "5432",
      "database.user": "postgres",
      "database.password": "postgres",
      "database.dbname": "testdb",
      "database.server.name": "test-server",
      "table.include.list": "public.test_table",
      "plugin.name": "pgoutput"
    }
  }'
```

### 2. Test Sink Connector (PostgreSQL)

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-postgres-sink",
    "config": {
      "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
      "connection.url": "jdbc:postgresql://localhost:5432/targetdb",
      "connection.user": "postgres",
      "connection.password": "postgres",
      "topics": "test-server.public.test_table",
      "auto.create": "true",
      "insert.mode": "upsert",
      "pk.mode": "record_key"
    }
  }'
```

### 3. Check Status

```bash
# List all connectors
curl http://localhost:8083/connectors

# Get connector status
curl http://localhost:8083/connectors/test-postgres-source/status

# Get connector config
curl http://localhost:8083/connectors/test-postgres-source/config
```

## 📊 Prometheus Metrics

### Available Metrics

```promql
# Kafka Connect metrics
kafka_connect_source_task_poll_records_total
kafka_connect_source_task_source_record_write_total
kafka_connect_sink_task_put_batch_records_total
kafka_connect_task_error_count

# Kafka metrics
kafka_server_BrokerTopicMetrics_MessagesInPerSec
kafka_server_BrokerTopicMetrics_BytesInPerSec
kafka_server_BrokerTopicMetrics_BytesOutPerSec
```

### Query Examples

```bash
# Ingestion rate (events per second)
curl -g 'http://localhost:9090/api/v1/query?query=sum(rate(kafka_connect_source_task_poll_records_total[5m]))'

# Error rate
curl -g 'http://localhost:9090/api/v1/query?query=sum(rate(kafka_connect_task_error_count[5m]))'

# Average latency
curl -g 'http://localhost:9090/api/v1/query?query=avg(kafka_connect_source_task_poll_batch_time_ms)'
```

## 🐛 Troubleshooting

### Kafka Connect Not Starting

```bash
# Check logs
docker logs kafka-connect

# Check if Kafka is ready
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Restart Kafka Connect
docker-compose -f docker-compose.local.yml restart kafka-connect
```

### Connector Fails to Create

```bash
# Check connector plugins
curl http://localhost:8083/connector-plugins

# Check connector config validation
curl -X PUT http://localhost:8083/connector-plugins/io.debezium.connector.postgresql.PostgresConnector/config/validate \
  -H "Content-Type: application/json" \
  -d '{ ... config ... }'
```

### Out of Memory

```bash
# Increase Kafka Connect memory in docker-compose.local.yml
environment:
  KAFKA_HEAP_OPTS: "-Xms1G -Xmx4G"  # Adjust as needed

# Restart
docker-compose -f docker-compose.local.yml restart kafka-connect
```

### Prometheus Not Scraping Metrics

```bash
# Check Prometheus targets
open http://localhost:9090/targets

# Check if JMX port is accessible
curl http://localhost:9097/metrics

# Restart Prometheus
docker-compose -f docker-compose.local.yml restart prometheus
```

## 🧹 Cleanup

### Stop All Services

```bash
docker-compose -f docker-compose.local.yml down
```

### Remove Volumes (DELETE ALL DATA!)

```bash
docker-compose -f docker-compose.local.yml down -v
```

### Remove Specific Volumes

```bash
# List volumes
docker volume ls | grep local

# Remove specific volume
docker volume rm local-kafka-data
```

## 🔄 Restart Everything

```bash
# Stop all
docker-compose -f docker-compose.local.yml down

# Remove old data (optional)
docker-compose -f docker-compose.local.yml down -v

# Start fresh
docker-compose -f docker-compose.local.yml up -d

# Wait for services to be ready (2-3 minutes)
watch docker-compose -f docker-compose.local.yml ps
```

## 📚 Useful Commands

### Docker Compose

```bash
# Start services
docker-compose -f docker-compose.local.yml up -d

# Stop services
docker-compose -f docker-compose.local.yml stop

# View logs
docker-compose -f docker-compose.local.yml logs -f [service-name]

# Restart service
docker-compose -f docker-compose.local.yml restart [service-name]

# Check status
docker-compose -f docker-compose.local.yml ps
```

### Kafka

```bash
# List topics
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Create topic
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic test-topic --partitions 3 --replication-factor 1

# Describe topic
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic test-topic

# Delete topic
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --delete --topic test-topic

# Console consumer
docker exec -it kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic test-topic --from-beginning
```

### Kafka Connect

```bash
# List connectors
curl http://localhost:8083/connectors

# Get connector status
curl http://localhost:8083/connectors/[connector-name]/status

# Restart connector
curl -X POST http://localhost:8083/connectors/[connector-name]/restart

# Delete connector
curl -X DELETE http://localhost:8083/connectors/[connector-name]

# Pause connector
curl -X PUT http://localhost:8083/connectors/[connector-name]/pause

# Resume connector
curl -X PUT http://localhost:8083/connectors/[connector-name]/resume
```

## 🎯 Next Steps

1. ✅ Setup local environment
2. ✅ Test basic connectivity
3. ✅ Create test pipeline
4. ✅ Monitor with Prometheus & 
5. 🚀 Start developing!

---

**Need Help?** Check the troubleshooting section or logs!

**Performance Issues?** Adjust memory settings in docker-compose.local.yml

**Questions?** Open an issue on GitHub
