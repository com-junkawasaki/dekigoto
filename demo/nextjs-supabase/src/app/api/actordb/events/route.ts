import { NextRequest, NextResponse } from 'next/server'
import { EventStore, Event, StorageFactory } from '@/lib/actordb/eventstore'

// Merkle DAG: actordb_api_events -> event_api_endpoint
// API endpoint for ActorDB event operations
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

// POST /api/actordb/events - Write event
export async function POST(request: NextRequest) {
  try {
    const eventData: Omit<Event, 'timestamp'> = await request.json()
    const event: Event = {
      ...eventData,
      timestamp: new Date()
    }

    const es = await getEventStore()
    const result = await es.writeEvent(event)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to write event:', error)
    return NextResponse.json({ error: 'Failed to write event' }, { status: 500 })
  }
}

// GET /api/actordb/events - Read events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const aggregateId = searchParams.get('aggregateId')
    const fromSeq = parseInt(searchParams.get('fromSeq') || '0')

    if (!aggregateId) {
      return NextResponse.json({ error: 'aggregateId is required' }, { status: 400 })
    }

    const es = await getEventStore()
    const events = await es.readEvents(aggregateId, fromSeq)

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to read events:', error)
    return NextResponse.json({ error: 'Failed to read events' }, { status: 500 })
  }
}
