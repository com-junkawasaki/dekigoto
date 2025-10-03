import { ActorDBClient } from './client';
import { Event, WriteResult } from './types';

// Merkle DAG: aggregate_root -> event_handler_pattern
// Generic AggregateRoot to reduce boilerplate in event-sourced systems.
export abstract class AggregateRoot<S extends object, EData extends { type: string }> {
  public readonly id: string;
  protected state: S;
  private handlers: Map<string, (state: S, data: EData) => S> = new Map();

  constructor(id: string, initialState: S) {
    this.id = id;
    this.state = initialState;
  }

  protected register<T extends EData>(
    eventType: T['type'],
    handler: (state: S, data: T) => S
  ) {
    this.handlers.set(eventType, handler as (state: S, data: EData) => S);
  }

  public apply(data: EData): void {
    const handler = this.handlers.get(data.type);
    if (handler) {
      this.state = handler(this.state, data);
    }
  }

  public applyAll(events: Event[]): void {
    events.forEach(event => this.apply(event.data as EData));
  }

  public getState(): S {
    return this.state;
  }
}

/**
 * A factory for creating event objects consistently.
 */
export class EventFactory<TEventData extends { type: string }> {
  private aggregateType: string;
  private idExtractor: (data: TEventData) => string;
  private metadataExtractor: (data: TEventData) => Record<string, any>;

  constructor(
    aggregateType: string,
    idExtractor: (data: TEventData) => string,
    metadataExtractor: (data: TEventData) => Record<string, any> = () => ({})
  ) {
    this.aggregateType = aggregateType;
    this.idExtractor = idExtractor;
    this.metadataExtractor = metadataExtractor;
  }

  /**
   * Creates a new event object.
   * @param data The event-specific data payload.
   * @param sequence The sequence number (optional, defaults to 1 as a placeholder).
   */
  public create(data: TEventData, sequence: number = 1): Event {
    const baseMetadata = { eventVersion: '1.0' };
    const customMetadata = this.metadataExtractor(data);

    return {
      aggregateId: this.idExtractor(data),
      aggregateType: this.aggregateType,
      sequence,
      eventType: data.type,
      data,
      timestamp: new Date(),
      eventTime: new Date(),
      metadata: { ...baseMetadata, ...customMetadata },
    };
  }
}

/**
 * Projects a list of states from a stream of events.
 *
 * @param events The stream of events.
 * @param aggregateType The type of aggregate to project.
 * @param aggregateFactory A function that creates a new aggregate from an ID and a list of events.
 * @returns A list of aggregate states.
 */
export function projectFromEvents<S extends object, E extends Event>(
  events: E[],
  aggregateType: string,
  aggregateFactory: (id: string, events: E[]) => AggregateRoot<S, any>
): S[] {
  const aggregates = new Map<string, E[]>();

  // Group events by aggregate ID
  for (const event of events) {
    if (event.aggregateType === aggregateType) {
      const id = event.aggregateId;
      if (!aggregates.has(id)) {
        aggregates.set(id, []);
      }
      aggregates.get(id)!.push(event);
    }
  }

  // Create aggregates from event groups and get their state
  const result: S[] = [];
  for (const [id, aggregateEvents] of aggregates) {
    const aggregate = aggregateFactory(id, aggregateEvents);
    const state = aggregate.getState();
    // Assuming the factory returns null for deleted/invalid aggregates
    if (state && !(state as any).status?.includes('cancelled')) {
      result.push(state);
    }
  }

  return result;
}

// Merkle DAG: typed_actor_manager -> state_session_orm
// A generic manager that acts as a State-Session-ORM for actors.
// It takes an aggregate's definition and provides type-safe handles
// corresponding to the aggregate's current state.

/**
 * A map defining how to create a state-specific handle.
 * The keys are state names (e.g., 'pending'), and the values are functions
 * that create the handle for that state.
 */
export type StateHandlerMap<TState, TBaseHandle> = {
  [state: string]: (baseHandle: TBaseHandle) => any;
};

/**
 * A function that extracts the state name (as a string) from a state object.
 */
export type StateAccessor<TState> = (state: TState) => string;

export class TypedActorManager<
  TState extends object,
  TAggregate extends AggregateRoot<TState, any>
> {
  private client: ActorDBClient;
  private aggregateClass: new (id: string, events: Event[]) => TAggregate;
  private stateAccessor: StateAccessor<TState>;
  private handlerMap: StateHandlerMap<TState, { state: TState; actor: Actor }>;

  constructor(
    client: ActorDBClient,
    aggregateClass: new (id: string, events: Event[]) => TAggregate,
    stateAccessor: StateAccessor<TState>,
    handlerMap: StateHandlerMap<TState, { state: TState; actor: Actor }>
  ) {
    this.client = client;
    this.aggregateClass = aggregateClass;
    this.stateAccessor = stateAccessor;
    this.handlerMap = handlerMap;
  }

  /**
   * Retrieves a type-safe handle for a given actor ID.
   * The type of the returned handle depends on the actor's current state.
   * @param aggregateId The ID of the aggregate.
   * @param aggregateType The type of the aggregate.
   * @returns A promise that resolves to a state-specific handle, or null if not found.
   */
  public async getHandle(aggregateId: string, aggregateType: string) {
    const actor = new Actor(this.client, aggregateId, aggregateType);
    const events = await actor.readEvents();

    if (events.length === 0) {
      return null;
    }

    const aggregate = new this.aggregateClass(aggregateId, events);
    const state = aggregate.getState();

    // Return null if state is invalid (e.g., for a deleted aggregate)
    if (!state) {
        return null;
    }
    
    const stateName = this.stateAccessor(state);
    const handlerFactory = this.handlerMap[stateName];

    if (handlerFactory) {
      await actor.loadSequence(); // Ensure sequence is loaded for subsequent writes
      const baseHandle = { state, actor };
      return handlerFactory(baseHandle) as ReturnType<typeof handlerFactory>;
    }

    // Return a base handle if no specific handler is found for the state
    return { state, actor };
  }
}


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
