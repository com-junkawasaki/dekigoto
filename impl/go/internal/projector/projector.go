package projector

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/junkawasaki/actordb-dokigoto/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

// ProjectionDefinition defines a projection's schema and IVM rules
// Merkle DAG: sha256:projection_def_v1 - Declarative projection DSL
type ProjectionDefinition struct {
	Name            string                 `yaml:"name"`
	Sources         []SourceDefinition     `yaml:"sources"`
	StateSchema     map[string]interface{} `yaml:"state"`
	IVM             IVMConfig              `yaml:"ivm"`
	Security        SecurityConfig         `yaml:"security"`
	Materialization MaterializationConfig  `yaml:"materialization"`
}

// SourceDefinition defines an event source for projection
type SourceDefinition struct {
	Stream string `yaml:"stream"`
	Key    string `yaml:"key"`
	Filter string `yaml:"filter,omitempty"`
}

// IVMConfig configures Incremental View Maintenance
type IVMConfig struct {
	LateWindowMs   int64       `yaml:"late_window_ms"`
	WatermarkLagMs int64       `yaml:"watermark_lag_ms"`
	Delta          []DeltaRule `yaml:"delta"`
}

// DeltaRule defines how to update projection state from events
type DeltaRule struct {
	On     string `yaml:"on"`     // event type
	Update string `yaml:"update"` // update expression
}

// SecurityConfig defines security policies for the projection
type SecurityConfig struct {
	RLS      string   `yaml:"rls"`  // Row Level Security expression
	Mask     []string `yaml:"mask"` // Columns to mask
	TenantID string   `yaml:"tenant_id"`
}

// MaterializationConfig controls auto-promotion/demotion
type MaterializationConfig struct {
	PromoteIfQPS float64 `yaml:"promote_if_qps"`
	DemoteIfQPS  float64 `yaml:"demote_if_qps"`
}

// ProjectionState holds the current state of a projection
type ProjectionState struct {
	Name           string
	IsMaterialized bool
	LastUpdate     time.Time
	QPS            float64
	State          map[string]interface{}
	StateMu        sync.RWMutex
}

// ProjectionResult contains query results
type ProjectionResult struct {
	Data      interface{}
	Source    string // "materialized" or "ondemand"
	Latency   time.Duration
	Timestamp time.Time
}

// ProjectionEngine handles IVM with auto-materialization
// Process Network Node: projection_engine
// Dependencies: [event_stream, catalog_service]
// Outputs: [materialized_views, ondemand_results]
// SLO: p99_latency_200ms_ondemand_50ms_materialized
type ProjectionEngine struct {
	config        config.ProjectionConfig
	eventstore    *eventstore.EventStore
	projections   map[string]*ProjectionState
	projectionsMu sync.RWMutex
	definitions   map[string]*ProjectionDefinition
	definitionsMu sync.RWMutex
	workers       []*Worker
	eventChannel  chan eventstore.Event // Channel to receive events from EventStore
	running       bool
	ctx           context.Context
	cancel        context.CancelFunc
}

// Worker handles projection updates
type Worker struct {
	id      int
	engine  *ProjectionEngine
	queue   chan ProjectionUpdate
	running bool
}

// ProjectionUpdate represents an update to process
type ProjectionUpdate struct {
	ProjectionName string
	Event          eventstore.Event
	Priority       int // 0=interactive, 1=batch
}

// New creates a new ProjectionEngine
func New(cfg config.ProjectionConfig, es *eventstore.EventStore) (*ProjectionEngine, error) {
	ctx, cancel := context.WithCancel(context.Background())

	pe := &ProjectionEngine{
		config:      cfg,
		eventstore:  es,
		projections: make(map[string]*ProjectionState),
		definitions: make(map[string]*ProjectionDefinition),
		workers:     make([]*Worker, cfg.WorkerCount),
		running:     false,
		ctx:         ctx,
		cancel:      cancel,
	}

	// Initialize workers
	for i := 0; i < cfg.WorkerCount; i++ {
		pe.workers[i] = &Worker{
			id:     i,
			engine: pe,
			queue:  make(chan ProjectionUpdate, 1000),
		}
	}

	return pe, nil
}

// Start begins the ProjectionEngine operation
func (pe *ProjectionEngine) Start(ctx context.Context) error {
	pe.running = true

	// Subscribe to the event store to receive real-time events.
	pe.eventChannel = pe.eventstore.Subscribe()

	// Start workers
	for _, worker := range pe.workers {
		go worker.run()
	}

	// Start event subscription
	go pe.subscribeToEvents()

	log.Printf("ProjectionEngine started with %d workers", len(pe.workers))
	return nil
}

// Stop shuts down the ProjectionEngine
func (pe *ProjectionEngine) Stop() {
	pe.running = false
	pe.cancel()

	// Stop workers
	for _, worker := range pe.workers {
		if worker.running {
			close(worker.queue)
		}
	}

	// Unsubscribe from the event store to release resources.
	if pe.eventChannel != nil {
		pe.eventstore.Unsubscribe(pe.eventChannel)
	}

	log.Println("ProjectionEngine stopped")
}

// RegisterProjection registers a new projection definition
func (pe *ProjectionEngine) RegisterProjection(def *ProjectionDefinition) error {
	pe.definitionsMu.Lock()
	pe.definitions[def.Name] = def
	pe.definitionsMu.Unlock()

	pe.projectionsMu.Lock()
	pe.projections[def.Name] = &ProjectionState{
		Name:           def.Name,
		IsMaterialized: false,
		LastUpdate:     time.Now(),
		QPS:            0,
		State:          make(map[string]interface{}),
	}
	pe.projectionsMu.Unlock()

	log.Printf("Registered projection: %s", def.Name)
	return nil
}

// Query executes a projection query
func (pe *ProjectionEngine) Query(ctx context.Context, projectionName string, params map[string]interface{}) (*ProjectionResult, error) {
	if !pe.running {
		return nil, fmt.Errorf("projection engine not running")
	}

	start := time.Now()

	pe.projectionsMu.RLock()
	proj, exists := pe.projections[projectionName]
	pe.projectionsMu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("projection %s not found", projectionName)
	}

	proj.StateMu.RLock()
	state := make(map[string]interface{})
	for k, v := range proj.State {
		state[k] = v
	}
	proj.StateMu.RUnlock()

	result := &ProjectionResult{
		Data:      state,
		Timestamp: time.Now(),
		Latency:   time.Since(start),
	}

	if proj.IsMaterialized {
		result.Source = "materialized"
	} else {
		result.Source = "ondemand"
		// Update QPS for auto-promotion logic
		pe.updateQPS(projectionName)
	}

	return result, nil
}

// subscribeToEvents subscribes to eventstore events and routes them to workers
func (pe *ProjectionEngine) subscribeToEvents() {
	log.Println("ProjectionEngine is now listening for events from EventStore...")
	for {
		select {
		case <-pe.ctx.Done():
			log.Println("Stopping event subscription.")
			return
		case event, ok := <-pe.eventChannel:
			if !ok {
				log.Println("Event channel closed, stopping subscription.")
				return
			}
			pe.routeEvent(event)
		}
	}
}

// routeEvent routes an event to appropriate projections
func (pe *ProjectionEngine) routeEvent(event eventstore.Event) {
	if !pe.running {
		return
	}

	pe.definitionsMu.RLock()
	for name, def := range pe.definitions {
		if pe.shouldProcessEvent(def, event) {
			update := ProjectionUpdate{
				ProjectionName: name,
				Event:          event,
				Priority:       1, // Default to batch priority
			}

			// Route to worker (simple round-robin for MVP)
			workerIndex := len(name) % len(pe.workers)
			select {
			case pe.workers[workerIndex].queue <- update:
			default:
				log.Printf("Worker queue full, dropping update for %s", name)
			}
		}
	}
	pe.definitionsMu.RUnlock()
}

// shouldProcessEvent checks if a projection should process an event
func (pe *ProjectionEngine) shouldProcessEvent(def *ProjectionDefinition, event eventstore.Event) bool {
	for _, source := range def.Sources {
		if source.Stream == event.EventType {
			return true
		}
	}
	return false
}

// updateQPS updates QPS tracking for auto-promotion
func (pe *ProjectionEngine) updateQPS(projectionName string) {
	pe.projectionsMu.Lock()
	defer pe.projectionsMu.Unlock()

	if proj, exists := pe.projections[projectionName]; exists {
		proj.QPS += 1.0 // Simplified QPS tracking
	}
}

// run executes projection updates (Worker method)
func (w *Worker) run() {
	w.running = true
	log.Printf("Worker %d started", w.id)

	for {
		select {
		case update, ok := <-w.queue:
			if !ok {
				w.running = false
				return
			}
			w.processUpdate(update)
		case <-w.engine.ctx.Done():
			w.running = false
			return
		}
	}
}

// processUpdate applies a projection update
func (w *Worker) processUpdate(update ProjectionUpdate) {
	// Get projection definition
	w.engine.definitionsMu.RLock()
	_, exists := w.engine.definitions[update.ProjectionName]
	w.engine.definitionsMu.RUnlock()

	if !exists {
		log.Printf("Definition not found for projection: %s", update.ProjectionName)
		return
	}

	// Apply IVM rules
	w.engine.projectionsMu.Lock()
	proj := w.engine.projections[update.ProjectionName]
	w.engine.projectionsMu.Unlock()

	proj.StateMu.Lock()
	// MVP: Simple state updates based on event type
	switch update.Event.EventType {
	case "order_created":
		if count, ok := proj.State["orders"].(int); ok {
			proj.State["orders"] = count + 1
		} else {
			proj.State["orders"] = 1
		}
	case "order_cancelled":
		if count, ok := proj.State["orders"].(int); ok && count > 0 {
			proj.State["orders"] = count - 1
		}
	}
	proj.LastUpdate = time.Now()
	proj.StateMu.Unlock()

	// Check for auto-promotion
	w.checkAutoPromotion(update.ProjectionName, proj)
}

// checkAutoPromotion checks if a projection should be promoted to materialized
func (w *Worker) checkAutoPromotion(name string, proj *ProjectionState) {
	if !proj.IsMaterialized && proj.QPS >= w.engine.config.AutoPromoteQPSThreshold {
		log.Printf("Auto-promoting projection %s (QPS: %.2f)", name, proj.QPS)
		proj.IsMaterialized = true
		// Reset QPS after promotion
		proj.QPS = 0
	}
}
