package test

import (
	"context"
	"testing"
	"time"

	"github.com/junkawasaki/actordb-dokigoto/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/internal/projector"
	"github.com/junkawasaki/actordb-dokigoto/internal/security"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

// TestMVPActorWrite tests basic actor-based event writing
func TestMVPActorWrite(t *testing.T) {
	cfg := config.EventStoreConfig{
		DataDir:             "/tmp/actordb_test",
		SnapshotInterval:    100,
		RetentionPeriod:     24 * time.Hour,
		Compression:         "none",
		MaxConcurrentWrites: 10,
	}

	es, err := eventstore.New(cfg)
	if err != nil {
		t.Fatalf("Failed to create eventstore: %v", err)
	}

	if err := es.Start(context.Background()); err != nil {
		t.Fatalf("Failed to start eventstore: %v", err)
	}
	defer es.Stop()

	// Test single-writer serialization
	event := eventstore.Event{
		AggregateID:   "order-123",
		Sequence:      1,
		EventType:     "order_created",
		Data:          []byte(`{"amount": 100.0}`),
		Timestamp:     time.Now(),
		AggregateType: "order",
	}

	result, err := es.WriteEvent(context.Background(), event)
	if err != nil {
		t.Fatalf("Failed to write event: %v", err)
	}

	if !result.Success {
		t.Fatalf("Write failed: %v", result.Error)
	}

	if result.Sequence != 1 {
		t.Errorf("Expected sequence 1, got %d", result.Sequence)
	}

	// Test sequence validation (should fail)
	invalidEvent := event
	invalidEvent.Sequence = 3 // Skip sequence 2

	result2, err := es.WriteEvent(context.Background(), invalidEvent)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if result2.Success {
		t.Error("Expected sequence validation to fail")
	}
}

// TestMVPProjectionIVM tests basic projection with IVM
func TestMVPProjectionIVM(t *testing.T) {
	esCfg := config.EventStoreConfig{
		DataDir:             "/tmp/actordb_test",
		SnapshotInterval:    100,
		RetentionPeriod:     24 * time.Hour,
		Compression:         "none",
		MaxConcurrentWrites: 10,
	}

	es, err := eventstore.New(esCfg)
	if err != nil {
		t.Fatalf("Failed to create eventstore: %v", err)
	}

	projCfg := config.ProjectionConfig{
		WorkerCount:             2,
		MaxMemoryMB:             100,
		AutoPromoteQPSThreshold: 1.0,
		AutoDemoteQPSThreshold:  0.1,
		LateWindowMs:            60000,
		WatermarkLagMs:          2000,
		MaxRebuildTimeSec:       30,
	}

	proj, err := projector.New(projCfg, es)
	if err != nil {
		t.Fatalf("Failed to create projector: %v", err)
	}

	if err := es.Start(context.Background()); err != nil {
		t.Fatalf("Failed to start eventstore: %v", err)
	}
	defer es.Stop()

	if err := proj.Start(context.Background()); err != nil {
		t.Fatalf("Failed to start projector: %v", err)
	}
	defer proj.Stop()

	// Register a simple projection
	def := &projector.ProjectionDefinition{
		Name: "orders_by_customer",
		Sources: []projector.SourceDefinition{
			{Stream: "order_created", Key: "customer_id"},
			{Stream: "order_cancelled", Key: "customer_id"},
		},
		StateSchema: map[string]interface{}{
			"customer_id":  "uuid",
			"orders":       "int",
			"total_amount": "decimal",
		},
	}

	if err := proj.RegisterProjection(def); err != nil {
		t.Fatalf("Failed to register projection: %v", err)
	}

	// Write some events
	event1 := eventstore.Event{
		AggregateID:   "order-123",
		Sequence:      1,
		EventType:     "order_created",
		Data:          []byte(`{"customer_id": "cust-1", "amount": 100.0}`),
		Timestamp:     time.Now(),
		AggregateType: "order",
	}

	if _, err := es.WriteEvent(context.Background(), event1); err != nil {
		t.Fatalf("Failed to write event: %v", err)
	}

	// Give projection time to process
	time.Sleep(100 * time.Millisecond)

	// Query the projection
	result, err := proj.Query(context.Background(), "orders_by_customer", nil)
	if err != nil {
		t.Fatalf("Failed to query projection: %v", err)
	}

	if result.Source != "ondemand" {
		t.Errorf("Expected ondemand source, got %s", result.Source)
	}
}

// TestMVPSecurity tests basic security validation
func TestMVPSecurity(t *testing.T) {
	cfg := config.SecurityConfig{
		MTLSEnabled:        false, // Disable for test
		JWTIssuer:          "test-issuer",
		JWTLifetimeSec:     300,
		AuditStreamEnabled: true,
		SPIFFETrustDomain:  "test.org",
	}

	sg, err := security.NewGateway(cfg)
	if err != nil {
		t.Fatalf("Failed to create security gateway: %v", err)
	}

	if err := sg.Start(context.Background()); err != nil {
		t.Fatalf("Failed to start security gateway: %v", err)
	}
	defer sg.Stop()

	// Test token validation
	result, err := sg.ValidateToken(context.Background(), "valid-token")
	if err != nil {
		t.Fatalf("Token validation error: %v", err)
	}

	if !result.Valid {
		t.Error("Expected token to be valid")
	}

	if result.Context == nil {
		t.Error("Expected security context")
	}

	// Test permission check
	if !sg.CheckPermission(result.Context, "test", "read") {
		t.Error("Expected permission check to pass")
	}
}

// BenchmarkMVPWrite benchmarks write performance (single-threaded per actor)
func BenchmarkMVPWrite(b *testing.B) {
	cfg := config.EventStoreConfig{
		DataDir:             "/tmp/actordb_bench",
		SnapshotInterval:    1000,
		RetentionPeriod:     24 * time.Hour,
		Compression:         "none",
		MaxConcurrentWrites: 100,
	}

	es, err := eventstore.New(cfg)
	if err != nil {
		b.Fatalf("Failed to create eventstore: %v", err)
	}

	if err := es.Start(context.Background()); err != nil {
		b.Fatalf("Failed to start eventstore: %v", err)
	}
	defer es.Stop()

	b.ResetTimer()

	// Single-threaded benchmark (actor-based single-writer constraint)
	seq := int64(1)
	for i := 0; i < b.N; i++ {
		event := eventstore.Event{
			AggregateID:   "bench-order",
			Sequence:      seq,
			EventType:     "order_created",
			Data:          []byte(`{"amount": 100.0}`),
			Timestamp:     time.Now(),
			AggregateType: "order",
		}

		result, err := es.WriteEvent(context.Background(), event)
		if err != nil || !result.Success {
			b.Errorf("Write failed: %v", err)
		}
		seq++
	}
}
