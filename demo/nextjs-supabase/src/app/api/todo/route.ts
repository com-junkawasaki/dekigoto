import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/actordb/eventstore'
import {
  createTodoListCreatedEvent,
  createTodoItemCreatedEvent,
  createTodoItemUpdatedEvent,
  createTodoItemCompletedEvent,
  createTodoItemDeletedEvent
} from '@/lib/events/todo-events'
import {
  getAllTodoLists,
  getAllTodoItems,
  getTodoItemsByList,
  getTodoStatistics
} from '@/lib/aggregates/todo-aggregate'

// Merkle DAG: todo_api -> event_sourced_crud
// Event-sourced TODO API using ActorDB
let eventStore: EventStore | null = null

async function getEventStore(): Promise<EventStore> {
  if (!eventStore) {
    // Use Supabase PostgreSQL for event storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is required for ActorDB')
    }

    // Create PostgreSQL connection string from Supabase URL
    const connectionString = `postgresql://postgres:${supabaseKey}@${supabaseUrl.replace('https://', '')}:5432/postgres?sslmode=require`

    // Create config directly instead of using load function
    const config = {
      data_dir: './data',
      snapshot_interval: 100,
      retention_period: '30d',
      compression: 'none',
      max_concurrent_writes: 10,
      storage: {
        type: 'postgresql' as const,
        connection_string: connectionString,
        path: '',
        options: {}
      }
    }

    eventStore = new EventStore(config)
    await eventStore.start()
  }
  return eventStore
}

// GET /api/todo - Get all TODO data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const listId = searchParams.get('listId')
    const type = searchParams.get('type') // 'lists', 'items', 'stats'

    const es = await getEventStore()
    const allEvents = await es.readEvents('todo_system', 0) // Get all events

    switch (type) {
      case 'lists':
        const allLists = getAllTodoLists(allEvents)
        return NextResponse.json({ lists: allLists })

      case 'items':
        if (listId) {
          const listItems = getTodoItemsByList(allEvents, listId)
          return NextResponse.json({ items: listItems })
        } else {
          const allItems = getAllTodoItems(allEvents)
          return NextResponse.json({ items: allItems })
        }

      case 'stats':
        const todoStats = getTodoStatistics(allEvents)
        return NextResponse.json({ stats: todoStats })

      default:
        // Return all data
        const defaultLists = getAllTodoLists(allEvents)
        const defaultItems = getAllTodoItems(allEvents)
        const defaultStats = getTodoStatistics(allEvents)

        return NextResponse.json({
          lists: defaultLists,
          items: defaultItems,
          stats: defaultStats,
          totalEvents: allEvents.length
        })
    }
  } catch (error) {
    console.error('Failed to get TODO data:', error)
    return NextResponse.json({ error: 'Failed to get TODO data' }, { status: 500 })
  }
}

// POST /api/todo - Create new TODO item or list
export async function POST(request: NextRequest) {
  try {
    const { type, ...data } = await request.json()
    const es = await getEventStore()

    let event
    let result

    switch (type) {
      case 'list':
        event = createTodoListCreatedEvent(data)
        result = await es.writeEvent(event)
        return NextResponse.json({
          listId: data.listId,
          sequence: result.sequence,
          success: result.success
        })

      case 'item':
        event = createTodoItemCreatedEvent(data)
        result = await es.writeEvent(event)
        return NextResponse.json({
          itemId: data.itemId,
          sequence: result.sequence,
          success: result.success
        })

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to create TODO:', error)
    return NextResponse.json({ error: 'Failed to create TODO' }, { status: 500 })
  }
}
