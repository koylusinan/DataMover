# 🧪 Rollback Test Guide

Bu guide Debezium olmadan rollback mekanizmasını nasıl test edeceğinizi gösterir.

## 📋 Hazırlık

### 1. Backend'i Başlatın
```bash
npm run debezium:dev
```

Backend `http://localhost:3001` üzerinde çalışacak.

### 2. Frontend'i Başlatın
```bash
npm run dev
```

Frontend `http://localhost:5173` üzerinde çalışacak.

---

## 🔬 Test Sayfasına Erişim

1. Login olun: `http://localhost:5173/login`
   - Email: `admin@example.com`
   - Password: `password123`

2. Sidebar'dan **Flask ikonu** (Test Rollback) tıklayın
   - Ya da direkt: `http://localhost:5173/test-rollback`

---

## ✅ Test Senaryoları

### Senaryo 1: Pipeline ID Bulma

1. Ana sayfadan bir pipeline seçin
2. URL'den pipeline ID'yi kopyalayın
   ```
   http://localhost:5173/pipelines/123e4567-e89b-12d3-a456-426614174000
                                    ↑ Bu kısım pipeline ID
   ```
3. Test sayfasına geri dönün
4. Pipeline ID'yi input'a yapıştırın

---

### Senaryo 2: Deploy Test (Başarılı)

**Amaç:** Source ve sink'in başarıyla deploy edildiğini görmek

**Adımlar:**
1. Pipeline ID girin
2. "Deploy" butonuna tıklayın
3. Test Results'a bakın:
   - ✅ "Deploying source connector"
   - ✅ "Source connector deployed"
   - ✅ "Deploying sink connector"
   - ✅ "Sink connector deployed"

**Backend Logs:**
```
[INFO] Deploying source connector
[INFO] Deploying sink connector
[INFO] Pipeline deployed successfully
```

---

### Senaryo 3: Deploy Test (Rollback Tetikleme)

**Amaç:** Sink deploy başarısız olduğunda rollback'in tetiklendiğini görmek

**Kafka Connect Çalışmıyorsa (Normal Durum):**
1. Pipeline ID girin
2. "Deploy" butonuna tıklayın
3. Test Results'a bakın:
   - ❌ "Source deployment failed: fetch failed"
   - Ya da
   - ❌ "Sink deployment failed: fetch failed"

**Backend Logs:**
```
[ERROR] Source deployment failed: fetch failed
```

**NOT:** Rollback sadece şu durumda tetiklenir:
- ✅ Source deploy BAŞARILI
- ❌ Sink deploy BAŞARISIZ

---

### Senaryo 4: Pause Test

**Amaç:** Pipeline'ın pause edildiğini görmek

**Adımlar:**
1. Önce bir pipeline deploy edin (source ve sink çalışıyor olmalı)
2. "Pause" butonuna tıklayın
3. Test Results'a bakın:
   - ✅ "Pipeline paused"

**Backend Logs:**
```
[INFO] Connector paused: my-pipeline-source
[INFO] Connector paused: my-pipeline-sink
[INFO] Pipeline paused successfully
```

---

### Senaryo 5: Start Test

**Amaç:** Pause edilmiş pipeline'ı tekrar başlatmak

**Adımlar:**
1. Pipeline'ı pause edin
2. "Start" butonuna tıklayın
3. Test Results'a bakın:
   - ✅ "Pipeline started"

**Backend Logs:**
```
[INFO] Connector resumed: my-pipeline-source
[INFO] Connector resumed: my-pipeline-sink
[INFO] Pipeline started successfully
```

---

### Senaryo 6: Delete Test

**Amaç:** Tüm connector'ları silmek

**Adımlar:**
1. "Delete" butonuna tıklayın
2. Confirm dialog'da OK deyin
3. Test Results'a bakın:
   - ✅ "Connectors deleted"

**Backend Logs:**
```
[INFO] Connector deleted from Kafka Connect: my-pipeline-source
[INFO] Connector deleted from Kafka Connect: my-pipeline-sink
[INFO] All connectors deleted successfully
```

---

## 🔍 Backend Logs Nasıl Görülür?

Backend çalıştırdığınız terminal'de tüm logları görebilirsiniz:

```bash
npm run debezium:dev

# Örnek log output:
{"level":30,"time":1700000000000,"connector":"test-pipeline-source","msg":"Deploying source connector"}
{"level":40,"time":1700000001000,"err":{"type":"Error","message":"fetch failed"},"connector":"test-pipeline-sink","msg":"Sink deployment failed"}
{"level":40,"time":1700000002000,"pipelineId":"abc-123","msg":"Rolling back source connector due to sink failure"}
{"level":30,"time":1700000003000,"connector":"test-pipeline-source","msg":"Source connector rolled back"}
```

---

## 🎯 Rollback Logic Nasıl Test Edilir?

### Manuel Test (Kafka Connect ile):

**1. Kafka Connect'i Başlatın:**
```bash
docker-compose -f docker-compose.debezium.yml up -d
```

**2. Bir Pipeline Deploy Edin:**
- Source başarılı olacak ✅
- Sink başarılı olacak ✅

**3. Database'den Sink Config'i Bozun:**
```sql
-- Sink connector config'ine invalid bir değer ekle
UPDATE pipeline_connectors
SET config = jsonb_set(
  config,
  '{connection.url}',
  '"jdbc:postgresql://invalid-host:5432/db"'
)
WHERE type = 'sink'
AND pipeline_id = 'YOUR_PIPELINE_ID';
```

**4. Pipeline'ı Tekrar Deploy Edin:**
- Source deploy başarılı ✅
- Sink deploy BAŞARISIZ ❌
- **ROLLBACK TETIKLENIR!** 🔄
- Source connector silinir ✅

**Backend Logs:**
```
[INFO] Deploying source connector
[INFO] Source connector deployed
[INFO] Deploying sink connector
[ERROR] Sink deployment failed: Connection refused
[WARN] Rolling back source connector due to sink failure
[INFO] Source connector rolled back
[ERROR] Deployment failed
```

---

## 📊 Test Results Yorumlama

### Başarılı Deploy:
```
✅ Start: Starting deployment test...
✅ Deploy: Deployment successful!
✅ Source: Source connector deployed
✅ Sink: Sink connector deployed
```

### Rollback Tetiklenmiş:
```
✅ Start: Starting deployment test...
✅ Source: Source connector deployed
❌ Error: sink: Connection refused
⚠️  Rollback: 🔄 Rollback was triggered!
❌ Deploy: Deployment failure
```

### Kafka Connect Yok:
```
✅ Start: Starting deployment test...
❌ Deploy: Deployment failed: fetch failed
❌ Error: source: fetch failed
```

---

## 💡 İpuçları

### 1. Backend Logs'u JSON Pretty Print ile Görmek:
```bash
npm run debezium:dev | bunyan
# veya
npm run debezium:dev | pino-pretty
```

### 2. Pipeline_Connectors Tablosunu Kontrol:
```sql
-- Deploy sonrası connector'ları gör
SELECT
  pipeline_id,
  name,
  type,
  status,
  connector_class,
  config->>'connector.class' as class,
  created_at,
  updated_at
FROM pipeline_connectors
ORDER BY created_at DESC;
```

### 3. Kafka Connect'te Connector'ları Gör:
```bash
curl http://localhost:8083/connectors | jq
```

### 4. Connector Status'ü Kontrol:
```bash
curl http://localhost:8083/connectors/my-pipeline-source/status | jq
```

---

## 🚀 Gerçek Ortam Testi

### Tam Stack Test:

**1. Tüm servisleri başlatın:**
```bash
# Terminal 1: PostgreSQL
docker-compose -f docker-compose.debezium.yml up postgres

# Terminal 2: Kafka + Zookeeper + Connect
docker-compose -f docker-compose.debezium.yml up kafka zookeeper connect

# Terminal 3: Backend
npm run debezium:dev

# Terminal 4: Frontend
npm run dev
```

**2. Test Pipeline Oluşturun:**
- Login olun
- New Pipeline → PostgreSQL to PostgreSQL
- Source config girin (valid)
- Sink config girin (invalid host)
- Deploy edin
- **Rollback tetiklenecek!**

**3. Verify:**
```bash
# Source connector silindi mi?
curl http://localhost:8083/connectors | jq

# DB'de kayıt var mı?
SELECT * FROM pipeline_connectors WHERE pipeline_id = 'YOUR_ID';

# Pipeline status error mı?
SELECT status FROM pipelines WHERE id = 'YOUR_ID';
```

---

## 📖 Özet

Bu test guide ile şunları test edebilirsiniz:

✅ Deploy mekanizması
✅ Rollback logic
✅ DLQ configuration
✅ Pause/Start/Delete operations
✅ Error handling
✅ Structured logging
✅ DB persistence
✅ Status tracking

**Test sayfası:** `/test-rollback`
**Backend URL:** `http://localhost:3001`
**Frontend URL:** `http://localhost:5173`

Herhangi bir sorun için backend logs'u kontrol edin!
