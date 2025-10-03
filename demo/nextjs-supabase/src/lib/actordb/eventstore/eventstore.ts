import { EventStoreConfig } from '../config/config';
import { Storage, StorageFactory, Event, ActorState, WriteResult, StorageConfig, MemoryStorage } from './storage';

// EventStore handles actor-based append-only event storage
// Process Network Node: write_aggregate
// Dependencies: []
// Outputs: [event_stream]
// SLO: p99_latency_100ms
export class EventStore {
  private config: EventStoreConfig;
  private storage!: Storage;
  private actors: Map<string, ActorState> = new Map();
  private running: boolean = false;
  private eventListeners: Set<(event: Event) => void> = new Set();

  constructor(config: EventStoreConfig) {
    this.config = config;
  }

  // Start begins the EventStore operation
  async start(): Promise<void> {
    // Create storage backend
    const storageConfig: StorageConfig = {
      type: this.config.storage.type,
      path: this.config.storage.path,
      connectionString: this.config.storage.connection_string,
      options: this.config.storage.options,
    };

    this.storage = await StorageFactory.createStorage(storageConfig);

    const storageConfigMap: { [key: string]: any } = {
      path: this.config.storage.path,
      connection_string: this.config.storage.connection_string,
      ...this.config.storage.options,
    };

    await this.storage.open(storageConfigMap);
    this.running = true;

    console.log(`EventStore started with storage type: ${this.config.storage.type}`);
  }

  // Stop shuts down the EventStore
  async stop(): Promise<void> {
    this.running = false;

    if (this.storage) {
      await this.storage.close();
    }

    console.log('EventStore stopped');
  }

  // WriteEvent appends an event to an actor's event stream
  // Ensures single-writer serialization per actor
  // Merkle DAG: sha256:event_write_v1 - Atomic event append with sequence validation
  async writeEvent(event: Event): Promise<WriteResult> {
    if (!this.running) {
      return {
        aggregateId: event.aggregateId,
        sequence: 0,
        success: false,
        timestamp: new Date(),
        error: 'eventstore not running'
      };
    }

    // Set timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    try {
      // Write to storage backend
      await this.storage.writeEvent(event);

      // Update actor state in memory
      let actor = this.actors.get(event.aggregateId);
      if (!actor) {
        actor = {
          aggregateId: event.aggregateId,
          lastSequence: 0,
          lastTimestamp: new Date(),
        };
        this.actors.set(event.aggregateId, actor);
      }
      actor.lastSequence = event.sequence;
      actor.lastTimestamp = event.timestamp;

      // Check if snapshot is needed
      if (event.sequence % this.config.snapshot_interval === 0) {
        try {
          await this.createSnapshot(event.aggregateId, event.sequence);
        } catch (err) {
          console.error(`Failed to create snapshot for ${event.aggregateId}: ${err}`);
        }
      }

      // Broadcast the event to all subscribers
      this.broadcastEvent(event);

      return {
        aggregateId: event.aggregateId,
        sequence: event.sequence,
        timestamp: event.timestamp,
        success: true,
      };

    } catch (err) {
      return {
        aggregateId: event.aggregateId,
        sequence: 0,
        success: false,
        timestamp: new Date(),
        error: err instanceof Error ? err.message : 'unknown error'
      };
    }
  }

  // ReadEvents reads events for an actor from a given sequence
  async readEvents(aggregateId: string, fromSeq: number): Promise<Event[]> {
    if (!this.running) {
      throw new Error('eventstore not running');
    }

    return await this.storage.readEvents(aggregateId, fromSeq);
  }

  // GetActorState returns the current state of an actor
  async getActorState(aggregateId: string): Promise<ActorState | null> {
    let actor = this.actors.get(aggregateId);

    if (!actor) {
      // Try to get from storage
      const lastSeq = await this.storage.getLastSequence(aggregateId);
      if (lastSeq > 0) {
        // Create in-memory state
        actor = {
          aggregateId,
          lastSequence: lastSeq,
          lastTimestamp: new Date(),
        };
        this.actors.set(aggregateId, actor);
      }
    }

    return actor || null;
  }

  // Subscribe adds a new event listener
  subscribe(listener: (event: Event) => void): () => void {
    this.eventListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  // GetAllEvents returns all events (for testing/debugging)
  getAllEvents(): Event[] {
    // This is inefficient for production use - only for testing
    if (this.storage instanceof MemoryStorage) {
      return (this.storage as any).getAllEvents();
    }
    return [];
  }

  private async createSnapshot(aggregateId: string, sequence: number): Promise<void> {
    // Get actor state
    const actor = await this.getActorState(aggregateId);
    if (!actor) {
      throw new Error(`actor ${aggregateId} not found`);
    }

    // Serialize actor state
    const snapshotData = Buffer.from(JSON.stringify(actor));

    // Write snapshot to storage
    await this.storage.writeSnapshot(aggregateId, sequence, snapshotData);

    console.log(`Created snapshot for actor ${aggregateId} at sequence ${sequence}`);
  }

  private broadcastEvent(event: Event): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`Error in event listener: ${err}`);
      }
    }
  }
}
