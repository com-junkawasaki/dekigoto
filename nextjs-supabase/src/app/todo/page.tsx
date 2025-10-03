import { createClient } from '@/utils/supabase/server-utils'
import { redirect } from 'next/navigation'
import { TodoDashboard } from '@/components/todo/TodoDashboard'
import { getTodoLists, getTodoItems, getTodoStats } from '@/utils/supabase/todo'

// Merkle DAG: todo_page -> event_sourced_ui
// Server Component for event-sourced TODO application with ActorDB integration
export default async function TodoPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect to signin if not authenticated
  if (!user || error) {
    redirect('/signin')
  }

  // Fetch initial data from ActorDB via API
  const [listsResponse, itemsResponse, statsResponse] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/todo?type=lists`),
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/todo?type=items`),
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/todo?type=stats`)
  ])

  const [listsData, itemsData, statsData] = await Promise.all([
    listsResponse.json(),
    itemsResponse.json(),
    statsResponse.json()
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <TodoDashboard
        user={user}
        initialLists={listsData.lists || []}
        initialItems={itemsData.items || []}
        initialStats={statsData.stats || {}}
      />
    </div>
  )
}
