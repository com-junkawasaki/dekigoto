package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/junkawasaki/actordb-dokigoto/impl/go/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/impl/go/internal/eventstore/storage"
	"github.com/junkawasaki/actordb-dokigoto/impl/go/internal/eventstore/storage/postgresql"
	"github.com/junkawasaki/actordb-dokigoto/impl/go/pkg/config"
)

// Merkle DAG: migration_tool -> data_transfer
// Process Network: eventstore -> supabase_migration
// Migrate ActorDB events to Supabase PostgreSQL

type SupabaseEvent struct {
	AggregateID   string                 `json:"aggregate_id"`
	Sequence      int64                  `json:"sequence"`
	EventType     string                 `json:"event_type"`
	Data          json.RawMessage        `json:"data"`
	Timestamp     string                 `json:"timestamp"`
	EventTime     string                 `json:"event_time"`
	AggregateType string                 `json:"aggregate_type"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

func main() {
	if len(os.Args) < 4 {
		log.Fatal("Usage: migration <source_config> <supabase_url> <supabase_key>")
	}

	sourceConfigPath := os.Args[1]
	supabaseURL := os.Args[2]
	supabaseKey := os.Args[3]

	// Load ActorDB configuration
	cfg, err := config.Load(sourceConfigPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Create ActorDB eventstore
	es, err := eventstore.New(cfg.EventStore)
	if err != nil {
		log.Fatalf("Failed to create eventstore: %v", err)
	}

	// Start eventstore
	ctx := context.Background()
	if err := es.Start(ctx); err != nil {
		log.Fatalf("Failed to start eventstore: %v", err)
	}
	defer es.Stop()

	// Create Supabase storage connection
	supabaseConfig := map[string]interface{}{
		"connection_string": fmt.Sprintf("postgres://postgres:%s@%s:5432/postgres", supabaseKey, supabaseURL),
	}

	supabaseStorage, err := postgresql.NewPostgreSQLStorage()
	if err != nil {
		log.Fatalf("Failed to create Supabase storage: %v", err)
	}

	if err := supabaseStorage.Open(ctx, supabaseConfig); err != nil {
		log.Fatalf("Failed to connect to Supabase: %v", err)
	}
	defer supabaseStorage.Close(ctx)

	// Migrate all events
	if err := migrateAllEvents(ctx, es, supabaseStorage); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Migration completed successfully!")
}

func migrateAllEvents(ctx context.Context, source *eventstore.EventStore, target storage.Storage) error {
	// Get all events from ActorDB
	events := source.GetAllEvents()
	if len(events) == 0 {
		log.Println("No events found in source database")
		return nil
	}

	log.Printf("Found %d events to migrate", len(events))

	// Migrate events one by one
	migrated := 0
	for _, event := range events {
		if err := target.WriteEvent(ctx, event); err != nil {
			log.Printf("Failed to migrate event %s:%d: %v", event.AggregateID, event.Sequence, err)
			continue
		}
		migrated++
	}

	log.Printf("Successfully migrated %d/%d events", migrated, len(events))
	return nil
}
