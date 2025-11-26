# Supabase Database Backup & Restore

## Hızlı Komutlar

### Yedek Al
```bash
docker exec supabase_db_cdcstream pg_dump -U postgres -d postgres \
  --no-owner --no-acl --schema=public -F c \
  > backups/supabase_full_$(date +%Y%m%d_%H%M%S).dump
```

### Geri Yükle
```bash
docker exec -i supabase_db_cdcstream pg_restore -U postgres -d postgres \
  --clean --no-owner --no-acl \
  < backups/supabase_full_20241126_012900.dump
```

---

## Detaylı Kullanım

### 1. Tam Yedek (Custom Format - Önerilen)

```bash
# Tüm public schema'yı yedekle
docker exec supabase_db_cdcstream pg_dump -U postgres -d postgres \
  --no-owner --no-acl \
  --schema=public \
  -F c \
  > backups/supabase_full_$(date +%Y%m%d_%H%M%S).dump
```

### 2. SQL Format Yedek

```bash
# SQL olarak yedekle (okunabilir)
docker exec supabase_db_cdcstream pg_dump -U postgres -d postgres \
  --no-owner --no-acl \
  --schema=public \
  > backups/supabase_full_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Sadece Kritik Tablolar

```bash
docker exec supabase_db_cdcstream pg_dump -U postgres -d postgres \
  --no-owner --no-acl \
  -t public.pipelines \
  -t public.pipeline_connectors \
  -t public.pipeline_table_objects \
  -t public.user_profiles \
  -t public.connectors \
  -t public.connector_versions \
  -t public.alert_preferences \
  -t public.slack_integrations \
  -t public.monitoring_settings \
  > backups/supabase_critical_$(date +%Y%m%d_%H%M%S).sql
```

### 4. Sadece Schema (Yapı)

```bash
docker exec supabase_db_cdcstream pg_dump -U postgres -d postgres \
  --no-owner --no-acl \
  --schema-only \
  --schema=public \
  > backups/supabase_schema_$(date +%Y%m%d_%H%M%S).sql
```

### 5. Sadece Data

```bash
docker exec supabase_db_cdcstream pg_dump -U postgres -d postgres \
  --no-owner --no-acl \
  --data-only \
  --schema=public \
  > backups/supabase_data_$(date +%Y%m%d_%H%M%S).sql
```

---

## Geri Yükleme

### Custom Format (.dump) Geri Yükleme

```bash
# --clean: Önce mevcut tabloları sil
docker exec -i supabase_db_cdcstream pg_restore -U postgres -d postgres \
  --clean \
  --no-owner \
  --no-acl \
  < backups/supabase_full_YYYYMMDD_HHMMSS.dump
```

### SQL Format Geri Yükleme

```bash
docker exec -i supabase_db_cdcstream psql -U postgres -d postgres \
  < backups/supabase_full_YYYYMMDD_HHMMSS.sql
```

### Belirli Tabloları Geri Yükle

```bash
# Sadece pipelines tablosunu geri yükle
docker exec -i supabase_db_cdcstream pg_restore -U postgres -d postgres \
  --clean \
  --no-owner \
  --no-acl \
  -t pipelines \
  < backups/supabase_full_YYYYMMDD_HHMMSS.dump
```

---

## Yedek İçeriğini Kontrol Et

```bash
# Yedekteki tabloları listele
docker exec -i supabase_db_cdcstream pg_restore --list \
  < backups/supabase_full_YYYYMMDD_HHMMSS.dump | grep "TABLE DATA"
```

---

## Tablolar (24 Adet)

| Tablo | Açıklama | Öncelik |
|-------|----------|---------|
| `pipelines` | Ana pipeline tanımları | 🔴 Kritik |
| `pipeline_connectors` | Source/Sink connector config | 🔴 Kritik |
| `pipeline_table_objects` | Tablo mapping'leri | 🔴 Kritik |
| `pipeline_tasks` | Task durumları | 🟡 Orta |
| `pipeline_objects` | Seçilen objeler | 🟡 Orta |
| `pipeline_logs` | Pipeline logları | 🟢 Düşük |
| `pipeline_progress_events` | İlerleme eventleri | 🟢 Düşük |
| `pipeline_restore_staging` | Restore staging | 🟡 Orta |
| `pipeline_slack_channels` | Slack kanal bağlantıları | 🟡 Orta |
| `user_profiles` | Kullanıcı profilleri | 🔴 Kritik |
| `user_activity_logs` | Aktivite logları | 🟢 Düşük |
| `connectors` | Connector registry | 🔴 Kritik |
| `connector_versions` | Versiyon geçmişi | 🔴 Kritik |
| `deployments` | Deployment kayıtları | 🟡 Orta |
| `connection_configs` | Connection ayarları | 🟡 Orta |
| `validation_results` | Validasyon sonuçları | 🟢 Düşük |
| `alert_preferences` | Alert tercihleri | 🟡 Orta |
| `alert_events` | Alert eventleri | 🟢 Düşük |
| `alert_recipients` | Alert alıcıları | 🟡 Orta |
| `slack_integrations` | Slack webhook'ları | 🟡 Orta |
| `monitoring_settings` | Global monitoring ayarları | 🟡 Orta |
| `mapping_configs` | Field mapping | 🟡 Orta |
| `job_runs` | Job çalıştırma kayıtları | 🟢 Düşük |
| `precheck_results` | Ön kontrol sonuçları | 🟢 Düşük |

---

## Mevcut Yedekler

| Dosya | Tarih | Boyut |
|-------|-------|-------|
| `supabase_full_20241126_012900.dump` | 26 Kasım 2024 01:29 | 134 KB |
| `database-backup-2025-11-16.sql` | 16 Kasım 2025 | 8.7 KB |

---

## Otomatik Yedekleme (Cron)

```bash
# Crontab'a ekle (her gün 03:00'da yedek al)
0 3 * * * cd /Users/skoyluhp/Downloads/datamove/cdcstream && docker exec supabase_db_cdcstream pg_dump -U postgres -d postgres --no-owner --no-acl --schema=public -F c > backups/supabase_auto_$(date +\%Y\%m\%d).dump
```

---

## Sorun Giderme

### Hata: "relation does not exist"
Foreign key sırası nedeniyle olabilir. `--disable-triggers` kullan:
```bash
docker exec -i supabase_db_cdcstream pg_restore -U postgres -d postgres \
  --clean --no-owner --no-acl --disable-triggers \
  < backups/supabase_full_YYYYMMDD_HHMMSS.dump
```

### Hata: "permission denied"
`--no-owner --no-acl` flag'lerini kullandığından emin ol.

### Container Adını Bul
```bash
docker ps --filter "name=supabase" --filter "name=db" --format "{{.Names}}"
```
