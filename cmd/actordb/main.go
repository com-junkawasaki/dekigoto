package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/junkawasaki/actordb-dokigoto/internal/control"
	"github.com/junkawasaki/actordb-dokigoto/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/internal/projector"
	"github.com/junkawasaki/actordb-dokigoto/internal/query"
	"github.com/junkawasaki/actordb-dokigoto/internal/security"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

func main() {
	configPath := flag.String("config", "config/example.yaml", "Path to the configuration file")
	generateToken := flag.Bool("generate-token", false, "Generate a sample JWT token and exit")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if *generateToken {
		generateSampleToken(cfg)
		return
	}

	log.Println("Starting ActorDB components...")

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
	qry := query.NewQueryInterface(cfg.Query, es, secGW)

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

func generateSampleToken(cfg *config.Config) {
	// Allow overriding roles via environment variable
	roles := []string{"user", "reader"} // default roles
	if os.Getenv("TOKEN_ROLES") != "" {
		// Simple override for testing - in production use proper role management
		if os.Getenv("TOKEN_ROLES") == "admin" {
			roles = []string{"admin"}
		}
	}

	claims := security.CustomClaims{
		TenantID:   "tenant-test-456",
		Roles:      roles,
		Attributes: map[string]interface{}{"department": "testing"},
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    cfg.Security.JWTIssuer,
			Subject:   "user-test-123",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	ss, err := token.SignedString([]byte(cfg.Security.JWSSecret))
	if err != nil {
		log.Fatalf("Failed to sign token: %v", err)
	}
	fmt.Println(ss)
}
