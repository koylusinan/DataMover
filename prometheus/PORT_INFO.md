# Port Configuration

## 🔌 Service Ports

All ports have been configured to avoid conflicts with existing services.

**Note:** Kafka runs in **KRaft mode** (no Zookeeper required!)

### Kafka Stack

| Service | Internal Port | External Port | Status |
|---------|---------------|---------------|--------|
| Kafka (KRaft) | 29092 | 9092 | ✅ Available |
| Kafka Controller | 29093 | - | ✅ Internal only |
| Kafka JMX | 9093 | 9093 | ✅ Available |
| Kafka Connect | 8083 | 8083 | ✅ Available |
| Kafka Connect JMX | 9097 | 9097 | ✅ Available |

### Monitoring

| Service | Internal Port | External Port | Status |
|---------|---------------|---------------|--------|
| Kafka UI | 8080 | **8081** | ✅ Changed (8080 in use) |
| Prometheus | 9090 | 9090 | ✅ Available |

## ⚠️ Port Conflicts Avoided

### Existing Services (Already Running)

```
1521  - Oracle XE
1522  - Oracle CDC Test  
5432  - PostgreSQL Debezium
8080  - Oracle XE (conflict!)
54321 - Supabase Kong
54322 - Supabase DB
54323 - Supabase Studio
54324 - Supabase Inbucket
54327 - Supabase Analytics
```

### Our Services (No Conflicts)

```
8081  - Kafka UI (changed from 8080)
8083  - Kafka Connect
9090  - Prometheus
9092  - Kafka (KRaft mode - no Zookeeper!)
9093  - Kafka JMX
9097  - Kafka Connect JMX
```

## 🌐 Access URLs

```bash
# Kafka UI (Management Interface)
http://localhost:8081

# Kafka Connect REST API
http://localhost:8083

# Kafka Connect Metrics (JMX)
http://localhost:9097/metrics

# Prometheus Web UI
http://localhost:9090

# Kafka Bootstrap Server
localhost:9092
```

## 🔍 Verify No Conflicts

```bash
# Check ports before starting
netstat -an | grep -E '(8081|8083|9090|9092|9093|9097)'

# Should be empty if all ports are free
```

## 📝 Notes

1. **KRaft Mode** - Kafka runs without Zookeeper!
   - Uses internal Raft consensus protocol
   - Simpler architecture, faster startup
   - No port 2181 needed

2. **Port 8080** was changed to **8081** for Kafka UI
   - Reason: Port 8080 is used by Oracle XE

3. All other ports are standard and available

4. If you need to change any port, edit:
   ```
   prometheus/docker-compose.local.yml
   ```

## 🚀 Start Services

```bash
cd prometheus
./start-local.sh

# Services will start on configured ports
# Access: http://localhost:8081 (Kafka UI)
```
