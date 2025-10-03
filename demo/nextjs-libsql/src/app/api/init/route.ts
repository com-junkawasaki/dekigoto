// API route to initialize the database
import { NextResponse } from 'next/server'
import { initializeDatabase } from '../../../../lib/database/config'
import { getProjectionEngine } from '../../../../lib/actordb/projector'

export async function POST() {
  try {
    // Initialize database schema
    await initializeDatabase()

    // Initialize projections
    const projectionEngine = getProjectionEngine()

    // Register todo projections (they will be initialized automatically)
    projectionEngine.registerProjection({
      name: 'todo_lists',
      eventTypes: ['todo_list_created'],
      initialState: () => ({ lists: [] }),
      reducer: (state, event) => {
        if (event.eventType === 'todo_list_created') {
          const data = event.data
          return {
            ...state,
            lists: [...state.lists, {
              id: data.listId,
              title: data.title,
              description: data.description,
              color: data.color,
              isDefault: data.isDefault,
              userId: data.userId,
              createdAt: event.timestamp.toISOString()
            }]
          }
        }
        return state
      }
    })

    projectionEngine.registerProjection({
      name: 'todo_items',
      eventTypes: ['todo_item_created', 'todo_item_updated', 'todo_item_completed', 'todo_item_deleted'],
      initialState: () => ({ items: [] }),
      reducer: (state, event) => {
        if (event.eventType === 'todo_item_created') {
          const data = event.data
          return {
            ...state,
            items: [...state.items, {
              id: data.itemId,
              listId: data.listId,
              title: data.title,
              description: data.description,
              priority: data.priority,
              status: 'pending',
              dueDate: data.dueDate,
              tags: data.tags,
              userId: data.userId,
              createdAt: event.timestamp.toISOString(),
              updatedAt: event.timestamp.toISOString()
            }]
          }
        } else if (event.eventType === 'todo_item_updated') {
          const data = event.data
          return {
            ...state,
            items: state.items.map((item: any) =>
              item.id === data.itemId
                ? { ...item, ...data.updates, updatedAt: event.timestamp.toISOString() }
                : item
            )
          }
        } else if (event.eventType === 'todo_item_completed') {
          const data = event.data
          return {
            ...state,
            items: state.items.map((item: any) =>
              item.id === data.itemId
                ? { ...item, status: 'completed', completedAt: data.completedAt, updatedAt: event.timestamp.toISOString() }
                : item
            )
          }
        } else if (event.eventType === 'todo_item_deleted') {
          const data = event.data
          return {
            ...state,
            items: state.items.map((item: any) =>
              item.id === data.itemId
                ? { ...item, status: 'cancelled', updatedAt: event.timestamp.toISOString() }
                : item
            )
          }
        }
        return state
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Database and projections initialized successfully'
    })
  } catch (error) {
    console.error('Failed to initialize:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to initialize database' },
      { status: 500 }
    )
  }
}
