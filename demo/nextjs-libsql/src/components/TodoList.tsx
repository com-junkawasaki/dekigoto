'use client'

import { useState } from 'react'
import { completeTodoItem, deleteTodoItem } from '../app/todo/actions'

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

interface TodoListProps {
  items: TodoItem[]
  onUpdate?: () => void
}

const priorityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
}

const statusColors = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function TodoList({ items, onUpdate }: TodoListProps) {
  const [completing, setCompleting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleComplete = async (itemId: string) => {
    setCompleting(itemId)
    try {
      const result = await completeTodoItem(itemId)
      if (result.success) {
        onUpdate?.()
      } else {
        alert('Failed to complete todo: ' + result.error)
      }
    } catch (error) {
      alert('Failed to complete todo')
    } finally {
      setCompleting(null)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this todo?')) return

    setDeleting(itemId)
    try {
      const result = await deleteTodoItem(itemId)
      if (result.success) {
        onUpdate?.()
      } else {
        alert('Failed to delete todo: ' + result.error)
      }
    } catch (error) {
      alert('Failed to delete todo')
    } finally {
      setDeleting(null)
    }
  }

  const activeItems = items.filter(item => item.status !== 'cancelled')

  if (activeItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No todos yet. Create your first todo above!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activeItems.map((item) => (
        <div key={item.id} className="card">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className={`text-lg font-semibold ${item.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                  {item.title}
                </h3>
                <span className={`px-2 py-1 text-xs rounded-full ${priorityColors[item.priority]}`}>
                  {item.priority}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[item.status]}`}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>

              {item.description && (
                <p className="text-gray-600 mb-2">{item.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500">
                {item.dueDate && (
                  <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                )}
                <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
              </div>

              {item.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {item.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 ml-4">
              {item.status !== 'completed' && (
                <button
                  onClick={() => handleComplete(item.id)}
                  disabled={completing === item.id}
                  className="btn btn-secondary text-sm disabled:opacity-50"
                >
                  {completing === item.id ? '...' : 'Complete'}
                </button>
              )}
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deleting === item.id}
                className="btn text-red-600 hover:bg-red-50 text-sm disabled:opacity-50"
              >
                {deleting === item.id ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
