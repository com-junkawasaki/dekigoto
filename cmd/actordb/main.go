package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/junkawasaki/actordb-dokigoto/internal/control"
	"github.com/junkawasaki/actordb-dokigoto/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/internal/projector"
	"github.com/junkawasaki/actordb-dokigoto/internal/query"
	"github.com/junkawasaki/actordb-dokigoto/internal/security"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

func main() {
	var configPath string
	flag.StringVar(&configPath, "config", "config/example.yaml", "Path to configuration file")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize components following topological order from dag.jsonnet
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Security Gateway (foundation)
	secGW, err := security.NewGateway(cfg.Security)
	if err != nil {
		log.Fatalf("Failed to initialize security gateway: %v", err)
	}

	// 2. EventStore (write path)
	es, err := eventstore.New(cfg.EventStore)
	if err != nil {
		log.Fatalf("Failed to initialize eventstore: %v", err)
	}

	// 3. Projection Engine (read path)
	proj, err := projector.New(cfg.Projection, es)
	if err != nil {
		log.Fatalf("Failed to initialize projector: %v", err)
	}

	// 4. Query Interface
	qry, err := query.New(cfg.Query, proj, secGW)
	if err != nil {
		log.Fatalf("Failed to initialize query interface: %v", err)
	}

	// 5. Control Plane (monitoring and scaling)
	ctrl, err := control.New(cfg.Control, es, proj, secGW)
	if err != nil {
		log.Fatalf("Failed to initialize control plane: %v", err)
	}

	// Start all components in topological order
	log.Println("Starting ActorDB components...")

	if err := secGW.Start(ctx); err != nil {
		log.Fatalf("Failed to start security gateway: %v", err)
	}

	if err := es.Start(ctx); err != nil {
		log.Fatalf("Failed to start eventstore: %v", err)
	}

	if err := proj.Start(ctx); err != nil {
		log.Fatalf("Failed to start projector: %v", err)
	}

	if err := qry.Start(ctx); err != nil {
		log.Fatalf("Failed to start query interface: %v", err)
	}

	if err := ctrl.Start(ctx); err != nil {
		log.Fatalf("Failed to start control plane: %v", err)
	}

	log.Printf("ActorDB started successfully on %s", cfg.Query.ListenAddr)

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	<-sigCh
	log.Println("Shutting down ActorDB...")

	// Shutdown in reverse topological order
	ctrl.Stop()
	qry.Stop()
	proj.Stop()
	es.Stop()
	secGW.Stop()

	log.Println("ActorDB shutdown complete")
}
