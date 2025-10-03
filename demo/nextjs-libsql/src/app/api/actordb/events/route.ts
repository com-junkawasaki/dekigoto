// API route for ActorDB events
import { NextRequest, NextResponse } from 'next/server'
import { getEventStore } from '../../../../../lib/actordb/eventstore'
import { getProjectionEngine } from '../../../../../lib/actordb/projector'

const eventStore = getEventStore()
const projectionEngine = getProjectionEngine()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    const events = await eventStore.getAllEvents(limit)

    return NextResponse.json({
      success: true,
      data: events,
      count: events.length
    })
  } catch (error) {
    console.error('Failed to get events:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get events' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const event = await request.json()

    // Validate event structure
    if (!event.aggregateId || !event.aggregateType || !event.eventType || !event.data) {
      return NextResponse.json(
        { success: false, error: 'Invalid event structure' },
        { status: 400 }
      )
    }

    // Set timestamps if not provided
    event.timestamp = event.timestamp || new Date().toISOString()
    event.eventTime = event.eventTime || new Date().toISOString()

    const result = await eventStore.writeEvent(event)

    if (result.success) {
      // Process event through projections
      await projectionEngine.processEvent(event)

      return NextResponse.json({
        success: true,
        data: result
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Failed to write event:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to write event' },
      { status: 500 }
    )
  }
}
