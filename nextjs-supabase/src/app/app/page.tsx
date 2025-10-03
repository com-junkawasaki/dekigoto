import { createClient } from '@/utils/supabase/server-utils'
import Link from 'next/link'
import { getTodoLists, getTodoItems, getTodoStats, TodoList, TodoItem } from '@/utils/supabase/todo'

// Merkle DAG: public_app -> todo_display
// Server Component for public application content with TODO display
export default async function PublicApp() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch TODO data regardless of authentication status
  let lists: TodoList[] = []
  let items: TodoItem[] = []
  let stats: any = { total: 0, pending: 0, in_progress: 0, completed: 0 }

  try {
    // For demo purposes, try to fetch data (will work if user is logged in)
    const [listsData, itemsData, statsData] = await Promise.all([
      getTodoLists().catch(() => []),
      getTodoItems().catch(() => []),
      getTodoStats().catch(() => ({ total: 0, pending: 0, in_progress: 0, completed: 0 }))
    ])
    lists = listsData
    items = itemsData
    stats = statsData
  } catch (error) {
    // If data fetch fails, show demo data
    console.log('Using demo data for public access')
  }

  // Demo data for when no real data is available
  const demoLists: TodoList[] = [
    { id: 'demo-list-1', user_id: 'demo', title: 'Demo Tasks', description: 'Sample task list', color: '#3b82f6', is_default: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ]

  const demoItems: TodoItem[] = [
    { id: 'demo-item-1', list_id: 'demo-list-1', user_id: 'demo', title: 'Welcome to ActorDB', description: 'Experience event-sourcing powered task management', priority: 'high', status: 'pending', tags: ['demo', 'welcome'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'demo-item-2', list_id: 'demo-list-1', user_id: 'demo', title: 'Try the TODO App', description: 'Sign in to create and manage your own tasks', priority: 'medium', status: 'pending', tags: ['tutorial'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'demo-item-3', list_id: 'demo-list-1', user_id: 'demo', title: 'Event Sourcing Demo', description: 'Every action creates an immutable event in ActorDB', priority: 'low', status: 'completed', completed_at: new Date().toISOString(), tags: ['event-sourcing', 'demo'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ]

  const demoStats = { total: 3, pending: 2, in_progress: 0, completed: 1, high_priority: 1 }

  // Use real data if available, otherwise demo data
  const displayLists = lists.length > 0 ? lists : demoLists
  const displayItems = items.length > 0 ? items : demoItems
  const displayStats = stats.total > 0 ? stats : demoStats
  const isDemoMode = lists.length === 0 && items.length === 0

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {user ? 'Your Dashboard' : 'ActorDB Demo Dashboard'}
              </h1>
              <p className="mt-2 text-gray-600">
                {user
                  ? 'Welcome back! Here\'s your task overview.'
                  : 'Experience ActorDB-powered task management without signing in.'
                }
                {isDemoMode && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Demo Mode
                  </span>
                )}
              </p>
            </div>
            {!user && (
              <div className="flex space-x-3">
                <Link
                  href="/signin"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Task Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{displayStats.total}</div>
              <div className="text-sm text-gray-600">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{displayStats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{displayStats.in_progress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{displayStats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
          </div>
        </div>

        {/* TODO Lists and Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lists Overview */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Task Lists</h2>
            {displayLists.length > 0 ? (
              <div className="space-y-3">
                {displayLists.map((list) => (
                  <div key={list.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: list.color }}
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">{list.title}</h3>
                        {list.description && (
                          <p className="text-sm text-gray-600">{list.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {displayItems.filter(item => item.list_id === list.id).length} tasks
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No task lists available.</p>
            )}
          </div>

          {/* Recent Tasks */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Tasks</h2>
            {displayItems.length > 0 ? (
              <div className="space-y-3">
                {displayItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                      item.status === 'completed' ? 'bg-green-500' :
                      item.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium truncate ${
                        item.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
                      }`}>
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-sm text-gray-600 truncate">{item.description}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.priority === 'high' ? 'bg-red-100 text-red-800' :
                          item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {item.priority}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {displayItems.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">
                    And {displayItems.length - 5} more tasks...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No tasks available.</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Ready to manage your own tasks?</h3>
              <p className="text-gray-600">
                Sign in to create, edit, and organize your personal task lists with full event sourcing.
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/todo"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Full TODO App →
              </Link>
              {!user && (
                <Link
                  href="/signup"
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* User Info (if logged in) */}
        {user && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
                <div className="mt-2 space-y-1">
                  <p><span className="font-medium">Email:</span> {user.email}</p>
                  <p><span className="font-medium">User ID:</span> {user.id}</p>
                  <p><span className="font-medium">Joined:</span> {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
