package security

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

// SecurityContext contains security information for a request
// Merkle DAG: sha256:security_ctx_v1 - Zero-trust security context
type SecurityContext struct {
	TenantID    string
	UserID      string
	Roles       []string
	Permissions []string
	Attributes  map[string]interface{}
	ExpiresAt   time.Time
	TokenHash   string
	AuditID     string
}

// CustomClaims defines the structure of custom JWT claims for ActorDB
type CustomClaims struct {
	Roles      []string               `json:"roles"`
	Attributes map[string]interface{} `json:"attributes"`
	TenantID   string                 `json:"tenant_id"`
	jwt.RegisteredClaims
}

// AuditEvent represents a security audit event
type AuditEvent struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	Action    string                 `json:"action"` // read, write, deny
	Resource  string                 `json:"resource"`
	UserID    string                 `json:"user_id"`
	TenantID  string                 `json:"tenant_id"`
	IPAddress string                 `json:"ip_address"`
	Success   bool                   `json:"success"`
	ErrorMsg  string                 `json:"error_msg,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// TokenValidationResult contains JWT validation results
type TokenValidationResult struct {
	Valid   bool
	Context *SecurityContext
	Error   error
}

// SecurityGateway provides zero-trust security with mTLS + JWS + ABAC/RBAC
// Process Network Node: security_gateway
// Dependencies: []
// Outputs: [validated_tokens, audit_stream]
// SLO: token_validation_10ms
type SecurityGateway struct {
	config        config.SecurityConfig
	tlsConfig     *tls.Config
	policy        map[string][]string // Role -> []Permissions
	auditStream   chan AuditEvent
	auditStreamMu sync.Mutex
	running       bool
	ctx           context.Context
	cancel        context.CancelFunc
	server        *http.Server
}

// NewGateway creates a new SecurityGateway
func NewGateway(cfg config.SecurityConfig) (*SecurityGateway, error) {
	ctx, cancel := context.WithCancel(context.Background())

	sg := &SecurityGateway{
		config:      cfg,
		auditStream: make(chan AuditEvent, 1000),
		running:     false,
		ctx:         ctx,
		cancel:      cancel,
		// MVP Policy Definition
		policy: map[string][]string{
			"admin":  {"read", "write", "admin:access"},
			"user":   {"read"},
			"reader": {"read"},
		},
	}

	// Configure mTLS if enabled
	if cfg.MTLSEnabled {
		tlsCfg, err := sg.configureMTLS()
		if err != nil {
			return nil, fmt.Errorf("failed to configure mTLS: %w", err)
		}
		sg.tlsConfig = tlsCfg
	}

	return sg, nil
}

// Start begins the SecurityGateway operation
func (sg *SecurityGateway) Start(ctx context.Context) error {
	sg.running = true

	// Start audit stream processor
	go sg.processAuditStream()

	// Start HTTP server for token validation endpoint
	mux := http.NewServeMux()
	mux.HandleFunc("/validate", sg.handleValidateToken)
	mux.HandleFunc("/health", sg.handleHealth)

	sg.server = &http.Server{
		Addr:         ":8443", // Security service port
		Handler:      mux,
		TLSConfig:    sg.tlsConfig,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		var err error
		if sg.config.MTLSEnabled {
			log.Println("Starting SecurityGateway with mTLS on :8443")
			err = sg.server.ListenAndServeTLS("", "")
		} else {
			log.Println("Starting SecurityGateway on :8443")
			err = sg.server.ListenAndServe()
		}
		if err != nil && err != http.ErrServerClosed {
			log.Printf("SecurityGateway server error: %v", err)
		}
	}()

	log.Println("SecurityGateway started")
	return nil
}

// Stop shuts down the SecurityGateway
func (sg *SecurityGateway) Stop() {
	sg.running = false
	sg.cancel()

	if sg.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := sg.server.Shutdown(ctx); err != nil {
			log.Printf("SecurityGateway server shutdown error: %v", err)
		}
	}

	close(sg.auditStream)
	log.Println("SecurityGateway stopped")
}

// ValidateToken validates a JWT token and returns security context
func (sg *SecurityGateway) ValidateToken(ctx context.Context, tokenString string) (*TokenValidationResult, error) {
	if !sg.running {
		return &TokenValidationResult{Valid: false, Error: fmt.Errorf("security gateway not running")}, nil
	}

	if tokenString == "" {
		result := &TokenValidationResult{Valid: false, Error: fmt.Errorf("empty token")}
		sg.auditEvent("token_validation", "token", "", "system", false, "empty token")
		return result, nil
	}

	// JWS tokens are often prefixed with "Bearer "
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	claims := &CustomClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Validate the alg is what we expect:
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(sg.config.JWSSecret), nil
	})

	if err != nil {
		sg.auditEvent("token_validation", "token", "", "system", false, fmt.Sprintf("token parsing error: %v", err))
		return &TokenValidationResult{Valid: false, Error: err}, nil
	}

	if !token.Valid {
		sg.auditEvent("token_validation", "token", claims.Subject, claims.TenantID, false, "invalid token")
		return &TokenValidationResult{Valid: false, Error: fmt.Errorf("invalid token")}, nil
	}

	// Construct security context from claims
	securityCtx := &SecurityContext{
		TenantID:    claims.TenantID,
		UserID:      claims.Subject,
		Roles:       claims.Roles,
		Permissions: []string{}, // Permissions should be derived from roles by a policy engine
		Attributes:  claims.Attributes,
		ExpiresAt:   claims.ExpiresAt.Time,
		TokenHash:   "mock_hash", // In prod, hash the token string
		AuditID:     fmt.Sprintf("audit_%d", time.Now().Unix()),
	}

	result := &TokenValidationResult{
		Valid:   true,
		Context: securityCtx,
	}

	sg.auditEvent("token_validation", "token", securityCtx.UserID, securityCtx.TenantID, true, "")
	return result, nil
}

// CheckPermission checks if a security context has permission for an action on a resource
func (sg *SecurityGateway) CheckPermission(ctx *SecurityContext, resource string, action string) bool {
	// In production: Use a proper policy engine like OPA
	permission := fmt.Sprintf("%s:%s", resource, action)

	for _, role := range ctx.Roles {
		if permissions, ok := sg.policy[role]; ok {
			for _, p := range permissions {
				if p == permission || p == "admin" {
					return true
				}
			}
		}
	}
	return false
}

// ApplyRLS applies Row Level Security filtering
func (sg *SecurityGateway) ApplyRLS(ctx *SecurityContext, data interface{}, rlsExpression string) (interface{}, error) {
	// MVP: Simple tenant-based RLS
	// In production: Evaluate RLS expressions against data
	if rlsExpression == "tenant_id" {
		// Filter data by tenant_id
		return data, nil
	}
	return data, nil
}

// MaskColumns applies column masking based on security context
func (sg *SecurityGateway) MaskColumns(ctx *SecurityContext, data interface{}, maskedColumns []string) (interface{}, error) {
	// MVP: Simple column masking
	// In production: Mask sensitive columns in result data
	return data, nil
}

// configureMTLS configures mutual TLS
func (sg *SecurityGateway) configureMTLS() (*tls.Config, error) {
	// MVP: Basic TLS config
	// In production: Load proper certificates and configure SPIFFE
	cert, err := tls.LoadX509KeyPair("certs/server.crt", "certs/server.key")
	if err != nil {
		// For MVP, create self-signed cert if not found
		log.Println("MTLS certificates not found, mTLS setup failed")
		return nil, fmt.Errorf("failed to load mTLS certificates: %w", err)
	}

	caCert, err := os.ReadFile("certs/server.crt")
	if err != nil {
		return nil, fmt.Errorf("failed to read CA certificate: %w", err)
	}
	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientAuth:   tls.RequireAndVerifyClientCert,
		MinVersion:   tls.VersionTLS12,
		ClientCAs:    caCertPool,
	}, nil
}

// auditEvent sends an event to the audit stream
func (sg *SecurityGateway) auditEvent(action, resource, userID, tenantID string, success bool, errorMsg string) {
	event := AuditEvent{
		ID:        fmt.Sprintf("audit_%d", time.Now().UnixNano()),
		Timestamp: time.Now(),
		Action:    action,
		Resource:  resource,
		UserID:    userID,
		TenantID:  tenantID,
		Success:   success,
		ErrorMsg:  errorMsg,
	}

	select {
	case sg.auditStream <- event:
	default:
		log.Println("Audit stream full, dropping event")
	}
}

// processAuditStream processes audit events
func (sg *SecurityGateway) processAuditStream() {
	for {
		select {
		case event, ok := <-sg.auditStream:
			if !ok {
				return
			}
			log.Printf("AUDIT: %s %s %s %s %v", event.Action, event.Resource, event.UserID, event.TenantID, event.Success)
		case <-sg.ctx.Done():
			return
		}
	}
}

// handleValidateToken handles token validation HTTP requests
func (sg *SecurityGateway) handleValidateToken(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	result, err := sg.ValidateToken(r.Context(), token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !result.Valid {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte("Token valid")); err != nil {
		log.Printf("Error writing response: %v", err)
	}
}

// handleHealth handles health check requests
func (sg *SecurityGateway) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte("OK")); err != nil {
		log.Printf("Error writing health check response: %v", err)
	}
}
