package eventstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/tursodatabase/libsql-client-go/libsql"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

// LibSQLStorage implements Storage interface using libSQL
// libSQL is a fork of SQLite with additional features like embedded replicas
type LibSQLStorage struct {
	db *sql.DB
}

// NewLibSQLStorage creates a new libSQL storage instance
func NewLibSQLStorage() *LibSQLStorage {
	return &LibSQLStorage{}
}

// Open initializes the libSQL database connection
// Supports both local SQLite files and remote libSQL servers
func (s *LibSQLStorage) Open(ctx context.Context, config map[string]interface{}) error {
	// libSQL supports multiple connection types:
	// 1. Local SQLite file: "file:./local.db"
	// 2. Remote libSQL server: "libsql://..."
	// 3. In-memory: ":memory:"

	var dbPath string
	if path, ok := config["path"].(string); ok && path != "" {
		dbPath = fmt.Sprintf("file:%s", path)
	} else if connStr, ok := config["connection_string"].(string); ok && connStr != "" {
		dbPath = connStr // Can be libsql:// URL for remote connection
	} else {
		dbPath = ":memory:"
	}

	// libSQL uses the standard sql.Open with libsql driver
	db, err := sql.Open("libsql", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open libSQL database: %w", err)
	}

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping libSQL database: %w", err)
	}

	// Create tables if they don't exist
	if err := s.createTables(ctx, db); err != nil {
		db.Close()
		return fmt.Errorf("failed to create tables: %w", err)
	}

	s.db = db

	// Configure connection pool for better performance
	s.db.SetMaxOpenConns(25)
	s.db.SetMaxIdleConns(25)

	return nil
}

// Close closes the database connection
func (s *LibSQLStorage) Close(ctx context.Context) error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// createTables creates the necessary tables
// libSQL is fully compatible with SQLite schema
func (s *LibSQLStorage) createTables(ctx context.Context, db *sql.DB) error {
	// Events table - same as SQLite implementation
	eventsTable := `
	CREATE TABLE IF NOT EXISTS events (
		aggregate_id TEXT NOT NULL,
		sequence BIGINT NOT NULL,
		event_type TEXT NOT NULL,
		data TEXT,  -- libSQL handles JSON better than BYTEA
		timestamp TIMESTAMPTZ NOT NULL,
		event_time TIMESTAMPTZ,
		aggregate_type TEXT,
		metadata JSON,  -- libSQL has native JSON support
		PRIMARY KEY (aggregate_id, sequence)
	);

	CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);
	CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
	CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
	CREATE INDEX IF NOT EXISTS idx_events_event_time ON events(event_time) WHERE event_time IS NOT NULL;
	`

	// Snapshots table
	snapshotsTable := `
	CREATE TABLE IF NOT EXISTS snapshots (
		aggregate_id TEXT PRIMARY KEY,
		sequence BIGINT NOT NULL,
		data TEXT,  -- Store as JSON for better libSQL compatibility
		timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
	);
	`

	// Sequences table for tracking last sequence per aggregate
	sequencesTable := `
	CREATE TABLE IF NOT EXISTS sequences (
		aggregate_id TEXT PRIMARY KEY,
		last_sequence BIGINT NOT NULL DEFAULT 0
	);
	`

	tables := []string{eventsTable, snapshotsTable, sequencesTable}
	for _, table := range tables {
		if _, err := db.ExecContext(ctx, table); err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	return nil
}

// WriteEvent writes a single event
func (s *LibSQLStorage) WriteEvent(ctx context.Context, event Event) error {
	// Start transaction for atomicity
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check sequence
	var expectedSeq int64
	err = tx.QueryRowContext(ctx, "SELECT last_sequence FROM sequences WHERE aggregate_id = ?", event.AggregateID).Scan(&expectedSeq)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to get last sequence: %w", err)
	}

	expectedSeq++ // Next expected sequence
	if event.Sequence != expectedSeq {
		return fmt.Errorf("sequence mismatch: expected %d, got %d for aggregate %s", expectedSeq, event.Sequence, event.AggregateID)
	}

	// Serialize data and metadata for JSON storage
	dataJSON, err := json.Marshal(event.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	// Insert event - use JSON columns for better libSQL compatibility
	_, err = tx.ExecContext(ctx, `
		INSERT INTO events (aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		event.AggregateID, event.Sequence, event.EventType, string(dataJSON),
		event.Timestamp, event.EventTime, event.AggregateType, event.Metadata)
	if err != nil {
		return fmt.Errorf("failed to insert event: %w", err)
	}

	// Update sequence
	_, err = tx.ExecContext(ctx, `
		INSERT OR REPLACE INTO sequences (aggregate_id, last_sequence)
		VALUES (?, ?)`,
		event.AggregateID, event.Sequence)
	if err != nil {
		return fmt.Errorf("failed to update sequence: %w", err)
	}

	return tx.Commit()
}

// ReadEvents reads events for an aggregate
func (s *LibSQLStorage) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64, limit int) ([]Event, error) {
	query := `
		SELECT aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata
		FROM events
		WHERE aggregate_id = ?
		AND sequence >= ?
		ORDER BY sequence ASC`

	args := []interface{}{aggregateID, fromSeq}
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var event Event
		var dataStr string
		var eventTime sql.NullTime

		err := rows.Scan(
			&event.AggregateID, &event.Sequence, &event.EventType, &dataStr,
			&event.Timestamp, &eventTime, &event.AggregateType, &event.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		if eventTime.Valid {
			event.EventTime = eventTime.Time
		}

		// Deserialize JSON data
		if dataStr != "" {
			err = json.Unmarshal([]byte(dataStr), &event.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal event data: %w", err)
			}
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

// GetLastSequence returns the last sequence for an aggregate
func (s *LibSQLStorage) GetLastSequence(ctx context.Context, aggregateID string) (int64, error) {
	var seq int64
	err := s.db.QueryRowContext(ctx, "SELECT last_sequence FROM sequences WHERE aggregate_id = ?", aggregateID).Scan(&seq)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get last sequence: %w", err)
	}
	return seq, nil
}

// WriteSnapshot writes a snapshot
func (s *LibSQLStorage) WriteSnapshot(ctx context.Context, aggregateID string, sequence int64, data []byte) error {
	// Store snapshot data as JSON for better libSQL compatibility
	snapshotJSON, err := json.Marshal(map[string]interface{}{
		"sequence": sequence,
		"data":     data,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal snapshot: %w", err)
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO snapshots (aggregate_id, sequence, data, timestamp)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
		aggregateID, sequence, string(snapshotJSON))
	if err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}
	return nil
}

// ReadSnapshot reads a snapshot
func (s *LibSQLStorage) ReadSnapshot(ctx context.Context, aggregateID string) (int64, []byte, error) {
	var sequence int64
	var dataStr string
	err := s.db.QueryRowContext(ctx, "SELECT sequence, data FROM snapshots WHERE aggregate_id = ?", aggregateID).Scan(&sequence, &dataStr)
	if err == sql.ErrNoRows {
		return 0, nil, nil
	}
	if err != nil {
		return 0, nil, fmt.Errorf("failed to read snapshot: %w", err)
	}

	// Deserialize JSON snapshot data
	var snapshot map[string]interface{}
	if err := json.Unmarshal([]byte(dataStr), &snapshot); err != nil {
		return 0, nil, fmt.Errorf("failed to unmarshal snapshot: %w", err)
	}

	seq := int64(snapshot["sequence"].(float64))
	dataBytes := []byte(snapshot["data"].(string)) // JSON unmarshals bytes as string

	return seq, dataBytes, nil
}

// Compact performs compaction
// libSQL handles compaction automatically like SQLite
func (s *LibSQLStorage) Compact(ctx context.Context) error {
	// Run VACUUM ANALYZE for libSQL (compatible with SQLite)
	_, err := s.db.ExecContext(ctx, "VACUUM ANALYZE events, snapshots, sequences")
	if err != nil {
		return fmt.Errorf("failed to vacuum analyze: %w", err)
	}
	return nil
}

// GetStats returns storage statistics
func (s *LibSQLStorage) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get table sizes
	tables := []string{"events", "snapshots", "sequences"}
	for _, table := range tables {
		var count int64
		err := s.db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
		if err != nil {
			return nil, fmt.Errorf("failed to get %s count: %w", table, err)
		}
		stats[fmt.Sprintf("%s_count", table)] = count
	}

	// Get database size (approximate)
	var pageSize, pageCount int64
	err := s.db.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize)
	if err == nil {
		err = s.db.QueryRowContext(ctx, "PRAGMA page_count").Scan(&pageCount)
		if err == nil {
			stats["database_size_bytes"] = pageSize * pageCount
		}
	}

	// libSQL specific stats
	stats["driver"] = "libsql"
	stats["connection_pool_max_open"] = s.db.Stats().MaxOpenConnections
	stats["connection_pool_open"] = s.db.Stats().OpenConnections

	return stats, nil
}

// WriteEventsBatch writes multiple events in a batch
func (s *LibSQLStorage) WriteEventsBatch(ctx context.Context, events []Event) error {
	if len(events) == 0 {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, event := range events {
		// Check sequence for each event
		var expectedSeq int64
		err = tx.QueryRowContext(ctx, "SELECT last_sequence FROM sequences WHERE aggregate_id = ?", event.AggregateID).Scan(&expectedSeq)
		if err != nil && err != sql.ErrNoRows {
			return fmt.Errorf("failed to get last sequence for %s: %w", event.AggregateID, err)
		}

		expectedSeq++
		if event.Sequence != expectedSeq {
			return fmt.Errorf("sequence mismatch for %s: expected %d, got %d", event.AggregateID, expectedSeq, event.Sequence)
		}

		// Serialize data for JSON storage
		dataJSON, err := json.Marshal(event.Data)
		if err != nil {
			return fmt.Errorf("failed to marshal event data: %w", err)
		}

		// Insert event
		_, err = tx.ExecContext(ctx, `
			INSERT INTO events (aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			event.AggregateID, event.Sequence, event.EventType, string(dataJSON),
			event.Timestamp, event.EventTime, event.AggregateType, event.Metadata)
		if err != nil {
			return fmt.Errorf("failed to insert event: %w", err)
		}

		// Update sequence
		_, err = tx.ExecContext(ctx, `
			INSERT OR REPLACE INTO sequences (aggregate_id, last_sequence)
			VALUES (?, ?)`,
			event.AggregateID, event.Sequence)
		if err != nil {
			return fmt.Errorf("failed to update sequence for %s: %w", event.AggregateID, err)
		}
	}

	return tx.Commit()
}
