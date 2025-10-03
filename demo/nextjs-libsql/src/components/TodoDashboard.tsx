'use client'

import { useEffect, useState } from 'react'
import { getTodoLists, getTodoItems, getTodoStatistics } from '../app/todo/actions'
import StatsCard from './StatsCard'
import { TodoListForm, TodoItemForm } from './TodoForm'
import TodoList from './TodoList'

interface TodoList {
  id: string
  title: string
  description?: string
  color: string
  createdAt: string
}

interface TodoItem {
  id: string
  listId: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  dueDate?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface Statistics {
  total: number
  pending: number
  inProgress: number
  completed: number
  highPriority: number
}

export default function TodoDashboard() {
  const [lists, setLists] = useState<TodoList[]>([])
  const [items, setItems] = useState<TodoItem[]>([])
  const [stats, setStats] = useState<Statistics | null>(null)
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [listsResult, itemsResult, statsResult] = await Promise.all([
        getTodoLists(),
        getTodoItems(),
        getTodoStatistics()
      ])

      if (listsResult.success) {
        setLists(listsResult.data)
        if (!selectedListId && listsResult.data.length > 0) {
          setSelectedListId(listsResult.data[0].id)
        }
      }

      if (itemsResult.success) {
        setItems(itemsResult.data)
      }

      if (statsResult.success) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedList = lists.find(list => list.id === selectedListId)
  const filteredItems = selectedListId
    ? items.filter(item => item.listId === selectedListId)
    : items

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatsCard
            title="Total Todos"
            value={stats.total}
            color="blue"
          />
          <StatsCard
            title="Pending"
            value={stats.pending}
            color="gray"
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgress}
            color="blue"
          />
          <StatsCard
            title="Completed"
            value={stats.completed}
            color="green"
          />
          <StatsCard
            title="High Priority"
            value={stats.highPriority}
            color="red"
          />
        </div>
      )}

      {/* Todo Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <TodoListForm onSuccess={loadData} />

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Todo Lists</h3>
            <div className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedListId === list.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className="font-medium">{list.title}</span>
                  </div>
                  {list.description && (
                    <p className="text-sm text-gray-600 mt-1">{list.description}</p>
                  )}
                </button>
              ))}
              {lists.length === 0 && (
                <p className="text-gray-500 text-center py-4">No lists yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedList ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2">{selectedList.title}</h2>
                {selectedList.description && (
                  <p className="text-gray-600">{selectedList.description}</p>
                )}
              </div>

              <div className="mb-6">
                <TodoItemForm listId={selectedList.id} onSuccess={loadData} />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Todos</h3>
                <TodoList items={filteredItems} onUpdate={loadData} />
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Select a todo list to view and manage todos
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
