//go:build rocksdb
// +build rocksdb

package eventstore

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/tecbot/gorocksdb"
)

// RocksDBStorage implements Storage interface using RocksDB
type RocksDBStorage struct {
	db        *gorocksdb.DB
	opts      *gorocksdb.Options
	ro        *gorocksdb.ReadOptions
	wo        *gorocksdb.WriteOptions
	sequences sync.Map // aggregate_id -> last_sequence
}

// NewRocksDBStorage creates a new RocksDB storage instance
func NewRocksDBStorage() *RocksDBStorage {
	return &RocksDBStorage{}
}

// Open initializes the RocksDB database
func (s *RocksDBStorage) Open(ctx context.Context, config map[string]interface{}) error {
	dbPath, ok := config["path"].(string)
	if !ok || dbPath == "" {
		return fmt.Errorf("path is required for RocksDB")
	}

	// Create directory if it doesn't exist
	if err := ensureDir(dbPath); err != nil {
		return fmt.Errorf("failed to create RocksDB directory: %w", err)
	}

	// RocksDB options
	opts := gorocksdb.NewDefaultOptions()
	opts.SetCreateIfMissing(true)
	opts.SetMaxOpenFiles(-1) // Unlimited
	opts.SetMaxBackgroundJobs(4)

	// Performance tuning
	opts.SetWriteBufferSize(64 << 20) // 64MB
	opts.SetMaxWriteBufferNumber(3)
	opts.SetTargetFileSizeBase(64 << 20) // 64MB

	db, err := gorocksdb.OpenDb(opts, dbPath)
	if err != nil {
		return fmt.Errorf("failed to open RocksDB: %w", err)
	}

	s.db = db
	s.opts = opts
	s.ro = gorocksdb.NewDefaultReadOptions()
	s.wo = gorocksdb.NewDefaultWriteOptions()
	s.wo.SetSync(false) // Disable sync for performance

	// Load sequences from disk
	if err := s.loadSequences(); err != nil {
		s.Close(ctx)
		return fmt.Errorf("failed to load sequences: %w", err)
	}

	return nil
}

// Close closes the database
func (s *RocksDBStorage) Close(ctx context.Context) error {
	if s.wo != nil {
		s.wo.Destroy()
	}
	if s.ro != nil {
		s.ro.Destroy()
	}
	if s.opts != nil {
		s.opts.Destroy()
	}
	if s.db != nil {
		s.db.Close()
	}
	return nil
}

// WriteEvent writes a single event
func (s *RocksDBStorage) WriteEvent(ctx context.Context, event Event) error {
	// Check sequence
	expectedSeq, err := s.getExpectedSequence(event.AggregateID)
	if err != nil {
		return fmt.Errorf("failed to get expected sequence: %w", err)
	}

	if event.Sequence != expectedSeq {
		return fmt.Errorf("sequence mismatch: expected %d, got %d for aggregate %s", expectedSeq, event.Sequence, event.AggregateID)
	}

	// Serialize event
	eventData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Create keys
	eventKey := s.makeEventKey(event.AggregateID, event.Sequence)
	sequenceKey := s.makeSequenceKey(event.AggregateID)

	// Batch write
	batch := gorocksdb.NewWriteBatch()
	defer batch.Destroy()

	batch.Put(eventKey, eventData)
	batch.Put(sequenceKey, s.encodeSequence(event.Sequence))

	if err := s.db.Write(s.wo, batch); err != nil {
		return fmt.Errorf("failed to write batch: %w", err)
	}

	// Update in-memory sequence
	s.sequences.Store(event.AggregateID, event.Sequence)

	return nil
}

// ReadEvents reads events for an aggregate
func (s *RocksDBStorage) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64, limit int) ([]Event, error) {
	var events []Event

	// Create iterator for range scan
	prefix := s.makeAggregatePrefix(aggregateID)
	startKey := s.makeEventKey(aggregateID, fromSeq)

	iter := s.db.NewIterator(s.ro)
	defer iter.Close()

	for iter.Seek(startKey); iter.Valid() && (limit <= 0 || len(events) < limit); iter.Next() {
		key := iter.Key()
		defer key.Free()

		// Check if key matches aggregate prefix
		if !s.hasPrefix(key.Data(), prefix) {
			break
		}

		value := iter.Value()
		defer value.Free()

		var event Event
		if err := json.Unmarshal(value.Data(), &event); err != nil {
			return nil, fmt.Errorf("failed to unmarshal event: %w", err)
		}

		events = append(events, event)
	}

	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("iterator error: %w", err)
	}

	return events, nil
}

// GetLastSequence returns the last sequence for an aggregate
func (s *RocksDBStorage) GetLastSequence(ctx context.Context, aggregateID string) (int64, error) {
	if seq, ok := s.sequences.Load(aggregateID); ok {
		return seq.(int64), nil
	}
	return 0, nil
}

// WriteSnapshot writes a snapshot
func (s *RocksDBStorage) WriteSnapshot(ctx context.Context, aggregateID string, sequence int64, data []byte) error {
	snapshotKey := s.makeSnapshotKey(aggregateID)

	batch := gorocksdb.NewWriteBatch()
	defer batch.Destroy()

	// Store snapshot data with sequence
	snapshotValue, err := json.Marshal(map[string]interface{}{
		"sequence": sequence,
		"data":     data,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal snapshot: %w", err)
	}

	batch.Put(snapshotKey, snapshotValue)

	if err := s.db.Write(s.wo, batch); err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}

	return nil
}

// ReadSnapshot reads a snapshot
func (s *RocksDBStorage) ReadSnapshot(ctx context.Context, aggregateID string) (int64, []byte, error) {
	snapshotKey := s.makeSnapshotKey(aggregateID)

	value, err := s.db.Get(s.ro, snapshotKey)
	if err != nil {
		return 0, nil, fmt.Errorf("failed to read snapshot: %w", err)
	}
	defer value.Free()

	if !value.Exists() {
		return 0, nil, nil
	}

	var snapshot map[string]interface{}
	if err := json.Unmarshal(value.Data(), &snapshot); err != nil {
		return 0, nil, fmt.Errorf("failed to unmarshal snapshot: %w", err)
	}

	seq := int64(snapshot["sequence"].(float64))
	data := snapshot["data"].([]byte)

	return seq, data, nil
}

// Compact performs compaction
func (s *RocksDBStorage) Compact(ctx context.Context) error {
	// Compact entire database
	if err := s.db.CompactRange(gorocksdb.Range{}); err != nil {
		return fmt.Errorf("failed to compact database: %w", err)
	}
	return nil
}

// GetStats returns storage statistics
func (s *RocksDBStorage) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get property values
	properties := []string{
		"rocksdb.num-files-at-level0",
		"rocksdb.num-files-at-level1",
		"rocksdb.num-files-at-level2",
		"rocksdb.num-files-at-level3",
		"rocksdb.num-files-at-level4",
		"rocksdb.num-files-at-level5",
		"rocksdb.num-files-at-level6",
		"rocksdb.estimate-num-keys",
		"rocksdb.estimate-live-data-size",
		"rocksdb.size-all-mem-tables",
	}

	for _, prop := range properties {
		if value, err := s.db.GetProperty(prop); err == nil {
			stats[prop] = value
		}
	}

	// Count aggregates and events
	aggregateCount := 0
	eventCount := 0
	s.sequences.Range(func(key, value interface{}) bool {
		aggregateCount++
		eventCount += int(value.(int64))
		return true
	})
	stats["aggregates_count"] = aggregateCount
	stats["events_count"] = eventCount

	return stats, nil
}

// WriteEventsBatch writes multiple events in a batch
func (s *RocksDBStorage) WriteEventsBatch(ctx context.Context, events []Event) error {
	if len(events) == 0 {
		return nil
	}

	batch := gorocksdb.NewWriteBatch()
	defer batch.Destroy()

	// Group events by aggregate for sequence checking
	aggregateEvents := make(map[string][]Event)
	for _, event := range events {
		aggregateEvents[event.AggregateID] = append(aggregateEvents[event.AggregateID], event)
	}

	// Process each aggregate
	for aggregateID, aggEvents := range aggregateEvents {
		// Check sequences for this aggregate
		expectedSeq, err := s.getExpectedSequence(aggregateID)
		if err != nil {
			return fmt.Errorf("failed to get expected sequence for %s: %w", aggregateID, err)
		}

		for _, event := range aggEvents {
			if event.Sequence != expectedSeq {
				return fmt.Errorf("sequence mismatch for %s: expected %d, got %d", aggregateID, expectedSeq, event.Sequence)
			}

			// Serialize event
			eventData, err := json.Marshal(event)
			if err != nil {
				return fmt.Errorf("failed to marshal event: %w", err)
			}

			eventKey := s.makeEventKey(event.AggregateID, event.Sequence)
			batch.Put(eventKey, eventData)

			expectedSeq++
		}

		// Update sequence
		sequenceKey := s.makeSequenceKey(aggregateID)
		batch.Put(sequenceKey, s.encodeSequence(expectedSeq-1))

		// Update in-memory sequence
		s.sequences.Store(aggregateID, expectedSeq-1)
	}

	if err := s.db.Write(s.wo, batch); err != nil {
		return fmt.Errorf("failed to write batch: %w", err)
	}

	return nil
}

// Helper methods

func (s *RocksDBStorage) getExpectedSequence(aggregateID string) (int64, error) {
	if seq, ok := s.sequences.Load(aggregateID); ok {
		return seq.(int64) + 1, nil
	}
	return 1, nil // First event
}

func (s *RocksDBStorage) makeEventKey(aggregateID string, sequence int64) []byte {
	// Format: e:{aggregate_id}:{sequence}
	key := fmt.Sprintf("e:%s:%020d", aggregateID, sequence)
	return []byte(key)
}

func (s *RocksDBStorage) makeSequenceKey(aggregateID string) []byte {
	// Format: s:{aggregate_id}
	key := fmt.Sprintf("s:%s", aggregateID)
	return []byte(key)
}

func (s *RocksDBStorage) makeSnapshotKey(aggregateID string) []byte {
	// Format: p:{aggregate_id}
	key := fmt.Sprintf("p:%s", aggregateID)
	return []byte(key)
}

func (s *RocksDBStorage) makeAggregatePrefix(aggregateID string) []byte {
	// Format: e:{aggregate_id}:
	return []byte(fmt.Sprintf("e:%s:", aggregateID))
}

func (s *RocksDBStorage) hasPrefix(data []byte, prefix []byte) bool {
	if len(data) < len(prefix) {
		return false
	}
	for i, b := range prefix {
		if data[i] != b {
			return false
		}
	}
	return true
}

func (s *RocksDBStorage) encodeSequence(seq int64) []byte {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(seq))
	return buf
}

func (s *RocksDBStorage) loadSequences() error {
	// Scan all sequence keys
	iter := s.db.NewIterator(s.ro)
	defer iter.Close()

	prefix := []byte("s:")
	for iter.Seek(prefix); iter.Valid() && s.hasPrefix(iter.Key().Data(), prefix); iter.Next() {
		key := iter.Key()
		value := iter.Value()

		aggregateID := string(key.Data()[2:]) // Remove "s:" prefix
		seq := int64(binary.BigEndian.Uint64(value.Data()))

		s.sequences.Store(aggregateID, seq)

		key.Free()
		value.Free()
	}

	return iter.Err()
}
