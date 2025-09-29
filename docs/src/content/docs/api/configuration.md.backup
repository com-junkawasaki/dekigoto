---
title: Configuration API
description: Complete YAML configuration schema and options for ActorDB TypeScript
---

# Configuration API

ActorDB TypeScript uses YAML configuration files to define system behavior, component settings, and operational parameters.

## Configuration Structure

```yaml
# Complete ActorDB TypeScript Configuration
version: "1.0.0"
cluster:
  name: "actordb-cluster"
  nodes: ["localhost"]
eventstore:
  data_dir: "./data"
  snapshot_interval: 100
  retention_period: "30d"
  compression: "gzip"
  max_concurrent_writes: 10
  storage:
    type: "memory"
    path: "./data/events.db"
    connection_string: "postgresql://user:pass@localhost:5432/actordb"
    options: {}
projection:
  worker_count: 4
  max_memory_mb: 512
  auto_promote_qps_threshold: 10.0
  auto_demote_qps_threshold: 1.0
  late_window_ms: "1000ms"
  watermark_lag_ms: "500ms"
  max_rebuild_time_sec: "30s"
security:
  mtls_enabled: false
  jwt_issuer: "actordb"
  jwt_lifetime_sec: 3600
  jws_secret: "your-secret-key"
  audit_stream_enabled: true
  spiffe_trust_domain: "example.org"
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

## TypeScript Interface

```typescript
interface Config {
  version: string;
  cluster: ClusterConfig;
  eventstore: EventStoreConfig;
  projection: ProjectionConfig;
  security: SecurityConfig;
  query: QueryConfig;
  control: ControlConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
}
```

## Configuration Sections

### Cluster Configuration

<div class="interface-definition">
<h4>ClusterConfig</h4>
```typescript
interface ClusterConfig {
  name: string;        // Cluster identifier
  nodes: string[];     // List of cluster nodes
}
```
</div>

**YAML Example:**
```yaml
cluster:
  name: "production-cluster"
  nodes:
    - "node1.example.com:8080"
    - "node2.example.com:8080"
    - "node3.example.com:8080"
```

**Properties:**
- `name`: Unique cluster identifier for multi-node deployments
- `nodes`: Array of node addresses for cluster communication

### EventStore Configuration

<div class="interface-definition">
<h4>EventStoreConfig</h4>
```typescript
interface EventStoreConfig {
  data_dir: string;
  snapshot_interval: number;
  retention_period: string;
  compression: string;
  max_concurrent_writes: number;
  storage: StorageConfig;
}
```
</div>

**YAML Example:**
```yaml
eventstore:
  data_dir: "./data/events"
  snapshot_interval: 100
  retention_period: "90d"
  compression: "gzip"
  max_concurrent_writes: 20
  storage:
    type: "postgresql"
    connection_string: "postgresql://actordb:password@localhost:5432/actordb"
```

**Properties:**
- `data_dir`: Directory for storing event data and snapshots
- `snapshot_interval`: Create snapshot every N events per aggregate
- `retention_period`: How long to keep events (e.g., "30d", "1y")
- `compression`: Compression algorithm for stored events
- `max_concurrent_writes`: Maximum parallel write operations
- `storage`: Storage backend configuration

### Storage Backend Configuration

<div class="interface-definition">
<h4>StorageConfig</h4>
```typescript
interface StorageConfig {
  type: "memory" | "sqlite" | "postgresql";
  path?: string;
  connection_string?: string;
  options?: { [key: string]: any };
}
```
</div>

#### Memory Storage

```yaml
storage:
  type: "memory"
```
- **Use Case**: Development, testing, temporary deployments
- **Pros**: Fast, simple, no external dependencies
- **Cons**: Data lost on restart, limited capacity

#### SQLite Storage

```yaml
storage:
  type: "sqlite"
  path: "./data/events.db"
  options:
    journal_mode: "WAL"
    synchronous: "NORMAL"
```
- **Use Case**: Single-node deployments, small to medium scale
- **Pros**: ACID transactions, single file, good performance
- **Cons**: Not suitable for high-concurrency scenarios

#### PostgreSQL Storage

```yaml
storage:
  type: "postgresql"
  connection_string: "postgresql://user:password@host:port/database"
  options:
    ssl: true
    max_connections: 20
    connection_timeout: 10000
```
- **Use Case**: Production deployments, high availability
- **Pros**: Advanced features, high performance, scalability
- **Cons**: Requires separate database server

### Projection Configuration

<div class="interface-definition">
<h4>ProjectionConfig</h4>
```typescript
interface ProjectionConfig {
  worker_count: number;
  max_memory_mb: number;
  auto_promote_qps_threshold: number;
  auto_demote_qps_threshold: number;
  late_window_ms: string;
  watermark_lag_ms: string;
  max_rebuild_time_sec: string;
}
```
</div>

**YAML Example:**
```yaml
projection:
  worker_count: 8
  max_memory_mb: 1024
  auto_promote_qps_threshold: 50.0
  auto_demote_qps_threshold: 5.0
  late_window_ms: "2000ms"
  watermark_lag_ms: "1000ms"
  max_rebuild_time_sec: "300s"
```

**Properties:**
- `worker_count`: Number of parallel projection workers
- `max_memory_mb`: Memory limit for projection state
- `auto_promote_qps_threshold`: Auto-promote to materialized when QPS exceeds
- `auto_demote_qps_threshold`: Auto-demote from materialized when QPS drops below
- `late_window_ms`: How long to wait for late-arriving events
- `watermark_lag_ms`: Lag behind event time for watermark advancement
- `max_rebuild_time_sec`: Maximum time allowed for projection rebuild

### Security Configuration

<div class="interface-definition">
<h4>SecurityConfig</h4>
```typescript
interface SecurityConfig {
  mtls_enabled: boolean;
  jwt_issuer: string;
  jwt_lifetime_sec: number;
  jws_secret: string;
  audit_stream_enabled: boolean;
  spiffe_trust_domain: string;
  listen_addr: string;
}
```
</div>

**YAML Example:**
```yaml
security:
  mtls_enabled: true
  jwt_issuer: "actordb.example.com"
  jwt_lifetime_sec: 1800
  jws_secret: "${JWT_SECRET}"  # Environment variable
  audit_stream_enabled: true
  spiffe_trust_domain: "example.com"
  listen_addr: ":8443"
```

**Properties:**
- `mtls_enabled`: Enable mutual TLS authentication
- `jwt_issuer`: JWT issuer identifier
- `jwt_lifetime_sec`: Token lifetime in seconds
- `jws_secret`: Secret key for JWT signing/verification
- `audit_stream_enabled`: Enable security audit logging
- `spiffe_trust_domain`: SPIFFE trust domain for workload identity
- `listen_addr`: Security gateway listen address

### Query Configuration

<div class="interface-definition">
<h4>QueryConfig</h4>
```typescript
interface QueryConfig {
  listen_addr: string;
  max_connections: number;
  query_timeout_sec: string;
  enable_sql_dialect: boolean;
}
```
</div>

**YAML Example:**
```yaml
query:
  listen_addr: ":8080"
  max_connections: 200
  query_timeout_sec: "60s"
  enable_sql_dialect: true
```

**Properties:**
- `listen_addr`: Query interface listen address
- `max_connections`: Maximum concurrent connections
- `query_timeout_sec`: Query execution timeout
- `enable_sql_dialect`: Enable SQL-like query syntax

### Control Plane Configuration

<div class="interface-definition">
<h4>ControlConfig</h4>
```typescript
interface ControlConfig {
  listen_addr: string;
  metrics_interval_sec: string;
  scaling_check_interval_sec: string;
  max_hot_key_rho: number;
}
```
</div>

**YAML Example:**
```yaml
control:
  listen_addr: ":8081"
  metrics_interval_sec: "30s"
  scaling_check_interval_sec: "60s"
  max_hot_key_rho: 0.7
```

**Properties:**
- `listen_addr`: Control plane listen address
- `metrics_interval_sec`: Metrics collection interval
- `scaling_check_interval_sec`: Auto-scaling evaluation interval
- `max_hot_key_rho`: Hot key detection threshold (0.0-1.0)

### Monitoring Configuration

<div class="interface-definition">
<h4>MonitoringConfig</h4>
```typescript
interface MonitoringConfig {
  prometheus_addr: string;
  health_check_interval_sec: string;
}
```
</div>

**YAML Example:**
```yaml
monitoring:
  prometheus_addr: ":9090"
  health_check_interval_sec: "30s"
```

**Properties:**
- `prometheus_addr`: Prometheus metrics endpoint
- `health_check_interval_sec`: Health check frequency

### Logging Configuration

<div class="interface-definition">
<h4>LoggingConfig</h4>
```typescript
interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
  output: "stdout" | "stderr" | "file";
}
```
</div>

**YAML Example:**
```yaml
logging:
  level: "info"
  format: "json"
  output: "stdout"
```

**Properties:**
- `level`: Minimum log level to output
- `format`: Log format (json for structured logging)
- `output`: Where to send log output

## Environment Variable Substitution

Configuration values can reference environment variables:

```yaml
security:
  jws_secret: "${JWT_SECRET}"
  jwt_issuer: "${JWT_ISSUER:-actordb}"

database:
  host: "${DB_HOST:-localhost}"
  port: "${DB_PORT:-5432}"
  password: "${DB_PASSWORD}"
```

## Configuration Validation

The configuration is validated at startup:

```typescript
class ConfigValidator {
  validate(config: Config): ValidationResult {
    const errors: string[] = [];

    // Version check
    if (!config.version) {
      errors.push("version is required");
    }

    // Storage validation
    if (!config.eventstore.storage.type) {
      errors.push("eventstore.storage.type is required");
    }

    // Security validation
    if (config.security.jwt_lifetime_sec < 300) {
      errors.push("jwt_lifetime_sec must be at least 300 seconds");
    }

    // Cross-reference validation
    if (config.projection.worker_count > config.eventstore.max_concurrent_writes) {
      errors.push("projection worker_count cannot exceed eventstore max_concurrent_writes");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

## Configuration Hot Reload

Support for runtime configuration updates:

```typescript
class ConfigReloader {
  private watcher: fs.FSWatcher;
  private currentConfig: Config;

  watchConfigFile(configPath: string): void {
    this.watcher = fs.watch(configPath, (eventType) => {
      if (eventType === 'change') {
        this.reloadConfig(configPath);
      }
    });
  }

  private async reloadConfig(configPath: string): Promise<void> {
    try {
      const newConfig = load(configPath);
      const validation = this.validator.validate(newConfig);

      if (validation.valid) {
        this.currentConfig = newConfig;
        this.notifyComponents(newConfig);
      } else {
        console.error('Invalid configuration:', validation.errors);
      }
    } catch (error) {
      console.error('Failed to reload configuration:', error);
    }
  }

  private notifyComponents(config: Config): void {
    // Notify components that support hot reload
    this.eventstore.updateConfig(config.eventstore);
    this.projectionEngine.updateConfig(config.projection);
    this.securityGateway.updateConfig(config.security);
  }
}
```

## Configuration Examples

See the `config/example.yaml` file for complete configuration examples. The configuration system allows ActorDB TypeScript to be finely tuned for different deployment scenarios while maintaining type safety and validation.
