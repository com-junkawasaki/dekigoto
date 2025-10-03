#!/usr/bin/env node

import * as path from 'path';
import { load, Config } from './config';
import { SecurityGateway } from './security';
import { EventStore } from './eventstore';
import { ProjectionEngine } from './projector';
import { QueryInterface } from './query';
import { ControlPlane } from './control';

// Generate a sample JWT token for testing
// Merkle DAG: sha256:token_gen_v1 - Sample token generation for testing
function generateSampleToken(security: any): string {
  const jwt = require('jsonwebtoken');

  // Allow overriding roles via environment variable
  let roles = ['user', 'reader']; // default roles
  if (process.env.TOKEN_ROLES === 'admin') {
    roles = ['admin'];
  }

  const payload = {
    roles,
    attributes: { department: 'testing' },
    tenant_id: 'tenant-test-456',
    sub: 'user-test-123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iss: security.jwt_issuer,
  };

  const token = jwt.sign(payload, security.jws_secret);
  console.log('Generated sample token:');
  console.log(token);
  return token;
}

// Main entry point following topological execution order from dag.jsonnet
// Process Network Execution: security_gateway -> write_aggregate -> catalog_service -> projection_engine -> query_interface -> control_plane
// Merkle DAG: sha256:main_entry_v1 - Topological process network initialization
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let configPath = 'config/example.yaml';
  let generateToken = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
      configPath = args[i + 1];
      i++;
    } else if (args[i] === '--generate-token') {
      generateToken = true;
    }
  }

  // Load configuration
  const cfg: Config = load(path.resolve(configPath));

  if (generateToken) {
    generateSampleToken(cfg.security);
    return;
  }

  console.log('Starting ActorDB TypeScript components...');

  // Initialize components following topological order from dag.jsonnet
  // Execution order: security_gateway -> write_aggregate -> catalog_service -> projection_engine -> query_interface -> control_plane

  let secGW: SecurityGateway | undefined;
  let es: EventStore | undefined;
  let proj: ProjectionEngine | undefined;
  let qry: QueryInterface | undefined;
  let ctrl: ControlPlane | undefined;

  try {
    // 1. Security Gateway (foundation)
    console.log('Initializing Security Gateway...');
    secGW = new SecurityGateway(cfg.security);

    // 2. EventStore (write path)
    console.log('Initializing EventStore...');
    es = new EventStore(cfg.eventstore);

    // 3. Projection Engine (read path)
    console.log('Initializing Projection Engine...');
    proj = new ProjectionEngine(cfg.projection, es);

    // 4. Query Interface
    console.log('Initializing Query Interface...');
    qry = new QueryInterface(cfg.query, es, secGW);

    // 5. Control Plane (monitoring and scaling)
    console.log('Initializing Control Plane...');
    ctrl = new ControlPlane(cfg.control);
    ctrl.setDependencies(es, proj, secGW);

    // Start all components in topological order
    console.log('Starting all components...');

    await secGW.start();
    await es.start();
    await proj.start();
    await qry.start();
    await ctrl.start();

    console.log(`ActorDB TypeScript started successfully on ${cfg.query.listen_addr}`);

    // Wait for shutdown signal
    const shutdown = () => {
      console.log('Shutting down ActorDB TypeScript...');

      // Shutdown in reverse topological order
      const shutdownPromises: Promise<void>[] = [];

      if (ctrl) shutdownPromises.push(ctrl.stop());
      if (qry) shutdownPromises.push(qry.stop());
      if (proj) shutdownPromises.push(proj.stop());
      if (es) shutdownPromises.push(es.stop());
      if (secGW) shutdownPromises.push(secGW.stop());

      Promise.all(shutdownPromises)
        .then(() => {
          console.log('ActorDB TypeScript shutdown complete');
          process.exit(0);
        })
        .catch((err) => {
          console.error('Error during shutdown:', err);
          process.exit(1);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep the process running
    await new Promise(() => {}); // Never resolves

  } catch (err) {
    console.error('Failed to start ActorDB TypeScript:', err);

    // Cleanup on failure
    const cleanupPromises: Promise<void>[] = [];
    if (ctrl) cleanupPromises.push(ctrl.stop().catch(() => {}));
    if (qry) cleanupPromises.push(qry.stop().catch(() => {}));
    if (proj) cleanupPromises.push(proj.stop().catch(() => {}));
    if (es) cleanupPromises.push(es.stop().catch(() => {}));
    if (secGW) cleanupPromises.push(secGW.stop().catch(() => {}));

    await Promise.all(cleanupPromises);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run main if this file is executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error('Main function error:', err);
    process.exit(1);
  });
}
