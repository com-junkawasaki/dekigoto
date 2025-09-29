package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// Config represents the complete ActorDB configuration
type Config struct {
	Version    string           `yaml:"version"`
	Cluster    ClusterConfig    `yaml:"cluster"`
	EventStore EventStoreConfig `yaml:"eventstore"`
	Projection ProjectionConfig `yaml:"projection"`
	Security   SecurityConfig   `yaml:"security"`
	Query      QueryConfig      `yaml:"query"`
	Control    ControlConfig    `yaml:"control"`
	Monitoring MonitoringConfig `yaml:"monitoring"`
	Logging    LoggingConfig    `yaml:"logging"`
}

// ClusterConfig defines cluster-wide settings
type ClusterConfig struct {
	Name  string   `yaml:"name"`
	Nodes []string `yaml:"nodes"`
}

// StorageConfig contains configuration for storage backends
type StorageConfig struct {
	Type             string                 `yaml:"type"` // sqlite, postgresql, rocksdb, leveldb, memory
	Path             string                 `yaml:"path,omitempty"`
	ConnectionString string                 `yaml:"connection_string,omitempty"`
	Options          map[string]interface{} `yaml:"options,omitempty"`
}

// EventStoreConfig configures the event storage layer
type EventStoreConfig struct {
	DataDir             string        `yaml:"data_dir"`
	SnapshotInterval    int64         `yaml:"snapshot_interval"`
	RetentionPeriod     time.Duration `yaml:"retention_period"`
	Compression         string        `yaml:"compression"`
	MaxConcurrentWrites int           `yaml:"max_concurrent_writes"`
	Storage             StorageConfig `yaml:"storage"`
}

// ProjectionConfig configures the projection engine
type ProjectionConfig struct {
	WorkerCount             int           `yaml:"worker_count"`
	MaxMemoryMB             int           `yaml:"max_memory_mb"`
	AutoPromoteQPSThreshold float64       `yaml:"auto_promote_qps_threshold"`
	AutoDemoteQPSThreshold  float64       `yaml:"auto_demote_qps_threshold"`
	LateWindowMs            time.Duration `yaml:"late_window_ms"`
	WatermarkLagMs          time.Duration `yaml:"watermark_lag_ms"`
	MaxRebuildTimeSec       time.Duration `yaml:"max_rebuild_time_sec"`
}

// SecurityConfig configures security and authentication
type SecurityConfig struct {
	MTLSEnabled        bool   `yaml:"mtls_enabled"`
	JWTIssuer          string `yaml:"jwt_issuer"`
	JWTLifetimeSec     int64  `yaml:"jwt_lifetime_sec"`
	JWSSecret          string `yaml:"jws_secret"`
	AuditStreamEnabled bool   `yaml:"audit_stream_enabled"`
	SPIFFETrustDomain  string `yaml:"spiffe_trust_domain"`
}

// QueryConfig configures the query interface
type QueryConfig struct {
	ListenAddr       string        `yaml:"listen_addr"`
	MaxConnections   int           `yaml:"max_connections"`
	QueryTimeoutSec  time.Duration `yaml:"query_timeout_sec"`
	EnableSQLDialect bool          `yaml:"enable_sql_dialect"`
}

// ControlConfig configures the control plane
type ControlConfig struct {
	ListenAddr              string        `yaml:"listen_addr"`
	MetricsIntervalSec      time.Duration `yaml:"metrics_interval_sec"`
	ScalingCheckIntervalSec time.Duration `yaml:"scaling_check_interval_sec"`
	MaxHotKeyRho            float64       `yaml:"max_hot_key_rho"`
}

// MonitoringConfig configures monitoring and metrics
type MonitoringConfig struct {
	PrometheusAddr         string        `yaml:"prometheus_addr"`
	HealthCheckIntervalSec time.Duration `yaml:"health_check_interval_sec"`
}

// LoggingConfig configures logging
type LoggingConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
	Output string `yaml:"output"`
}

// Load loads configuration from a YAML file
func Load(path string) (*Config, error) {
	cleanedPath := filepath.Clean(path)
	data, err := os.ReadFile(cleanedPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	// Durations are now parsed directly from string format (e.g., "10s") by yaml.v3
	// The manual multiplication is no longer needed.
	/*
		cfg.Projection.LateWindowMs *= time.Millisecond
		cfg.Projection.WatermarkLagMs *= time.Millisecond
		cfg.Projection.MaxRebuildTimeSec *= time.Second

		cfg.Query.QueryTimeoutSec *= time.Second

		cfg.Control.MetricsIntervalSec *= time.Second
		cfg.Control.ScalingCheckIntervalSec *= time.Second

		cfg.Monitoring.HealthCheckIntervalSec *= time.Second
	*/

	return &cfg, nil
}

// parseDuration parses duration strings like "30d", "1h", etc.
func parseDuration(d time.Duration) (time.Duration, error) {
	if d == 0 {
		return 0, nil
	}
	// If it's already a duration (from YAML parsing), return as-is
	return d, nil
}

// parseDurationString parses custom duration strings
func parseDurationString(s string) (time.Duration, error) {
	if s == "" {
		return 0, nil
	}

	// Handle custom formats like "30d"
	switch s[len(s)-1] {
	case 'd':
		var days int
		if _, err := fmt.Sscanf(s, "%dd", &days); err != nil {
			return 0, err
		}
		return time.Duration(days) * 24 * time.Hour, nil
	default:
		return time.ParseDuration(s)
	}
}
