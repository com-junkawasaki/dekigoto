---
title: Quick Start
description: Get ActorDB TypeScript up and running in 5 minutes
---

# Quick Start Guide

Get ActorDB TypeScript running in your development environment in just 5 minutes.

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** and **npm 8+**
- **Git** for cloning repositories
- **Terminal** access

```bash
# Verify installations
node --version  # Should show 18.x or higher
npm --version   # Should show 8.x or higher
```

## Step 1: Clone and Setup

```bash
# Clone the ActorDB repository
git clone https://github.com/junkawasaki/actordb-dokigoto.git
cd actordb-dokigoto

# Navigate to TypeScript implementation
cd impl/typescript

# Install dependencies
npm install

# Build the project
npm run build
```

## Step 2: Configuration

Create a basic configuration file:

```bash
# Copy example configuration
cp ../../config/example.yaml config.yaml
```

The default configuration uses in-memory storage - perfect for getting started:

```yaml
version: "1.0.0"
eventstore:
  storage:
    type: "memory"
security:
  jwt_secret: "quickstart-secret"
query:
  listen_addr: ":8080"
```

## Step 3: Start ActorDB

```bash
# Start ActorDB TypeScript
npm start
```

You should see output like:
```
Starting ActorDB TypeScript components...
EventStore started with storage type: memory
Security Gateway started
Projection Engine started with 4 workers
Query Interface started on :8080
Control Plane started
ActorDB TypeScript started successfully on :8080
```

## Step 4: Test the API

### Generate a Test Token

In another terminal, generate a JWT token:

```bash
# Generate sample JWT token
npm start -- --generate-token
```

Output:
```
Generated sample token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Test Event Writing

Create an event using curl:

```bash
# Write a test event
curl -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "aggregateId": "user-123",
    "sequence": 1,
    "eventType": "user_created",
    "data": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "aggregateType": "User"
  }'
```

### Test Event Reading

Read the events back:

```bash
# Read events for the aggregate
curl http://localhost:8080/events/user-123 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Response:
```json
{
  "aggregateId": "user-123",
  "events": [
    {
      "sequence": 1,
      "eventType": "user_created",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "data": "eyJuYW1lIjoiSm9obiBEb2UiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20ifQ=="
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:30:01.000Z"
}
```

## Step 5: Explore Projections

### Register a Projection

Create a simple user summary projection:

```typescript
// In your application code
import { ProjectionEngine, ProjectionDefinition } from 'actordb-typescript';

const projection: ProjectionDefinition = {
  name: 'user_summary',
  sources: [{ stream: 'user_created' }],
  ivm: {
    lateWindowMs: 1000,
    watermarkLagMs: 500,
    delta: [
      {
        on: 'user_created',
        update: 'state[aggregate_id] = { name: event.name, email: event.email, created: true }'
      }
    ]
  }
};

await projectionEngine.registerProjection(projection);
```

### Query the Projection

```bash
# Query the projection
curl "http://localhost:8080/query/projection/user_summary/user-123" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## TypeScript Integration Example

Here's a complete example of using ActorDB in a TypeScript application:

```typescript
import {
  EventStore,
  ProjectionEngine,
  SecurityGateway,
  Event
} from 'actordb-typescript';

// Initialize components
const eventstore = new EventStore({
  storage: { type: 'memory' }
});

const security = new SecurityGateway({
  jwt_secret: 'your-secret'
});

const projections = new ProjectionEngine({}, eventstore);

// Start components
await eventstore.start();
await security.start();
await projections.start();

// Domain model
class User {
  constructor(
    private aggregateId: string,
    private eventstore: EventStore
  ) {}

  async create(name: string, email: string) {
    const event: Event = {
      aggregateId: this.aggregateId,
      sequence: 1, // In real app, get from actor state
      eventType: 'user_created',
      data: Buffer.from(JSON.stringify({ name, email })),
      timestamp: new Date(),
      eventTime: new Date(),
      aggregateType: 'User'
    };

    const result = await this.eventstore.writeEvent(event);
    return result;
  }
}

// Usage
const user = new User('user-123', eventstore);
await user.create('John Doe', 'john@example.com');

// Query projections
const userData = await projections.query('user_summary', {
  userId: 'user-123'
});

console.log(userData); // { name: 'John Doe', email: 'john@example.com', created: true }
```

## Development Workflow

### Running in Development Mode

```bash
# Start with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Debugging

Enable debug logging:

```yaml
logging:
  level: "debug"
  format: "text"
```

Or use environment variables:

```bash
DEBUG=actordb:* npm start
```

### Health Checks

Check system health:

```bash
# Query interface health
curl http://localhost:8080/health

# Security gateway health
curl http://localhost:8443/health

# Control plane health
curl http://localhost:8081/health
```

## Next Steps

Now that you have ActorDB running, explore:

- **[Architecture Overview](/architecture/process-network)** - Deep dive into the system design
- **[Component Documentation](/components/security-gateway)** - Learn about each component
- **[API Reference](/api/configuration)** - Complete API documentation
- **[Examples](/examples/basic-eventsourcing)** - Practical use cases

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port 8080
lsof -i :8080
kill -9 <PID>
```

**Configuration errors:**
```bash
# Validate configuration
npm start -- --validate-config config.yaml
```

**Permission denied:**
```bash
# Fix data directory permissions
chmod 755 data/
```

### Getting Help

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check the full documentation
- **Community**: Join discussions and ask questions

## Production Deployment

For production use, consider:

- **Persistent Storage**: Use PostgreSQL instead of memory
- **Security**: Enable mTLS and proper JWT secrets
- **Monitoring**: Set up Prometheus metrics
- **Scaling**: Configure multiple projection workers
- **Backup**: Regular event data backups

Ready to build event-sourced applications with ActorDB TypeScript! 🚀
