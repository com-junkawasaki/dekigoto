// ActorDB TypeScript Client
// Main entry point for the client library

// Core client
export { ActorDBClient, createClient, defaultConfig } from './client';

// High-level abstractions
export { Actor, ActorManager } from './actor';

// Query building utilities
export { QueryBuilder, QueryBuilders } from './query-builder';

// Type definitions
export type {
  Event,
  WriteResult,
  QueryRequest,
  QueryResponse,
  ProjectionDefinition,
  SourceDefinition,
  IVMConfig,
  DeltaRule,
  SecurityConfig,
  MaterializationConfig,
  ClientConfig,
  HealthStatus,
  Metrics,
} from './types';

export { ActorDBError } from './types';

// Convenience functions for quick setup
import { createClient, defaultConfig } from './client';
import { ActorManager } from './actor';
import { QueryBuilders } from './query-builder';

/**
 * Quick setup function for common use cases
 */
export function quickStart(baseURL: string, token?: string) {
  const config = {
    ...defaultConfig,
    baseURL,
    token,
  };

  const client = createClient(config);
  const actors = new ActorManager(client);
  const queries = new QueryBuilders(client);

  return {
    client,
    actors,
    queries,
  };
}

/**
 * Example usage:
 *
 * ```typescript
 * import { quickStart } from 'actordb-client';
 *
 * const { client, actors, queries } = quickStart('http://localhost:9090', 'your-token');
 *
 * // Create an actor
 * const user = actors.getActor('user-123', 'user');
 * await user.create();
 *
 * // Write an event
 * await user.writeEvent('user_created', { name: 'John Doe', email: 'john@example.com' });
 *
 * // Query data
 * const result = await queries.projectionState('user_profiles').execute();
 * console.log(result.data);
 * ```
 */
