---
title: EventStore
description: Actor-based event persistence with single-writer semantics and snapshot support
---

# EventStore

The EventStore implements actor-based event persistence with single-writer semantics, ensuring consistent event ordering and reliable state reconstruction.

## Overview

<div class="process-node">
<h3>📝 EventStore</h3>
<p><strong>Merkle DAG:</strong> <code class="merkle-hash">sha256:event_store_v1</code></p>
<p><strong>Description:</strong> Single-writer actor event append</p>
<p><strong>Dependencies:</strong> [security_gateway]</p>
<p><strong>Outputs:</strong> [event_stream]</p>
<p><strong>SLO:</strong> p99_latency_100ms</p>
</div>

## Core Concepts

### Event Structure

```typescript
interface Event {
  aggregateId: string;    // Business entity identifier
  sequence: number;       // Event sequence within aggregate
  eventType: string;      // Event type (e.g., 'user_created')
  data: Buffer;          // Event payload (JSON)
  timestamp: Date;       // When event occurred
  eventTime: Date;       // Event time (for late events)
  aggregateType: string;  // Entity type (e.g., 'User')
  metadata?: { [key: string]: any }; // Additional context
}
```

### Actor State

```typescript
interface ActorState {
  aggregateId: string;
  lastSequence: number;
  lastTimestamp: Date;
  snapshotData?: Buffer;
  snapshotSeq?: number;
}
```

### Write Result

```typescript
interface WriteResult {
  aggregateId: string;
  sequence: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}
```

## Single-Writer Semantics

### Actor Isolation

Each aggregate maintains its own event stream with guaranteed ordering:

```typescript
class EventStore {
  private actors = new Map<string, ActorState>();

  async writeEvent(event: Event): Promise<WriteResult> {
    // 1. Validate sequence ordering
    const actor = this.actors.get(event.aggregateId);
    if (actor) {
      const expectedSeq = actor.lastSequence + 1;
      if (event.sequence !== expectedSeq) {
        throw new Error(
          `Sequence mismatch for ${event.aggregateId}. ` +
          `Expected: ${expectedSeq}, Got: ${event.sequence}`
        );
      }
    } else if (event.sequence !== 1) {
      throw new Error(
        `First event for ${event.aggregateId} must have sequence 1`
      );
    }

    // 2. Write to storage
    await this.storage.writeEvent(event);

    // 3. Update actor state
    const newActor: ActorState = {
      aggregateId: event.aggregateId,
      lastSequence: event.sequence,
      lastTimestamp: event.timestamp
    };
    this.actors.set(event.aggregateId, newActor);

    // 4. Broadcast to subscribers
    this.broadcastEvent(event);

    return {
      aggregateId: event.aggregateId,
      sequence: event.sequence,
      timestamp: event.timestamp,
      success: true
    };
  }
}
```

### Concurrency Control

```typescript
class ActorLock {
  private locks = new Map<string, Promise<void>>();

  async withLock<T>(aggregateId: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing operation on this aggregate
    const existingLock = this.locks.get(aggregateId);
    if (existingLock) {
      await existingLock;
    }

    // Create new lock for this operation
    let resolveLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      resolveLock = resolve;
    });

    this.locks.set(aggregateId, lockPromise);

    try {
      return await operation();
    } finally {
      resolveLock!();
      this.locks.delete(aggregateId);
    }
  }
}
```

## Storage Backends

### Storage Interface

```typescript
interface Storage {
  // Lifecycle
  open(config: { [key: string]: any }): Promise<void>;
  close(): Promise<void>;

  // Event operations
  writeEvent(event: Event): Promise<void>;
  readEvents(aggregateId: string, fromSeq: number, limit?: number): Promise<Event[]>;

  // Snapshot operations
  writeSnapshot(aggregateId: string, sequence: number, data: Buffer): Promise<void>;
  readSnapshot(aggregateId: string): Promise<{ sequence: number; data: Buffer } | null>;

  // Maintenance
  compact(): Promise<void>;
  getStats(): Promise<{ [key: string]: any }>;
}
```

### Memory Storage

```typescript
class MemoryStorage implements Storage {
  private events = new Map<string, Event[]>();
  private snapshots = new Map<string, { sequence: number; data: Buffer }>();

  async writeEvent(event: Event): Promise<void> {
    const events = this.events.get(event.aggregateId) || [];
    events.push(event);
    this.events.set(event.aggregateId, events);
  }

  async readEvents(aggregateId: string, fromSeq: number, limit?: number): Promise<Event[]> {
    const events = this.events.get(aggregateId) || [];
    const result = events.filter(e => e.sequence >= fromSeq);

    if (limit) {
      return result.slice(0, limit);
    }

    return result;
  }
}
```

### SQLite Storage

```typescript
class SQLiteStorage implements Storage {
  private db: Database;

  async open(config: { [key: string]: any }): Promise<void> {
    this.db = new Database(config.path);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        aggregate_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        data BLOB NOT NULL,
        timestamp TEXT NOT NULL,
        event_time TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        metadata TEXT,
        PRIMARY KEY (aggregate_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        aggregate_id TEXT PRIMARY KEY,
        sequence INTEGER NOT NULL,
        data BLOB NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  async writeEvent(event: Event): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO events (aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.aggregateId,
      event.sequence,
      event.eventType,
      event.data,
      event.timestamp.toISOString(),
      event.eventTime.toISOString(),
      event.aggregateType,
      event.metadata ? JSON.stringify(event.metadata) : null
    );
  }
}
```

## Snapshot Management

### Snapshot Creation

```typescript
class SnapshotManager {
  private snapshotInterval: number;

  constructor(snapshotInterval: number) {
    this.snapshotInterval = snapshotInterval;
  }

  shouldSnapshot(sequence: number): boolean {
    return sequence % this.snapshotInterval === 0;
  }

  async createSnapshot(aggregateId: string, sequence: number, state: any): Promise<void> {
    const snapshotData = Buffer.from(JSON.stringify(state));

    await this.storage.writeSnapshot(aggregateId, sequence, snapshotData);

    console.log(`Created snapshot for ${aggregateId} at sequence ${sequence}`);
  }
}
```

### State Reconstruction

```typescript
class StateReconstructor {
  async reconstructState(aggregateId: string): Promise<any> {
    // 1. Load latest snapshot
    const snapshot = await this.storage.readSnapshot(aggregateId);
    let state = {};

    if (snapshot) {
      state = JSON.parse(snapshot.data.toString());
    }

    // 2. Apply events since snapshot
    const fromSeq = snapshot ? snapshot.sequence + 1 : 1;
    const events = await this.storage.readEvents(aggregateId, fromSeq);

    // 3. Replay events
    for (const event of events) {
      state = this.applyEvent(state, event);
    }

    return state;
  }

  private applyEvent(state: any, event: Event): any {
    const eventData = JSON.parse(event.data.toString());

    switch (event.eventType) {
      case 'user_created':
        return { ...state, ...eventData, created: true };
      case 'user_updated':
        return { ...state, ...eventData };
      default:
        return state;
    }
  }
}
```

## Event Streaming

### Publisher-Subscriber Pattern

```typescript
interface EventListener {
  (event: Event): void | Promise<void>;
}

class EventPublisher {
  private listeners = new Set<EventListener>();
  private queue: Event[] = [];
  private processing = false;

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(event: Event): Promise<void> {
    this.queue.push(event);
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;

      // Publish to all listeners concurrently
      const promises = Array.from(this.listeners).map(listener =>
        Promise.resolve(listener(event)).catch(error =>
          console.error('Event listener error:', error)
        )
      );

      await Promise.all(promises);
    }

    this.processing = false;
  }
}
```

### Stream Processing

```typescript
class StreamProcessor {
  private streams = new Map<string, EventStream>();

  createStream(name: string, filter?: (event: Event) => boolean): EventStream {
    const stream = new EventStream(name, filter);
    this.streams.set(name, stream);
    return stream;
  }

  async processEvent(event: Event): Promise<void> {
    for (const stream of this.streams.values()) {
      if (stream.matches(event)) {
        await stream.publish(event);
      }
    }
  }
}

class EventStream {
  private listeners = new Set<EventListener>();

  constructor(
    private name: string,
    private filter?: (event: Event) => boolean
  ) {}

  matches(event: Event): boolean {
    return !this.filter || this.filter(event);
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(event: Event): Promise<void> {
    const promises = Array.from(this.listeners).map(listener =>
      Promise.resolve(listener(event)).catch(error =>
        console.error(`Stream ${this.name} listener error:`, error)
      )
    );

    await Promise.all(promises);
  }
}
```

## Performance Optimization

### Batch Operations

```typescript
class BatchProcessor {
  private batchSize: number;
  private flushInterval: number;
  private batches = new Map<string, Event[]>();

  constructor(batchSize = 100, flushInterval = 1000) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;

    setInterval(() => this.flushAll(), flushInterval);
  }

  addToBatch(event: Event): void {
    const key = event.aggregateId;
    const batch = this.batches.get(key) || [];
    batch.push(event);
    this.batches.set(key, batch);

    if (batch.length >= this.batchSize) {
      this.flushBatch(key);
    }
  }

  private async flushBatch(key: string): Promise<void> {
    const batch = this.batches.get(key);
    if (!batch || batch.length === 0) return;

    this.batches.delete(key);

    try {
      await this.storage.writeEventsBatch(batch);
    } catch (error) {
      console.error(`Batch write failed for ${key}:`, error);
      // Re-queue failed events
      this.batches.set(key, batch);
    }
  }

  private async flushAll(): Promise<void> {
    for (const key of this.batches.keys()) {
      await this.flushBatch(key);
    }
  }
}
```

### Read Optimization

```typescript
class ReadOptimizer {
  private cache = new Map<string, { events: Event[]; timestamp: number }>();
  private cacheTTL: number;

  constructor(cacheTTL = 300000) { // 5 minutes
    this.cacheTTL = cacheTTL;
  }

  async readEvents(aggregateId: string, fromSeq: number): Promise<Event[]> {
    const cacheKey = `${aggregateId}:${fromSeq}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.events;
    }

    const events = await this.storage.readEvents(aggregateId, fromSeq);
    this.cache.set(cacheKey, { events, timestamp: Date.now() });

    return events;
  }

  invalidateCache(aggregateId: string): void {
    // Remove all cache entries for this aggregate
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${aggregateId}:`)) {
        this.cache.delete(key);
      }
    }
  }
}
```

## Monitoring & Metrics

### EventStore Metrics

```typescript
interface EventStoreMetrics {
  totalEvents: number;
  totalAggregates: number;
  eventsPerSecond: number;
  averageEventSize: number;
  storageSize: number;
  snapshotCount: number;
  readLatency: { p50: number; p99: number };
  writeLatency: { p50: number; p99: number };
}

class MetricsCollector {
  private metrics = {
    writes: 0,
    reads: 0,
    writeLatencies: [] as number[],
    readLatencies: [] as number[],
    errors: 0
  };

  recordWrite(duration: number, success: boolean): void {
    this.metrics.writes++;
    this.metrics.writeLatencies.push(duration);
    if (!success) this.metrics.errors++;
  }

  recordRead(duration: number, success: boolean): void {
    this.metrics.reads++;
    this.metrics.readLatencies.push(duration);
    if (!success) this.metrics.errors++;
  }

  getMetrics(): EventStoreMetrics {
    return {
      totalEvents: this.metrics.writes,
      readLatency: {
        p50: this.percentile(this.metrics.readLatencies, 50),
        p99: this.percentile(this.metrics.readLatencies, 99)
      },
      writeLatency: {
        p50: this.percentile(this.metrics.writeLatencies, 50),
        p99: this.percentile(this.metrics.writeLatencies, 99)
      }
    };
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    return sorted[Math.floor(index)];
  }
}
```

## Error Handling

### Idempotent Writes

```typescript
class IdempotentWriter {
  private processedEvents = new Set<string>();

  async writeEvent(event: Event): Promise<WriteResult> {
    const eventId = `${event.aggregateId}:${event.sequence}`;

    if (this.processedEvents.has(eventId)) {
      // Return success for duplicate events
      return {
        aggregateId: event.aggregateId,
        sequence: event.sequence,
        timestamp: event.timestamp,
        success: true
      };
    }

    try {
      const result = await this.storage.writeEvent(event);
      this.processedEvents.add(eventId);
      return result;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        this.processedEvents.add(eventId);
        return {
          aggregateId: event.aggregateId,
          sequence: event.sequence,
          timestamp: event.timestamp,
          success: true
        };
      }
      throw error;
    }
  }

  private isDuplicateError(error: any): boolean {
    // Check for duplicate key constraint violations
    return error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
           error.code === '23505'; // PostgreSQL unique violation
  }
}
```

The EventStore provides the foundation for ActorDB's event-sourcing architecture, ensuring reliable, ordered event persistence with strong consistency guarantees.
