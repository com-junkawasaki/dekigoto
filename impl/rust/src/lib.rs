//! # ActorDB - Dekigoto
//!
//! A novel database model that combines single-writer actor serialization,
//! incremental view maintenance (IVM), and zero-trust messaging.
//!
//! This crate implements the ActorDB process network following the Merkle DAG
//! defined in `dag.jsonnet`, ensuring topological consistency in execution.

pub mod config;
pub mod security;
pub mod eventstore;
pub mod projector;
pub mod query;
pub mod control;

// Re-export error types for use in ActorDBError
pub use security::SecurityError;
pub use eventstore::EventStoreError;
pub use projector::ProjectorError;
pub use query::QueryError;
pub use control::ControlError;

/// Core types shared across modules
pub mod types {
    use serde::{Deserialize, Serialize};
    use uuid::Uuid;

    /// Actor identifier - globally unique
    #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub struct ActorId(pub Uuid);

    /// Event identifier - globally unique
    #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub struct EventId(pub Uuid);

    /// Event sequence number within an actor
    #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
    pub struct SequenceNumber(pub u64);

    /// Tenant identifier for multi-tenancy
    #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub struct TenantId(pub String);

    /// Projection identifier
    #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub struct ProjectionId(pub String);

    /// Security roles for RBAC
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    pub enum Role {
        Admin,
        Writer,
        Reader,
        User,
    }

    impl std::fmt::Display for Role {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                Role::Admin => write!(f, "admin"),
                Role::Writer => write!(f, "writer"),
                Role::Reader => write!(f, "reader"),
                Role::User => write!(f, "user"),
            }
        }
    }
}

/// Error types used throughout the system
pub mod error {
    use thiserror::Error;
    use crate::{SecurityError, EventStoreError, ProjectorError, QueryError, ControlError};

    #[derive(Error, Debug)]
    pub enum ActorDBError {
        #[error("Configuration error: {0}")]
        Config(#[from] config::ConfigError),

        #[error("Security error: {0}")]
        Security(#[from] SecurityError),

        #[error("EventStore error: {0}")]
        EventStore(#[from] EventStoreError),

        #[error("Projector error: {0}")]
        Projector(#[from] ProjectorError),

        #[error("Query error: {0}")]
        Query(#[from] QueryError),

        #[error("Control plane error: {0}")]
        Control(#[from] ControlError),

        #[error("IO error: {0}")]
        Io(#[from] std::io::Error),

        #[error("Serialization error: {0}")]
        Serde(#[from] serde_json::Error),

        #[error("Database error: {0}")]
        Database(String),

        #[error("Network error: {0}")]
        Network(String),

        #[error("Authentication failed: {0}")]
        Authentication(String),

        #[error("Authorization failed: {0}")]
        Authorization(String),

        #[error("Internal error: {0}")]
        Internal(String),
    }

    pub type Result<T> = std::result::Result<T, ActorDBError>;
}

/// Common traits for process network components
pub mod process {
    use async_trait::async_trait;
    use std::fmt::Debug;

    /// Core trait for all process network components
    /// Components must implement lifecycle management and health checking
    #[async_trait]
    pub trait ProcessNode: Send + Sync + Debug {
        /// Component identifier for process network graph
        fn id(&self) -> &'static str;

        /// Initialize the component with configuration
        async fn init(&mut self) -> crate::error::Result<()>;

        /// Start the component (begin processing)
        async fn start(&mut self) -> crate::error::Result<()>;

        /// Stop the component gracefully
        async fn stop(&mut self) -> crate::error::Result<()>;

        /// Health check for the component
        async fn health_check(&self) -> HealthStatus;

        /// Get component metrics
        fn metrics(&self) -> Vec<Metric>;
    }

    /// Health status of a process node
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub enum HealthStatus {
        Healthy,
        Degraded(String),
        Unhealthy(String),
    }

    /// Metric for monitoring component performance
    #[derive(Debug, Clone)]
    pub struct Metric {
        pub name: String,
        pub value: f64,
        pub unit: String,
        pub timestamp: chrono::DateTime<chrono::Utc>,
    }
}
