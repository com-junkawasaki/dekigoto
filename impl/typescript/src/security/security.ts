import * as jwt from 'jsonwebtoken';
import express from 'express';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityConfig } from '../config/config';

// SecurityContext contains security information for a request
// Merkle DAG: sha256:security_ctx_v1 - Zero-trust security context
export interface SecurityContext {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  attributes: { [key: string]: any };
  expiresAt: Date;
  tokenHash: string;
  auditId: string;
}

// CustomClaims defines the structure of custom JWT claims for ActorDB
export interface CustomClaims extends jwt.JwtPayload {
  roles: string[];
  attributes: { [key: string]: any };
  tenant_id: string;
}

// AuditEvent represents a security audit event
export interface AuditEvent {
  id: string;
  timestamp: Date;
  action: string; // read, write, deny
  resource: string;
  userId: string;
  tenantId: string;
  ipAddress?: string;
  success: boolean;
  errorMsg?: string;
  metadata?: { [key: string]: any };
}

// TokenValidationResult contains JWT validation results
export interface TokenValidationResult {
  valid: boolean;
  context?: SecurityContext;
  error?: string;
}

// SecurityGateway provides zero-trust security with mTLS + JWS + ABAC/RBAC
// Process Network Node: security_gateway
// Dependencies: []
// Outputs: [validated_tokens, audit_stream]
// SLO: token_validation_10ms
export class SecurityGateway {
  private config: SecurityConfig;
  private tlsConfig?: https.ServerOptions;
  private policy: Map<string, string[]>; // Role -> []Permissions
  private auditStream: AuditEvent[] = [];
  private running: boolean = false;
  private server?: http.Server | https.Server;
  private app: express.Application;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.app = express();

    // MVP Policy Definition
    this.policy = new Map([
      ['admin', ['read', 'write', 'admin:access']],
      ['user', ['read']],
      ['reader', ['read']],
      ['read', ['read']],
      ['write', ['read', 'write']],
    ]);

    this.setupRoutes();
  }

  // Start begins the SecurityGateway operation
  async start(): Promise<void> {
    this.running = true;

    // Configure mTLS if enabled
    if (this.config.mtls_enabled) {
      this.tlsConfig = await this.configureMTLS();
    }

    // Start HTTP server for token validation endpoint
    const listenAddr = this.config.listen_addr || ':8443';

    return new Promise((resolve, reject) => {
      try {
        const [host, port] = listenAddr.split(':');
        const serverOptions = this.tlsConfig ? {
          ...this.tlsConfig,
          host: host === '' ? undefined : host,
          port: parseInt(port)
        } : {
          host: host === '' ? undefined : host,
          port: parseInt(port)
        };

        if (this.config.mtls_enabled && this.tlsConfig) {
          this.server = https.createServer(this.tlsConfig, this.app);
          console.log(`Starting SecurityGateway with mTLS on ${listenAddr}`);
        } else {
          this.server = http.createServer(this.app);
          console.log(`Starting SecurityGateway on ${listenAddr}`);
        }

        this.server.listen(parseInt(port), host === '' ? undefined : host, () => {
          console.log('SecurityGateway started');
          resolve();
        });

        this.server.on('error', (err: Error) => {
          console.error(`SecurityGateway server error: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // Stop shuts down the SecurityGateway
  async stop(): Promise<void> {
    this.running = false;

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('SecurityGateway stopped');
          resolve();
        });
      });
    }
  }

  // ValidateToken validates a JWT token and returns security context
  // Merkle DAG: sha256:token_validate_v1 - JWS token validation with security context extraction
  validateToken(tokenString: string): TokenValidationResult {
    if (!this.running) {
      return { valid: false, error: 'security gateway not running' };
    }

    if (!tokenString) {
      this.auditEvent('token_validation', 'token', '', '', false, 'empty token');
      return { valid: false, error: 'empty token' };
    }

    // JWS tokens are often prefixed with "Bearer "
    tokenString = tokenString.replace(/^Bearer\s+/i, '');

    try {
      const claims = jwt.verify(tokenString, this.config.jws_secret) as CustomClaims;

      if (!claims.sub || !claims.tenant_id) {
        throw new Error('missing required claims');
      }

      // Construct security context from claims
      const securityCtx: SecurityContext = {
        tenantId: claims.tenant_id,
        userId: claims.sub,
        roles: claims.roles || [],
        permissions: [], // Permissions should be derived from roles by a policy engine
        attributes: claims.attributes || {},
        expiresAt: claims.exp ? new Date(claims.exp * 1000) : new Date(),
        tokenHash: 'mock_hash', // In prod, hash the token string
        auditId: `audit_${Date.now()}`,
      };

      this.auditEvent('token_validation', 'token', securityCtx.userId, securityCtx.tenantId, true, '');
      return { valid: true, context: securityCtx };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'token parsing error';
      this.auditEvent('token_validation', 'token', '', '', false, errorMsg);
      return { valid: false, error: errorMsg };
    }
  }

  // CheckPermission checks if a security context has permission for an action
  checkPermission(ctx: SecurityContext, permission: string): boolean {
    // In production: Use a proper policy engine like OPA
    for (const role of ctx.roles) {
      const permissions = this.policy.get(role);
      if (permissions && permissions.includes(permission)) {
        return true;
      }
    }
    return false;
  }

  // ApplyRLS applies Row Level Security filtering
  applyRLS(ctx: SecurityContext, data: any, rlsExpression: string): any {
    // MVP: Simple tenant-based RLS
    // In production: Evaluate RLS expressions against data
    if (rlsExpression === 'tenant_id') {
      // Filter data by tenant_id
      return data;
    }
    return data;
  }

  // MaskColumns applies column masking based on security context
  maskColumns(ctx: SecurityContext, data: any, maskedColumns: string[]): any {
    // MVP: Simple column masking
    // In production: Mask sensitive columns in result data
    return data;
  }

  // GetAuditEvents returns recent audit events
  getAuditEvents(limit: number = 100): AuditEvent[] {
    return this.auditStream.slice(-limit);
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    this.app.post('/validate', (req, res) => {
      const token = req.headers.authorization;
      if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }

      const result = this.validateToken(token);
      if (!result.valid) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      res.json({ valid: true, message: 'Token valid' });
    });

    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    this.app.get('/audit', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      res.json({ events: this.getAuditEvents(limit) });
    });
  }

  private async configureMTLS(): Promise<https.ServerOptions> {
    // MVP: Basic TLS config
    // In production: Load proper certificates and configure SPIFFE
    const certsDir = path.join(process.cwd(), 'certs');

    try {
      const certPath = path.join(certsDir, 'server.crt');
      const keyPath = path.join(certsDir, 'server.key');
      const caPath = path.join(certsDir, 'server.crt'); // Using server cert as CA for self-signed

      if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        throw new Error('MTLS certificates not found');
      }

      const cert = fs.readFileSync(certPath);
      const key = fs.readFileSync(keyPath);
      const ca = fs.readFileSync(caPath);

      return {
        cert,
        key,
        requestCert: true,
        rejectUnauthorized: true,
        ca: [ca]
      };
    } catch (err) {
      console.log('MTLS certificates not found, mTLS setup failed');
      throw new Error(`failed to configure mTLS: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  private auditEvent(action: string, resource: string, userId: string, tenantId: string, success: boolean, errorMsg?: string): void {
    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      resource,
      userId,
      tenantId,
      success,
      errorMsg,
    };

    // Keep only last 1000 events in memory
    this.auditStream.push(event);
    if (this.auditStream.length > 1000) {
      this.auditStream.shift();
    }

    console.log(`AUDIT: ${event.action} ${event.resource} ${event.userId} ${event.tenantId} ${event.success}`);
  }
}
