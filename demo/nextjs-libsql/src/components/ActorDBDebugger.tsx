'use client'

import { useEffect, useState } from 'react'

interface Event {
  aggregateId: string
  aggregateType: string
  sequence: number
  eventType: string
  data: any
  timestamp: Date
  eventTime: Date
  metadata?: Record<string, any>
}

export default function ActorDBDebugger() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set())

  const loadEvents = async () => {
    try {
      const response = await fetch('/api/actordb/events')
      const result = await response.json()

      if (result.success) {
        setEvents(result.data)
      } else {
        console.error('Failed to load events:', result.error)
      }
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedEvents(newExpanded)
  }

  const getEventTypeColor = (eventType: string) => {
    if (eventType.includes('created')) return 'bg-green-100 text-green-800'
    if (eventType.includes('updated')) return 'bg-blue-100 text-blue-800'
    if (eventType.includes('completed')) return 'bg-purple-100 text-purple-800'
    if (eventType.includes('deleted')) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Loading events...</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">ActorDB Event Stream</h2>
        <div className="flex gap-2">
          <button
            onClick={loadEvents}
            className="btn btn-secondary text-sm"
          >
            Refresh
          </button>
          <span className="text-sm text-gray-500">
            {events.length} events
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No events in the stream yet. Create some todos to see events here!
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {events.map((event, index) => (
            <div
              key={`${event.aggregateId}-${event.sequence}`}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getEventTypeColor(event.eventType)}`}>
                    {event.eventType}
                  </span>
                  <span className="text-sm font-medium text-gray-600">
                    {event.aggregateType}: {event.aggregateId}
                  </span>
                  <span className="text-xs text-gray-500">
                    seq: {event.sequence}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                  <button
                    onClick={() => toggleExpanded(index)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {expandedEvents.has(index) ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              {expandedEvents.has(index) && (
                <div className="mt-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Event Data</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Metadata</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(event.metadata || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    <div>Timestamp: {new Date(event.timestamp).toISOString()}</div>
                    <div>Event Time: {new Date(event.eventTime).toISOString()}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">About ActorDB Event Sourcing</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Each todo operation creates an immutable event in the event stream</li>
          <li>• Events are stored in LibSQL with full ACID guarantees</li>
          <li>• Projections maintain materialized views for fast queries</li>
          <li>• Event sourcing enables audit trails and state reconstruction</li>
        </ul>
      </div>
    </div>
  )
}
