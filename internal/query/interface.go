package query

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/junkawasaki/actordb-dokigoto/internal/projector"
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

// QueryInterface provides SQL-like query interface with transparent RLS
// Process Network Node: query_interface
// Dependencies: [projection_engine, catalog_service]
// Outputs: [query_results]
// SLO: query_p99_100ms
type QueryInterface struct {
	config    config.QueryConfig
	projector *projector.ProjectionEngine
	security  *security.SecurityGateway
	server    *http.Server
	running   bool
	ctx       context.Context
	cancel    context.CancelFunc
}

// New creates a new QueryInterface
func New(cfg config.QueryConfig, proj *projector.ProjectionEngine, sec *security.SecurityGateway) (*QueryInterface, error) {
	ctx, cancel := context.WithCancel(context.Background())

	qi := &QueryInterface{
		config:    cfg,
		projector: proj,
		security:  sec,
		running:   false,
		ctx:       ctx,
		cancel:    cancel,
	}

	return qi, nil
}

// Start begins the QueryInterface operation
func (qi *QueryInterface) Start(ctx context.Context) error {
	qi.running = true

	mux := http.NewServeMux()
	mux.HandleFunc("/query", qi.handleQuery)
	mux.HandleFunc("/health", qi.handleHealth)

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

// ExecuteQuery executes a query with security context
func (qi *QueryInterface) ExecuteQuery(ctx context.Context, req *QueryRequest) (*QueryResponse, error) {
	if !qi.running {
		return nil, fmt.Errorf("query interface not running")
	}

	start := time.Now()

	// Parse SQL-like query
	projectionName, err := qi.parseSQL(req.SQL)
	if err != nil {
		return &QueryResponse{
			Error:   err.Error(),
			Latency: time.Since(start),
		}, nil
	}

	// Execute projection query
	result, err := qi.projector.Query(ctx, projectionName, req.Parameters)
	if err != nil {
		return &QueryResponse{
			Error:   err.Error(),
			Latency: time.Since(start),
		}, nil
	}

	// Apply RLS if security context is provided
	if req.SecurityCtx != nil {
		// Get projection definition to check RLS rules
		filteredData, err := qi.applySecurityFiltering(req.SecurityCtx, result.Data)
		if err != nil {
			return &QueryResponse{
				Error:   fmt.Sprintf("Security filtering failed: %v", err),
				Latency: time.Since(start),
			}, nil
		}
		result.Data = filteredData
	}

	response := &QueryResponse{
		Data:      result.Data,
		Source:    result.Source,
		Latency:   time.Since(start),
		Timestamp: result.Timestamp,
	}

	return response, nil
}

// parseSQL parses a simple SQL-like query to extract projection name
// MVP: Simple parsing for "SELECT * FROM projection_name"
func (qi *QueryInterface) parseSQL(sql string) (string, error) {
	sql = strings.TrimSpace(strings.ToUpper(sql))

	if !strings.HasPrefix(sql, "SELECT") {
		return "", fmt.Errorf("only SELECT queries supported")
	}

	// Find FROM clause
	fromIndex := strings.Index(sql, "FROM")
	if fromIndex == -1 {
		return "", fmt.Errorf("FROM clause required")
	}

	// Extract projection name after FROM
	projectionPart := strings.TrimSpace(sql[fromIndex+4:])
	// Remove trailing clauses (WHERE, etc.)
	if whereIndex := strings.Index(projectionPart, " WHERE"); whereIndex != -1 {
		projectionPart = strings.TrimSpace(projectionPart[:whereIndex])
	}

	if projectionPart == "" {
		return "", fmt.Errorf("projection name required after FROM")
	}

	return projectionPart, nil
}

// applySecurityFiltering applies RLS and column masking
func (qi *QueryInterface) applySecurityFiltering(ctx *security.SecurityContext, data interface{}) (interface{}, error) {
	// Check permissions
	if !qi.security.CheckPermission(ctx, "query", "read") {
		return nil, fmt.Errorf("insufficient permissions")
	}

	// Apply RLS (MVP: tenant-based filtering)
	filteredData, err := qi.security.ApplyRLS(ctx, data, "tenant_id")
	if err != nil {
		return nil, err
	}

	// Apply column masking (MVP: mask sensitive fields)
	maskedData, err := qi.security.MaskColumns(ctx, filteredData, []string{"email", "phone"})
	if err != nil {
		return nil, err
	}

	return maskedData, nil
}

// handleQuery handles HTTP query requests
func (qi *QueryInterface) handleQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract token from header
	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Missing authorization token", http.StatusUnauthorized)
		return
	}

	// Validate token
	tokenResult, err := qi.security.ValidateToken(r.Context(), token)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token validation error: %v", err), http.StatusInternalServerError)
		return
	}

	if !tokenResult.Valid {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	// Parse query from request body
	// MVP: Simple query parsing
	sql := r.URL.Query().Get("sql")
	if sql == "" {
		http.Error(w, "Missing sql parameter", http.StatusBadRequest)
		return
	}

	req := &QueryRequest{
		SQL:         sql,
		SecurityCtx: tokenResult.Context,
	}

	// Execute query
	resp, err := qi.ExecuteQuery(r.Context(), req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Query execution error: %v", err), http.StatusInternalServerError)
		return
	}

	if resp.Error != "" {
		http.Error(w, resp.Error, http.StatusBadRequest)
		return
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"data": "%v", "source": "%s", "latency_ms": %.2f}`,
		resp.Data, resp.Source, float64(resp.Latency.Nanoseconds())/1000000)
}

// handleHealth handles health check requests
func (qi *QueryInterface) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}
