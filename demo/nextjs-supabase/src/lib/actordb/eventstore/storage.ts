import { EventStoreConfig } from '../config/config';

// Event represents a single event in the event store
// Merkle DAG: sha256:event_v1 - Single-writer actor event persistence
export interface Event {
  aggregateId: string;
  sequence: number;
  eventType: string;
  data: Buffer;
  timestamp: Date;
  eventTime: Date; // For late event handling
  aggregateType: string;
  metadata?: { [key: string]: any };
}

// ActorState represents the current state of an actor
export interface ActorState {
  aggregateId: string;
  lastSequence: number;
  lastTimestamp: Date;
  snapshotData?: Buffer;
  snapshotSeq?: number;
}

// WriteResult contains the result of a write operation
export interface WriteResult {
  aggregateId: string;
  sequence: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

// Storage defines the interface for event storage backends
// Process Network Node: storage_backend
// Dependencies: []
// Outputs: [persisted_events, snapshots]
// Merkle DAG: sha256:storage_interface_v1 - Abstract storage backend interface
// This abstraction allows different storage engines (SQLite, PostgreSQL, RocksDB, LevelDB)
export interface Storage {
  // Lifecycle methods
  open(config: { [key: string]: any }): Promise<void>;
  close(): Promise<void>;

  // Event operations
  writeEvent(event: Event): Promise<void>;
  readEvents(aggregateId: string, fromSeq: number, limit?: number): Promise<Event[]>;
  getLastSequence(aggregateId: string): Promise<number>;

  // Snapshot operations
  writeSnapshot(aggregateId: string, sequence: number, data: Buffer): Promise<void>;
  readSnapshot(aggregateId: string): Promise<{ sequence: number; data: Buffer } | null>;

  // Maintenance operations
  compact(): Promise<void>;
  getStats(): Promise<{ [key: string]: any }>;

  // Batch operations for performance
  writeEventsBatch(events: Event[]): Promise<void>;
}

// StorageConfig contains configuration for storage backends
export interface StorageConfig {
  type: string; // sqlite, postgresql, rocksdb, leveldb, memory
  path?: string;
  connectionString?: string;
  options?: { [key: string]: any };
}

// StorageFactory creates storage instances based on type
export class StorageFactory {
  static async createStorage(config: StorageConfig): Promise<Storage> {
    switch (config.type) {
      case 'sqlite':
        return new SQLiteStorage();
      case 'postgresql':
        return new PostgreSQLStorage();
      case 'memory':
      default:
        return new MemoryStorage();
    }
  }
}

// MemoryStorage implements in-memory storage for MVP/testing
// Merkle DAG: sha256:memory_storage_v1 - In-memory event storage for development/testing
export class MemoryStorage implements Storage {
  private events: Map<string, Event[]> = new Map();
  private snapshots: Map<string, { sequence: number; data: Buffer }> = new Map();
  private sequences: Map<string, number> = new Map();

  async open(config: { [key: string]: any }): Promise<void> {
    // No-op for memory storage
  }

  async close(): Promise<void> {
    // No-op for memory storage
  }

  async writeEvent(event: Event): Promise<void> {
    const existingEvents = this.events.get(event.aggregateId) || [];

    // Check sequence
    if (existingEvents.length > 0 && event.sequence !== existingEvents[existingEvents.length - 1].sequence + 1) {
      throw new Error(`sequence mismatch for aggregate ${event.aggregateId}`);
    }

    // First event for this aggregate
    if (existingEvents.length === 0 && event.sequence !== 1) {
      throw new Error(`first event must have sequence 1 for aggregate ${event.aggregateId}`);
    }

    this.events.set(event.aggregateId, [...existingEvents, event]);
    this.sequences.set(event.aggregateId, event.sequence);
  }

  async readEvents(aggregateId: string, fromSeq: number, limit?: number): Promise<Event[]> {
    const events = this.events.get(aggregateId) || [];
    const result: Event[] = [];

    for (const event of events) {
      if (event.sequence >= fromSeq) {
        result.push(event);
        if (limit && result.length >= limit) {
          break;
        }
      }
    }

    return result;
  }

  async getLastSequence(aggregateId: string): Promise<number> {
    return this.sequences.get(aggregateId) || 0;
  }

  async writeSnapshot(aggregateId: string, sequence: number, data: Buffer): Promise<void> {
    this.snapshots.set(aggregateId, { sequence, data });
  }

  async readSnapshot(aggregateId: string): Promise<{ sequence: number; data: Buffer } | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  async compact(): Promise<void> {
    // No-op for memory storage
  }

  async getStats(): Promise<{ [key: string]: any }> {
    return {
      totalAggregates: this.events.size,
      totalEvents: this.countTotalEvents(),
      memoryUsage: 'unknown',
    };
  }

  async writeEventsBatch(events: Event[]): Promise<void> {
    for (const event of events) {
      await this.writeEvent(event);
    }
  }

  // Helper method for testing
  getAllEvents(): Event[] {
    const allEvents: Event[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }
    return allEvents;
  }

  private countTotalEvents(): number {
    let count = 0;
    for (const events of this.events.values()) {
      count += events.length;
    }
    return count;
  }
}

// SQLiteStorage implements SQLite storage
export class SQLiteStorage implements Storage {
  async open(config: { [key: string]: any }): Promise<void> {
    // TODO: Implement SQLite storage
    throw new Error('SQLite storage not implemented yet');
  }

  async close(): Promise<void> {
    // TODO: Implement close
  }

  async writeEvent(event: Event): Promise<void> {
    // TODO: Implement writeEvent
    throw new Error('SQLite writeEvent not implemented yet');
  }

  async readEvents(aggregateId: string, fromSeq: number, limit?: number): Promise<Event[]> {
    // TODO: Implement readEvents
    throw new Error('SQLite readEvents not implemented yet');
  }

  async getLastSequence(aggregateId: string): Promise<number> {
    // TODO: Implement getLastSequence
    throw new Error('SQLite getLastSequence not implemented yet');
  }

  async writeSnapshot(aggregateId: string, sequence: number, data: Buffer): Promise<void> {
    // TODO: Implement writeSnapshot
    throw new Error('SQLite writeSnapshot not implemented yet');
  }

  async readSnapshot(aggregateId: string): Promise<{ sequence: number; data: Buffer } | null> {
    // TODO: Implement readSnapshot
    throw new Error('SQLite readSnapshot not implemented yet');
  }

  async compact(): Promise<void> {
    // TODO: Implement compact
  }

  async getStats(): Promise<{ [key: string]: any }> {
    // TODO: Implement getStats
    return {};
  }

  async writeEventsBatch(events: Event[]): Promise<void> {
    // TODO: Implement writeEventsBatch
    throw new Error('SQLite writeEventsBatch not implemented yet');
  }
}

// PostgreSQLStorage implements PostgreSQL storage
export class PostgreSQLStorage implements Storage {
  async open(config: { [key: string]: any }): Promise<void> {
    // TODO: Implement PostgreSQL storage
    throw new Error('PostgreSQL storage not implemented yet');
  }

  async close(): Promise<void> {
    // TODO: Implement close
  }

  async writeEvent(event: Event): Promise<void> {
    // TODO: Implement writeEvent
    throw new Error('PostgreSQL writeEvent not implemented yet');
  }

  async readEvents(aggregateId: string, fromSeq: number, limit?: number): Promise<Event[]> {
    // TODO: Implement readEvents
    throw new Error('PostgreSQL readEvents not implemented yet');
  }

  async getLastSequence(aggregateId: string): Promise<number> {
    // TODO: Implement getLastSequence
    throw new Error('PostgreSQL getLastSequence not implemented yet');
  }

  async writeSnapshot(aggregateId: string, sequence: number, data: Buffer): Promise<void> {
    // TODO: Implement writeSnapshot
    throw new Error('PostgreSQL writeSnapshot not implemented yet');
  }

  async readSnapshot(aggregateId: string): Promise<{ sequence: number; data: Buffer } | null> {
    // TODO: Implement readSnapshot
    throw new Error('PostgreSQL readSnapshot not implemented yet');
  }

  async compact(): Promise<void> {
    // TODO: Implement compact
  }

  async getStats(): Promise<{ [key: string]: any }> {
    // TODO: Implement getStats
    return {};
  }

  async writeEventsBatch(events: Event[]): Promise<void> {
    // TODO: Implement writeEventsBatch
    throw new Error('PostgreSQL writeEventsBatch not implemented yet');
  }
}
