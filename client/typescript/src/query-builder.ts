import { QueryResponse } from './types';
import { ActorDBClient } from './client';

/**
 * Query Builder for ActorDB SQL queries
 */
export class QueryBuilder {
  private client: ActorDBClient;
  private sql: string = '';
  private parameters: Record<string, any> = {};

  constructor(client: ActorDBClient) {
    this.client = client;
  }

  /**
   * Start building a SELECT query
   */
  select(fields: string = '*'): QueryBuilder {
    this.sql = `SELECT ${fields}`;
    return this;
  }

  /**
   * Specify the projection/table to query from
   */
  from(projection: string): QueryBuilder {
    this.sql += ` FROM ${projection}`;
    return this;
  }

  /**
   * Add WHERE clause
   */
  where(condition: string, parameters?: Record<string, any>): QueryBuilder {
    this.sql += ` WHERE ${condition}`;
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.sql += ` ORDER BY ${field} ${direction}`;
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): QueryBuilder {
    this.sql += ` LIMIT ${count}`;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): QueryBuilder {
    this.sql += ` OFFSET ${count}`;
    return this;
  }

  /**
   * Add parameter
   */
  param(key: string, value: any): QueryBuilder {
    this.parameters[key] = value;
    return this;
  }

  /**
   * Set raw SQL (for advanced queries)
   */
  raw(sql: string): QueryBuilder {
    this.sql = sql;
    return this;
  }

  /**
   * Execute the query
   */
  async execute(): Promise<QueryResponse> {
    return this.client.query({
      sql: this.sql,
      parameters: this.parameters,
    });
  }

  /**
   * Get the generated SQL
   */
  getSQL(): string {
    return this.sql;
  }

  /**
   * Get the parameters
   */
  getParameters(): Record<string, any> {
    return { ...this.parameters };
  }

  /**
   * Reset the builder
   */
  reset(): QueryBuilder {
    this.sql = '';
    this.parameters = {};
    return this;
  }
}

/**
 * Predefined query builders for common patterns
 */
export class QueryBuilders {
  private client: ActorDBClient;

  constructor(client: ActorDBClient) {
    this.client = client;
  }

  /**
   * Create a new query builder
   */
  builder(): QueryBuilder {
    return new QueryBuilder(this.client);
  }

  /**
   * Query events by aggregate
   */
  eventsByAggregate(aggregateId: string, fromSequence: number = 1): QueryBuilder {
    return this.builder()
      .raw(`SELECT * FROM events WHERE aggregate_id = ? AND sequence >= ?`)
      .param('aggregate_id', aggregateId)
      .param('from_sequence', fromSequence)
      .orderBy('sequence');
  }

  /**
   * Query events by type
   */
  eventsByType(eventType: string, limit: number = 100): QueryBuilder {
    return this.builder()
      .raw(`SELECT * FROM events WHERE event_type = ?`)
      .param('event_type', eventType)
      .orderBy('timestamp', 'DESC')
      .limit(limit);
  }

  /**
   * Query aggregate state
   */
  aggregateState(aggregateId: string): QueryBuilder {
    return this.builder()
      .raw(`SELECT * FROM aggregate_states WHERE aggregate_id = ?`)
      .param('aggregate_id', aggregateId);
  }

  /**
   * Query projection state
   */
  projectionState(projectionName: string): QueryBuilder {
    return this.builder()
      .raw(`SELECT * FROM ${projectionName}`);
  }

  /**
   * Count events by type
   */
  countEventsByType(eventType?: string): QueryBuilder {
    let builder = this.builder().select('COUNT(*) as count');

    if (eventType) {
      builder = builder
        .from('events')
        .where('event_type = ?', { event_type: eventType });
    } else {
      builder = builder.from('events');
    }

    return builder;
  }

  /**
   * Get recent events
   */
  recentEvents(limit: number = 50): QueryBuilder {
    return this.builder()
      .select('*')
      .from('events')
      .orderBy('timestamp', 'DESC')
      .limit(limit);
  }

  /**
   * Search events by metadata
   */
  eventsByMetadata(key: string, value: any): QueryBuilder {
    return this.builder()
      .raw(`SELECT * FROM events WHERE metadata->>? = ?`)
      .param('key', key)
      .param('value', value)
      .orderBy('timestamp', 'DESC');
  }
}
