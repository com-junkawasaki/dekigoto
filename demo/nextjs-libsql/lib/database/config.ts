// Merkle DAG: database_config -> libsql_connection
// LibSQL database configuration for ActorDB demo

import { createClient } from '@libsql/client'

export interface DatabaseConfig {
  url: string
  authToken?: string
}

export const defaultConfig: DatabaseConfig = {
  url: process.env.LIBSQL_URL || 'file:./actordb.db',
  authToken: process.env.LIBSQL_AUTH_TOKEN
}

export function createDatabaseClient(config: DatabaseConfig = defaultConfig) {
  return createClient({
    url: config.url,
    authToken: config.authToken
  })
}

// Global database instance for server-side use
let dbInstance: ReturnType<typeof createClient> | null = null

export function getDatabaseClient() {
  if (!dbInstance) {
    dbInstance = createDatabaseClient()
  }
  return dbInstance
}

// Initialize database schema
export async function initializeDatabase() {
  const db = getDatabaseClient()

  // Create events table for event sourcing
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aggregate_id TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      event_time TEXT NOT NULL,
      metadata TEXT,
      UNIQUE(aggregate_id, sequence)
    )
  `)

  // Create projections table for materialized views
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      last_event_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Create indexes for performance
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_id, aggregate_type)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_events_sequence ON events(sequence)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_projections_name ON projections(name)`)

  console.log('Database initialized successfully')
}
