// TypeScript type definitions for ActorDB

export interface Event {
  aggregate_id: string;
  sequence: number;
  event_type: string;
  data: any;
  timestamp: string;
  event_time?: string;
  aggregate_type: string;
  metadata?: Record<string, any>;
}

export interface WriteResult {
  aggregate_id: string;
  sequence: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface QueryRequest {
  sql: string;
  parameters?: Record<string, any>;
}

export interface QueryResponse {
  data: any;
  source: 'materialized' | 'ondemand';
  latency_ms: number;
  timestamp: string;
  error?: string;
}

export interface ProjectionDefinition {
  name: string;
  sources: SourceDefinition[];
  state_schema: Record<string, any>;
  ivm: IVMConfig;
  security: SecurityConfig;
  materialization: MaterializationConfig;
}

export interface SourceDefinition {
  stream: string;
  key: string;
  filter?: string;
}

export interface IVMConfig {
  late_window_ms: number;
  watermark_lag_ms: number;
  delta: DeltaRule[];
}

export interface DeltaRule {
  on: string;
  update: string;
}

export interface SecurityConfig {
  rls: string;
  mask: string[];
  tenant_id?: string;
}

export interface MaterializationConfig {
  promote_if_qps: number;
  demote_if_qps: number;
}

export interface ClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  token?: string;
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_check: string;
  message?: string;
}

export interface Metrics {
  [key: string]: any;
}

export class ActorDBError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ActorDBError';
  }
}
