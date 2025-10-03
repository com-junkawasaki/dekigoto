'use client'

import { User } from '@supabase/supabase-js'
import { TodoList } from '@/utils/supabase/todo'
import { Plus, List } from 'lucide-react'

// Merkle DAG: todo_sidebar -> list_navigation
// Client component for TODO list sidebar navigation
interface TodoSidebarProps {
  lists: TodoList[]
  selectedListId: string | null
  onSelectList: (id: string | null) => void
  user: User
}

export function TodoSidebar({ lists, selectedListId, onSelectList, user }: TodoSidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user.email?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.email}
            </p>
            <p className="text-xs text-gray-500">Task Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        <button
          onClick={() => onSelectList(null)}
          className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedListId === null
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <List className="w-5 h-5 mr-3" />
          All Tasks
        </button>

        <div className="pt-4">
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Lists
            </h3>
            <button className="text-gray-400 hover:text-gray-600">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => onSelectList(list.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedListId === list.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                  style={{ backgroundColor: list.color }}
                />
                <span className="truncate">{list.title}</span>
                {list.is_default && (
                  <span className="ml-auto text-xs text-gray-400">default</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Powered by ActorDB
        </div>
      </div>
    </div>
  )
}
