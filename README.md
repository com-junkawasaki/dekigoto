# ActorDB - Dekigoto

**ActorDB** is a novel database model that combines **single-writer actor serialization**, **incremental view maintenance (IVM)**, and **zero-trust messaging** into a unified database experience.

## Overview

ActorDB provides:
- **Write Model**: Actor (aggregate) based event persistence with append-only semantics
- **Read Model**: Query-driven projections with on-demand computation and automatic materialization promotion
- **Security**: mTLS + JWS signatures + ABAC/RBAC with RLS/column masking built into projections
- **Consistency**: Strong single-writer serialization within actors, eventual consistency across actors with sagas

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Query Interface │    │ Projection DSL  │    │  Control Plane  │
│   (SQL Dialect)  │    │  (IVM Engine)   │    │  (Auto-scaling) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────────┐
                    │ Security Gateway│
                    │ (mTLS + JWS +  │
                    │     ABAC)      │
                    └─────────────────┘
                              │
                    ┌─────────────────┐
                    │   Event Store   │
                    │ (Actor-based    │
                    │  Append-only)   │
                    └─────────────────┘
```

## Core Components

### EventStore
- Actor-based single-writer append-only event storage
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

## MVP Validation Criteria

- **Actor Throughput**: ≥50-100k cmds/sec/node
- **Projection Latency P99**: ≤200ms (ondemand), ≤50ms (materialized)
- **Late Event Correction**: Failure rate < 10^-6
- **Rebuild Time**: ≤30s for 100GB projections
- **Security Propagation**: ≤30s for key revocation

## License

MIT License
