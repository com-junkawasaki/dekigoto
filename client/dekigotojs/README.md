# ActorDB TypeScript Client

A TypeScript client library for interacting with ActorDB, providing both low-level HTTP API access and high-level abstractions for working with actors and queries.

## Installation

```bash
npm install actordb-client
# or
yarn add actordb-client
```

## Quick Start

```typescript
import { quickStart } from 'actordb-client';

// Initialize client with quick setup
const { client, actors, queries } = quickStart('http://localhost:9090', 'your-jwt-token');

// Create and use an actor
const user = actors.getActor('user-123', 'user');
await user.create();
await user.writeEvent('user_created', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Query data
const result = await queries.projectionState('user_profiles').execute();
console.log(result.data);
```

## Manual Setup

```typescript
import { ActorDBClient, ActorManager, QueryBuilders } from 'actordb-client';

// Create client
const client = new ActorDBClient({
  baseURL: 'http://localhost:9090',
  token: 'your-jwt-token',
  timeout: 30000,
});

// Create managers
const actors = new ActorManager(client);
const queries = new QueryBuilders(client);
```

## Working with Actors

### Creating and Managing Actors

```typescript
// Get or create an actor
const user = actors.getActor('user-123', 'user');
await user.create();

// Write events
await user.writeEvent('user_updated', {
  name: 'Jane Doe',
  preferences: { theme: 'dark' }
});

// Read events
const events = await user.readEvents();
console.log('User events:', events);

// Get current state
const state = await user.getState();
console.log('Current state:', state);
```

### Batch Operations

```typescript
// Write multiple events at once
const events = [
  {
    aggregate_id: 'user-123',
    sequence: 1,
    event_type: 'user_created',
    data: { name: 'John' },
    aggregate_type: 'user'
  },
  {
    aggregate_id: 'user-123',
    sequence: 2,
    event_type: 'user_updated',
    data: { email: 'john@example.com' },
    aggregate_type: 'user'
  }
];

const results = await client.writeEventsBatch(events);
console.log('Batch write results:', results);
```

## Querying Data

### Using Query Builders

```typescript
// Simple query
const result = await queries.builder()
  .select('*')
  .from('user_profiles')
  .where('active = ?', { active: true })
  .limit(10)
  .execute();

// Count query
const count = await queries.countEventsByType('user_created').execute();

// Recent events
const recent = await queries.recentEvents(50).execute();

// Events by metadata
const tagged = await queries.eventsByMetadata('tags', 'important').execute();
```

### Raw SQL Queries

```typescript
// Execute raw SQL
const result = await client.executeSQL(
  'SELECT * FROM user_profiles WHERE created_at > ?',
  { created_at: '2024-01-01T00:00:00Z' }
);
```

## Projections

### Registering Projections

```typescript
const projection = {
  name: 'user_profiles',
  sources: [
    {
      stream: 'user_created',
      key: 'user_id'
    },
    {
      stream: 'user_updated',
      key: 'user_id'
    }
  ],
  state_schema: {
    user_id: 'string',
    name: 'string',
    email: 'string',
    created_at: 'timestamp'
  },
  ivm: {
    late_window_ms: 60000,
    watermark_lag_ms: 2000,
    delta: [
      {
        on: 'user_created',
        update: 'name = data.name; email = data.email; created_at = timestamp'
      },
      {
        on: 'user_updated',
        update: 'name = data.name || name; email = data.email || email'
      }
    ]
  },
  security: {
    rls: 'tenant_id',
    mask: ['password', 'ssn']
  },
  materialization: {
    promote_if_qps: 2.0,
    demote_if_qps: 0.2
  }
};

await client.registerProjection(projection);
```

### Querying Projections

```typescript
// List all projections
const projections = await client.listProjections();

// Get projection state
const state = await client.getProjectionState('user_profiles');
```

## Security and Authentication

### Token Management

```typescript
// Set token
client.setToken('new-jwt-token');

// Clear token
client.clearToken();

// Validate token
const validation = await client.validateToken();
if (validation.valid) {
  console.log('Token is valid for:', validation.context);
}
```

## Monitoring and Health Checks

```typescript
// Check system health
const health = await client.getHealth();
health.forEach(service => {
  console.log(`${service.service}: ${service.status}`);
});

// Get metrics
const metrics = await client.getMetrics();
console.log('System metrics:', metrics);
```

## Error Handling

```typescript
import { ActorDBError } from 'actordb-client';

try {
  await client.writeEvent(event);
} catch (error) {
  if (error instanceof ActorDBError) {
    console.error('ActorDB error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Response:', error.response);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Advanced Usage

### Custom HTTP Requests

```typescript
// Raw HTTP request for advanced use cases
const response = await client.request({
  method: 'GET',
  url: '/custom-endpoint',
  params: { param1: 'value1' },
  headers: { 'Custom-Header': 'value' }
});
```

### Event Streaming (Future)

```typescript
// Subscribe to real-time events (when implemented)
const subscription = client.subscribeToEvents({
  aggregate_id: 'user-123'
});

subscription.on('event', (event) => {
  console.log('New event:', event);
});
```

## Configuration

### Client Configuration Options

```typescript
const client = new ActorDBClient({
  baseURL: 'http://localhost:9090',     // ActorDB server URL
  timeout: 30000,                        // Request timeout in ms
  token: 'jwt-token',                    // Authentication token
  headers: {                             // Additional headers
    'X-Tenant-ID': 'tenant-123',
    'User-Agent': 'my-app/1.0.0'
  }
});
```

## API Reference

### ActorDBClient

- `writeEvent(event)` - Write a single event
- `writeEventsBatch(events)` - Write multiple events
- `readEvents(aggregateId, fromSequence?)` - Read events for an aggregate
- `query(request)` - Execute a query
- `executeSQL(sql, parameters?)` - Execute SQL query
- `getHealth()` - Get system health status
- `getMetrics()` - Get system metrics
- `createAggregate(id, type)` - Create a new aggregate
- `getAggregateState(id)` - Get aggregate state
- `registerProjection(projection)` - Register a projection
- `listProjections()` - List all projections
- `getProjectionState(name)` - Get projection state
- `validateToken(token?)` - Validate authentication token
- `request(config)` - Raw HTTP request

### Actor

- `create()` - Create the actor
- `writeEvent(type, data, metadata?)` - Write an event
- `readEvents(fromSequence?)` - Read events
- `getState()` - Get current state
- `loadSequence()` - Load current sequence from store

### QueryBuilder

- `select(fields?)` - Start SELECT query
- `from(projection)` - Specify projection/table
- `where(condition, params?)` - Add WHERE clause
- `orderBy(field, direction?)` - Add ORDER BY clause
- `limit(count)` - Add LIMIT clause
- `offset(count)` - Add OFFSET clause
- `param(key, value)` - Add query parameter
- `raw(sql)` - Set raw SQL
- `execute()` - Execute the query

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `npm test`
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
