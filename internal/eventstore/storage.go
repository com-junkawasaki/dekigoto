package eventstore

import (
	"context"
	"fmt"
	"sync"
)

// Storage defines the interface for event storage backends
// This abstraction allows different storage engines (SQLite, PostgreSQL, RocksDB, LevelDB)
type Storage interface {
	// Lifecycle methods
	Open(ctx context.Context, config map[string]interface{}) error
	Close(ctx context.Context) error

	// Event operations
	WriteEvent(ctx context.Context, event Event) error
	ReadEvents(ctx context.Context, aggregateID string, fromSeq int64, limit int) ([]Event, error)
	GetLastSequence(ctx context.Context, aggregateID string) (int64, error)

	// Snapshot operations
	WriteSnapshot(ctx context.Context, aggregateID string, sequence int64, data []byte) error
	ReadSnapshot(ctx context.Context, aggregateID string) (sequence int64, data []byte, err error)

	// Maintenance operations
	Compact(ctx context.Context) error
	GetStats(ctx context.Context) (map[string]interface{}, error)

	// Batch operations for performance
	WriteEventsBatch(ctx context.Context, events []Event) error
}

// StorageConfig contains configuration for storage backends
type StorageConfig struct {
	Type             string                 `yaml:"type"` // sqlite, postgresql, rocksdb, leveldb
	Path             string                 `yaml:"path,omitempty"`
	ConnectionString string                 `yaml:"connection_string,omitempty"`
	Options          map[string]interface{} `yaml:"options,omitempty"`
}

// StorageFactory creates storage instances based on type
type StorageFactory struct{}

// NewStorage creates a storage instance based on configuration
func (f *StorageFactory) NewStorage(config StorageConfig) (Storage, error) {
	switch config.Type {
	case "sqlite":
		return NewSQLiteStorage(), nil
	case "postgresql":
		return NewPostgreSQLStorage(), nil
	case "memory":
		return NewMemoryStorage(), nil
	default:
		return NewMemoryStorage(), nil // Default to memory for MVP
	}
}

// MemoryStorage implements in-memory storage for MVP/testing
type MemoryStorage struct {
	events    map[string][]Event
	snapshots map[string]SnapshotData
	sequences map[string]int64
	mu        sync.RWMutex
}

type SnapshotData struct {
	Sequence int64
	Data     []byte
}

// NewMemoryStorage creates a new in-memory storage
func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		events:    make(map[string][]Event),
		snapshots: make(map[string]SnapshotData),
		sequences: make(map[string]int64),
	}
}

// Open implements Storage
func (m *MemoryStorage) Open(ctx context.Context, config map[string]interface{}) error {
	return nil
}

// Close implements Storage
func (m *MemoryStorage) Close(ctx context.Context) error {
	return nil
}

// WriteEvent implements Storage
func (m *MemoryStorage) WriteEvent(ctx context.Context, event Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if events, exists := m.events[event.AggregateID]; exists {
		// Check sequence
		if len(events) > 0 && event.Sequence != events[len(events)-1].Sequence+1 {
			return fmt.Errorf("sequence mismatch for aggregate %s", event.AggregateID)
		}
	} else {
		// First event for this aggregate
		if event.Sequence != 1 {
			return fmt.Errorf("first event must have sequence 1 for aggregate %s", event.AggregateID)
		}
	}

	m.events[event.AggregateID] = append(m.events[event.AggregateID], event)
	m.sequences[event.AggregateID] = event.Sequence

	return nil
}

// ReadEvents implements Storage
func (m *MemoryStorage) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64, limit int) ([]Event, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	events, exists := m.events[aggregateID]
	if !exists {
		return []Event{}, nil
	}

	var result []Event
	for _, event := range events {
		if event.Sequence >= fromSeq {
			result = append(result, event)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}

	return result, nil
}

// GetLastSequence implements Storage
func (m *MemoryStorage) GetLastSequence(ctx context.Context, aggregateID string) (int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if seq, exists := m.sequences[aggregateID]; exists {
		return seq, nil
	}
	return 0, nil
}

// WriteSnapshot implements Storage
func (m *MemoryStorage) WriteSnapshot(ctx context.Context, aggregateID string, sequence int64, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.snapshots[aggregateID] = SnapshotData{
		Sequence: sequence,
		Data:     data,
	}
	return nil
}

// ReadSnapshot implements Storage
func (m *MemoryStorage) ReadSnapshot(ctx context.Context, aggregateID string) (int64, []byte, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if snapshot, exists := m.snapshots[aggregateID]; exists {
		return snapshot.Sequence, snapshot.Data, nil
	}
	return 0, nil, nil
}

// Compact implements Storage
func (m *MemoryStorage) Compact(ctx context.Context) error {
	return nil
}

// GetStats implements Storage
func (m *MemoryStorage) GetStats(ctx context.Context) (map[string]interface{}, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return map[string]interface{}{
		"total_aggregates": len(m.events),
		"total_events":     m.countTotalEvents(),
		"memory_usage":     "unknown",
	}, nil
}

func (m *MemoryStorage) countTotalEvents() int {
	count := 0
	for _, events := range m.events {
		count += len(events)
	}
	return count
}

// WriteEventsBatch implements Storage
func (m *MemoryStorage) WriteEventsBatch(ctx context.Context, events []Event) error {
	for _, event := range events {
		if err := m.WriteEvent(ctx, event); err != nil {
			return err
		}
	}
	return nil
}

// GetAllEvents returns all events (for testing/debugging)
func (m *MemoryStorage) GetAllEvents() []Event {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var allEvents []Event
	for _, events := range m.events {
		allEvents = append(allEvents, events...)
	}
	return allEvents
}
