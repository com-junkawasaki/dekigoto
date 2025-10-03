import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Config represents the complete ActorDB configuration
// Process Network Node: configuration
// Dependencies: []
// Outputs: [system_config]
// Merkle DAG: sha256:config_v1 - Configuration management with YAML parsing
export interface Config {
  version: string;
  cluster: ClusterConfig;
  eventstore: EventStoreConfig;
  projection: ProjectionConfig;
  security: SecurityConfig;
  query: QueryConfig;
  control: ControlConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
}

// ClusterConfig defines cluster-wide settings
export interface ClusterConfig {
  name: string;
  nodes: string[];
}

// StorageConfig contains configuration for storage backends
export interface StorageConfig {
  type: string; // sqlite, postgresql, rocksdb, leveldb, memory
  path?: string;
  connection_string?: string;
  options?: { [key: string]: any };
}

// EventStoreConfig configures the event storage layer
export interface EventStoreConfig {
  data_dir: string;
  snapshot_interval: number;
  retention_period: string; // Duration string like "30d"
  compression: string;
  max_concurrent_writes: number;
  storage: StorageConfig;
}

// ProjectionConfig configures the projection engine
export interface ProjectionConfig {
  worker_count: number;
  max_memory_mb: number;
  auto_promote_qps_threshold: number;
  auto_demote_qps_threshold: number;
  late_window_ms: string; // Duration string
  watermark_lag_ms: string; // Duration string
  max_rebuild_time_sec: string; // Duration string
}

// SecurityConfig configures security and authentication
export interface SecurityConfig {
  mtls_enabled: boolean;
  jwt_issuer: string;
  jwt_lifetime_sec: number;
  jws_secret: string;
  audit_stream_enabled: boolean;
  spiffe_trust_domain: string;
  listen_addr?: string;
}

// QueryConfig configures the query interface
export interface QueryConfig {
  listen_addr: string;
  max_connections: number;
  query_timeout_sec: string; // Duration string
  enable_sql_dialect: boolean;
}

// ControlConfig configures the control plane
export interface ControlConfig {
  listen_addr: string;
  metrics_interval_sec: string; // Duration string
  scaling_check_interval_sec: string; // Duration string
  max_hot_key_rho: number;
}

// MonitoringConfig configures monitoring and metrics
export interface MonitoringConfig {
  prometheus_addr: string;
  health_check_interval_sec: string; // Duration string
}

// LoggingConfig configures logging
export interface LoggingConfig {
  level: string;
  format: string;
  output: string;
}

// Load loads configuration from a YAML file
// Merkle DAG: sha256:config_load_v1 - YAML configuration parsing and validation
export function load(configPath: string): Config {
  const cleanPath = path.resolve(configPath);
  const data = fs.readFileSync(cleanPath, 'utf8');

  const cfg = yaml.load(data) as Config;

  // Parse duration strings to milliseconds for internal use
  // Note: TypeScript doesn't have built-in duration parsing like Go,
  // so we'll store as strings and parse when needed

  return cfg;
}

// parseDuration parses duration strings like "30d", "1h", etc.
export function parseDuration(durationStr: string): number {
  if (!durationStr) {
    return 0;
  }

  // Handle custom formats like "30d"
  const lastChar = durationStr.slice(-1);
  switch (lastChar) {
    case 'd':
      const days = parseInt(durationStr.slice(0, -1));
      return days * 24 * 60 * 60 * 1000; // days to milliseconds
    case 'h':
      const hours = parseInt(durationStr.slice(0, -1));
      return hours * 60 * 60 * 1000; // hours to milliseconds
    case 'm':
      const minutes = parseInt(durationStr.slice(0, -1));
      return minutes * 60 * 1000; // minutes to milliseconds
    case 's':
      const seconds = parseInt(durationStr.slice(0, -1));
      return seconds * 1000; // seconds to milliseconds
    case 'S': // already in seconds
      return parseInt(durationStr.slice(0, -1)) * 1000;
    default:
      // Assume milliseconds if no suffix
      return parseInt(durationStr);
  }
}

// Helper function to get duration in milliseconds
export function getDurationMs(config: Config, field: keyof Config): number {
  const value = (config[field] as any);
  if (typeof value === 'string') {
    return parseDuration(value);
  }
  return 0;
}
