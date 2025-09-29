//! Configuration management for ActorDB
//!
//! This module handles loading and validation of ActorDB configuration
//! from YAML files, following the same structure as the Go implementation.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

/// Complete ActorDB configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub version: String,
    pub cluster: ClusterConfig,
    pub eventstore: EventStoreConfig,
    pub projection: ProjectionConfig,
    pub security: SecurityConfig,
    pub query: QueryConfig,
    pub control: ControlConfig,
    pub monitoring: MonitoringConfig,
    pub logging: LoggingConfig,
}

/// Cluster-wide settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterConfig {
    pub name: String,
    pub nodes: Vec<String>,
}

/// Storage backend configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    #[serde(rename = "type")]
    pub storage_type: String, // sqlite, postgresql, rocksdb, leveldb, memory
    pub path: Option<String>,
    pub connection_string: Option<String>,
    pub options: Option<HashMap<String, serde_yaml::Value>>,
}

/// Event storage layer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventStoreConfig {
    pub data_dir: String,
    pub snapshot_interval: u64,
    pub retention_period: Duration,
    pub compression: String,
    pub max_concurrent_writes: usize,
    pub storage: StorageConfig,
}

/// Projection engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionConfig {
    pub worker_count: usize,
    pub max_memory_mb: usize,
    pub auto_promote_qps_threshold: f64,
    pub auto_demote_qps_threshold: f64,
    pub late_window_ms: Duration,
    pub watermark_lag_ms: Duration,
    pub max_rebuild_time_sec: Duration,
}

/// Security and authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub mtls_enabled: bool,
    pub jwt_issuer: String,
    pub jwt_lifetime_sec: u64,
    pub jws_secret: String,
    pub audit_stream_enabled: bool,
    pub spiffe_trust_domain: String,
    pub listen_addr: Option<String>,
}

/// Query interface configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryConfig {
    pub listen_addr: String,
    pub max_connections: usize,
    pub query_timeout_sec: Duration,
    pub enable_sql_dialect: bool,
}

/// Control plane configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlConfig {
    pub listen_addr: String,
    pub metrics_interval_sec: Duration,
    pub scaling_check_interval_sec: Duration,
    pub max_hot_key_rho: f64,
}

/// Monitoring and metrics configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub prometheus_addr: String,
    pub health_check_interval_sec: Duration,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: String,
    pub output: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML parsing error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Invalid configuration: {0}")]
    Invalid(String),
}

impl Config {
    /// Load configuration from a YAML file
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, ConfigError> {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| ConfigError::Io(e))?;
        let config: Config = serde_yaml::from_str(&contents)
            .map_err(|e| ConfigError::Yaml(e))?;

        // Basic validation
        config.validate()?;

        Ok(config)
    }

    /// Validate the configuration
    fn validate(&self) -> Result<(), ConfigError> {
        // Validate storage type
        let valid_storage_types = ["memory", "sqlite", "postgresql", "libsql", "rocksdb", "leveldb"];
        if !valid_storage_types.contains(&self.eventstore.storage.storage_type.as_str()) {
            return Err(ConfigError::Invalid(format!(
                "Invalid storage type: {}. Valid types: {:?}",
                self.eventstore.storage.storage_type, valid_storage_types
            )));
        }

        // Validate security settings
        if self.security.jws_secret.is_empty() {
            return Err(ConfigError::Invalid("JWS secret cannot be empty".to_string()));
        }

        if self.security.jwt_lifetime_sec == 0 {
            return Err(ConfigError::Invalid("JWT lifetime must be greater than 0".to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    #[test]
    fn test_load_valid_config() {
        let yaml_content = r#"
version: "1.0.0"
cluster:
  name: "test-cluster"
  nodes: ["node1", "node2"]
eventstore:
  data_dir: "/tmp/actordb"
  snapshot_interval: 1000
  retention_period: 2592000  # 30 days in seconds
  compression: "snappy"
  max_concurrent_writes: 10
  storage:
    type: "sqlite"
    path: "/tmp/actordb/events.db"
projection:
  worker_count: 4
  max_memory_mb: 1024
  auto_promote_qps_threshold: 100.0
  auto_demote_qps_threshold: 10.0
  late_window_ms: 5000
  watermark_lag_ms: 1000
  max_rebuild_time_sec: 30
security:
  mtls_enabled: true
  jwt_issuer: "https://actordb.example.com"
  jwt_lifetime_sec: 300
  jws_secret: "your-very-secret-and-long-key-for-hs256"
  audit_stream_enabled: true
  spiffe_trust_domain: "example.org"
query:
  listen_addr: "0.0.0.0:9090"
  max_connections: 100
  query_timeout_sec: 30
  enable_sql_dialect: true
control:
  listen_addr: "0.0.0.0:8080"
  metrics_interval_sec: 60
  scaling_check_interval_sec: 300
  max_hot_key_rho: 0.7
monitoring:
  prometheus_addr: "0.0.0.0:9091"
  health_check_interval_sec: 30
logging:
  level: "info"
  format: "json"
  output: "stdout"
"#;

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(yaml_content.as_bytes()).unwrap();

        let config = Config::load(temp_file.path()).unwrap();

        assert_eq!(config.version, "1.0.0");
        assert_eq!(config.cluster.name, "test-cluster");
        assert_eq!(config.eventstore.storage.storage_type, "sqlite");
        assert_eq!(config.security.jwt_issuer, "https://actordb.example.com");
    }

    #[test]
    fn test_invalid_storage_type() {
        let yaml_content = r#"
version: "1.0.0"
cluster:
  name: "test-cluster"
  nodes: ["node1"]
eventstore:
  data_dir: "/tmp/actordb"
  snapshot_interval: 1000
  retention_period: 2592000
  compression: "snappy"
  max_concurrent_writes: 10
  storage:
    type: "invalid_type"
projection:
  worker_count: 4
  max_memory_mb: 1024
  auto_promote_qps_threshold: 100.0
  auto_demote_qps_threshold: 10.0
  late_window_ms: 5000
  watermark_lag_ms: 1000
  max_rebuild_time_sec: 30
security:
  mtls_enabled: false
  jwt_issuer: "test"
  jwt_lifetime_sec: 300
  jws_secret: "secret"
  audit_stream_enabled: false
  spiffe_trust_domain: "test"
query:
  listen_addr: "0.0.0.0:9090"
  max_connections: 100
  query_timeout_sec: 30
  enable_sql_dialect: true
control:
  listen_addr: "0.0.0.0:8080"
  metrics_interval_sec: 60
  scaling_check_interval_sec: 300
  max_hot_key_rho: 0.7
monitoring:
  prometheus_addr: "0.0.0.0:9091"
  health_check_interval_sec: 30
logging:
  level: "info"
  format: "json"
  output: "stdout"
"#;

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(yaml_content.as_bytes()).unwrap();

        let result = Config::load(temp_file.path());
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ConfigError::Invalid(_)));
    }
}
