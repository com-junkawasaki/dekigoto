package test

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"sync/atomic"

	"github.com/junkawasaki/actordb-dokigoto/internal/eventstore"
	"github.com/junkawasaki/actordb-dokigoto/internal/projector"
	"github.com/junkawasaki/actordb-dokigoto/pkg/config"
)

// setupTestEnvironment initializes the core components for benchmarking.
// This helper function reduces boilerplate in benchmark functions.
func setupTestEnvironment(b *testing.B) (*eventstore.EventStore, *projector.ProjectionEngine) {
	// Use in-memory storage for benchmarks to isolate component performance
	// from disk I/O.
	esCfg := config.EventStoreConfig{
		Storage: config.StorageConfig{
			Type: "memory",
		},
		SnapshotInterval: 1000,
	}
	es, err := eventstore.New(esCfg)
	if err != nil {
		b.Fatalf("Failed to create EventStore: %v", err)
	}
	es.Start(context.Background())

	projCfg := config.ProjectionConfig{
		WorkerCount:             4,
		AutoPromoteQPSThreshold: 1000, // High threshold to prevent auto-promotion during tests
	}
	proj, err := projector.New(projCfg, es)
	if err != nil {
		b.Fatalf("Failed to create ProjectionEngine: %v", err)
	}
	proj.Start(context.Background())

	// Register a simple projection for testing
	projDef := &projector.ProjectionDefinition{
		Name: "order_counts",
		Sources: []projector.SourceDefinition{
			{Stream: "order_created"},
			{Stream: "order_cancelled"},
		},
	}
	if err := proj.RegisterProjection(projDef); err != nil {
		b.Fatalf("Failed to register projection: %v", err)
	}

	b.ResetTimer() // Start timing after setup is complete
	return es, proj
}

// BenchmarkWriteEvent measures the throughput of writing events to the EventStore.
// This isolates the performance of the write path.
func BenchmarkWriteEvent(b *testing.B) {
	es, _ := setupTestEnvironment(b)
	b.ReportAllocs()

	var counter int64
	// Run the benchmark in parallel to test concurrent writes.
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Use a unique aggregate ID for each write to prevent contention
			// on a single actor, which would not be a realistic workload.
			aggID := fmt.Sprintf("order-%d", atomic.AddInt64(&counter, 1))
			event := eventstore.Event{
				AggregateID: aggID,
				EventType:   "order_created",
				Sequence:    1, // Sequence should start at 1 for a new aggregate
				Data:        []byte(`{"product_id": "prod-456", "quantity": 2}`),
			}
			_, err := es.WriteEvent(context.Background(), event)
			if err != nil {
				b.Errorf("WriteEvent failed: %v", err)
			}
		}
	})
}

// BenchmarkReadProjection measures the latency of querying a projection.
// This isolates the performance of the read path.
func BenchmarkReadProjection(b *testing.B) {
	// Perform one write to ensure the projection exists.
	// This write is not part of the measurement.
	event := eventstore.Event{
		AggregateID: "order-warmup",
		EventType:   "order_created",
		Sequence:    1,
		Data:        []byte(`{}`),
	}
	es, proj := setupTestEnvironment(b)
	if _, err := es.WriteEvent(context.Background(), event); err != nil {
		b.Fatalf("Warm-up write failed: %v", err)
	}
	time.Sleep(100 * time.Millisecond) // Allow time for projection to be created

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := proj.Query(context.Background(), "order_counts", nil)
		if err != nil {
			b.Fatalf("Query failed: %v", err)
		}
	}
}

// BenchmarkE2E measures the end-to-end latency from writing an event
// until it's reflected in a projection query result. This is a crucial
// metric for user-facing applications.
func BenchmarkE2E(b *testing.B) {
	es, proj := setupTestEnvironment(b)
	b.ReportAllocs()

	var wg sync.WaitGroup

	// Using a fixed number of iterations for stable E2E measurement.
	// b.N is not suitable here as we need to coordinate goroutines.
	const numIterations = 100
	latencies := make(chan time.Duration, numIterations)

	b.ResetTimer()

	for i := 0; i < numIterations; i++ {
		wg.Add(1)
		go func(iteration int) {
			defer wg.Done()

			startTime := time.Now()
			aggID := fmt.Sprintf("order-e2e-%d", iteration)

			// 1. Write an event
			event := eventstore.Event{
				AggregateID: aggID,
				EventType:   "order_created",
				Sequence:    1,
				Data:        []byte(`{}`),
			}
			_, err := es.WriteEvent(context.Background(), event)
			if err != nil {
				b.Errorf("WriteEvent in E2E failed: %v", err)
				return
			}

			// 2. Poll the projection until the update is reflected
			// In a real system, you'd use a push-based mechanism, but for this
			// benchmark, polling is a simple way to measure replication latency.
			var isReflected bool
			for retries := 0; retries < 100; retries++ {
				res, err := proj.Query(context.Background(), "order_counts", nil)
				if err != nil {
					b.Errorf("Query in E2E failed: %v", err)
					return
				}
				if state, ok := res.Data.(map[string]interface{}); ok {
					if orders, ok := state["orders"].(int); ok && orders >= iteration+1 {
						isReflected = true
						break
					}
				}
				time.Sleep(10 * time.Millisecond) // Poll interval
			}

			if !isReflected {
				b.Errorf("Projection was not updated in time for iteration %d", iteration)
				return
			}
			latencies <- time.Since(startTime)
		}(i)
	}

	wg.Wait()
	close(latencies)

	var totalLatency time.Duration
	for l := range latencies {
		totalLatency += l
	}

	// Report the average E2E latency as a custom benchmark metric.
	avgLatency := totalLatency / time.Duration(numIterations)
	b.ReportMetric(float64(avgLatency.Microseconds()), "avg_e2e_latency_µs")
}
