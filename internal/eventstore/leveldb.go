//go:build leveldb
// +build leveldb

package eventstore

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/util"
)

// LevelDBStorage implements Storage interface using LevelDB
type LevelDBStorage struct {
	db        *leveldb.DB
	sequences sync.Map // aggregate_id -> last_sequence
}

// NewLevelDBStorage creates a new LevelDB storage instance
func NewLevelDBStorage() *LevelDBStorage {
	return &LevelDBStorage{}
}

// Open initializes the LevelDB database
func (s *LevelDBStorage) Open(ctx context.Context, config map[string]interface{}) error {
	dbPath, ok := config["path"].(string)
	if !ok || dbPath == "" {
		return fmt.Errorf("path is required for LevelDB")
	}

	// LevelDB options
	opts := &opt.Options{
		NoSync: false, // Enable sync for durability
	}

	db, err := leveldb.OpenFile(dbPath, opts)
	if err != nil {
		return fmt.Errorf("failed to open LevelDB: %w", err)
	}

	s.db = db

	// Load sequences from disk
	if err := s.loadSequences(); err != nil {
		s.Close(ctx)
		return fmt.Errorf("failed to load sequences: %w", err)
	}

	return nil
}

// Close closes the database
func (s *LevelDBStorage) Close(ctx context.Context) error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// WriteEvent writes a single event
func (s *LevelDBStorage) WriteEvent(ctx context.Context, event Event) error {
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
	batch := new(leveldb.Batch)

	batch.Put(eventKey, eventData)
	batch.Put(sequenceKey, s.encodeSequence(event.Sequence))

	if err := s.db.Write(batch, nil); err != nil {
		return fmt.Errorf("failed to write batch: %w", err)
	}

	// Update in-memory sequence
	s.sequences.Store(event.AggregateID, event.Sequence)

	return nil
}

// ReadEvents reads events for an aggregate
func (s *LevelDBStorage) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64, limit int) ([]Event, error) {
	var events []Event

	// Create range for iteration
	prefix := s.makeAggregatePrefix(aggregateID)
	startKey := s.makeEventKey(aggregateID, fromSeq)

	r := util.BytesPrefix(prefix)
	iter := s.db.NewIterator(r, nil)
	defer iter.Release()

	// Seek to start position
	for ok := iter.Seek(startKey); ok && (limit <= 0 || len(events) < limit); ok = iter.Next() {
		key := iter.Key()
		value := iter.Value()

		// Parse sequence from key to ensure ordering
		seq := s.parseSequenceFromEventKey(key)
		if seq < fromSeq {
			continue
		}

		var event Event
		if err := json.Unmarshal(value, &event); err != nil {
			return nil, fmt.Errorf("failed to unmarshal event: %w", err)
		}

		events = append(events, event)
	}

	if err := iter.Error(); err != nil {
		return nil, fmt.Errorf("iterator error: %w", err)
	}

	return events, nil
}

// GetLastSequence returns the last sequence for an aggregate
func (s *LevelDBStorage) GetLastSequence(ctx context.Context, aggregateID string) (int64, error) {
	if seq, ok := s.sequences.Load(aggregateID); ok {
		return seq.(int64), nil
	}
	return 0, nil
}

// WriteSnapshot writes a snapshot
func (s *LevelDBStorage) WriteSnapshot(ctx context.Context, aggregateID string, sequence int64, data []byte) error {
	snapshotKey := s.makeSnapshotKey(aggregateID)

	// Store snapshot data with sequence
	snapshotValue, err := json.Marshal(map[string]interface{}{
		"sequence": sequence,
		"data":     data,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal snapshot: %w", err)
	}

	if err := s.db.Put(snapshotKey, snapshotValue, nil); err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}

	return nil
}

// ReadSnapshot reads a snapshot
func (s *LevelDBStorage) ReadSnapshot(ctx context.Context, aggregateID string) (int64, []byte, error) {
	snapshotKey := s.makeSnapshotKey(aggregateID)

	value, err := s.db.Get(snapshotKey, nil)
	if err != nil {
		if err == leveldb.ErrNotFound {
			return 0, nil, nil
		}
		return 0, nil, fmt.Errorf("failed to read snapshot: %w", err)
	}

	var snapshot map[string]interface{}
	if err := json.Unmarshal(value, &snapshot); err != nil {
		return 0, nil, fmt.Errorf("failed to unmarshal snapshot: %w", err)
	}

	seq := int64(snapshot["sequence"].(float64))
	data := []byte(snapshot["data"].(string)) // JSON unmarshals bytes as string

	return seq, data, nil
}

// Compact performs compaction (LevelDB handles this automatically)
func (s *LevelDBStorage) Compact(ctx context.Context) error {
	// LevelDB doesn't have explicit compaction, but we can optimize
	if err := s.db.CompactRange(util.Range{}); err != nil {
		return fmt.Errorf("failed to compact database: %w", err)
	}
	return nil
}

// GetStats returns storage statistics
func (s *LevelDBStorage) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get stats from leveldb (limited API)
	st := s.db.Stats()
	stats["leveldb"] = st.String()

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
func (s *LevelDBStorage) WriteEventsBatch(ctx context.Context, events []Event) error {
	if len(events) == 0 {
		return nil
	}

	// Group events by aggregate for sequence checking
	aggregateEvents := make(map[string][]Event)
	for _, event := range events {
		aggregateEvents[event.AggregateID] = append(aggregateEvents[event.AggregateID], event)
	}

	// Process each aggregate
	batch := new(leveldb.Batch)

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

	if err := s.db.Write(batch, nil); err != nil {
		return fmt.Errorf("failed to write batch: %w", err)
	}

	return nil
}

// Helper methods

func (s *LevelDBStorage) getExpectedSequence(aggregateID string) (int64, error) {
	if seq, ok := s.sequences.Load(aggregateID); ok {
		return seq.(int64) + 1, nil
	}
	return 1, nil // First event
}

func (s *LevelDBStorage) makeEventKey(aggregateID string, sequence int64) []byte {
	// Format: e:{aggregate_id}:{sequence}
	key := fmt.Sprintf("e:%s:%020d", aggregateID, sequence)
	return []byte(key)
}

func (s *LevelDBStorage) makeSequenceKey(aggregateID string) []byte {
	// Format: s:{aggregate_id}
	key := fmt.Sprintf("s:%s", aggregateID)
	return []byte(key)
}

func (s *LevelDBStorage) makeSnapshotKey(aggregateID string) []byte {
	// Format: p:{aggregate_id}
	key := fmt.Sprintf("p:%s", aggregateID)
	return []byte(key)
}

func (s *LevelDBStorage) makeAggregatePrefix(aggregateID string) []byte {
	// Format: e:{aggregate_id}:
	return []byte(fmt.Sprintf("e:%s:", aggregateID))
}

func (s *LevelDBStorage) encodeSequence(seq int64) []byte {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(seq))
	return buf
}

func (s *LevelDBStorage) parseSequenceFromEventKey(key []byte) int64 {
	// Extract sequence from key format: e:{aggregate_id}:{sequence}
	keyStr := string(key)
	// Find last colon
	lastColon := 0
	for i := len(keyStr) - 1; i >= 0; i-- {
		if keyStr[i] == ':' {
			lastColon = i
			break
		}
	}
	if lastColon == 0 {
		return 0
	}

	seqStr := keyStr[lastColon+1:]
	var seq int64
	for _, c := range seqStr {
		if c >= '0' && c <= '9' {
			seq = seq*10 + int64(c-'0')
		}
	}
	return seq
}

func (s *LevelDBStorage) loadSequences() error {
	// Scan all sequence keys
	r := util.BytesPrefix([]byte("s:"))
	iter := s.db.NewIterator(r, nil)
	defer iter.Release()

	for iter.Next() {
		key := iter.Key()
		value := iter.Value()

		aggregateID := string(key[2:]) // Remove "s:" prefix
		seq := int64(binary.BigEndian.Uint64(value))

		s.sequences.Store(aggregateID, seq)
	}

	return iter.Error()
}
