package eventstore

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

// Event represents a single event in the event store
// Merkle DAG: sha256:event_v1 - Single-writer actor event persistence
type Event struct {
	AggregateID   string                 `json:"aggregate_id"`
	Sequence      int64                  `json:"sequence"`
	EventType     string                 `json:"event_type"`
	Data          []byte                 `json:"data"`
	Timestamp     time.Time              `json:"timestamp"`
	EventTime     time.Time              `json:"event_time"` // For late event handling
	AggregateType string                 `json:"aggregate_type"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// ActorState represents the current state of an actor
type ActorState struct {
	AggregateID   string
	LastSequence  int64
	LastTimestamp time.Time
	SnapshotData  []byte
	SnapshotSeq   int64
}

// WriteResult contains the result of a write operation
type WriteResult struct {
	AggregateID string
	Sequence    int64
	Timestamp   time.Time
	Success     bool
	Error       error
}

// EventStore handles actor-based append-only event storage
// Process Network Node: write_aggregate
// Dependencies: []
// Outputs: [event_stream]
// SLO: p99_latency_100ms
type EventStore struct {
	config     config.EventStoreConfig
	actors     map[string]*ActorState
	actorsMu   sync.RWMutex
	eventLog   []Event // In-memory for MVP; would be persistent storage
	eventLogMu sync.RWMutex
	running    bool
	ctx        context.Context
	cancel     context.CancelFunc
}

// New creates a new EventStore instance
func New(cfg config.EventStoreConfig) (*EventStore, error) {
	ctx, cancel := context.WithCancel(context.Background())

	es := &EventStore{
		config:   cfg,
		actors:   make(map[string]*ActorState),
		eventLog: make([]Event, 0),
		running:  false,
		ctx:      ctx,
		cancel:   cancel,
	}

	return es, nil
}

// Start begins the EventStore operation
func (es *EventStore) Start(ctx context.Context) error {
	es.running = true
	log.Printf("EventStore started with data_dir: %s", es.config.DataDir)
	return nil
}

// Stop shuts down the EventStore
func (es *EventStore) Stop() {
	es.running = false
	es.cancel()
	log.Println("EventStore stopped")
}

// WriteEvent appends an event to an actor's event stream
// Ensures single-writer serialization per actor
func (es *EventStore) WriteEvent(ctx context.Context, event Event) (*WriteResult, error) {
	if !es.running {
		return nil, fmt.Errorf("eventstore not running")
	}

	es.actorsMu.Lock()
	actor, exists := es.actors[event.AggregateID]
	if !exists {
		actor = &ActorState{
			AggregateID:  event.AggregateID,
			LastSequence: 0,
		}
		es.actors[event.AggregateID] = actor
	}
	es.actorsMu.Unlock()

	// Validate sequence (single-writer check)
	expectedSeq := actor.LastSequence + 1
	if event.Sequence != expectedSeq {
		return &WriteResult{
			AggregateID: event.AggregateID,
			Success:     false,
			Error:       fmt.Errorf("sequence mismatch: expected %d, got %d", expectedSeq, event.Sequence),
		}, nil
	}

	// Set timestamp if not provided
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Append to event log
	es.eventLogMu.Lock()
	es.eventLog = append(es.eventLog, event)
	es.eventLogMu.Unlock()

	// Update actor state
	actor.LastSequence = event.Sequence
	actor.LastTimestamp = event.Timestamp

	// Check if snapshot is needed
	if event.Sequence%es.config.SnapshotInterval == 0 {
		if err := es.createSnapshot(event.AggregateID, event.Sequence); err != nil {
			log.Printf("Failed to create snapshot for %s: %v", event.AggregateID, err)
		}
	}

	result := &WriteResult{
		AggregateID: event.AggregateID,
		Sequence:    event.Sequence,
		Timestamp:   event.Timestamp,
		Success:     true,
	}

	return result, nil
}

// ReadEvents reads events for an actor from a given sequence
func (es *EventStore) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64) ([]Event, error) {
	if !es.running {
		return nil, fmt.Errorf("eventstore not running")
	}

	es.eventLogMu.RLock()
	defer es.eventLogMu.RUnlock()

	var events []Event
	for _, event := range es.eventLog {
		if event.AggregateID == aggregateID && event.Sequence >= fromSeq {
			events = append(events, event)
		}
	}

	return events, nil
}

// GetActorState returns the current state of an actor
func (es *EventStore) GetActorState(aggregateID string) (*ActorState, error) {
	es.actorsMu.RLock()
	defer es.actorsMu.RUnlock()

	actor, exists := es.actors[aggregateID]
	if !exists {
		return nil, fmt.Errorf("actor %s not found", aggregateID)
	}

	// Return a copy to prevent external modification
	state := *actor
	return &state, nil
}

// createSnapshot creates a snapshot for an actor (MVP: in-memory)
func (es *EventStore) createSnapshot(aggregateID string, sequence int64) error {
	// MVP: Just log the snapshot creation
	// In production: serialize actor state and persist
	log.Printf("Creating snapshot for actor %s at sequence %d", aggregateID, sequence)
	return nil
}

// GetAllEvents returns all events (for testing/debugging)
func (es *EventStore) GetAllEvents() []Event {
	es.eventLogMu.RLock()
	defer es.eventLogMu.RUnlock()

	events := make([]Event, len(es.eventLog))
	copy(events, es.eventLog)
	return events
}
