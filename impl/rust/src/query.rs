//! Query Interface - SQL-like declarative query language
//!
//! This module implements the query interface with transparent RLS integration
//! and support for temporal queries with event-time semantics.

use crate::error::{ActorDBError, Result};
use crate::process::{HealthStatus, ProcessNode};
use async_trait::async_trait;

#[derive(Debug)]
pub struct QueryInterface {
    // TODO: Implement QueryInterface
}

#[derive(Debug, thiserror::Error)]
pub enum QueryError {
    #[error("Query error: {0}")]
    Generic(String),
}

impl QueryInterface {
    pub async fn new(_config: ()) -> Result<Self> {
        Ok(Self {})
    }
}

#[async_trait]
impl ProcessNode for QueryInterface {
    fn id(&self) -> &'static str {
        "query_interface"
    }

    async fn init(&mut self) -> Result<()> {
        Ok(())
    }

    async fn start(&mut self) -> Result<()> {
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        HealthStatus::Healthy
    }

    fn metrics(&self) -> Vec<crate::process::Metric> {
        vec![]
    }
}
