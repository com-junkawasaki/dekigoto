import { ActorDBClient } from './client';
import { Event, WriteResult } from './types';

/**
 * High-level Actor abstraction for easier interaction with aggregates
 */
export class Actor {
  private client: ActorDBClient;
  private aggregateId: string;
  private aggregateType: string;
  private sequence: number = 0;

  constructor(client: ActorDBClient, aggregateId: string, aggregateType: string) {
    this.client = client;
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
  }

  /**
   * Create the actor if it doesn't exist
   */
  async create(): Promise<void> {
    await this.client.createAggregate(this.aggregateId, this.aggregateType);
  }

  /**
   * Write an event to this actor
   */
  async writeEvent(eventType: string, data: any, metadata?: Record<string, any>): Promise<WriteResult> {
    this.sequence++;
    return this.client.writeEvent({
      aggregate_id: this.aggregateId,
      sequence: this.sequence,
      event_type: eventType,
      data,
      aggregate_type: this.aggregateType,
      metadata,
    });
  }

  /**
   * Read events for this actor
   */
  async readEvents(fromSequence: number = 1): Promise<Event[]> {
    return this.client.readEvents(this.aggregateId, fromSequence);
  }

  /**
   * Get current state of this actor
   */
  async getState(): Promise<any> {
    return this.client.getAggregateState(this.aggregateId);
  }

  /**
   * Load current sequence from the event store
   */
  async loadSequence(): Promise<void> {
    try {
      const events = await this.readEvents();
      if (events.length > 0) {
        this.sequence = Math.max(...events.map(e => e.sequence));
      }
    } catch (error) {
      // Actor might not exist yet
      this.sequence = 0;
    }
  }

  /**
   * Get the aggregate ID
   */
  getAggregateId(): string {
    return this.aggregateId;
  }

  /**
   * Get the aggregate type
   */
  getAggregateType(): string {
    return this.aggregateType;
  }

  /**
   * Get current sequence
   */
  getSequence(): number {
    return this.sequence;
  }
}

/**
 * Actor Manager for handling multiple actors
 */
export class ActorManager {
  private client: ActorDBClient;
  private actors: Map<string, Actor> = new Map();

  constructor(client: ActorDBClient) {
    this.client = client;
  }

  /**
   * Get or create an actor
   */
  getActor(aggregateId: string, aggregateType: string): Actor {
    const key = `${aggregateType}:${aggregateId}`;
    let actor = this.actors.get(key);

    if (!actor) {
      actor = new Actor(this.client, aggregateId, aggregateType);
      this.actors.set(key, actor);
    }

    return actor;
  }

  /**
   * Create multiple actors
   */
  async createActors(actors: Array<{ id: string; type: string }>): Promise<void> {
    for (const { id, type } of actors) {
      const actor = this.getActor(id, type);
      await actor.create();
    }
  }

  /**
   * Load sequences for all managed actors
   */
  async loadAllSequences(): Promise<void> {
    const promises = Array.from(this.actors.values()).map(actor =>
      actor.loadSequence().catch(() => {
        // Ignore errors for non-existent actors
      })
    );
    await Promise.all(promises);
  }
}
