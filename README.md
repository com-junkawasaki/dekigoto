# ActorDB - Dekigoto

![ActorDB Logo](resources/zatsudan_kaiwa_roujin_kodomo.png)
*Logo illustration by [irasutoya](https://www.irasutoya.com/2015/08/blog-post_33.html)*

**ActorDB** is a novel database model that combines **single-writer actor serialization**, **incremental view maintenance (IVM)**, and **zero-trust messaging** into a unified database experience.

## Overview

ActorDB provides:
- **Write Model**: Actor (aggregate) based event persistence with append-only semantics
- **Read Model**: Query-driven projections with on-demand computation and automatic materialization promotion
- **Security**: mTLS + JWS signatures + ABAC/RBAC with RLS/column masking built into projections
- **Consistency**: Strong single-writer serialization within actors, eventual consistency across actors with sagas

## Architecture

```mermaid
graph TD
    subgraph "Client Layer"
        QI[Query Interface]
        CLI[TypeScript Client]
    end

    subgraph "Processing Layer"
        SEC[Security Gateway]
        PROC[Projection Engine]
        CP[Control Plane]
        CAT[Catalog Service]
    end

    subgraph "Storage Layer"
        ES[EventStore]
        STO[Pluggable Storage]
    end

    CLI --"gRPC/HTTP"--> QI
    QI --"SQL-like Queries"--> PROC
    QI --"Token Validation"--> SEC

    PROC --"Subscribes to Events"--> ES
    PROC --"Reads Projection Defs"--> CAT
    
    SEC --"Manages Policies"--> CAT
    
    CP --"Monitors & Controls"--> ES
    CP --"Monitors & Controls"--> PROC
    CP --"Monitors & Controls"--> SEC

    ES --"Persists Events to"--> STO

    style QI fill:#f9f,stroke:#333,stroke-width:2px
    style PROC fill:#ccf,stroke:#333,stroke-width:2px
    style ES fill:#cfc,stroke:#333,stroke-width:2px
    style SEC fill:#f99,stroke:#333,stroke-width:2px
    style CP fill:#fcf,stroke:#333,stroke-width:2px
```

*Requires separate build with tags
**SQLite-compatible with remote capabilities

## Core Components

### EventStore
- Actor-based single-writer append-only event storage
- **Multi-backend storage support**:
  - **Memory**: In-memory storage for testing/development
  - **SQLite**: Embedded database for single-node deployments
  - **PostgreSQL**: Production-grade RDBMS with advanced features
  - **libSQL**: SQLite-compatible with remote capabilities ([turso.tech/libsql](https://turso.tech/libsql))
  - **RocksDB**: High-performance KV store (requires `go build -tags rocksdb`)
  - **LevelDB**: Alternative KV store (requires `go build -tags leveldb`)
- Snapshot management with configurable retention
- Compression (Protobuf/Parquet) and indexing

### Projection Engine
- Incremental View Maintenance (IVM) with automatic promotion/demotion
- Late event handling with watermarks and correction windows
- Priority queuing for interactive vs batch workloads

### Security Layer
- mTLS with SPIFFE workload identity
- Short-lived JWT with Proof-of-Possession (PoP)
- ABAC/RBAC with Row-Level Security (RLS) and column masking
- Audit streams for all operations

### Query Interface
- SQL-like declarative query language
- Transparent RLS integration
- Support for temporal queries with event-time semantics

### Control Plane
- Auto-scaling and shard rebalancing
- Health monitoring and SLO tracking
- Certificate rotation and policy distribution

## Process Network Model

This project follows a **Merkle DAG-based process network model** defined in `dag.jsonnet`. All operations must maintain topological consistency:

- **Execution**: Follow topological sort order
- **Problem Resolution**: Use reverse topological sort to identify root causes
- **Dependencies**: Keep dependency DAG minimal and stable

## Quick Start

```bash
# Build
go build -o actordb ./cmd/actordb

# Run with example configuration
./actordb -config config/example.yaml
```

## Configuration

See `config/example.yaml` for configuration options.

### Storage Configuration

Configure your preferred storage backend in `config/example.yaml`:

```yaml
eventstore:
  storage:
    type: "libsql"  # memory, sqlite, postgresql, libsql, rocksdb, leveldb
    path: "/data/actordb/events.db"  # For SQLite/RocksDB/LevelDB
    connection_string: "libsql://your-database.turso.io"  # For libSQL/PostgreSQL remote
    options:
      max_connections: 25  # Additional options
```

## TypeScript Client

ActorDB provides a full-featured TypeScript client library for easy integration:

### Installation

```bash
cd client/typescript
npm install
npm run build
```

### Usage

```typescript
import { quickStart } from './dist';

// Quick setup
const { client, actors, queries } = quickStart('http://localhost:9090', 'your-token');

// Work with actors
const user = actors.getActor('user-123', 'user');
await user.create();
await user.writeEvent('user_created', { name: 'John', email: 'john@example.com' });

// Query data
const result = await queries.projectionState('user_profiles').execute();
console.log(result.data);
```

See `client/typescript/README.md` for detailed documentation.

## C Library Dependencies

For RocksDB and LevelDB storage backends, you need to install the corresponding C libraries:

### macOS (Homebrew)

```bash
brew install rocksdb leveldb
```

### Ubuntu/Debian

```bash
sudo apt-get install librocksdb-dev libleveldb-dev
```

### CentOS/RHEL

```bash
sudo yum install rocksdb-devel leveldb-devel
```

### Build with C Libraries

Use the provided build script:

```bash
# Build all variants
./build.sh --all

# Build specific storage backend
./build.sh --libsql
./build.sh --rocksdb
./build.sh --leveldb

# Run built binaries
./bin/actordb-libsql --config config/example.yaml
./bin/actordb-rocksdb --config config/example.yaml
./bin/actordb-leveldb --config config/example.yaml
```

### Manual Build

```bash
# libSQL (no C dependencies required)
go build -o actordb-libsql ./cmd/actordb

# RocksDB
CGO_CFLAGS="-I/opt/homebrew/include" CGO_LDFLAGS="-L/opt/homebrew/lib -lrocksdb -lz -lbz2 -lsnappy -llz4 -lzstd" \
go build -tags rocksdb -o actordb-rocksdb ./cmd/actordb

# LevelDB
CGO_CFLAGS="-I/opt/homebrew/include" CGO_LDFLAGS="-L/opt/homebrew/lib -lleveldb -lz -lbz2 -lsnappy -llz4 -lzstd" \
go build -tags leveldb -o actordb-leveldb ./cmd/actordb
```

## MVP Validation Criteria

- **Actor Throughput**: ≥50-100k cmds/sec/node
- **Projection Latency P99**: ≤200ms (ondemand), ≤50ms (materialized)
- **Late Event Correction**: Failure rate < 10^-6
- **Rebuild Time**: ≤30s for 100GB projections
- **Security Propagation**: ≤30s for key revocation

## License

MIT License
