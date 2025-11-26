# Monitoring, Logging & Alert Mimarisi

## Genel Bakış

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                               │
│  - MonitoringTab.tsx        - AlertsPage                                │
│  - MonitoringDashboardPage  - LogsTab.tsx                               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   server.js (:5001)  │  │ debezium-backend │  │ monitoring-service   │
│   Main Backend       │  │     (:5002)      │  │   (Background)       │
└──────────────────────┘  └──────────────────┘  └──────────────────────┘
         │                         │                      │
         ▼                         ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Supabase (PostgreSQL)                         │
│  - pipelines           - alert_events        - monitoring_settings   │
│  - pipeline_logs       - alert_preferences   - slack_integrations    │
└──────────────────────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Redis (:6379)      │  │  Kafka Connect       │
│   - Panel prefs      │  │  - Connector status  │
│   - Layout prefs     │  │  - JMX metrics       │
│   - Cache            │  │  - Prometheus        │
└──────────────────────┘  └──────────────────────┘
```

---

## Backend Servisleri

### 1. server.js (Port: 5001)

**Ana backend servisi** - UI panel yönetimi ve temel API'ler

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/health` | GET | Health check |
| `/api/monitoring-panels/:pipelineId` | GET | Panel tercihlerini getir |
| `/api/monitoring-panels/:pipelineId` | POST | Panel tercihlerini kaydet |
| `/api/monitoring-layout/:pipelineId` | GET | Layout tercihlerini getir |
| `/api/monitoring-layout/:pipelineId` | POST | Layout tercihlerini kaydet |
| `/api/pipelines/:pipelineId/wal-size` | GET | WAL boyutunu getir |
| `/api/pipelines/:pipelineId/consumer-group` | GET | Consumer group bilgisi |
| `/api/jmx-metrics` | GET | JMX metrikleri |
| `/api/kafka-consumer-metrics` | GET | Kafka consumer metrikleri |

**Dosya:** `backend/server.js`

---

### 2. debezium-backend.js (Port: 5002)

**Debezium ve Alert yönetimi** - Pipeline operasyonları ve alertler

#### Monitoring Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/monitoring/thresholds` | GET | Monitoring eşiklerini getir |
| `/api/monitoring/thresholds` | PUT | Monitoring eşiklerini güncelle |
| `/api/pipelines/:id/monitoring` | GET | Pipeline monitoring verileri |
| `/api/pipelines/:id/logs` | GET | Pipeline logları |
| `/api/pipelines/:id/activity` | GET | Pipeline aktivitesi |
| `/api/pipelines/:id/state-changes` | GET | Durum değişiklikleri |

#### Alert Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/alerts` | GET | Tüm alertleri listele |
| `/api/alerts/stats` | GET | Alert istatistikleri |
| `/api/pipelines/:id/alerts` | GET | Pipeline alertleri |
| `/api/alerts/:id/resolve` | POST | Alert'i çöz |
| `/api/pipelines/:id/alerts/resolve-all` | POST | Tüm alertleri çöz |

#### Slack Endpoint

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/slack/send` | POST | Slack mesajı gönder |

**Dosya:** `backend/debezium-backend.js`

---

### 3. monitoring-service.js (Background Service)

**Proaktif Monitoring** - Otomatik kontrol ve alert oluşturma

```javascript
class MonitoringService {
  thresholds = {
    lag_ms: 5000,              // Max gecikme (ms)
    throughput_drop_percent: 50, // Throughput düşüş %
    error_rate_percent: 1,      // Error rate %
    dlq_count: 0,               // DLQ mesaj sayısı
    check_interval_ms: 60000,   // Kontrol aralığı
    pause_duration_seconds: 5,  // Pause süresi
  }
}
```

#### Metodlar

| Metod | Açıklama |
|-------|----------|
| `loadThresholds()` | DB'den eşikleri yükle |
| `start()` | Servisi başlat |
| `checkAllPipelines()` | Tüm pipeline'ları kontrol et |
| `checkPipeline()` | Tek pipeline kontrol |
| `checkConnectorStatus()` | Connector durumu |
| `checkLag()` | Lag kontrolü |
| `checkThroughput()` | Throughput kontrolü |
| `checkDLQ()` | Dead Letter Queue kontrolü |
| `checkErrorRate()` | Error rate kontrolü |
| `checkWALSize()` | WAL boyutu kontrolü (PostgreSQL) |
| `sendWALSlackNotification()` | Slack bildirimi gönder |
| `createAlert()` | Alert oluştur |

**Dosya:** `backend/monitoring-service.js`

---

### 4. Diğer Servisler

| Servis | Dosya | Açıklama |
|--------|-------|----------|
| Time Series API | `monitoring-timeseries-endpoint.js` | Prometheus metrik çekme |
| Pipeline Cleanup | `pipeline-cleanup-service.js` | Soft-delete temizleme |
| Redis Cache | `redis-cache.js` | Panel/layout cache |
| Monitoring Starter | `start-monitoring.js` | Standalone monitoring |

---

## Veritabanı Tabloları

### Monitoring

| Tablo | Açıklama |
|-------|----------|
| `monitoring_settings` | Global monitoring eşikleri |
| `pipeline_logs` | Pipeline log kayıtları |
| `pipeline_progress_events` | İlerleme eventleri |

### Alert

| Tablo | Açıklama |
|-------|----------|
| `alert_events` | Oluşan alertler |
| `alert_preferences` | Kullanıcı alert tercihleri |
| `alert_recipients` | Alert alıcıları |

### Slack

| Tablo | Açıklama |
|-------|----------|
| `slack_integrations` | Slack webhook yapılandırmaları |
| `pipeline_slack_channels` | Pipeline-Slack eşleştirmeleri |

---

## Mevcut Edge Functions

| Function | Açıklama |
|----------|----------|
| `admin-users` | Admin kullanıcı CRUD (auth.admin API) |
| `mock-kafka-connect` | Test için mock Kafka Connect |
| `test-connection` | Bağlantı testi |

---

## 🚀 Edge Function'a Taşınabilecek İşlemler

### ✅ ÖNERİLEN - Edge Function'a Taşı

| İşlem | Mevcut Konum | Neden Edge Function? |
|-------|--------------|---------------------|
| **Alert CRUD** | `debezium-backend.js` | Sadece DB işlemi, dış API yok |
| **Monitoring Settings** | `debezium-backend.js` | Basit GET/PUT, DB-only |
| **Slack Webhook Send** | `debezium-backend.js` | Stateless, hızlı işlem |
| **Pipeline Cleanup** | `pipeline-cleanup-service.js` | Scheduled function olarak |
| **Alert Preferences** | Frontend → Supabase | Direkt DB erişimi |

### ⚠️ KALSIN - Backend'de Tutulmalı

| İşlem | Neden Backend? |
|-------|----------------|
| **Kafka Connect API** | Dış API erişimi gerekli |
| **JMX/Prometheus Metrics** | Dış servis sorgulaması |
| **WAL Size Check** | Source DB'ye bağlantı gerekli |
| **Monitoring Service Loop** | Long-running process |
| **Redis Cache** | Redis bağlantısı |
| **Consumer Group Info** | Kafka API erişimi |

---

## 📋 Önerilen Edge Functions

### 1. `alerts` - Alert Yönetimi

```typescript
// supabase/functions/alerts/index.ts
// GET /alerts - Tüm alertleri listele
// GET /alerts/stats - İstatistikler
// POST /alerts/:id/resolve - Alert çöz
// POST /pipelines/:id/alerts/resolve-all - Toplu çöz
```

**Avantajlar:**
- DB'ye yakın, düşük latency
- Cold start yok (sık kullanım)
- Backend yükünü azaltır

### 2. `monitoring-settings` - Monitoring Ayarları

```typescript
// supabase/functions/monitoring-settings/index.ts
// GET / - Ayarları getir
// PUT / - Ayarları güncelle
```

### 3. `slack-notify` - Slack Bildirimi

```typescript
// supabase/functions/slack-notify/index.ts
// POST / - Slack mesajı gönder
```

**Avantajlar:**
- Webhook çağrısı için ideal
- Async işlem
- Rate limiting kolay

### 4. `pipeline-cleanup` - Zamanlanmış Temizlik

```typescript
// supabase/functions/pipeline-cleanup/index.ts
// Cron: Her saat çalışır
// Expired pipeline'ları temizler
```

**Avantajlar:**
- pg_cron yerine Edge Function
- Daha iyi loglama
- Hata yönetimi

---

## Taşıma Öncelik Sırası

| Öncelik | Function | Effort | Impact |
|---------|----------|--------|--------|
| 1️⃣ | `alerts` | Orta | Yüksek |
| 2️⃣ | `monitoring-settings` | Düşük | Orta |
| 3️⃣ | `slack-notify` | Düşük | Orta |
| 4️⃣ | `pipeline-cleanup` | Orta | Düşük |

---

## Servis Başlatma

### Development

```bash
# Terminal 1: Main backend
npm run dev:backend

# Terminal 2: Debezium backend
npm run dev:debezium

# Terminal 3: Monitoring service
node backend/start-monitoring.js

# Terminal 4: Supabase Edge Functions
supabase functions serve
```

### Production

```bash
# PM2 ile
pm2 start backend/server.js --name "main-backend"
pm2 start backend/debezium-backend.js --name "debezium-backend"
pm2 start backend/start-monitoring.js --name "monitoring-service"

# Edge Functions otomatik deploy
supabase functions deploy
```

---

## Environment Variables

```bash
# Database
SUPABASE_DB_HOST=127.0.0.1
SUPABASE_DB_PORT=54322
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=postgres

# Kafka Connect
KAFKA_CONNECT_URL=http://127.0.0.1:8083

# Prometheus
PROMETHEUS_URL=http://localhost:9090

# Redis
REDIS_URL=redis://localhost:6379

# Alert Thresholds
ALERT_LAG_MS=5000
ALERT_THROUGHPUT_DROP_PERCENT=50
ALERT_ERROR_RATE_PERCENT=1
ALERT_DLQ_COUNT=0
ALERT_CHECK_INTERVAL_MS=60000
```

---

## Dosya Yapısı

```
backend/
├── server.js                    # Ana backend (5001)
├── debezium-backend.js          # Debezium backend (5002)
├── monitoring-service.js        # Background monitoring
├── monitoring-timeseries-endpoint.js
├── pipeline-cleanup-service.js
├── redis-cache.js
├── start-monitoring.js
└── database-ops/
    └── server.js

supabase/functions/
├── admin-users/                 # ✅ Mevcut
├── mock-kafka-connect/          # ✅ Mevcut
├── test-connection/             # ✅ Mevcut
├── alerts/                      # ✅ Hazır
├── monitoring-settings/         # ✅ Hazır
├── slack-notify/                # ✅ Hazır
└── pipeline-cleanup/            # ✅ Hazır
```

---

## 🆕 Edge Functions Detaylı Dokümantasyon

### 1. `alerts` - Alert Yönetimi

**Dosya:** `supabase/functions/alerts/index.ts`

#### Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/alerts` | Alertleri listele |
| GET | `/alerts?pipeline_id=xxx` | Pipeline bazlı filtrele |
| GET | `/alerts?resolved=false` | Çözülmemiş alertler |
| GET | `/alerts?limit=50&offset=0` | Pagination |
| GET | `/alerts/stats` | İstatistikler |
| GET | `/alerts/:id` | Tek alert detayı |
| POST | `/alerts` | Yeni alert oluştur |
| POST | `/alerts/:id/resolve` | Alert çöz |
| POST | `/pipelines/:id/alerts/resolve-all` | Toplu çöz |

#### Request/Response Örnekleri

```bash
# Alertleri listele
curl -X GET "https://xxx.supabase.co/functions/v1/alerts?resolved=false&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Response
{
  "alerts": [
    {
      "id": "uuid",
      "pipeline_id": "uuid",
      "alert_type": "high_lag",
      "severity": "warning",
      "message": "Lag exceeded threshold",
      "resolved": false,
      "created_at": "2024-11-26T01:00:00Z",
      "pipelines": { "name": "my-pipeline" }
    }
  ],
  "total": 25
}

# Alert oluştur
curl -X POST "https://xxx.supabase.co/functions/v1/alerts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline_id": "uuid",
    "alert_type": "connector_failed",
    "severity": "critical",
    "message": "Source connector failed"
  }'

# İstatistikler
curl -X GET "https://xxx.supabase.co/functions/v1/alerts/stats"
# Response
{
  "total": 150,
  "unresolved": 12,
  "by_severity": { "critical": 2, "warning": 8, "info": 2 },
  "by_type": { "high_lag": 5, "connector_failed": 3, "throughput_drop": 4 }
}
```

---

### 2. `monitoring-settings` - Monitoring Ayarları

**Dosya:** `supabase/functions/monitoring-settings/index.ts`

#### Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/` | Mevcut ayarları getir |
| PUT | `/` | Ayarları güncelle |

#### Ayar Alanları

| Alan | Tip | Default | Açıklama |
|------|-----|---------|----------|
| `lag_ms` | number | 5000 | Max gecikme (ms) |
| `throughput_drop_percent` | number | 50 | Throughput düşüş % |
| `error_rate_percent` | number | 1 | Max error rate % |
| `dlq_count` | number | 0 | DLQ mesaj eşiği |
| `check_interval_ms` | number | 60000 | Kontrol aralığı |
| `pause_duration_seconds` | number | 5 | Auto-pause süresi |
| `backup_retention_hours` | number | 24 | Yedek saklama süresi |

#### Request/Response Örnekleri

```bash
# Ayarları getir
curl -X GET "https://xxx.supabase.co/functions/v1/monitoring-settings" \
  -H "Authorization: Bearer $TOKEN"

# Response
{
  "id": "uuid",
  "lag_ms": 5000,
  "throughput_drop_percent": 50,
  "error_rate_percent": 1,
  "dlq_count": 0,
  "check_interval_ms": 60000,
  "pause_duration_seconds": 5,
  "backup_retention_hours": 24,
  "updated_at": "2024-11-26T01:00:00Z"
}

# Ayarları güncelle
curl -X PUT "https://xxx.supabase.co/functions/v1/monitoring-settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lag_ms": 10000,
    "check_interval_ms": 30000
  }'
```

---

### 3. `slack-notify` - Slack Bildirimi

**Dosya:** `supabase/functions/slack-notify/index.ts`

#### Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/` | Slack mesajı gönder |

#### Request Body

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `message` | string | ✅ | Mesaj içeriği |
| `pipelineId` | string | ❌ | Pipeline ID (webhook bulmak için) |
| `severity` | string | ❌ | `info`, `warning`, `critical`, `success` |
| `title` | string | ❌ | Mesaj başlığı |
| `fields` | array | ❌ | Ek alanlar |
| `webhookUrl` | string | ❌ | Direkt webhook URL |

#### Severity Renkleri

| Severity | Renk | Emoji |
|----------|------|-------|
| `info` | 🔵 #2196F3 | ℹ️ |
| `warning` | 🟠 #FF9800 | ⚠️ |
| `critical` | 🔴 #F44336 | 🚨 |
| `success` | 🟢 #4CAF50 | ✅ |

#### Request/Response Örnekleri

```bash
# Pipeline'a bağlı webhook'lara gönder
curl -X POST "https://xxx.supabase.co/functions/v1/slack-notify" \
  -H "Content-Type: application/json" \
  -d '{
    "pipelineId": "uuid",
    "message": "WAL size exceeded 80% threshold",
    "severity": "warning",
    "title": "WAL Size Alert",
    "fields": [
      { "title": "Current Size", "value": "850 MB" },
      { "title": "Threshold", "value": "80%" }
    ]
  }'

# Response
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "total": 2
}

# Direkt webhook URL ile
curl -X POST "https://xxx.supabase.co/functions/v1/slack-notify" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://hooks.slack.com/services/xxx",
    "message": "Test message",
    "severity": "info"
  }'
```

---

### 4. `pipeline-cleanup` - Zamanlanmış Temizlik

**Dosya:** `supabase/functions/pipeline-cleanup/index.ts`

#### Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/` | Cleanup çalıştır |
| POST | `/ {dry_run: true}` | Önizleme (silmeden) |

#### Silme Sırası (FK Constraints)

```
1. pipeline_tasks
2. pipeline_table_objects
3. pipeline_restore_staging
4. pipeline_connectors
5. pipeline_objects
6. pipeline_logs
7. pipeline_progress_events
8. pipeline_slack_channels
9. alert_events
10. alert_preferences
11. alert_recipients
12. mapping_configs
13. job_runs
14. precheck_results
15. pipelines (son)
```

#### Request/Response Örnekleri

```bash
# Dry run (önizleme)
curl -X POST "https://xxx.supabase.co/functions/v1/pipeline-cleanup" \
  -H "Content-Type: application/json" \
  -d '{ "dry_run": true }'

# Response
{
  "success": true,
  "dry_run": true,
  "checked": 5,
  "deleted": 2,
  "errors": 0,
  "results": [
    {
      "pipeline_id": "uuid",
      "pipeline_name": "old-pipeline",
      "deleted_at": "2024-11-20T00:00:00Z",
      "retention_hours": 24,
      "status": "deleted"
    }
  ],
  "duration_ms": 150
}

# Gerçek silme
curl -X POST "https://xxx.supabase.co/functions/v1/pipeline-cleanup"

# Response
{
  "success": true,
  "dry_run": false,
  "checked": 5,
  "deleted": 2,
  "errors": 0,
  "results": [...],
  "duration_ms": 2500
}
```

#### Cron ile Zamanlanmış Çalıştırma

```sql
-- Supabase Dashboard > SQL Editor
-- Her saat başı çalıştır
SELECT cron.schedule(
  'cleanup-expired-pipelines',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xxx.supabase.co/functions/v1/pipeline-cleanup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## Deploy Komutları

```bash
# Local test
supabase functions serve alerts --env-file .env.local
supabase functions serve monitoring-settings --env-file .env.local
supabase functions serve slack-notify --env-file .env.local
supabase functions serve pipeline-cleanup --env-file .env.local

# Tek function deploy
supabase functions deploy alerts
supabase functions deploy monitoring-settings
supabase functions deploy slack-notify
supabase functions deploy pipeline-cleanup

# Tümünü deploy
supabase functions deploy

# Logs izle
supabase functions logs alerts --follow
```

---

## Performance İpuçları

1. **Client Reuse**: Her function'da `getSupabaseClient()` singleton pattern kullanılıyor
2. **Connection Pooling**: Supabase client otomatik yönetiyor
3. **Cold Start**: İlk çağrıda ~200ms, sonraki çağrılarda <50ms
4. **Timeout**: Default 60 saniye (pipeline-cleanup için yeterli)
5. **Memory**: Default 256MB (yeterli)
