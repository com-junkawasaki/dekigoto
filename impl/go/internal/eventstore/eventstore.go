package eventstore

import (
	"context"
	"encoding/json"
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
	config        config.EventStoreConfig
	storage       Storage
	actors        map[string]*ActorState
	actorsMu      sync.RWMutex
	running       bool
	ctx           context.Context
	cancel        context.CancelFunc
	subscribers   map[chan Event]struct{}
	subscribersMu sync.RWMutex
}

// New creates a new EventStore instance
func New(cfg config.EventStoreConfig) (*EventStore, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// Create storage backend
	factory := StorageFactory{}
	storageConfig := StorageConfig{
		Type:             cfg.Storage.Type,
		Path:             cfg.Storage.Path,
		ConnectionString: cfg.Storage.ConnectionString,
		Options:          cfg.Storage.Options,
	}
	storage, err := factory.NewStorage(storageConfig)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create storage: %w", err)
	}

	es := &EventStore{
		config:      cfg,
		storage:     storage,
		actors:      make(map[string]*ActorState),
		running:     false,
		ctx:         ctx,
		cancel:      cancel,
		subscribers: make(map[chan Event]struct{}),
	}

	return es, nil
}

// Start begins the EventStore operation
func (es *EventStore) Start(ctx context.Context) error {
	// Open storage backend
	storageConfig := map[string]interface{}{
		"path":              es.config.Storage.Path,
		"connection_string": es.config.Storage.ConnectionString,
	}
	for k, v := range es.config.Storage.Options {
		storageConfig[k] = v
	}

	if err := es.storage.Open(ctx, storageConfig); err != nil {
		return fmt.Errorf("failed to open storage: %w", err)
	}

	es.running = true
	log.Printf("EventStore started with storage type: %s", es.config.Storage.Type)
	return nil
}

// Stop shuts down the EventStore
func (es *EventStore) Stop() {
	es.running = false
	es.cancel()

	// Close storage backend
	if es.storage != nil {
		if err := es.storage.Close(context.Background()); err != nil {
			log.Printf("Error closing storage: %v", err)
		}
	}

	log.Println("EventStore stopped")
}

// WriteEvent appends an event to an actor's event stream
// Ensures single-writer serialization per actor
func (es *EventStore) WriteEvent(ctx context.Context, event Event) (*WriteResult, error) {
	if !es.running {
		return nil, fmt.Errorf("eventstore not running")
	}

	// Set timestamp if not provided
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Write to storage backend
	if err := es.storage.WriteEvent(ctx, event); err != nil {
		return &WriteResult{
			AggregateID: event.AggregateID,
			Success:     false,
			Error:       err,
		}, nil
	}

	// Update actor state in memory
	es.actorsMu.Lock()
	actor, exists := es.actors[event.AggregateID]
	if !exists {
		actor = &ActorState{
			AggregateID:  event.AggregateID,
			LastSequence: 0,
		}
		es.actors[event.AggregateID] = actor
	}
	actor.LastSequence = event.Sequence
	actor.LastTimestamp = event.Timestamp
	es.actorsMu.Unlock()

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

	// Broadcast the event to all subscribers
	es.broadcastEvent(event)

	return result, nil
}

// ReadEvents reads events for an actor from a given sequence
func (es *EventStore) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64) ([]Event, error) {
	if !es.running {
		return nil, fmt.Errorf("eventstore not running")
	}

	return es.storage.ReadEvents(ctx, aggregateID, fromSeq, 0) // No limit
}

// GetActorState returns the current state of an actor
func (es *EventStore) GetActorState(aggregateID string) (*ActorState, error) {
	es.actorsMu.RLock()
	actor, exists := es.actors[aggregateID]
	es.actorsMu.RUnlock()

	if !exists {
		// Try to get from storage
		lastSeq, err := es.storage.GetLastSequence(context.Background(), aggregateID)
		if err != nil {
			return nil, fmt.Errorf("actor %s not found: %w", aggregateID, err)
		}

		// Create in-memory state
		actor = &ActorState{
			AggregateID:  aggregateID,
			LastSequence: lastSeq,
		}

		es.actorsMu.Lock()
		es.actors[aggregateID] = actor
		es.actorsMu.Unlock()
	}

	// Return a copy to prevent external modification
	state := *actor
	return &state, nil
}

// createSnapshot creates a snapshot for an actor
func (es *EventStore) createSnapshot(aggregateID string, sequence int64) error {
	// Get actor state
	actor, err := es.GetActorState(aggregateID)
	if err != nil {
		return fmt.Errorf("failed to get actor state: %w", err)
	}

	// Serialize actor state
	snapshotData, err := json.Marshal(actor)
	if err != nil {
		return fmt.Errorf("failed to marshal actor state: %w", err)
	}

	// Write snapshot to storage
	if err := es.storage.WriteSnapshot(context.Background(), aggregateID, sequence, snapshotData); err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}

	log.Printf("Created snapshot for actor %s at sequence %d", aggregateID, sequence)
	return nil
}

// Subscribe adds a new event listener.
// It returns a channel that will receive events.
func (es *EventStore) Subscribe() chan Event {
	es.subscribersMu.Lock()
	defer es.subscribersMu.Unlock()

	// Use a buffered channel to prevent blocking the event store if a subscriber is slow.
	ch := make(chan Event, 1000)
	es.subscribers[ch] = struct{}{}
	log.Println("New subscriber added to EventStore")
	return ch
}

// Unsubscribe removes an event listener.
func (es *EventStore) Unsubscribe(ch chan Event) {
	es.subscribersMu.Lock()
	defer es.subscribersMu.Unlock()

	delete(es.subscribers, ch)
	log.Println("Subscriber removed from EventStore")
}

// broadcastEvent sends an event to all subscribers.
func (es *EventStore) broadcastEvent(event Event) {
	es.subscribersMu.RLock()
	defer es.subscribersMu.RUnlock()

	for ch := range es.subscribers {
		select {
		case ch <- event:
		// Non-blocking send
		default:
			// This helps detect slow consumers without blocking the write path.
			log.Printf("Subscriber channel full. Dropping event for a subscriber.")
		}
	}
}

// GetAllEvents returns all events (for testing/debugging)
func (es *EventStore) GetAllEvents() []Event {
	// This is inefficient for production use - only for testing
	if memStorage, ok := es.storage.(*MemoryStorage); ok {
		return memStorage.GetAllEvents()
	}

	// For other storages, return empty slice (not implemented for performance)
	return []Event{}
}
