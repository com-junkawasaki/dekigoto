'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, Database, FileText, Users, BarChart3, Settings, Play, Pause, RotateCcw } from 'lucide-react'

// Merkle DAG: actordb_debugger -> comprehensive_demo_interface
// Comprehensive ActorDB debugger and demo interface
export function ActorDBDebugger() {
  const [activeTab, setActiveTab] = useState('overview')
  const [systemStatus, setSystemStatus] = useState('loading')

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Activity },
    { id: 'events', name: 'Event Store', icon: Database },
    { id: 'todo', name: 'TODO Demo', icon: FileText },
    { id: 'queries', name: 'Queries', icon: BarChart3 },
    { id: 'auth', name: 'Auth Debug', icon: Users },
    { id: 'settings', name: 'Settings', icon: Settings }
  ]

  useEffect(() => {
    // Simulate system status check
    const checkStatus = async () => {
      try {
        // Check if APIs are accessible
        const responses = await Promise.allSettled([
          fetch('/api/actordb/events', { method: 'GET' }),
          fetch('/api/todo', { method: 'GET' })
        ])

        const allOk = responses.every(r => r.status === 'fulfilled' && r.value.ok)
        setSystemStatus(allOk ? 'online' : 'degraded')
      } catch {
        setSystemStatus('offline')
      }
    }

    checkStatus()
  }, [])

  const getStatusColor = () => {
    switch (systemStatus) {
      case 'online': return 'text-green-600 bg-green-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100'
      case 'offline': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ActorDB Debugger</h1>
                <p className="text-sm text-gray-600">Comprehensive event-sourcing system demo</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
                System: {systemStatus}
              </div>
              <div className="flex space-x-2">
                <Link
                  href="/app"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Demo
                </Link>
                <Link
                  href="/todo"
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  TODO App
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg min-h-[600px]">
          <div className="p-6">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'events' && <EventsTab />}
            {activeTab === 'todo' && <TodoTab />}
            {activeTab === 'queries' && <QueriesTab />}
            {activeTab === 'auth' && <AuthTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </main>
    </div>
  )
}

// Overview Tab Component
function OverviewTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">System Overview</h2>
        <p className="text-gray-600">
          ActorDB is a comprehensive event-sourcing database system built with TypeScript.
          This debugger allows you to explore all system capabilities interactively.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <Database className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="font-medium text-blue-900 mb-2">Event Store</h3>
          <p className="text-sm text-blue-700">
            Append-only event storage with actor-based concurrency control
          </p>
        </div>

        <div className="bg-green-50 p-6 rounded-lg">
          <FileText className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-medium text-green-900 mb-2">Event Sourcing</h3>
          <p className="text-sm text-green-700">
            Immutable event streams with aggregate reconstruction
          </p>
        </div>

        <div className="bg-purple-50 p-6 rounded-lg">
          <BarChart3 className="w-8 h-8 text-purple-600 mb-3" />
          <h3 className="font-medium text-purple-900 mb-2">Query System</h3>
          <p className="text-sm text-purple-700">
            Real-time projections and aggregate queries
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => {/* TODO: Create demo event */}}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4 mr-2" />
            Create Event
          </button>
          <button
            onClick={() => {/* TODO: Query events */}}
            className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Database className="w-4 h-4 mr-2" />
            Query Events
          </button>
          <button
            onClick={() => {/* TODO: Create TODO */}}
            className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            Add TODO
          </button>
          <button
            onClick={() => {/* TODO: View metrics */}}
            className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            View Metrics
          </button>
        </div>
      </div>
    </div>
  )
}

// Events Tab Component
function EventsTab() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadEvents = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/actordb/events?aggregateId=system_events')
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to load events:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Event Store</h2>
        <button
          onClick={loadEvents}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium mb-3">Recent Events</h3>
        {events.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((event, index) => (
              <div key={index} className="bg-white p-3 rounded border">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{event.eventType}</span>
                  <span className="text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
                </div>
                <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No events found</p>
        )}
      </div>
    </div>
  )
}

// TODO Tab Component
function TodoTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">TODO Management</h2>
      <div className="bg-yellow-50 p-4 rounded-lg">
        <p className="text-yellow-800">
          TODO functionality is available at <Link href="/todo" className="underline">/todo</Link> or <Link href="/app" className="underline">/app</Link>
        </p>
      </div>
    </div>
  )
}

// Queries Tab Component
function QueriesTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Query Interface</h2>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800">
          Query system for real-time projections and aggregate queries
        </p>
      </div>
    </div>
  )
}

// Auth Tab Component
function AuthTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Authentication Debug</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/signin" className="bg-blue-50 p-6 rounded-lg hover:bg-blue-100 transition-colors">
          <Users className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="font-medium text-blue-900 mb-2">Sign In</h3>
          <p className="text-sm text-blue-700">Test authentication flow</p>
        </Link>
        <Link href="/signup" className="bg-green-50 p-6 rounded-lg hover:bg-green-100 transition-colors">
          <Users className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-medium text-green-900 mb-2">Sign Up</h3>
          <p className="text-sm text-green-700">Create new account</p>
        </Link>
      </div>
    </div>
  )
}

// Settings Tab Component
function SettingsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">System Settings</h2>
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Environment</h3>
          <div className="text-sm space-y-1">
            <p><strong>Node.js:</strong> {process.version}</p>
            <p><strong>Next.js:</strong> 15.5.4</p>
            <p><strong>TypeScript:</strong> Integrated</p>
          </div>
        </div>
      </div>
    </div>
  )
}
