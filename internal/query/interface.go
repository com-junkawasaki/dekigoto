package query

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/junkawasaki/actordb-dokigoto/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/internal/security"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

// QueryRequest represents a query request
type QueryRequest struct {
	SQL         string                    `json:"sql"`
	Parameters  map[string]interface{}    `json:"parameters,omitempty"`
	SecurityCtx *security.SecurityContext `json:"-"`
}

// QueryResponse represents a query response
type QueryResponse struct {
	Data      interface{}   `json:"data"`
	Source    string        `json:"source"` // "materialized" or "ondemand"
	Latency   time.Duration `json:"latency"`
	Timestamp time.Time     `json:"timestamp"`
	Error     string        `json:"error,omitempty"`
}

// QueryInterface provides a query interface for projections
// Process Network Node: query_interface
// Dependencies: [projection_engine, catalog_service]
// Outputs: [query_results]
// SLO: query_p99_100ms
type QueryInterface struct {
	config     config.QueryConfig
	eventStore *eventstore.EventStore
	secGateway *security.SecurityGateway
	server     *http.Server
	running    bool
	mu         sync.Mutex
	ctx        context.Context
	cancel     context.CancelFunc
}

// NewQueryInterface creates a new QueryInterface
func NewQueryInterface(cfg config.QueryConfig, es *eventstore.EventStore, sg *security.SecurityGateway) *QueryInterface {
	ctx, cancel := context.WithCancel(context.Background())
	return &QueryInterface{
		config:     cfg,
		eventStore: es,
		secGateway: sg,
		running:    false,
		ctx:        ctx,
		cancel:     cancel,
	}
}

// Start begins query interface operation
func (qi *QueryInterface) Start(ctx context.Context) error {
	qi.running = true

	mux := http.NewServeMux()
	mux.HandleFunc("/health", qi.handleHealth)
	mux.HandleFunc("/query", qi.handleQuery) // Existing query endpoint
	mux.HandleFunc("/query/admin", qi.authMiddleware(qi.handleAdminQuery))

	qi.server = &http.Server{
		Addr:         qi.config.ListenAddr,
		Handler:      mux,
		ReadTimeout:  qi.config.QueryTimeoutSec,
		WriteTimeout: qi.config.QueryTimeoutSec,
	}

	go func() {
		log.Printf("Starting QueryInterface on %s", qi.config.ListenAddr)
		if err := qi.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("QueryInterface server error: %v", err)
		}
	}()

	log.Println("QueryInterface started")
	return nil
}

// Stop shuts down the QueryInterface
func (qi *QueryInterface) Stop() {
	qi.running = false
	qi.cancel()

	if qi.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		qi.server.Shutdown(ctx)
	}

	log.Println("QueryInterface stopped")
}

// handleQuery handles HTTP query requests
func (qi *QueryInterface) handleQuery(w http.ResponseWriter, r *http.Request) {
	// Dummy implementation for now, as projector is removed.
	// In a real scenario, this would involve query parsing and execution.
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"result": "query ok"})
}

// handleHealth handles health check requests
func (qi *QueryInterface) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// handleAdminQuery is a protected endpoint
func (qi *QueryInterface) handleAdminQuery(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"result": "admin access granted"})
}

// authMiddleware wraps a handler to perform authentication and authorization
func (qi *QueryInterface) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenString := r.Header.Get("Authorization")
		result, err := qi.secGateway.ValidateToken(r.Context(), tokenString)
		if err != nil || !result.Valid {
			http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
			return
		}

		// Authorization check
		if !qi.secGateway.CheckPermission(result.Context, "admin:access") {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	}
}
