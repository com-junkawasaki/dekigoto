'use client'

import { TodoItem } from '@/utils/supabase/todo'
import { CheckCircle, Circle, Clock, AlertTriangle, Trash2, Edit } from 'lucide-react'
import { updateTodoStatus, deleteTodo } from '@/app/todo/actions'

// Merkle DAG: todo_list -> item_display
// Client component for displaying and managing TODO items
interface TodoListProps {
  items: TodoItem[]
}

export function TodoList({ items }: TodoListProps) {
  const handleStatusChange = async (id: string, status: TodoItem['status']) => {
    try {
      await updateTodoStatus(id, status)
    } catch (error) {
      console.error('Failed to update todo status:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTodo(id)
      } catch (error) {
        console.error('Failed to delete todo:', error)
      }
    }
  }

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />
      case 'pending':
      default:
        return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  const getPriorityColor = (priority: TodoItem['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-600'
      case 'medium':
        return 'text-yellow-600'
      case 'low':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <CheckCircle className="w-12 h-12 mb-4" />
        <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
        <p className="text-sm">Create your first task to get started</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-200">
      {items.map((item) => (
        <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
          <div className="flex items-start space-x-4">
            {/* Status Checkbox */}
            <button
              onClick={() => handleStatusChange(
                item.id,
                item.status === 'completed' ? 'pending' : 'completed'
              )}
              className="mt-1 flex-shrink-0"
            >
              {getStatusIcon(item.status)}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className={`text-lg font-medium ${
                    item.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
                  }`}>
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1 text-gray-600">{item.description}</p>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {/* Priority */}
                  <div className={`flex items-center space-x-1 ${getPriorityColor(item.priority)}`}>
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium capitalize">{item.priority}</span>
                  </div>

                  {/* Due Date */}
                  {item.due_date && (
                    <div className="text-xs text-gray-500">
                      Due: {new Date(item.due_date).toLocaleDateString()}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <button
                    onClick={() => {/* TODO: Implement edit */}}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="mt-3 flex items-center text-xs text-gray-500 space-x-4">
                <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
                {item.status === 'completed' && item.completed_at && (
                  <span>Completed: {new Date(item.completed_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
