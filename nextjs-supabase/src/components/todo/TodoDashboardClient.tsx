'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { TodoList, TodoItem } from '@/utils/supabase/todo'
import { TodoSidebar } from './TodoSidebar'
import { TodoList as TodoListComponent } from './TodoList'
import { TodoForm } from './TodoForm'
import { StatsCard } from './StatsCard'

// Merkle DAG: todo_dashboard_client -> ui_state_management
// Client component for TODO application dashboard with interactive features
interface TodoDashboardClientProps {
  user: User
  initialLists: TodoList[]
  initialItems: TodoItem[]
  initialStats: { total?: number; pending?: number; in_progress?: number; completed?: number; high_priority?: number }
  defaultListId: string | null
}

export function TodoDashboardClient({
  user,
  initialLists,
  initialItems,
  initialStats,
  defaultListId
}: TodoDashboardClientProps) {
  const [lists, setLists] = useState<TodoList[]>(initialLists)
  const [items, setItems] = useState<TodoItem[]>(initialItems)
  const [stats, setStats] = useState<{ total?: number; pending?: number; in_progress?: number; completed?: number; high_priority?: number }>(initialStats)
  const [selectedListId, setSelectedListId] = useState<string | null>(defaultListId)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    // Update state when initial data changes (server-side updates)
    setLists(initialLists)
    setItems(initialItems)
    setStats(initialStats)
    if (!selectedListId && defaultListId) {
      setSelectedListId(defaultListId)
    }
  }, [initialLists, initialItems, initialStats, defaultListId, selectedListId])

  const selectedList = lists.find(list => list.id === selectedListId)
  const filteredItems = selectedListId
    ? items.filter(item => item.list_id === selectedListId)
    : items

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <TodoSidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={setSelectedListId}
        user={user}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedList ? selectedList.title : 'All Tasks'}
              </h1>
              <p className="text-gray-600">
                {filteredItems.length} {filteredItems.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
              >
                Add Task
              </button>
              <Link
                href="/app"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg font-medium transition-colors"
              >
                Back to App
              </Link>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatsCard title="Total Tasks" value={stats.total || 0} />
            <StatsCard title="Pending" value={stats.pending || 0} color="yellow" />
            <StatsCard title="In Progress" value={stats.in_progress || 0} color="blue" />
            <StatsCard title="Completed" value={stats.completed || 0} color="green" />
          </div>
        </div>

        {/* Todo List */}
        <div className="flex-1 overflow-auto">
          <TodoListComponent
            items={filteredItems}
          />
        </div>

        {/* Todo Form Modal */}
        {showForm && selectedList && (
          <TodoForm
            listId={selectedList.id}
            onClose={() => setShowForm(false)}
            onSubmit={() => {}} // Server Actions handle revalidation automatically
          />
        )}
      </div>
    </div>
  )
}
