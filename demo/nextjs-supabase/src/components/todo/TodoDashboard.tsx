import { User } from '@supabase/supabase-js'
import { TodoList, TodoItem } from '@/utils/supabase/todo'
import { TodoDashboardClient } from './TodoDashboardClient'

// Merkle DAG: todo_dashboard -> ui_state_management
// Server component that passes initial data to client component
interface TodoDashboardProps {
  user: User
  initialLists: TodoList[]
  initialItems: TodoItem[]
  initialStats: { total?: number; pending?: number; in_progress?: number; completed?: number; high_priority?: number }
}

export function TodoDashboard({ user, initialLists, initialItems, initialStats }: TodoDashboardProps) {
  // Set default list if available
  const defaultListId = initialLists.length > 0
    ? (initialLists.find(list => list.is_default) || initialLists[0]).id
    : null

  return (
    <TodoDashboardClient
      user={user}
      initialLists={initialLists}
      initialItems={initialItems}
      initialStats={initialStats}
      defaultListId={defaultListId}
    />
  )
}
