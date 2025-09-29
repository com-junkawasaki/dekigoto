package eventstore

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

// PostgreSQLStorage implements Storage interface using PostgreSQL
type PostgreSQLStorage struct {
	db *sql.DB
}

// NewPostgreSQLStorage creates a new PostgreSQL storage instance
func NewPostgreSQLStorage() *PostgreSQLStorage {
	return &PostgreSQLStorage{}
}

// Open initializes the PostgreSQL database connection
func (s *PostgreSQLStorage) Open(ctx context.Context, config map[string]interface{}) error {
	connStr, ok := config["connection_string"].(string)
	if !ok || connStr == "" {
		return fmt.Errorf("connection_string is required for PostgreSQL")
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open PostgreSQL database: %w", err)
	}

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping PostgreSQL database: %w", err)
	}

	// Create tables
	if err := s.createTables(ctx, db); err != nil {
		db.Close()
		return fmt.Errorf("failed to create tables: %w", err)
	}

	s.db = db

	// Configure connection pool
	s.db.SetMaxOpenConns(25)
	s.db.SetMaxIdleConns(25)

	return nil
}

// Close closes the database connection
func (s *PostgreSQLStorage) Close(ctx context.Context) error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// createTables creates the necessary tables
func (s *PostgreSQLStorage) createTables(ctx context.Context, db *sql.DB) error {
	// Create database if it doesn't exist (optional, usually done externally)
	// Events table
	eventsTable := `
	CREATE TABLE IF NOT EXISTS events (
		aggregate_id TEXT NOT NULL,
		sequence BIGINT NOT NULL,
		event_type TEXT NOT NULL,
		data BYTEA,
		timestamp TIMESTAMPTZ NOT NULL,
		event_time TIMESTAMPTZ,
		aggregate_type TEXT,
		metadata JSONB,
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
		data BYTEA,
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
func (s *PostgreSQLStorage) WriteEvent(ctx context.Context, event Event) error {
	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check sequence
	var expectedSeq int64
	err = tx.QueryRowContext(ctx, "SELECT last_sequence FROM sequences WHERE aggregate_id = $1", event.AggregateID).Scan(&expectedSeq)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to get last sequence: %w", err)
	}

	expectedSeq++ // Next expected sequence
	if event.Sequence != expectedSeq {
		return fmt.Errorf("sequence mismatch: expected %d, got %d for aggregate %s", expectedSeq, event.Sequence, event.AggregateID)
	}

	// Insert event
	_, err = tx.ExecContext(ctx, `
		INSERT INTO events (aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		event.AggregateID, event.Sequence, event.EventType, event.Data,
		event.Timestamp, event.EventTime, event.AggregateType, event.Metadata)
	if err != nil {
		return fmt.Errorf("failed to insert event: %w", err)
	}

	// Update sequence
	_, err = tx.ExecContext(ctx, `
		INSERT INTO sequences (aggregate_id, last_sequence)
		VALUES ($1, $2)
		ON CONFLICT (aggregate_id) DO UPDATE SET last_sequence = EXCLUDED.last_sequence`,
		event.AggregateID, event.Sequence)
	if err != nil {
		return fmt.Errorf("failed to update sequence: %w", err)
	}

	return tx.Commit()
}

// ReadEvents reads events for an aggregate
func (s *PostgreSQLStorage) ReadEvents(ctx context.Context, aggregateID string, fromSeq int64, limit int) ([]Event, error) {
	query := `
		SELECT aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata
		FROM events
		WHERE aggregate_id = $1 AND sequence >= $2
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
		var eventTime sql.NullTime

		err := rows.Scan(
			&event.AggregateID, &event.Sequence, &event.EventType, &event.Data,
			&event.Timestamp, &eventTime, &event.AggregateType, &event.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		if eventTime.Valid {
			event.EventTime = eventTime.Time
		}

		events = append(events, event)
	}

	return events, rows.Err()
}

// GetLastSequence returns the last sequence for an aggregate
func (s *PostgreSQLStorage) GetLastSequence(ctx context.Context, aggregateID string) (int64, error) {
	var seq int64
	err := s.db.QueryRowContext(ctx, "SELECT last_sequence FROM sequences WHERE aggregate_id = $1", aggregateID).Scan(&seq)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get last sequence: %w", err)
	}
	return seq, nil
}

// WriteSnapshot writes a snapshot
func (s *PostgreSQLStorage) WriteSnapshot(ctx context.Context, aggregateID string, sequence int64, data []byte) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO snapshots (aggregate_id, sequence, data, timestamp)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
		ON CONFLICT (aggregate_id) DO UPDATE SET
			sequence = EXCLUDED.sequence,
			data = EXCLUDED.data,
			timestamp = CURRENT_TIMESTAMP`,
		aggregateID, sequence, data)
	if err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}
	return nil
}

// ReadSnapshot reads a snapshot
func (s *PostgreSQLStorage) ReadSnapshot(ctx context.Context, aggregateID string) (int64, []byte, error) {
	var sequence int64
	var data []byte
	err := s.db.QueryRowContext(ctx, "SELECT sequence, data FROM snapshots WHERE aggregate_id = $1", aggregateID).Scan(&sequence, &data)
	if err == sql.ErrNoRows {
		return 0, nil, nil
	}
	if err != nil {
		return 0, nil, fmt.Errorf("failed to read snapshot: %w", err)
	}
	return sequence, data, nil
}

// Compact performs compaction (PostgreSQL handles this automatically with VACUUM)
func (s *PostgreSQLStorage) Compact(ctx context.Context) error {
	// Run VACUUM ANALYZE for PostgreSQL
	_, err := s.db.ExecContext(ctx, "VACUUM ANALYZE events, snapshots, sequences")
	if err != nil {
		return fmt.Errorf("failed to vacuum analyze: %w", err)
	}
	return nil
}

// GetStats returns storage statistics
func (s *PostgreSQLStorage) GetStats(ctx context.Context) (map[string]interface{}, error) {
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

	// Get database size
	var size int64
	err := s.db.QueryRowContext(ctx, "SELECT pg_database_size(current_database())").Scan(&size)
	if err == nil {
		stats["database_size_bytes"] = size
	}

	// Get connection stats
	stats["max_open_conns"] = s.db.Stats().MaxOpenConnections
	stats["open_conns"] = s.db.Stats().OpenConnections
	stats["in_use_conns"] = s.db.Stats().InUse

	return stats, nil
}

// WriteEventsBatch writes multiple events in a batch
func (s *PostgreSQLStorage) WriteEventsBatch(ctx context.Context, events []Event) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, event := range events {
		// Check sequence for each event
		var expectedSeq int64
		err = tx.QueryRowContext(ctx, "SELECT last_sequence FROM sequences WHERE aggregate_id = $1", event.AggregateID).Scan(&expectedSeq)
		if err != nil && err != sql.ErrNoRows {
			return fmt.Errorf("failed to get last sequence for %s: %w", event.AggregateID, err)
		}

		expectedSeq++
		if event.Sequence != expectedSeq {
			return fmt.Errorf("sequence mismatch for %s: expected %d, got %d", event.AggregateID, expectedSeq, event.Sequence)
		}

		// Insert event
		_, err = tx.ExecContext(ctx, `
			INSERT INTO events (aggregate_id, sequence, event_type, data, timestamp, event_time, aggregate_type, metadata)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			event.AggregateID, event.Sequence, event.EventType, event.Data,
			event.Timestamp, event.EventTime, event.AggregateType, event.Metadata)
		if err != nil {
			return fmt.Errorf("failed to insert event: %w", err)
		}

		// Update sequence
		_, err = tx.ExecContext(ctx, `
			INSERT INTO sequences (aggregate_id, last_sequence)
			VALUES ($1, $2)
			ON CONFLICT (aggregate_id) DO UPDATE SET last_sequence = EXCLUDED.last_sequence`,
			event.AggregateID, event.Sequence)
		if err != nil {
			return fmt.Errorf("failed to update sequence for %s: %w", event.AggregateID, err)
		}
	}

	return tx.Commit()
}
