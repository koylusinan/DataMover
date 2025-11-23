# Quick Start Guide

Get CDCStream up and running in 5 minutes!

## Prerequisites

- Node.js 18+
- Kafka Connect running on `http://127.0.0.1:8083`
- Supabase project

## 1. Install

```bash
npm install
```

## 2. Configure

Create `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Database (Backend)
SUPABASE_DB_HOST=db.your-project.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-password
SUPABASE_DB_SSL=require

# API URLs
VITE_BACKEND_URL=http://localhost:5001
VITE_DEBEZIUM_BACKEND_URL=http://localhost:5002

# Kafka Connect
KAFKA_CONNECT_URL=http://127.0.0.1:8083
```

## 3. Start Services

Open **3 terminals**:

### Terminal 1 - Frontend
```bash
npm run dev
```
→ http://localhost:5173

### Terminal 2 - Registry Backend
```bash
npm run backend:dev
```
→ http://localhost:5001

### Terminal 3 - Debezium Backend
```bash
npm run debezium:dev
```
→ http://localhost:5002

## 4. Verify

```bash
# Check all services
curl http://localhost:5173
curl http://localhost:5001/api/health
curl http://localhost:5002/api/health
curl http://127.0.0.1:8083/
```

## 5. Create Your First Pipeline

1. Open http://localhost:5173
2. Click "New Pipeline"
3. Select source (Oracle/PostgreSQL)
4. Configure connection
5. Select tables
6. Configure destination
7. Deploy!

## What's Running?

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | React UI |
| Registry Backend | 5001 | Oracle/Postgres testing, validation |
| Debezium Backend | 5002 | Kafka Connect management |
| Kafka Connect | 8083 | Debezium connectors |

## Next Steps

- Read [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup
- Read [DEBEZIUM_BACKEND.md](DEBEZIUM_BACKEND.md) for API docs
- Configure Oracle Instant Client if needed

## Troubleshooting

**Services won't start?**
- Check ports are not in use
- Verify database password in `.env`
- Ensure Kafka Connect is running

**Can't connect to database?**
```bash
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

**Kafka Connect not available?**
```bash
docker ps
docker logs kafka-connect
```

## Need Help?

See detailed documentation:
- [SETUP_GUIDE.md](SETUP_GUIDE.md)
- [DEBEZIUM_BACKEND.md](DEBEZIUM_BACKEND.md)
- [README.md](README.md)
