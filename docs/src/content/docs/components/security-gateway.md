---
title: Security Gateway
description: Zero-trust security implementation with JWT validation, RBAC/ABAC authorization
---

# Security Gateway

The Security Gateway provides zero-trust security for ActorDB TypeScript, implementing JWT token validation, RBAC/ABAC authorization, and comprehensive audit logging.

## Overview

<div class="process-node">
<h3>🔐 Security Gateway</h3>
<p><strong>Merkle DAG:</strong> <code class="merkle-hash">sha256:sec_gw_v1</code></p>
<p><strong>Description:</strong> Zero-trust messaging with mTLS + JWS + ABAC/RBAC</p>
<p><strong>Dependencies:</strong> []</p>
<p><strong>Outputs:</strong> [validated_tokens, audit_stream]</p>
<p><strong>SLO:</strong> token_validation_10ms</p>
</div>

## Core Features

- **JWT Token Validation**: JWS-based token verification
- **RBAC/ABAC Authorization**: Role and attribute-based permissions
- **mTLS Support**: Mutual TLS for service-to-service communication
- **Audit Streaming**: Comprehensive security event logging
- **SPIFFE Integration**: Workload identity support

## Architecture

### Component Structure

```typescript
interface SecurityGateway {
  // Token validation
  validateToken(token: string): TokenValidationResult;

  // Permission checking
  checkPermission(ctx: SecurityContext, permission: string): boolean;

  // Row Level Security
  applyRLS(ctx: SecurityContext, data: any, rlsExpression: string): any;

  // Column masking
  maskColumns(ctx: SecurityContext, data: any, maskedColumns: string[]): any;

  // Audit events
  getAuditEvents(limit?: number): AuditEvent[];
}
```

### Security Context

```typescript
interface SecurityContext {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  attributes: { [key: string]: any };
  expiresAt: Date;
  tokenHash: string;
  auditId: string;
}
```

## JWT Token Validation

### Token Structure

```typescript
interface CustomClaims extends jwt.JwtPayload {
  roles: string[];
  attributes: { [key: string]: any };
  tenant_id: string;
  sub: string;
  iat: number;
  exp: number;
  iss: string;
}
```

### Validation Process

```typescript
class SecurityGateway {
  validateToken(tokenString: string): TokenValidationResult {
    // 1. Strip Bearer prefix
    tokenString = tokenString.replace(/^Bearer\s+/i, '');

    // 2. Parse and verify JWT
    try {
      const claims = jwt.verify(tokenString, this.config.jwsSecret) as CustomClaims;

      // 3. Validate required claims
      if (!claims.sub || !claims.tenant_id) {
        throw new Error('Missing required claims');
      }

      // 4. Create security context
      const context: SecurityContext = {
        tenantId: claims.tenant_id,
        userId: claims.sub,
        roles: claims.roles || [],
        permissions: [],
        attributes: claims.attributes || {},
        expiresAt: new Date(claims.exp! * 1000),
        tokenHash: 'computed_hash',
        auditId: `audit_${Date.now()}`
      };

      // 5. Log successful validation
      this.auditEvent('token_validation', 'token', context.userId, context.tenantId, true);

      return { valid: true, context };
    } catch (error) {
      // 6. Log validation failure
      this.auditEvent('token_validation', 'token', '', '', false, error.message);
      return { valid: false, error: error.message };
    }
  }
}
```

## RBAC/ABAC Authorization

### Role-Based Access Control (RBAC)

```typescript
// Policy definition
private policy: Map<string, string[]> = new Map([
  ['admin', ['read', 'write', 'admin:access']],
  ['user', ['read']],
  ['reader', ['read']],
  ['write', ['read', 'write']]
]);

checkPermission(context: SecurityContext, permission: string): boolean {
  for (const role of context.roles) {
    const rolePermissions = this.policy.get(role);
    if (rolePermissions?.includes(permission)) {
      return true;
    }
  }
  return false;
}
```

### Attribute-Based Access Control (ABAC)

```typescript
interface ABACPolicy {
  subject: { [key: string]: any };
  resource: { [key: string]: any };
  action: string;
  environment: { [key: string]: any };
  condition: string; // JavaScript expression
}

class ABACEnforcer {
  evaluate(policy: ABACPolicy, context: SecurityContext): boolean {
    // Evaluate condition with context
    const fn = new Function('subject', 'resource', 'action', 'environment', 'context',
      `return ${policy.condition};`);

    try {
      return fn(
        context.attributes,
        policy.resource,
        policy.action,
        policy.environment,
        context
      );
    } catch (error) {
      console.error('ABAC evaluation error:', error);
      return false;
    }
  }
}
```

## mTLS Configuration

### Certificate Setup

```typescript
async configureMTLS(): Promise<https.ServerOptions> {
  const certsDir = path.join(process.cwd(), 'certs');

  try {
    const cert = fs.readFileSync(path.join(certsDir, 'server.crt'));
    const key = fs.readFileSync(path.join(certsDir, 'server.key'));
    const ca = fs.readFileSync(path.join(certsDir, 'server.crt'));

    return {
      cert,
      key,
      requestCert: true,
      rejectUnauthorized: true,
      ca: [ca]
    };
  } catch (error) {
    throw new Error(`Failed to configure mTLS: ${error.message}`);
  }
}
```

### SPIFFE Integration

```typescript
class SPIFFEIdentity {
  private trustDomain: string;
  private svidPath: string;

  constructor(trustDomain: string) {
    this.trustDomain = trustDomain;
    this.svidPath = `/spire-agent/svid/${trustDomain}/workload`;
  }

  async getSVID(): Promise<{ cert: Buffer; key: Buffer }> {
    // Load SPIFFE SVID from agent
    const cert = fs.readFileSync(`${this.svidPath}/cert.pem`);
    const key = fs.readFileSync(`${this.svidPath}/key.pem`);

    return { cert, key };
  }

  verifyPeer(spiffeId: string): boolean {
    // Verify peer identity matches expected SPIFFE ID
    return spiffeId.startsWith(`spiffe://${this.trustDomain}/`);
  }
}
```

## Audit Streaming

### Audit Event Structure

```typescript
interface AuditEvent {
  id: string;
  timestamp: Date;
  action: string; // read, write, deny, validate
  resource: string;
  userId: string;
  tenantId: string;
  ipAddress?: string;
  success: boolean;
  errorMsg?: string;
  metadata?: { [key: string]: any };
}
```

### Event Streaming

```typescript
class AuditStreamer {
  private stream = new EventEmitter();
  private buffer: AuditEvent[] = [];
  private maxBufferSize = 1000;

  recordEvent(event: AuditEvent): void {
    // Add to buffer
    this.buffer.push(event);

    // Emit immediately
    this.stream.emit('audit', event);

    // Maintain buffer size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  getRecentEvents(limit = 100): AuditEvent[] {
    return this.buffer.slice(-limit);
  }

  onAudit(listener: (event: AuditEvent) => void): void {
    this.stream.on('audit', listener);
  }
}
```

## REST API Endpoints

### Token Validation

```typescript
// POST /validate
app.post('/validate', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const result = securityGateway.validateToken(authHeader);
  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  res.json({ valid: true, context: result.context });
});
```

### Permission Checking

```typescript
// POST /check-permission
app.post('/check-permission', (req, res) => {
  const { token, permission } = req.body;

  const result = securityGateway.validateToken(token);
  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const allowed = securityGateway.checkPermission(result.context!, permission);
  res.json({ allowed });
});
```

### Audit Events

```typescript
// GET /audit
app.get('/audit', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const events = securityGateway.getAuditEvents(limit);

  res.json({ events });
});
```

## Configuration

### Security Configuration

```yaml
security:
  # JWT settings
  jwt_issuer: "actordb"
  jwt_lifetime_sec: 3600
  jws_secret: "your-secret-key"

  # mTLS settings
  mtls_enabled: false

  # SPIFFE settings
  spiffe_trust_domain: "example.org"

  # Audit settings
  audit_stream_enabled: true

  # Server settings
  listen_addr: ":8443"
```

## Performance Characteristics

### SLO Targets

- **Token Validation**: < 10ms P99
- **Permission Check**: < 1ms P99
- **Audit Logging**: < 5ms P99
- **Throughput**: 10,000+ validations/second

### Performance Monitoring

```typescript
class SecurityMetrics {
  private metrics = {
    validations: 0,
    permissions: 0,
    audits: 0,
    errors: 0,
    latency: [] as number[]
  };

  recordValidation(duration: number, success: boolean): void {
    this.metrics.validations++;
    this.metrics.latency.push(duration);
    if (!success) this.metrics.errors++;
  }

  getStats() {
    return {
      totalValidations: this.metrics.validations,
      errorRate: this.metrics.errors / this.metrics.validations,
      latencyP50: this.percentile(this.metrics.latency, 50),
      latencyP99: this.percentile(this.metrics.latency, 99)
    };
  }
}
```

## Security Best Practices

### Token Security

1. **Short-lived Tokens**: Expire within 1 hour
2. **Secure Secrets**: Use proper key management
3. **Token Revocation**: Implement token blacklist
4. **Refresh Tokens**: Separate refresh from access tokens

### Authorization

1. **Principle of Least Privilege**: Grant minimal permissions
2. **Defense in Depth**: Multiple security layers
3. **Regular Audits**: Review permissions periodically
4. **Context Awareness**: Consider user context and environment

### Network Security

1. **mTLS Everywhere**: Encrypt all service communication
2. **SPIFFE Identity**: Use workload identity
3. **Zero Trust**: Never trust, always verify
4. **Network Segmentation**: Isolate sensitive components

## Testing

### Unit Tests

```typescript
describe('SecurityGateway', () => {
  let gateway: SecurityGateway;

  beforeEach(() => {
    gateway = new SecurityGateway({
      jwt_issuer: 'test',
      jws_secret: 'test-secret',
      mtls_enabled: false
    });
  });

  it('should validate valid JWT token', () => {
    const token = jwt.sign({
      sub: 'user123',
      tenant_id: 'tenant456',
      roles: ['user']
    }, 'test-secret');

    const result = gateway.validateToken(`Bearer ${token}`);
    expect(result.valid).toBe(true);
    expect(result.context?.userId).toBe('user123');
  });

  it('should reject invalid token', () => {
    const result = gateway.validateToken('invalid-token');
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Security Integration', () => {
  it('should enforce RBAC permissions', async () => {
    // Setup user with limited permissions
    const userContext = {
      userId: 'user123',
      roles: ['reader'],
      tenantId: 'tenant456'
    };

    // Should allow read
    expect(gateway.checkPermission(userContext, 'read')).toBe(true);

    // Should deny write
    expect(gateway.checkPermission(userContext, 'write')).toBe(false);
  });
});
```

The Security Gateway provides the foundation for ActorDB's zero-trust architecture, ensuring all access is properly authenticated, authorized, and audited.
