package control

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/junkawasaki/actordb-dokigoto/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/internal/projector"
	"github.com/junkawasaki/actordb-dokigoto/internal/security"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

// HealthStatus represents system health
type HealthStatus struct {
	Service   string    `json:"service"`
	Status    string    `json:"status"` // "healthy", "degraded", "unhealthy"
	LastCheck time.Time `json:"last_check"`
	Message   string    `json:"message,omitempty"`
}

// MetricsSnapshot contains system metrics
type MetricsSnapshot struct {
	Timestamp         time.Time         `json:"timestamp"`
	EventStoreMetrics EventStoreMetrics `json:"eventstore"`
	ProjectionMetrics ProjectionMetrics `json:"projection"`
	SecurityMetrics   SecurityMetrics   `json:"security"`
	SystemMetrics     SystemMetrics     `json:"system"`
}

// EventStoreMetrics contains EventStore performance metrics
type EventStoreMetrics struct {
	TotalEvents     int64         `json:"total_events"`
	ActiveActors    int           `json:"active_actors"`
	WriteLatencyP50 time.Duration `json:"write_latency_p50"`
	WriteLatencyP99 time.Duration `json:"write_latency_p99"`
	ErrorRate       float64       `json:"error_rate"`
}

// ProjectionMetrics contains Projection Engine metrics
type ProjectionMetrics struct {
	ActiveProjections int           `json:"active_projections"`
	MaterializedViews int           `json:"materialized_views"`
	QueryLatencyP50   time.Duration `json:"query_latency_p50"`
	QueryLatencyP99   time.Duration `json:"query_latency_p99"`
	RebuildTime       time.Duration `json:"rebuild_time"`
	LateEventRate     float64       `json:"late_event_rate"`
}

// SecurityMetrics contains security-related metrics
type SecurityMetrics struct {
	TokenValidations     int64         `json:"token_validations"`
	PermissionChecks     int64         `json:"permission_checks"`
	AuditEvents          int64         `json:"audit_events"`
	ValidationLatencyP99 time.Duration `json:"validation_latency_p99"`
}

// SystemMetrics contains system-level metrics
type SystemMetrics struct {
	CPUUsage    float64 `json:"cpu_usage"`
	MemoryUsage float64 `json:"memory_usage"`
	DiskUsage   float64 `json:"disk_usage"`
	NetworkIO   float64 `json:"network_io"`
}

// ScalingDecision represents a scaling action
type ScalingDecision struct {
	Service   string    `json:"service"`
	Action    string    `json:"action"` // "scale_up", "scale_down", "rebalance"
	Reason    string    `json:"reason"`
	Timestamp time.Time `json:"timestamp"`
}

// ControlPlane handles auto-scaling, monitoring, and operational automation
// Process Network Node: control_plane
// Dependencies: [all_processes]
// Outputs: [scaling_decisions, health_metrics]
// SLO: decision_latency_1s
type ControlPlane struct {
	config     config.ControlConfig
	eventstore *eventstore.EventStore
	projector  *projector.ProjectionEngine
	security   *security.SecurityGateway
	metrics    *MetricsSnapshot
	metricsMu  sync.RWMutex
	decisions  chan ScalingDecision
	server     *http.Server
	running    bool
	ctx        context.Context
	cancel     context.CancelFunc
}

// New creates a new ControlPlane
func New(cfg config.ControlConfig, es *eventstore.EventStore, proj *projector.ProjectionEngine, sec *security.SecurityGateway) (*ControlPlane, error) {
	ctx, cancel := context.WithCancel(context.Background())

	cp := &ControlPlane{
		config:     cfg,
		eventstore: es,
		projector:  proj,
		security:   sec,
		metrics:    &MetricsSnapshot{},
		decisions:  make(chan ScalingDecision, 100),
		running:    false,
		ctx:        ctx,
		cancel:     cancel,
	}

	return cp, nil
}

// Start begins the ControlPlane operation
func (cp *ControlPlane) Start(ctx context.Context) error {
	cp.running = true

	// Start metrics collection
	go cp.collectMetrics()

	// Start scaling controller
	go cp.scalingController()

	// Start health checker
	go cp.healthChecker()

	// Start HTTP server for monitoring endpoints
	mux := http.NewServeMux()
	mux.HandleFunc("/health", cp.handleHealth)
	mux.HandleFunc("/metrics", cp.handleMetrics)
	mux.HandleFunc("/decisions", cp.handleDecisions)

	cp.server = &http.Server{
		Addr:         cp.config.ListenAddr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("Starting ControlPlane on %s", cp.config.ListenAddr)
		if err := cp.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("ControlPlane server error: %v", err)
		}
	}()

	log.Println("ControlPlane started")
	return nil
}

// Stop shuts down the ControlPlane
func (cp *ControlPlane) Stop() {
	cp.running = false
	cp.cancel()

	if cp.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		cp.server.Shutdown(ctx)
	}

	close(cp.decisions)
	log.Println("ControlPlane stopped")
}

// GetHealthStatus returns overall system health
func (cp *ControlPlane) GetHealthStatus() []HealthStatus {
	statuses := []HealthStatus{}

	// Check EventStore
	esHealthy := cp.eventstore != nil
	esStatus := "healthy"
	if !esHealthy {
		esStatus = "unhealthy"
	}
	statuses = append(statuses, HealthStatus{
		Service:   "eventstore",
		Status:    esStatus,
		LastCheck: time.Now(),
	})

	// Check Projector
	projHealthy := cp.projector != nil
	projStatus := "healthy"
	if !projHealthy {
		projStatus = "unhealthy"
	}
	statuses = append(statuses, HealthStatus{
		Service:   "projector",
		Status:    projStatus,
		LastCheck: time.Now(),
	})

	// Check Security
	secHealthy := cp.security != nil
	secStatus := "healthy"
	if !secHealthy {
		secStatus = "unhealthy"
	}
	statuses = append(statuses, HealthStatus{
		Service:   "security",
		Status:    secStatus,
		LastCheck: time.Now(),
	})

	return statuses
}

// collectMetrics periodically collects system metrics
func (cp *ControlPlane) collectMetrics() {
	ticker := time.NewTicker(cp.config.MetricsIntervalSec)
	defer ticker.Stop()

	for {
		select {
		case <-cp.ctx.Done():
			return
		case <-ticker.C:
			cp.updateMetrics()
		}
	}
}

// updateMetrics updates the current metrics snapshot
func (cp *ControlPlane) updateMetrics() {
	cp.metricsMu.Lock()
	defer cp.metricsMu.Unlock()

	cp.metrics.Timestamp = time.Now()

	// EventStore metrics (MVP: basic counts)
	events := cp.eventstore.GetAllEvents()
	cp.metrics.EventStoreMetrics = EventStoreMetrics{
		TotalEvents:  int64(len(events)),
		ActiveActors: len(cp.eventstore.GetAllEvents()), // Simplified
	}

	// Projection metrics (MVP: placeholder)
	cp.metrics.ProjectionMetrics = ProjectionMetrics{
		ActiveProjections: 1, // MVP
		MaterializedViews: 0, // MVP
	}

	// Security metrics (MVP: placeholder)
	cp.metrics.SecurityMetrics = SecurityMetrics{
		TokenValidations: 0, // MVP
	}

	// System metrics (MVP: placeholder)
	cp.metrics.SystemMetrics = SystemMetrics{
		CPUUsage:    0.5, // MVP
		MemoryUsage: 0.3, // MVP
	}
}

// scalingController monitors metrics and makes scaling decisions
func (cp *ControlPlane) scalingController() {
	ticker := time.NewTicker(cp.config.ScalingCheckIntervalSec)
	defer ticker.Stop()

	for {
		select {
		case <-cp.ctx.Done():
			return
		case <-ticker.C:
			cp.evaluateScaling()
		}
	}
}

// evaluateScaling evaluates current metrics and makes scaling decisions
func (cp *ControlPlane) evaluateScaling() {
	cp.metricsMu.RLock()
	metrics := cp.metrics
	cp.metricsMu.RUnlock()

	// Check for hot key patterns (simplified)
	// In production: analyze actor write patterns, detect hotspots

	// Check projection load
	if metrics.ProjectionMetrics.QueryLatencyP99 > 100*time.Millisecond {
		decision := ScalingDecision{
			Service:   "projection",
			Action:    "scale_up",
			Reason:    "high query latency",
			Timestamp: time.Now(),
		}
		select {
		case cp.decisions <- decision:
			log.Printf("Scaling decision: %s %s (%s)", decision.Service, decision.Action, decision.Reason)
		default:
			log.Println("Decision channel full")
		}
	}
}

// healthChecker performs periodic health checks
func (cp *ControlPlane) healthChecker() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-cp.ctx.Done():
			return
		case <-ticker.C:
			statuses := cp.GetHealthStatus()
			for _, status := range statuses {
				if status.Status != "healthy" {
					log.Printf("Health check failed for %s: %s", status.Service, status.Status)
				}
			}
		}
	}
}

// handleHealth handles health check HTTP requests
func (cp *ControlPlane) handleHealth(w http.ResponseWriter, r *http.Request) {
	statuses := cp.GetHealthStatus()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	fmt.Fprintf(w, `{"status": "ok", "services": [`)
	for i, status := range statuses {
		if i > 0 {
			fmt.Fprintf(w, ",")
		}
		fmt.Fprintf(w, `{"service": "%s", "status": "%s"}`, status.Service, status.Status)
	}
	fmt.Fprintf(w, `]}`)
}

// handleMetrics handles metrics HTTP requests
func (cp *ControlPlane) handleMetrics(w http.ResponseWriter, r *http.Request) {
	cp.metricsMu.RLock()
	metrics := cp.metrics
	cp.metricsMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"metrics": {"total_events": %d, "active_actors": %d}}`,
		metrics.EventStoreMetrics.TotalEvents, metrics.EventStoreMetrics.ActiveActors)
}

// handleDecisions handles scaling decisions HTTP requests
func (cp *ControlPlane) handleDecisions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"decisions": "endpoint_placeholder"}`)
}
