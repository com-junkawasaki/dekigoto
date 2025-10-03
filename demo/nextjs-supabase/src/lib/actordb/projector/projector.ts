import { ProjectionConfig } from '../config/config';
import { EventStore, Event } from '../eventstore';

// ProjectionDefinition defines a projection's schema and IVM rules
// Merkle DAG: sha256:projection_def_v1 - Declarative projection DSL
export interface ProjectionDefinition {
  name: string;
  sources: SourceDefinition[];
  stateSchema?: { [key: string]: any };
  ivm: IVMConfig;
  security: SecurityConfig;
  materialization: MaterializationConfig;
}

// SourceDefinition defines an event source for projection
export interface SourceDefinition {
  stream: string;
  key?: string;
  filter?: string;
}

// IVMConfig configures Incremental View Maintenance
export interface IVMConfig {
  lateWindowMs: number;
  watermarkLagMs: number;
  delta: DeltaRule[];
}

// DeltaRule defines how to update projection state from events
export interface DeltaRule {
  on: string; // event type
  update: string; // update expression
}

// SecurityConfig defines security policies for the projection
export interface SecurityConfig {
  rls: string; // Row Level Security expression
  mask: string[]; // Columns to mask
  tenantId?: string;
}

// MaterializationConfig controls auto-promotion/demotion
export interface MaterializationConfig {
  promoteIfQPS: number;
  demoteIfQPS: number;
}

// ProjectionState holds the current state of a projection
export interface ProjectionState {
  name: string;
  isMaterialized: boolean;
  lastUpdate: Date;
  qps: number;
  state: { [key: string]: any };
}

// ProjectionResult contains query results
export interface ProjectionResult {
  data: any;
  source: 'materialized' | 'ondemand';
  latency: number; // in milliseconds
  timestamp: Date;
}

// Worker handles projection updates
class Worker {
  private id: number;
  private engine: ProjectionEngine;
  private queue: ProjectionUpdate[] = [];
  private running: boolean = false;
  private processing: boolean = false;

  constructor(id: number, engine: ProjectionEngine) {
    this.id = id;
    this.engine = engine;
  }

  start(): void {
    this.running = true;
    this.process();
  }

  stop(): void {
    this.running = false;
  }

  enqueue(update: ProjectionUpdate): void {
    this.queue.push(update);
    this.process();
  }

  private async process(): Promise<void> {
    if (this.processing || !this.running) {
      return;
    }

    this.processing = true;

    while (this.running && this.queue.length > 0) {
      const update = this.queue.shift();
      if (update) {
        try {
          await this.processUpdate(update);
        } catch (err) {
          console.error(`Worker ${this.id} error processing update: ${err}`);
        }
      }
    }

    this.processing = false;
  }

  private async processUpdate(update: ProjectionUpdate): Promise<void> {
    // Get projection definition
    const def = this.engine.getProjectionDefinition(update.projectionName);
    if (!def) {
      console.error(`Definition not found for projection: ${update.projectionName}`);
      return;
    }

    // Apply IVM rules
    const proj = this.engine.getProjectionState(update.projectionName);
    if (!proj) {
      return;
    }

    // MVP: Simple state updates based on event type
    switch (update.event.eventType) {
      case 'order_created':
        if (typeof proj.state.orders === 'number') {
          proj.state.orders += 1;
        } else {
          proj.state.orders = 1;
        }
        break;
      case 'order_cancelled':
        if (typeof proj.state.orders === 'number' && proj.state.orders > 0) {
          proj.state.orders -= 1;
        }
        break;
    }

    proj.lastUpdate = new Date();

    // Check for auto-promotion
    this.checkAutoPromotion(update.projectionName, proj);
  }

  private checkAutoPromotion(name: string, proj: ProjectionState): void {
    if (!proj.isMaterialized && proj.qps >= this.engine.getConfig().auto_promote_qps_threshold) {
      console.log(`Auto-promoting projection ${name} (QPS: ${proj.qps})`);
      proj.isMaterialized = true;
      // Reset QPS after promotion
      proj.qps = 0;
    }
  }
}

// ProjectionUpdate represents an update to process
interface ProjectionUpdate {
  projectionName: string;
  event: Event;
  priority: number; // 0=interactive, 1=batch
}

// ProjectionEngine handles IVM with auto-materialization
// Process Network Node: projection_engine
// Dependencies: [event_stream, catalog_service]
// Outputs: [materialized_views, ondemand_results]
// SLO: p99_latency_200ms_ondemand_50ms_materialized
export class ProjectionEngine {
  private config: ProjectionConfig;
  private eventstore: EventStore;
  private projections: Map<string, ProjectionState> = new Map();
  private definitions: Map<string, ProjectionDefinition> = new Map();
  private workers: Worker[] = [];
  private running: boolean = false;
  private unsubscribe?: () => void;

  constructor(config: ProjectionConfig, eventstore: EventStore) {
    this.config = config;
    this.eventstore = eventstore;

    // Initialize workers
    for (let i = 0; i < config.worker_count; i++) {
      this.workers.push(new Worker(i, this));
    }
  }

  // Start begins the ProjectionEngine operation
  async start(): Promise<void> {
    this.running = true;

    // Start workers
    for (const worker of this.workers) {
      worker.start();
    }

    // Subscribe to the event store
    this.unsubscribe = this.eventstore.subscribe((event) => {
      this.routeEvent(event);
    });

    console.log(`ProjectionEngine started with ${this.workers.length} workers`);
  }

  // Stop shuts down the ProjectionEngine
  async stop(): Promise<void> {
    this.running = false;

    // Stop workers
    for (const worker of this.workers) {
      worker.stop();
    }

    // Unsubscribe from the event store
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    console.log('ProjectionEngine stopped');
  }

  // RegisterProjection registers a new projection definition
  registerProjection(def: ProjectionDefinition): void {
    this.definitions.set(def.name, def);

    this.projections.set(def.name, {
      name: def.name,
      isMaterialized: false,
      lastUpdate: new Date(),
      qps: 0,
      state: {},
    });

    console.log(`Registered projection: ${def.name}`);
  }

  // Query executes a projection query
  // Merkle DAG: sha256:projection_query_v1 - Materialized/ondemand projection query execution
  async query(projectionName: string, params?: { [key: string]: any }): Promise<ProjectionResult> {
    if (!this.running) {
      throw new Error('projection engine not running');
    }

    const start = Date.now();

    const proj = this.projections.get(projectionName);
    if (!proj) {
      throw new Error(`projection ${projectionName} not found`);
    }

    const result: ProjectionResult = {
      data: { ...proj.state },
      timestamp: new Date(),
      latency: Date.now() - start,
      source: proj.isMaterialized ? 'materialized' : 'ondemand',
    };

    if (!proj.isMaterialized) {
      // Update QPS for auto-promotion logic
      this.updateQPS(projectionName);
    }

    return result;
  }

  // Internal methods for workers
  getConfig(): ProjectionConfig {
    return this.config;
  }

  getProjectionDefinition(name: string): ProjectionDefinition | undefined {
    return this.definitions.get(name);
  }

  getProjectionState(name: string): ProjectionState | undefined {
    return this.projections.get(name);
  }

  private routeEvent(event: Event): void {
    if (!this.running) {
      return;
    }

    for (const [name, def] of this.definitions) {
      if (this.shouldProcessEvent(def, event)) {
        const update: ProjectionUpdate = {
          projectionName: name,
          event,
          priority: 1, // Default to batch priority
        };

        // Route to worker (simple round-robin for MVP)
        const workerIndex = name.length % this.workers.length;
        this.workers[workerIndex].enqueue(update);
      }
    }
  }

  private shouldProcessEvent(def: ProjectionDefinition, event: Event): boolean {
    for (const source of def.sources) {
      if (source.stream === event.eventType) {
        return true;
      }
    }
    return false;
  }

  private updateQPS(projectionName: string): void {
    const proj = this.projections.get(projectionName);
    if (proj) {
      proj.qps += 1.0; // Simplified QPS tracking
    }
  }
}
