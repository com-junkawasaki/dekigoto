package eventstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// SQLiteStorage implements Storage interface using SQLite
type SQLiteStorage struct {
	db *sql.DB
}

// NewSQLiteStorage creates a new SQLite storage instance
func NewSQLiteStorage() *SQLiteStorage {
	return &SQLiteStorage{}
}

// Open initializes the SQLite database
func (s *SQLiteStorage) Open(ctx context.Context, config map[string]interface{}) error {
	dbPath, ok := config["path"].(string)
	if !ok || dbPath == "" {
		dbPath = ":memory:"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open SQLite database: %w", err)
	}

	// Create tables
	if err := s.createTables(ctx, db); err != nil {
		db.Close()
		return fmt.Errorf("failed to create tables: %w", err)
	}

	s.db = db

	// Enable WAL mode for better concurrent access
	if _, err := s.db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return fmt.Errorf("failed to enable WAL mode: %w", err)
	}

	// Enable foreign keys
	if _, err := s.db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	return nil
}

// Close closes the database connection
func (s *SQLiteStorage) Close(ctx context.Context) error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// createTables creates the necessary tables
func (s *SQLiteStorage) createTables(ctx context.Context, db *sql.DB) error {
	// Events table
	eventsTable := `
	CREATE TABLE IF NOT EXISTS events (
		aggregate_id TEXT NOT NULL,
		sequence INTEGER NOT NULL,
		event_type TEXT NOT NULL,
		data BLOB,
		timestamp DATETIME NOT NULL,
		event_time DATETIME,
		aggregate_type TEXT,
		metadata TEXT,
		PRIMARY KEY (aggregate_id, sequence)
	);
	CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);
	CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
	CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
	`

	// Snapshots table
	snapshotsTable := `
	CREATE TABLE IF NOT EXISTS snapshots (
		aggregate_id TEXT PRIMARY KEY,
		sequence INTEGER NOT NULL,
		data BLOB,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`

	// Sequences table for tracking last sequence per aggregate
	sequencesTable := `
	CREATE TABLE IF NOT EXISTS sequences (
		aggregate_id TEXT PRIMARY KEY,
		last_sequence INTEGER NOT NULL DEFAULT 0
	);
	`

	tables := []string{eventsTable, snapshotsTable, sequencesTable}
	for _, table := range tables {
		if _, err := db.Exec(table); err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	return nil
}

// WriteEvent writes a single event
func (s *SQLiteStorage) WriteEvent(ctx context.Context, event Event) error {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check sequence
	var expectedSeq int64
	err = tx.QueryRow("SELECT last_sequence FROM sequences WHERE aggregate_id = ?", event.AggregateID).Scan(&expectedSeq)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to get last sequence: %w", err)
	}

	expectedSeq++ // Next expected sequence
	if event.Sequence != expectedSeq {
		return fmt.Errorf("sequence mismatch: expected %d, got %d for aggregate %s", expectedSeq, event.Sequence, event.AggregateID)
	}

	// Serialize metadata
	var metadataJSON []byte
	if event.Metadata != nil {
		metadataJSON, err = json.Marshal(event.Metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal metadata: %w", err)
		}
	}

	// Insert event
	_, err = tx.Exec(`
		INSERT INTO events (aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		event.AggregateID, event.Sequence, event.EventType, event.Data,
		event.Timestamp, event.EventTime, event.AggregateType, string(metadataJSON))
	if err != nil {
		return fmt.Errorf("failed to insert event: %w", err)
	}

	// Update sequence
	_, err = tx.Exec(`
		INSERT OR REPLACE INTO sequences (aggregate_id, last_sequence)
		VALUES (?, ?)`,
		event.AggregateID, event.Sequence)
	if err != nil {
		return fmt.Errorf("failed to update sequence: %w", err)
	}

	return tx.Commit()
}

// ReadEvents reads events for an aggregate
func (s *SQLiteStorage) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64, limit int) ([]Event, error) {
	query := `
		SELECT aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata
		FROM events
		WHERE aggregate_id = ? AND sequence >= ?
		ORDER BY sequence ASC`

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := s.db.QueryContext(ctx, query, aggregateID, fromSeq)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var event Event
		var metadataStr string
		var eventTime sql.NullTime

		err := rows.Scan(
			&event.AggregateID, &event.Sequence, &event.EventType, &event.Data,
			&event.Timestamp, &eventTime, &event.AggregateType, &metadataStr)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		if eventTime.Valid {
			event.EventTime = eventTime.Time
		}

		// Deserialize metadata
		if metadataStr != "" {
			err = json.Unmarshal([]byte(metadataStr), &event.Metadata)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

// GetLastSequence returns the last sequence for an aggregate
func (s *SQLiteStorage) GetLastSequence(ctx context.Context, aggregateID string) (int64, error) {
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
func (s *SQLiteStorage) WriteSnapshot(ctx context.Context, aggregateID string, sequence int64, data []byte) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO snapshots (aggregate_id, sequence, data, timestamp)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
		aggregateID, sequence, data)
	if err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}
	return nil
}

// ReadSnapshot reads a snapshot
func (s *SQLiteStorage) ReadSnapshot(ctx context.Context, aggregateID string) (int64, []byte, error) {
	var sequence int64
	var data []byte
	err := s.db.QueryRowContext(ctx, "SELECT sequence, data FROM snapshots WHERE aggregate_id = ?", aggregateID).Scan(&sequence, &data)
	if err == sql.ErrNoRows {
		return 0, nil, nil
	}
	if err != nil {
		return 0, nil, fmt.Errorf("failed to read snapshot: %w", err)
	}
	return sequence, data, nil
}

// Compact performs compaction (SQLite handles this automatically)
func (s *SQLiteStorage) Compact(ctx context.Context) error {
	// VACUUM for SQLite
	_, err := s.db.ExecContext(ctx, "VACUUM")
	if err != nil {
		return fmt.Errorf("failed to vacuum database: %w", err)
	}
	return nil
}

// GetStats returns storage statistics
func (s *SQLiteStorage) GetStats(ctx context.Context) (map[string]interface{}, error) {
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

	// Get database file size
	var pageSize, pageCount int64
	err := s.db.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize)
	if err == nil {
		err = s.db.QueryRowContext(ctx, "PRAGMA page_count").Scan(&pageCount)
		if err == nil {
			stats["file_size_bytes"] = pageSize * pageCount
		}
	}

	return stats, nil
}

// WriteEventsBatch writes multiple events in a batch
func (s *SQLiteStorage) WriteEventsBatch(ctx context.Context, events []Event) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, event := range events {
		// Check sequence for each event
		var expectedSeq int64
		err = tx.QueryRow("SELECT last_sequence FROM sequences WHERE aggregate_id = ?", event.AggregateID).Scan(&expectedSeq)
		if err != nil && err != sql.ErrNoRows {
			return fmt.Errorf("failed to get last sequence for %s: %w", event.AggregateID, err)
		}

		expectedSeq++
		if event.Sequence != expectedSeq {
			return fmt.Errorf("sequence mismatch for %s: expected %d, got %d", event.AggregateID, expectedSeq, event.Sequence)
		}

		// Serialize metadata
		var metadataJSON []byte
		if event.Metadata != nil {
			metadataJSON, err = json.Marshal(event.Metadata)
			if err != nil {
				return fmt.Errorf("failed to marshal metadata: %w", err)
			}
		}

		// Insert event
		_, err = tx.Exec(`
			INSERT INTO events (aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			event.AggregateID, event.Sequence, event.EventType, event.Data,
			event.Timestamp, event.EventTime, event.AggregateType, string(metadataJSON))
		if err != nil {
			return fmt.Errorf("failed to insert event: %w", err)
		}

		// Update sequence
		_, err = tx.Exec(`
			INSERT OR REPLACE INTO sequences (aggregate_id, last_sequence)
			VALUES (?, ?)`,
			event.AggregateID, event.Sequence)
		if err != nil {
			return fmt.Errorf("failed to update sequence for %s: %w", event.AggregateID, err)
		}
	}

	return tx.Commit()
}
