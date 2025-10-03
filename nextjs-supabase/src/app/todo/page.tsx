import { createClient } from '@/utils/supabase/server-utils'
import { redirect } from 'next/navigation'
import { TodoDashboard } from '@/components/todo/TodoDashboard'
import { getTodoLists, getTodoItems, getTodoStats } from '@/utils/supabase/todo'

// Merkle DAG: todo_page -> task_management_ui
// Server Component for TODO application with server-side authentication and data fetching
export default async function TodoPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect to signin if not authenticated
  if (!user || error) {
    redirect('/signin')
  }

  // Fetch initial data on server
  const [lists, items, stats] = await Promise.all([
    getTodoLists(),
    getTodoItems(),
    getTodoStats()
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <TodoDashboard user={user} initialLists={lists} initialItems={items} initialStats={stats} />
    </div>
  )
}
