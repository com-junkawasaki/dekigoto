// Merkle DAG: eventstore_libsql -> libsql_storage
// LibSQL-based event store for ActorDB demo
// Process Network Node: write_aggregate (LibSQL variant)

import { getDatabaseClient } from '../database/config'

export interface Event {
  aggregateId: string
  aggregateType: string
  sequence: number
  eventType: string
  data: any
  timestamp: Date
  eventTime: Date
  metadata?: Record<string, any>
}

export interface WriteResult {
  aggregateId: string
  sequence: number
  success: boolean
  timestamp: Date
  error?: string
}

export interface ActorState {
  aggregateId: string
  lastSequence: number
  lastTimestamp: Date
}

export class LibSQLEventStore {
  private db = getDatabaseClient()
  private eventListeners: Set<(event: Event) => void> = new Set()

  // WriteEvent appends an event to an actor's event stream
  async writeEvent(event: Event): Promise<WriteResult> {
    try {
      // Get the next sequence number
      const lastSeqResult = await this.db.execute({
        sql: 'SELECT MAX(sequence) as last_seq FROM events WHERE aggregate_id = ?',
        args: [event.aggregateId]
      })

      const lastSeq = lastSeqResult.rows[0]?.last_seq || 0
      const nextSeq = lastSeq + 1

      // Validate sequence number
      if (event.sequence !== nextSeq) {
        return {
          aggregateId: event.aggregateId,
          sequence: 0,
          success: false,
          timestamp: new Date(),
          error: `Invalid sequence number. Expected ${nextSeq}, got ${event.sequence}`
        }
      }

      // Insert the event
      await this.db.execute({
        sql: `INSERT INTO events (
          aggregate_id, aggregate_type, sequence, event_type, data,
          timestamp, event_time, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          event.aggregateId,
          event.aggregateType,
          event.sequence,
          event.eventType,
          JSON.stringify(event.data),
          event.timestamp.toISOString(),
          event.eventTime.toISOString(),
          event.metadata ? JSON.stringify(event.metadata) : null
        ]
      })

      // Broadcast the event
      this.broadcastEvent(event)

      return {
        aggregateId: event.aggregateId,
        sequence: event.sequence,
        success: true,
        timestamp: event.timestamp
      }

    } catch (error) {
      return {
        aggregateId: event.aggregateId,
        sequence: 0,
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ReadEvents reads events for an actor from a given sequence
  async readEvents(aggregateId: string, fromSeq: number = 1): Promise<Event[]> {
    const result = await this.db.execute({
      sql: `SELECT * FROM events
            WHERE aggregate_id = ? AND sequence >= ?
            ORDER BY sequence ASC`,
      args: [aggregateId, fromSeq]
    })

    return result.rows.map(row => ({
      aggregateId: row.aggregate_id as string,
      aggregateType: row.aggregate_type as string,
      sequence: row.sequence as number,
      eventType: row.event_type as string,
      data: JSON.parse(row.data as string),
      timestamp: new Date(row.timestamp as string),
      eventTime: new Date(row.event_time as string),
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    }))
  }

  // GetActorState returns the current state of an actor
  async getActorState(aggregateId: string): Promise<ActorState | null> {
    const result = await this.db.execute({
      sql: `SELECT MAX(sequence) as last_seq, MAX(timestamp) as last_time
            FROM events WHERE aggregate_id = ?`,
      args: [aggregateId]
    })

    const row = result.rows[0]
    if (!row || !row.last_seq) {
      return null
    }

    return {
      aggregateId,
      lastSequence: row.last_seq as number,
      lastTimestamp: new Date(row.last_time as string)
    }
  }

  // GetAllEvents returns all events (for debugging/testing)
  async getAllEvents(limit: number = 1000): Promise<Event[]> {
    const result = await this.db.execute({
      sql: `SELECT * FROM events ORDER BY id DESC LIMIT ?`,
      args: [limit]
    })

    return result.rows.map(row => ({
      aggregateId: row.aggregate_id as string,
      aggregateType: row.aggregate_type as string,
      sequence: row.sequence as number,
      eventType: row.event_type as string,
      data: JSON.parse(row.data as string),
      timestamp: new Date(row.timestamp as string),
      eventTime: new Date(row.event_time as string),
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    })).reverse() // Return in chronological order
  }

  // Subscribe adds a new event listener
  subscribe(listener: (event: Event) => void): () => void {
    this.eventListeners.add(listener)

    // Return unsubscribe function
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  private broadcastEvent(event: Event): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (err) {
        console.error(`Error in event listener: ${err}`)
      }
    }
  }
}

// Singleton instance for the application
let eventStoreInstance: LibSQLEventStore | null = null

export function getEventStore(): LibSQLEventStore {
  if (!eventStoreInstance) {
    eventStoreInstance = new LibSQLEventStore()
  }
  return eventStoreInstance
}
