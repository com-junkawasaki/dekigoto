# ActorDB TypeScript Implementation

A complete TypeScript implementation of ActorDB following the process network graph model defined in `dag.jsonnet`.

## Process Network Architecture

Following SOLID principles with minimal and stable dependency DAG, this implementation follows the topological execution order:

1. **Security Gateway** (`security_gateway`) - Zero-trust security with mTLS + JWS + ABAC/RBAC
2. **EventStore** (`write_aggregate`) - Single-writer actor event persistence
3. **Projection Engine** (`projection_engine`) - Incremental view maintenance with auto-materialization
4. **Query Interface** (`query_interface`) - SQL dialect projection with declarative DSL
5. **Control Plane** (`control_plane`) - Auto-scaling, monitoring, and operational automation

## Merkle DAG Structure

All components include Merkle DAG hash references for:
- Process network node identification
- Dependency tracking
- SLO guarantees
- Version management

## Components

### Configuration (`src/config/`)
- YAML-based configuration management
- Environment-specific settings
- Duration parsing utilities

### Security Gateway (`src/security/`)
- JWT token validation with JWS
- RBAC/ABAC authorization
- Audit event streaming
- mTLS support (configurable)

### EventStore (`src/eventstore/`)
- Actor-based event persistence
- Multiple storage backends (Memory, SQLite, PostgreSQL)
- Snapshot support
- Event streaming to projection engine

### Projection Engine (`src/projector/`)
- Incremental View Maintenance (IVM)
- Auto-materialization based on QPS thresholds
- Declarative projection definitions
- Worker-based parallel processing

### Query Interface (`src/query/`)
- REST API for event queries
- Actor state inspection
- Admin endpoints with authentication
- Health check endpoints

### Control Plane (`src/control/`)
- System health monitoring
- Metrics collection
- Auto-scaling decisions
- REST API for operational data

## Building and Running

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run with default config
npm start

# Generate sample JWT token
npm start -- --generate-token

# Run with custom config
npm start -- --config /path/to/config.yaml
```

## Configuration

The implementation uses the same YAML configuration format as the Go version. See `config/example.yaml` for the complete configuration schema.

## Process Network Topology

The implementation strictly follows the topological ordering defined in `dag.jsonnet`:

- **Execution Order**: security_gateway → write_aggregate → projection_engine → query_interface → control_plane
- **Resolution Order**: control_plane → query_interface → projection_engine → write_aggregate → security_gateway

## Merkle DAG Comments

Throughout the codebase, you'll find comments referencing Merkle DAG hashes that correspond to the process network nodes defined in `dag.jsonnet`. These ensure:

- Traceability to the process network specification
- Version control of component behavior
- SLO guarantee verification
- Dependency relationship validation

## API Endpoints

### Security Gateway
- `POST /validate` - Token validation
- `GET /health` - Health check
- `GET /audit` - Audit events

### Query Interface
- `POST /query` - Query execution
- `POST /query/admin` - Admin queries (authenticated)
- `GET /events/:aggregateId` - Event history
- `GET /actors/:aggregateId` - Actor state
- `GET /health` - Health check

### Control Plane
- `GET /health` - System health
- `GET /metrics` - System metrics
- `GET /decisions` - Scaling decisions

## Development

The TypeScript implementation provides the same functionality as the Go version while maintaining:
- Type safety
- Modern async/await patterns
- Comprehensive error handling
- Full testability

All components follow the same process network model ensuring consistency with the Go implementation and the overall ActorDB architecture.
