---
title: Welcome to ActorDB TypeScript
description: Complete TypeScript implementation of ActorDB following process network graph model with Merkle DAG
---

# ActorDB TypeScript Documentation

Welcome to the comprehensive documentation for ActorDB's TypeScript implementation. This documentation covers the complete TypeScript version of ActorDB, designed following SOLID principles and process network graph modeling.

## What is ActorDB?

ActorDB is an event-sourcing database that implements the CQRS pattern with automatic projections and materialization. The TypeScript implementation provides:

- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Process Network Architecture**: Component orchestration following topological ordering
- **Merkle DAG Structure**: Immutable component versioning and dependency tracking
- **Zero-Trust Security**: JWT-based authentication with RBAC/ABAC authorization
- **Auto-Scaling**: Intelligent projection materialization and resource management

## Key Features

<div class="flow-diagram">
  <div class="flow-step">
    <h3>🔐 Security Gateway</h3>
    <p>JWT validation, RBAC/ABAC, audit streaming</p>
  </div>
  <div class="flow-arrow">→</div>
  <div class="flow-step">
    <h3>📝 EventStore</h3>
    <p>Actor-based event persistence with snapshots</p>
  </div>
  <div class="flow-arrow">→</div>
  <div class="flow-step">
    <h3>🔄 Projection Engine</h3>
    <p>IVM with auto-materialization</p>
  </div>
  <div class="flow-arrow">→</div>
  <div class="flow-step">
    <h3>🔍 Query Interface</h3>
    <p>REST API with declarative DSL</p>
  </div>
  <div class="flow-arrow">→</div>
  <div class="flow-step">
    <h3>🎛️ Control Plane</h3>
    <p>Monitoring and auto-scaling</p>
  </div>
</div>

## Process Network Architecture

The implementation follows a strict process network model defined in `dag.jsonnet`:

```json
{
  "processes": {
    "security_gateway": {
      "id": "security_gateway",
      "description": "Zero-trust messaging with mTLS + JWS + ABAC/RBAC",
      "dependencies": [],
      "outputs": ["validated_tokens", "audit_stream"],
      "security": "spiffe_shortlived_jwt",
      "slo": "token_validation_10ms",
      "merkle_hash": "sha256:sec_gw_v1"
    }
  }
}
```

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start with default config
npm start

# Or run in development mode
npm run dev
```

## Architecture Overview

- **Write Path**: Security Gateway → EventStore (single-writer actor persistence)
- **Read Path**: EventStore → Projection Engine → Query Interface (IVM with auto-materialization)
- **Control Path**: All components → Control Plane (monitoring and scaling decisions)

## TypeScript Benefits

- **Type Safety**: Comprehensive interfaces for all components
- **Developer Experience**: IntelliSense, refactoring, and error checking
- **Modern JavaScript**: Async/await, ES modules, and latest language features
- **Ecosystem Integration**: NPM packages, testing frameworks, and build tools

## Getting Started

Choose your learning path:

- [📚 Overview](/getting-started/overview) - Learn about ActorDB concepts
- [⚡ Quick Start](/getting-started/quick-start) - Get up and running in 5 minutes
- [🔧 Installation](/getting-started/installation) - Detailed setup instructions

## Examples

Explore practical examples:

- [Basic Event Sourcing](/examples/basic-eventsourcing)
- [CQRS with Projections](/examples/cqrs-projections)
- [Real-time Dashboards](/examples/realtime-dashboards)

## API Reference

Complete API documentation:

- [Configuration](/api/configuration) - YAML config schema
- [Storage Backends](/api/storage) - Database adapters
- [REST APIs](/api/rest-apis) - HTTP endpoints
