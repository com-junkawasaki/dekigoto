// Merkle DAG: projector_libsql -> projection_engine_libsql
// LibSQL-based projection engine for Todo application
// Process Network Node: projection_engine (LibSQL variant)

import { getDatabaseClient } from '../database/config'
import { Event } from './eventstore'

export interface ProjectionDefinition {
  name: string
  eventTypes: string[]
  initialState: () => any
  reducer: (state: any, event: Event) => any
}

export interface ProjectionState {
  name: string
  data: any
  lastEventId: number
  updatedAt: string
}

export class LibSQLProjectionEngine {
  private db = getDatabaseClient()
  private projections: Map<string, ProjectionDefinition> = new Map()
  private eventListeners: Set<(event: Event) => void> = new Set()

  // Register a projection definition
  registerProjection(definition: ProjectionDefinition): void {
    this.projections.set(definition.name, definition)

    // Initialize projection state if it doesn't exist
    this.initializeProjection(definition.name)
  }

  private async initializeProjection(name: string): Promise<void> {
    try {
      const result = await this.db.execute({
        sql: 'SELECT name FROM projections WHERE name = ?',
        args: [name]
      })

      if (result.rows.length === 0) {
        const definition = this.projections.get(name)
        if (definition) {
          const initialState = definition.initialState()
          await this.db.execute({
            sql: 'INSERT INTO projections (name, data, last_event_id, updated_at) VALUES (?, ?, ?, ?)',
            args: [name, JSON.stringify(initialState), 0, new Date().toISOString()]
          })
        }
      }
    } catch (error) {
      console.error(`Failed to initialize projection ${name}:`, error)
    }
  }

  // Process an event and update relevant projections
  async processEvent(event: Event): Promise<void> {
    for (const [name, definition] of this.projections) {
      if (definition.eventTypes.includes(event.eventType)) {
        await this.updateProjection(name, event)
      }
    }

    // Notify listeners
    this.broadcastEvent(event)
  }

  private async updateProjection(projectionName: string, event: Event): Promise<void> {
    try {
      // Get current projection state
      const result = await this.db.execute({
        sql: 'SELECT data, last_event_id FROM projections WHERE name = ?',
        args: [projectionName]
      })

      if (result.rows.length === 0) {
        console.error(`Projection ${projectionName} not found`)
        return
      }

      const row = result.rows[0]
      const currentState = JSON.parse(row.data as string)
      const lastEventId = row.last_event_id as number

      // Skip if we've already processed this event
      if (event.sequence <= lastEventId) {
        return
      }

      const definition = this.projections.get(projectionName)
      if (!definition) {
        return
      }

      // Apply reducer
      const newState = definition.reducer(currentState, event)

      // Update projection
      await this.db.execute({
        sql: 'UPDATE projections SET data = ?, last_event_id = ?, updated_at = ? WHERE name = ?',
        args: [
          JSON.stringify(newState),
          event.sequence,
          new Date().toISOString(),
          projectionName
        ]
      })

    } catch (error) {
      console.error(`Failed to update projection ${projectionName}:`, error)
    }
  }

  // Query a projection
  async queryProjection(projectionName: string): Promise<any> {
    const result = await this.db.execute({
      sql: 'SELECT data FROM projections WHERE name = ?',
      args: [projectionName]
    })

    if (result.rows.length === 0) {
      throw new Error(`Projection ${projectionName} not found`)
    }

    return JSON.parse(result.rows[0].data as string)
  }

  // Rebuild a projection from all events
  async rebuildProjection(projectionName: string): Promise<void> {
    const definition = this.projections.get(projectionName)
    if (!definition) {
      throw new Error(`Projection definition ${projectionName} not found`)
    }

    // Reset to initial state
    const initialState = definition.initialState()

    // Get all relevant events
    const eventTypes = definition.eventTypes.map(type => `'${type}'`).join(',')
    const eventsResult = await this.db.execute({
      sql: `SELECT * FROM events WHERE event_type IN (${eventTypes}) ORDER BY id ASC`,
      args: []
    })

    // Rebuild state from events
    let state = initialState
    for (const row of eventsResult.rows) {
      const event: Event = {
        aggregateId: row.aggregate_id as string,
        aggregateType: row.aggregate_type as string,
        sequence: row.sequence as number,
        eventType: row.event_type as string,
        data: JSON.parse(row.data as string),
        timestamp: new Date(row.timestamp as string),
        eventTime: new Date(row.event_time as string),
        metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
      }

      state = definition.reducer(state, event)
    }

    // Update projection with rebuilt state
    await this.db.execute({
      sql: 'UPDATE projections SET data = ?, last_event_id = ?, updated_at = ? WHERE name = ?',
      args: [
        JSON.stringify(state),
        eventsResult.rows.length > 0 ? (eventsResult.rows[eventsResult.rows.length - 1] as any).id : 0,
        new Date().toISOString(),
        projectionName
      ]
    })

    console.log(`Rebuilt projection ${projectionName}`)
  }

  // Subscribe to events
  subscribe(listener: (event: Event) => void): () => void {
    this.eventListeners.add(listener)

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

// Singleton instance
let projectionEngineInstance: LibSQLProjectionEngine | null = null

export function getProjectionEngine(): LibSQLProjectionEngine {
  if (!projectionEngineInstance) {
    projectionEngineInstance = new LibSQLProjectionEngine()
  }
  return projectionEngineInstance
}
