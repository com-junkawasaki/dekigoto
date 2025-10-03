import express from 'express';
import * as http from 'http';
import { QueryConfig } from '../config/config';
import { EventStore } from '../eventstore';
import { SecurityGateway } from '../security';

// QueryRequest represents a query request
export interface QueryRequest {
  sql: string;
  parameters?: { [key: string]: any };
  securityCtx?: import('../security').SecurityContext;
}

// QueryResponse represents a query response
export interface QueryResponse {
  data?: any;
  source?: 'materialized' | 'ondemand';
  latency?: number; // in milliseconds
  timestamp?: Date;
  error?: string;
}

// QueryInterface provides a query interface for projections
// Process Network Node: query_interface
// Dependencies: [projection_engine, catalog_service]
// Outputs: [query_results]
// SLO: query_p99_100ms
export class QueryInterface {
  private config: QueryConfig;
  private eventStore: EventStore;
  private secGateway: SecurityGateway;
  private server?: http.Server;
  private app: express.Application;
  private running: boolean = false;

  constructor(config: QueryConfig, eventStore: EventStore, secGateway: SecurityGateway) {
    this.config = config;
    this.eventStore = eventStore;
    this.secGateway = secGateway;
    this.app = express();

    this.setupRoutes();
  }

  // Start begins query interface operation
  async start(): Promise<void> {
    this.running = true;

    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);

      const [host, port] = this.config.listen_addr.split(':');
      const serverConfig = {
        host: host === '' ? undefined : host,
        port: parseInt(port)
      };

      this.server.listen(serverConfig.port, serverConfig.host, () => {
        console.log(`QueryInterface started on ${this.config.listen_addr}`);
        resolve();
      });

      this.server.on('error', (err: Error) => {
        console.error(`QueryInterface server error: ${err.message}`);
        reject(err);
      });
    });
  }

  // Stop shuts down the QueryInterface
  async stop(): Promise<void> {
    this.running = false;

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('QueryInterface stopped');
          resolve();
        });
      });
    }
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Query endpoint (placeholder for now)
    this.app.post('/query', (req, res) => {
      // Dummy implementation for MVP
      res.json({
        result: 'query ok',
        timestamp: new Date()
      });
    });

    // Admin query endpoint with authentication
    this.app.post('/query/admin', this.authMiddleware(), (req, res) => {
      res.json({
        result: 'admin access granted',
        timestamp: new Date()
      });
    });

    // Simple event query endpoint (for testing)
    this.app.get('/events/:aggregateId', this.authMiddleware(), async (req, res) => {
      try {
        const { aggregateId } = req.params;
        const fromSeq = parseInt(req.query.fromSeq as string) || 1;

        const events = await this.eventStore.readEvents(aggregateId, fromSeq);

        res.json({
          aggregateId,
          events: events.map(event => ({
            sequence: event.sequence,
            eventType: event.eventType,
            timestamp: event.timestamp,
            data: event.data.toString('base64'), // Return as base64 for JSON
          })),
          count: events.length,
          timestamp: new Date()
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'unknown error'
        });
      }
    });

    // Get actor state endpoint
    this.app.get('/actors/:aggregateId', this.authMiddleware(), async (req, res) => {
      try {
        const { aggregateId } = req.params;
        const actorState = await this.eventStore.getActorState(aggregateId);

        if (!actorState) {
          res.status(404).json({ error: 'actor not found' });
          return;
        }

        res.json({
          aggregateId: actorState.aggregateId,
          lastSequence: actorState.lastSequence,
          lastTimestamp: actorState.lastTimestamp,
          hasSnapshot: !!actorState.snapshotData,
          timestamp: new Date()
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'unknown error'
        });
      }
    });
  }

  private authMiddleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const tokenString = req.headers.authorization;

      if (!tokenString) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }

      const result = this.secGateway.validateToken(tokenString);
      if (!result.valid) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // For admin endpoints, check permissions
      if (req.path.includes('/admin')) {
        if (!this.secGateway.checkPermission(result.context!, 'admin:access')) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
      }

      // Attach security context to request
      (req as any).securityContext = result.context;
      next();
    };
  }
}
