'use client'

import { useState } from 'react'
import TodoDashboard from '../components/TodoDashboard'
import ActorDBDebugger from '../components/ActorDBDebugger'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'todos' | 'debugger'>('todos')

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('todos')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'todos'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Todo Dashboard
          </button>
          <button
            onClick={() => setActiveTab('debugger')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'debugger'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ActorDB Debugger
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'todos' && <TodoDashboard />}
      {activeTab === 'debugger' && <ActorDBDebugger />}

      {/* Footer Info */}
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">About This Demo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Architecture</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>Next.js 15</strong> with App Router</li>
              <li>• <strong>LibSQL</strong> for event storage</li>
              <li>• <strong>ActorDB</strong> event sourcing</li>
              <li>• <strong>TypeScript</strong> for type safety</li>
              <li>• <strong>Tailwind CSS</strong> for styling</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Features</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Event-sourced todo management</li>
              <li>• Real-time projections</li>
              <li>• ACID-compliant persistence</li>
              <li>• Audit trail with full event history</li>
              <li>• Live event stream debugger</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
