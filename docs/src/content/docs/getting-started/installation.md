---
title: Installation
description: Step-by-step guide to install and configure ActorDB TypeScript
---

# Installation Guide

This guide covers installing and configuring ActorDB TypeScript from source.

## Prerequisites

Before installing ActorDB TypeScript, ensure you have:

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (comes with Node.js)
- **TypeScript**: Version 5.0 or higher (installed automatically)
- **Git**: For cloning the repository

```bash
# Check versions
node --version  # Should be 18.0+
npm --version   # Should be 8.0+
```

## Installation Methods

### Method 1: Clone and Build from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/junkawasaki/actordb-dokigoto.git
   cd actordb-dokigoto
   ```

2. **Navigate to TypeScript implementation**
   ```bash
   cd impl/typescript
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Verify installation**
   ```bash
   npm test  # Run tests (if available)
   ```

### Method 2: Direct Download

If you prefer not to clone the entire repository:

```bash
# Download and extract the TypeScript implementation
wget https://github.com/junkawasaki/actordb-dokigoto/archive/main.zip
unzip main.zip
cd actordb-dokigoto-main/impl/typescript
npm install
npm run build
```

## Project Structure

After installation, your directory structure should look like:

```
impl/typescript/
├── dist/                 # Compiled JavaScript output
├── src/                  # TypeScript source code
│   ├── config/          # Configuration management
│   ├── security/        # Security gateway
│   ├── eventstore/      # Event storage
│   ├── projector/       # Projection engine
│   ├── query/           # Query interface
│   ├── control/         # Control plane
│   ├── main.ts          # Application entry point
│   └── index.ts         # Main exports
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md           # Implementation documentation
```

## Configuration

### Default Configuration

ActorDB TypeScript uses YAML configuration. Copy the example config:

```bash
cp ../../config/example.yaml config.yaml
```

### Configuration Structure

```yaml
version: "1.0.0"
cluster:
  name: "actordb-cluster"
  nodes: ["localhost"]

eventstore:
  data_dir: "./data"
  snapshot_interval: 100
  retention_period: "30d"
  storage:
    type: "memory"  # memory, sqlite, postgresql
    path: "./data/events.db"

projection:
  worker_count: 4
  max_memory_mb: 512
  auto_promote_qps_threshold: 10.0
  late_window_ms: "1s"
  watermark_lag_ms: "500ms"

security:
  mtls_enabled: false
  jwt_issuer: "actordb"
  jwt_lifetime_sec: 3600
  jws_secret: "your-secret-key"
  listen_addr: ":8443"

query:
  listen_addr: ":8080"
  max_connections: 100
  query_timeout_sec: "30s"
  enable_sql_dialect: true

control:
  listen_addr: ":8081"
  metrics_interval_sec: "10s"
  scaling_check_interval_sec: "30s"
  max_hot_key_rho: 0.8

monitoring:
  prometheus_addr: ":9090"
  health_check_interval_sec: "30s"

logging:
  level: "info"
  format: "json"
  output: "stdout"
```

### Storage Backends

#### Memory Storage (Default)
```yaml
eventstore:
  storage:
    type: "memory"
```
- Fast for development/testing
- Data lost on restart
- No persistence

#### SQLite Storage
```yaml
eventstore:
  storage:
    type: "sqlite"
    path: "./data/events.db"
```
- Single-file database
- Good for small deployments
- ACID transactions

#### PostgreSQL Storage
```yaml
eventstore:
  storage:
    type: "postgresql"
    connection_string: "postgresql://user:pass@localhost:5432/actordb"
```
- Production-ready
- High performance
- Advanced features

## Environment Variables

Override configuration with environment variables:

```bash
# Security
export ACTORDB_JWT_SECRET="your-production-secret"
export ACTORDB_JWS_SECRET="your-jws-secret"

# Database
export ACTORDB_DB_HOST="localhost"
export ACTORDB_DB_PORT="5432"
export ACTORDB_DB_NAME="actordb"
export ACTORDB_DB_USER="actordb_user"
export ACTORDB_DB_PASSWORD="secure-password"

# Ports
export ACTORDB_QUERY_PORT="8080"
export ACTORDB_SECURITY_PORT="8443"
export ACTORDB_CONTROL_PORT="8081"
```

## Running ActorDB

### Development Mode

```bash
# Start with default config
npm start

# Start with custom config
npm start -- --config /path/to/your/config.yaml

# Generate JWT token for testing
npm start -- --generate-token
```

### Production Mode

```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start -- --config config.prod.yaml
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY config/ ./config/

EXPOSE 8080 8443 8081
CMD ["node", "dist/main.js", "--config", "config/production.yaml"]
```

```bash
# Build and run
docker build -t actordb-typescript .
docker run -p 8080:8080 -p 8443:8443 -p 8081:8081 actordb-typescript
```

## Health Checks

### Service Endpoints

- **Query Interface**: `GET http://localhost:8080/health`
- **Security Gateway**: `GET http://localhost:8443/health`
- **Control Plane**: `GET http://localhost:8081/health`

### Docker Health Check

```yaml
version: '3.8'
services:
  actordb:
    build: .
    ports:
      - "8080:8080"
      - "8443:8443"
      - "8081:8081"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>
```

#### Permission Denied

```bash
# Fix data directory permissions
chmod 755 data/
chown -R actordb:actordb data/
```

#### Database Connection Failed

```bash
# Test database connection
psql -h localhost -U actordb_user -d actordb

# Check connection string format
postgresql://user:password@host:port/database
```

#### Out of Memory

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 dist/main.js

# Or set environment variable
export NODE_OPTIONS="--max-old-space-size=4096"
```

## Next Steps

- [Quick Start Tutorial](/getting-started/quick-start)
- [Configuration Reference](/api/configuration)
- [Component Architecture](/architecture/process-network)
