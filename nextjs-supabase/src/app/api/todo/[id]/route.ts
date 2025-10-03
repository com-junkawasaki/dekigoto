import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/actordb/eventstore'
import { load } from '@/lib/actordb/config'
import {
  createTodoItemUpdatedEvent,
  createTodoItemCompletedEvent,
  createTodoItemDeletedEvent
} from '@/lib/events/todo-events'
import { createTodoItemFromEvents } from '@/lib/aggregates/todo-aggregate'

// Merkle DAG: todo_item_api -> event_sourced_updates
// API for individual TODO item operations
let eventStore: EventStore | null = null

async function getEventStore(): Promise<EventStore> {
  if (!eventStore) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is required for ActorDB')
    }

    const connectionString = `postgresql://postgres:${supabaseKey}@${supabaseUrl.replace('https://', '')}:5432/postgres?sslmode=require`

    const config = load({
      eventstore: {
        storage: {
          type: 'postgresql',
          connection_string: connectionString,
          options: {}
        },
        snapshot_interval: 100
      }
    })

    eventStore = new EventStore(config.eventstore)
    await eventStore.start()
  }
  return eventStore
}

// PUT /api/todo/[id] - Update TODO item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const itemId = params.id
    const { action, ...updates } = await request.json()

    const es = await getEventStore()

    // Get current item state to determine sequence
    const events = await es.readEvents(itemId, 0)
    const currentItem = createTodoItemFromEvents(events)

    if (!currentItem) {
      return NextResponse.json({ error: 'TODO item not found' }, { status: 404 })
    }

    let event
    let result

    if (action === 'complete') {
      event = createTodoItemCompletedEvent(itemId, currentItem ? events.length : 0)
    } else {
      // Regular update
      event = createTodoItemUpdatedEvent(itemId, events.length, updates)
    }

    result = await es.writeEvent(event)

    return NextResponse.json({
      itemId,
      sequence: result.sequence,
      success: result.success
    })
  } catch (error) {
    console.error('Failed to update TODO item:', error)
    return NextResponse.json({ error: 'Failed to update TODO item' }, { status: 500 })
  }
}

// DELETE /api/todo/[id] - Delete TODO item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const itemId = params.id
    const es = await getEventStore()

    // Get current item state to determine sequence
    const events = await es.readEvents(itemId, 0)
    const currentItem = createTodoItemFromEvents(events)

    if (!currentItem) {
      return NextResponse.json({ error: 'TODO item not found' }, { status: 404 })
    }

    const event = createTodoItemDeletedEvent(itemId, events.length)
    const result = await es.writeEvent(event)

    return NextResponse.json({
      itemId,
      sequence: result.sequence,
      success: result.success
    })
  } catch (error) {
    console.error('Failed to delete TODO item:', error)
    return NextResponse.json({ error: 'Failed to delete TODO item' }, { status: 500 })
  }
}
