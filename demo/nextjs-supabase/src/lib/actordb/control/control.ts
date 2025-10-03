import express from 'express';
import * as http from 'http';
import { ControlConfig } from '../config/config';
import { EventStore } from '../eventstore';
import { ProjectionEngine } from '../projector';
import { SecurityGateway } from '../security';

// HealthStatus represents system health
export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  message?: string;
}

// MetricsSnapshot contains system metrics
export interface MetricsSnapshot {
  timestamp: Date;
  eventstore: EventStoreMetrics;
  projection: ProjectionMetrics;
  security: SecurityMetrics;
  system: SystemMetrics;
}

// EventStoreMetrics contains EventStore performance metrics
export interface EventStoreMetrics {
  totalEvents: number;
  activeActors: number;
  writeLatencyP50?: number; // milliseconds
  writeLatencyP99?: number; // milliseconds
  errorRate?: number;
}

// ProjectionMetrics contains Projection Engine metrics
export interface ProjectionMetrics {
  activeProjections: number;
  materializedViews: number;
  queryLatencyP50?: number; // milliseconds
  queryLatencyP99?: number; // milliseconds
  rebuildTime?: number; // milliseconds
  lateEventRate?: number;
}

// SecurityMetrics contains security-related metrics
export interface SecurityMetrics {
  tokenValidations: number;
  permissionChecks: number;
  auditEvents: number;
  validationLatencyP99?: number; // milliseconds
}

// SystemMetrics contains system-level metrics
export interface SystemMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  diskUsage?: number; // percentage
  networkIO?: number; // bytes/sec
}

// ScalingDecision represents a scaling action
export interface ScalingDecision {
  service: string;
  action: 'scale_up' | 'scale_down' | 'rebalance';
  reason: string;
  timestamp: Date;
}

// ControlPlane handles auto-scaling, monitoring, and operational automation
// Process Network Node: control_plane
// Dependencies: [all_processes]
// Outputs: [scaling_decisions, health_metrics]
// SLO: decision_latency_1s
export class ControlPlane {
  private config: ControlConfig;
  private eventstore?: EventStore;
  private projector?: ProjectionEngine;
  private security?: SecurityGateway;
  private metrics: MetricsSnapshot;
  private decisions: ScalingDecision[] = [];
  private server?: http.Server;
  private app: express.Application;
  private running: boolean = false;
  private metricsInterval?: NodeJS.Timeout;
  private scalingInterval?: NodeJS.Timeout;
  private healthInterval?: NodeJS.Timeout;

  constructor(config: ControlConfig) {
    this.config = config;
    this.app = express();
    this.metrics = this.createEmptyMetrics();

    this.setupRoutes();
  }

  // SetDependencies sets the dependencies (called after all components are created)
  setDependencies(eventstore: EventStore, projector: ProjectionEngine, security: SecurityGateway): void {
    this.eventstore = eventstore;
    this.projector = projector;
    this.security = security;
  }

  // Start begins the ControlPlane operation
  async start(): Promise<void> {
    this.running = true;

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, this.parseDuration(this.config.metrics_interval_sec));

    // Start scaling controller
    this.scalingInterval = setInterval(() => {
      this.evaluateScaling();
    }, this.parseDuration(this.config.scaling_check_interval_sec));

    // Start health checker
    this.healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // 30 seconds

    // Start HTTP server for monitoring endpoints
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);

      const [host, port] = this.config.listen_addr.split(':');
      const serverConfig = {
        host: host === '' ? undefined : host,
        port: parseInt(port)
      };

      this.server.listen(serverConfig.port, serverConfig.host, () => {
        console.log(`ControlPlane started on ${this.config.listen_addr}`);
        resolve();
      });

      this.server.on('error', (err: Error) => {
        console.error(`ControlPlane server error: ${err.message}`);
        reject(err);
      });
    });
  }

  // Stop shuts down the ControlPlane
  async stop(): Promise<void> {
    this.running = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
    }
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('ControlPlane stopped');
          resolve();
        });
      });
    }
  }

  // GetHealthStatus returns overall system health
  // Merkle DAG: sha256:health_check_v1 - Multi-service health status aggregation
  getHealthStatus(): HealthStatus[] {
    const statuses: HealthStatus[] = [];

    // Check EventStore
    const esHealthy = !!this.eventstore;
    statuses.push({
      service: 'eventstore',
      status: esHealthy ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
    });

    // Check Projector
    const projHealthy = !!this.projector;
    statuses.push({
      service: 'projector',
      status: projHealthy ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
    });

    // Check Security
    const secHealthy = !!this.security;
    statuses.push({
      service: 'security',
      status: secHealthy ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
    });

    return statuses;
  }

  // GetMetrics returns current metrics
  getMetrics(): MetricsSnapshot {
    return { ...this.metrics };
  }

  // GetDecisions returns recent scaling decisions
  getDecisions(limit: number = 10): ScalingDecision[] {
    return this.decisions.slice(-limit);
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    this.app.get('/health', (req, res) => {
      const statuses = this.getHealthStatus();
      const allHealthy = statuses.every(s => s.status === 'healthy');

      res.json({
        status: allHealthy ? 'ok' : 'degraded',
        services: statuses.map(s => ({
          service: s.service,
          status: s.status,
          message: s.message
        }))
      });
    });

    this.app.get('/metrics', (req, res) => {
      res.json({ metrics: this.getMetrics() });
    });

    this.app.get('/decisions', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 10;
      res.json({ decisions: this.getDecisions(limit) });
    });
  }

  private updateMetrics(): void {
    if (!this.running) return;

    this.metrics.timestamp = new Date();

    // EventStore metrics (MVP: basic counts)
    if (this.eventstore) {
      const events = this.eventstore.getAllEvents();
      this.metrics.eventstore = {
        totalEvents: events.length,
        activeActors: events.length, // Simplified
      };
    }

    // Projection metrics (MVP: placeholder)
    this.metrics.projection = {
      activeProjections: 1, // MVP
      materializedViews: 0, // MVP
    };

    // Security metrics (MVP: placeholder)
    this.metrics.security = {
      tokenValidations: 0, // MVP
      permissionChecks: 0, // MVP
      auditEvents: this.security ? this.security.getAuditEvents().length : 0,
    };

    // System metrics (MVP: placeholder)
    this.metrics.system = {
      cpuUsage: 0.5, // MVP
      memoryUsage: 0.3, // MVP
    };
  }

  private evaluateScaling(): void {
    if (!this.running) return;

    const metrics = this.metrics;

    // Check for scaling decisions based on metrics
    // MVP: Simple logic based on projection query latency

    if (metrics.projection.queryLatencyP99 && metrics.projection.queryLatencyP99 > 100) {
      const decision: ScalingDecision = {
        service: 'projection',
        action: 'scale_up',
        reason: 'high query latency',
        timestamp: new Date(),
      };

      this.decisions.push(decision);
      console.log(`Scaling decision: ${decision.service} ${decision.action} (${decision.reason})`);

      // Keep only last 100 decisions
      if (this.decisions.length > 100) {
        this.decisions.shift();
      }
    }
  }

  private performHealthCheck(): void {
    if (!this.running) return;

    const statuses = this.getHealthStatus();
    for (const status of statuses) {
      if (status.status !== 'healthy') {
        console.log(`Health check failed for ${status.service}: ${status.status}`);
      }
    }
  }

  private parseDuration(durationStr: string): number {
    // Simple duration parser for MVP
    // Assumes format like "30s", "5m", "1h"
    const match = durationStr.match(/^(\d+)([smh])$/);
    if (!match) return 30000; // default 30s

    const [, num, unit] = match;
    const value = parseInt(num);

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 30000;
    }
  }

  private createEmptyMetrics(): MetricsSnapshot {
    return {
      timestamp: new Date(),
      eventstore: {
        totalEvents: 0,
        activeActors: 0,
      },
      projection: {
        activeProjections: 0,
        materializedViews: 0,
      },
      security: {
        tokenValidations: 0,
        permissionChecks: 0,
        auditEvents: 0,
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
      },
    };
  }
}
