# CDCStream - Change Data Capture Platform

Enterprise-grade CDC platform powered by Debezium, Kafka Connect, and real-time monitoring.

## 🚀 Quick Start

### Local Development (Recommended)

```bash
# One command to start everything!
./start-local.sh

# Stop and cleanup
./stop-local.sh
```

### Manual Setup

```bash
# 1. Start Kafka stack
docker-compose -f docker-compose.local.yml up -d

# 2. Start backend
npm run debezium:dev

# 3. Start frontend
npm run dev
```

## 📚 Documentation

- [**Local Setup Guide**](LOCAL_SETUP.md) - Complete local development setup
- [**Setup Guide**](SETUP_GUIDE.md) - Initial configuration
- [**API Reference**](API_REFERENCE.md) - Backend API documentation
- [**Integration Guide**](INTEGRATION_GUIDE.md) - Integration patterns
- [**Troubleshooting**](TROUBLESHOOTING.md) - Common issues and solutions

## 🏗️ Architecture

```
Frontend (React) → Backend (Node.js) → Kafka Connect → Kafka → Databases
                                    ↓
```

## 🎯 Features

- ✅ Real-time CDC with Debezium
- ✅ Multiple source/sink connectors
- ✅ Visual pipeline builder
- ✅ Real-time monitoring with Prometheus
- ✅ Role-based access control (RBAC)
- ✅ Alert system
- ✅ Pipeline scheduling
- ✅ Connector registry

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Fastify
- **Database:** PostgreSQL (Supabase)
- **CDC:** Debezium, Kafka Connect
- **Message Broker:** Apache Kafka

## 📊 Service Ports

| Service        | Port | Description                |
|----------------|------|----------------------------|
| Frontend       | 5173 | React UI                   |
| Backend        | 5002 | Debezium Backend API       |
| Kafka          | 9092 | Kafka Broker               |
| Kafka Connect  | 8083 | Kafka Connect REST API     |
| Kafka UI       | 8080 | Kafka Management UI        |
| Prometheus     | 9090 | Metrics Storage            |

## 🔧 Configuration

See [.env.local.example](.env.local.example) for all environment variables.

## 🧪 Testing

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## 📖 Usage

1. Start local environment with `./start-local.sh`
2. Open http://localhost:5173
3. Create a new pipeline
4. Configure source and destination
5. Monitor in real-time

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines first.

## 📝 License

MIT
