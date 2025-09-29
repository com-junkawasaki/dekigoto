//! ActorDB - Dekigoto Rust Implementation
//!
//! This is the main entry point for the Rust implementation of ActorDB.
//! It follows the process network model defined in `dag.jsonnet`,
//! ensuring topological consistency in component initialization and execution.

use actordb::config::Config;
use actordb::error::{ActorDBError, Result};
use actordb::process::ProcessNode;
use actordb::security::{SecurityConfig, SecurityGateway};
use actordb::{control, eventstore, projector, query};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tokio::signal;
use tracing::{error, info};
use tracing_subscriber;

/// ActorDB Rust Implementation
#[derive(Parser)]
#[command(name = "actordb")]
#[command(about = "A novel database model combining actor serialization, IVM, and zero-trust messaging")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the ActorDB server
    Serve {
        /// Path to the configuration file
        #[arg(short, long, default_value = "config/example.yaml")]
        config: PathBuf,

        /// Generate a sample JWT token and exit
        #[arg(long)]
        generate_token: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt().init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Serve { config, generate_token } => {
            run_server(config, generate_token).await
        }
    }
}

async fn run_server(config_path: PathBuf, generate_token: bool) -> Result<()> {
    // Load configuration
    let config = Config::load(&config_path).map_err(|e| ActorDBError::Config(e))?;
    info!("Loaded configuration from {:?}", config_path);

    if generate_token {
        return generate_sample_token(&config).await;
    }

    info!("Starting ActorDB Rust implementation...");

    // Initialize components following topological order from dag.jsonnet
    let mut components: Vec<Box<dyn actordb::process::ProcessNode>> = Vec::new();

    // 1. Security Gateway (foundation - zero-trust security)
    info!("Initializing Security Gateway...");
    let security_config = SecurityConfig {
        mtls_enabled: config.security.mtls_enabled,
        jwt_issuer: config.security.jwt_issuer.clone(),
        jwt_lifetime_sec: config.security.jwt_lifetime_sec as u64,
        jws_secret: config.security.jws_secret.clone(),
        audit_stream_enabled: config.security.audit_stream_enabled,
        spiffe_trust_domain: config.security.spiffe_trust_domain.clone(),
        listen_addr: config.security.listen_addr.clone(),
    };

    let mut security_gateway = SecurityGateway::new(security_config)?;
    security_gateway.init().await?;
    components.push(Box::new(security_gateway));

    // 2. EventStore (write path - actor-based event persistence)
    info!("Initializing EventStore...");
    let eventstore_config = (); // TODO: Implement EventStoreConfig
    let mut eventstore = eventstore::EventStore::new(eventstore_config).await?;
    eventstore.init().await?;
    components.push(Box::new(eventstore));

    // 3. Projection Engine (read path - IVM)
    info!("Initializing Projection Engine...");
    let projector_config = (); // TODO: Implement ProjectionConfig
    let mut projector = projector::ProjectionEngine::new(projector_config).await?;
    projector.init().await?;
    components.push(Box::new(projector));

    // 4. Query Interface (SQL-like declarative DSL)
    info!("Initializing Query Interface...");
    let query_config = (); // TODO: Implement QueryConfig
    let mut query_interface = query::QueryInterface::new(query_config).await?;
    query_interface.init().await?;
    components.push(Box::new(query_interface));

    // 5. Control Plane (auto-scaling, monitoring, operational automation)
    info!("Initializing Control Plane...");
    let control_config = (); // TODO: Implement ControlConfig
    let mut control_plane = control::ControlPlane::new(control_config).await?;
    control_plane.init().await?;
    components.push(Box::new(control_plane));

    // Start all components in topological order
    info!("Starting all components...");
    for component in &mut components {
        component.start().await?;
    }

    info!("ActorDB Rust implementation started successfully");
    info!("Process network topology: security_gateway -> eventstore -> projector -> query_interface -> control_plane");

    // Wait for shutdown signal
    match signal::ctrl_c().await {
        Ok(()) => {
            info!("Received shutdown signal, stopping components...");
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
        }
    }

    // Stop components in reverse topological order
    info!("Stopping components in reverse topological order...");
    for component in components.iter_mut().rev() {
        if let Err(e) = component.stop().await {
            error!("Error stopping component: {}", e);
        }
    }

    info!("ActorDB Rust implementation shutdown complete");
    Ok(())
}

async fn generate_sample_token(config: &Config) -> Result<()> {
    // Create security gateway for token generation
    let security_config = SecurityConfig {
        mtls_enabled: config.security.mtls_enabled,
        jwt_issuer: config.security.jwt_issuer.clone(),
        jwt_lifetime_sec: config.security.jwt_lifetime_sec as u64,
        jws_secret: config.security.jws_secret.clone(),
        audit_stream_enabled: false, // Disable for token generation
        spiffe_trust_domain: config.security.spiffe_trust_domain.clone(),
        listen_addr: config.security.listen_addr.clone(),
    };

    let mut gateway = SecurityGateway::new(security_config)?;
    gateway.init().await?;
    gateway.start().await?;

    // Allow overriding roles via environment variable (similar to Go implementation)
    let roles = if let Ok(role_env) = std::env::var("TOKEN_ROLES") {
        match role_env.as_str() {
            "admin" => vec![actordb::types::Role::Admin],
            _ => vec![actordb::types::Role::Reader], // default fallback
        }
    } else {
        vec![actordb::types::Role::Reader] // default roles
    };

    let token = gateway.generate_test_token(
        "tenant-test-456",
        "user-test-123",
        &roles,
    ).await?;

    println!("{}", token);

    gateway.stop().await?;
    Ok(())
}