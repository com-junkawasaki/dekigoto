---
title: Process Network Architecture
description: Deep dive into ActorDB's process network topology and component orchestration
---

# Process Network Architecture

ActorDB TypeScript implements a sophisticated process network architecture based on the Merkle DAG defined in `dag.jsonnet`. This architecture ensures reliable, scalable, and maintainable component orchestration.

## Core Principles

### SOLID Architecture
- **Single Responsibility**: Each component has one clear purpose
- **Open/Closed**: Components are extensible without modification
- **Liskov Substitution**: Compatible interfaces across implementations
- **Interface Segregation**: Minimal, focused interfaces
- **Dependency Inversion**: Dependencies point to abstractions

### Merkle DAG Structure
Every component includes Merkle hash references for:
- **Version Control**: Immutable component versions
- **Dependency Tracking**: Input/output relationships
- **SLO Guarantees**: Performance commitments
- **Security Policies**: Access control definitions

## Component Topology

### Execution Order

Components initialize in strict topological order to ensure dependencies are satisfied:

```json
{
  "execution_order": [
    "security_gateway",     // 1. Foundation: security first
    "write_aggregate",      // 2. Write path: event persistence
    "catalog_service",      // 3. Metadata: projection definitions
    "projection_engine",    // 4. Read path: view maintenance
    "query_interface",      // 5. API: query processing
    "control_plane"         // 6. Control: monitoring & scaling
  ]
}
```

### Component Definitions

<div class="process-node">
<h3>🔐 Security Gateway</h3>
<p><strong>Merkle DAG:</strong> <code class="merkle-hash">sha256:sec_gw_v1</code></p>
<p><strong>Description:</strong> Zero-trust messaging with mTLS + JWS + ABAC/RBAC</p>
<p><strong>Dependencies:</strong> []</p>
<p><strong>Outputs:</strong> [validated_tokens, audit_stream]</p>
<p><strong>SLO:</strong> token_validation_10ms</p>
</div>

<div class="process-node">
<h3>📝 Write Aggregate (EventStore)</h3>
<p><strong>Merkle DAG:</strong> <code class="merkle-hash">sha256:event_store_v1</code></p>
<p><strong>Description:</strong> Single-writer actor event append</p>
<p><strong>Dependencies:</strong> [validated_tokens]</p>
<p><strong>Outputs:</strong> [event_stream]</p>
<p><strong>SLO:</strong> p99_latency_100ms</p>
</div>

<div class="process-node">
<h3>🔄 Projection Engine</h3>
<p><strong>Merkle DAG:</strong> <code class="merkle-hash">sha256:proj_eng_v1</code></p>
<p><strong>Description:</strong> Incremental view maintenance with auto-materialization</p>
<p><strong>Dependencies:</strong> [event_stream, catalog_service]</p>
<p><strong>Outputs:</strong> [materialized_views, ondemand_results]</p>
<p><strong>SLO:</strong> p99_latency_200ms_ondemand_50ms_materialized</p>
</div>

<div class="process-node">
<h3>🔍 Query Interface</h3>
<p><strong>Merkle DAG:</strong> <code class="merkle-hash">sha256:query_if_v1</code></p>
<p><strong>Description:</strong> SQL dialect projection with declarative DSL</p>
<p><strong>Dependencies:</strong> [projection_engine, catalog_service]</p>
<p><strong>Outputs:</strong> [query_results]</p>
<p><strong>SLO:</strong> query_p99_100ms</p>
</div>

<div class="process-node">
<h3>🎛️ Control Plane</h3>
<p><strong>Merkle DAG:</strong> <code class="merkle-hash">sha256:ctrl_pln_v1</code></p>
<p><strong>Description:</strong> Auto-scaling, monitoring, and operational automation</p>
<p><strong>Dependencies:</strong> [all_processes]</p>
<p><strong>Outputs:</strong> [scaling_decisions, health_metrics]</p>
<p><strong>SLO:</strong> decision_latency_1s</p>
</div>

## Data Flow Architecture

### Write Path Flow

**Write Path Flow:**
Client Request → Security Gateway → Token Validation → EventStore → Actor State → Event Persistence → Broadcast to Projections

### Read Path Flow

**Read Path Flow:**
Query Request → Security Gateway → Permission Check → Query Interface → Projection Type Check → Direct State / Projection Engine → Response

## Interface Definitions

### TypeScript Interfaces

```typescript
// Core component interfaces follow dependency inversion
interface SecurityGateway {
  validateToken(token: string): TokenValidationResult;
  checkPermission(ctx: SecurityContext, permission: string): boolean;
}

interface EventStore {
  writeEvent(event: Event): Promise<WriteResult>;
  readEvents(aggregateId: string, fromSeq: number): Promise<Event[]>;
  subscribe(listener: (event: Event) => void): () => void;
}

interface ProjectionEngine {
  registerProjection(def: ProjectionDefinition): void;
  query(name: string, params?: any): Promise<ProjectionResult>;
}

interface QueryInterface {
  // HTTP handlers for REST API
}

interface ControlPlane {
  getHealthStatus(): HealthStatus[];
  getMetrics(): MetricsSnapshot;
}
```

### Component Communication

Components communicate through well-defined interfaces:

```typescript
// Event-driven communication
class EventStore {
  private listeners = new Set<(event: Event) => void>();

  subscribe(listener: (event: Event) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private broadcast(event: Event) {
    this.listeners.forEach(listener => listener(event));
  }
}

// Dependency injection for testability
class ProjectionEngine {
  constructor(
    private eventstore: EventStore,
    private config: ProjectionConfig
  ) {}

  start() {
    this.eventstore.subscribe(event => this.processEvent(event));
  }
}
```

## Error Handling & Resilience

### Circuit Breaker Pattern

```typescript
class ResilientComponent {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

### Graceful Degradation

Components degrade gracefully when dependencies fail:

```typescript
class QueryInterface {
  private async handleQuery(req: Request): Promise<Response> {
    try {
      // Try materialized view first
      const result = await this.projectionEngine.query(req.params.name);
      return { data: result.data, source: 'materialized' };
    } catch (error) {
      // Fallback to on-demand computation
      console.warn('Materialized view failed, using on-demand');
      const result = await this.computeOnDemand(req.params.name);
      return { data: result, source: 'ondemand' };
    }
  }
}
```

## Scaling Strategies

### Horizontal Scaling

```typescript
class ScalableProjectionEngine {
  private workers: Worker[] = [];
  private eventQueue = new Map<string, Event[]>();

  scaleOut(count: number) {
    for (let i = 0; i < count; i++) {
      const worker = new Worker();
      worker.start();
      this.workers.push(worker);
    }
  }

  private routeEvent(event: Event) {
    const workerIndex = this.hash(event.aggregateId) % this.workers.length;
    this.workers[workerIndex].enqueue(event);
  }

  private hash(key: string): number {
    // Consistent hashing for stable routing
    return key.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }
}
```

### Vertical Scaling

Components scale vertically through configuration:

```yaml
projection:
  worker_count: 8          # More workers for CPU-intensive tasks
  max_memory_mb: 2048      # More memory for large state
  auto_promote_qps_threshold: 50.0  # Higher threshold for larger instances

eventstore:
  max_concurrent_writes: 100  # Higher concurrency for larger instances
  snapshot_interval: 1000     # Less frequent snapshots for larger instances
```

## Monitoring & Observability

### Metrics Collection

```typescript
interface ComponentMetrics {
  operationCount: number;
  errorCount: number;
  latencyP50: number;
  latencyP99: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
}

class MetricsCollector {
  private metrics = new Map<string, ComponentMetrics>();

  recordOperation(component: string, operation: string, duration: number) {
    const key = `${component}:${operation}`;
    const metric = this.metrics.get(key) || {
      operationCount: 0,
      errorCount: 0,
      latencies: []
    };

    metric.operationCount++;
    metric.latencies.push(duration);

    // Calculate percentiles periodically
    if (metric.latencies.length >= 100) {
      metric.latencyP50 = this.percentile(metric.latencies, 50);
      metric.latencyP99 = this.percentile(metric.latencies, 99);
      metric.latencies = []; // Reset for next window
    }

    this.metrics.set(key, metric);
  }
}
```

### Health Checks

```typescript
interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  responseTime: number;
}

class HealthChecker {
  private checks = new Map<string, () => Promise<HealthCheck>>();

  register(name: string, check: () => Promise<HealthCheck>) {
    this.checks.set(name, check);
  }

  async runAll(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];

    for (const [name, check] of this.checks) {
      const start = Date.now();
      try {
        const result = await check();
        result.responseTime = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: error.message,
          lastCheck: new Date(),
          responseTime: Date.now() - start
        });
      }
    }

    return results;
  }
}
```

## Configuration Management

### Hierarchical Configuration

```typescript
interface ConfigLayer {
  priority: number;
  source: 'default' | 'file' | 'environment' | 'runtime';
  values: { [key: string]: any };
}

class ConfigurationManager {
  private layers: ConfigLayer[] = [];

  addLayer(layer: ConfigLayer) {
    this.layers.push(layer);
    this.layers.sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  get<T>(key: string): T {
    for (const layer of this.layers) {
      if (layer.values[key] !== undefined) {
        return layer.values[key];
      }
    }
    throw new Error(`Configuration key not found: ${key}`);
  }
}
```

This architecture ensures ActorDB TypeScript is:
- **Reliable**: Components fail gracefully and recover automatically
- **Scalable**: Horizontal and vertical scaling support
- **Maintainable**: Clear interfaces and separation of concerns
- **Observable**: Comprehensive monitoring and health checking
- **Testable**: Dependency injection enables thorough testing
