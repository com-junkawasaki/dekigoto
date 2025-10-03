// Merkle DAG: todo_utils -> crud_operations
// Process Network: query_interface -> todo_management
// TODO CRUD operations for the Next.js example

import { createClient } from './server-utils'

// Types for TODO functionality
export interface TodoList {
  id: string
  user_id: string
  title: string
  description?: string
  color: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface TodoItem {
  id: string
  list_id: string
  user_id: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  due_date?: string
  completed_at?: string
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateTodoListData {
  title: string
  description?: string
  color?: string
}

export interface CreateTodoItemData {
  list_id: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  due_date?: string
  tags?: string[]
}

// TODO List Operations
export async function getTodoLists() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todo_lists')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as TodoList[]
}

export async function getTodoList(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todo_lists')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as TodoList
}

export async function createTodoList(data: CreateTodoListData) {
  const supabase = await createClient()

  const { data: result, error } = await supabase
    .from('todo_lists')
    .insert([data])
    .select()
    .single()

  if (error) throw error
  return result as TodoList
}

export async function updateTodoList(id: string, updates: Partial<CreateTodoListData>) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todo_lists')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TodoList
}

export async function deleteTodoList(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('todo_lists')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// TODO Item Operations
export async function getTodoItems(listId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('todo_items')
    .select(`
      *,
      todo_lists (
        title,
        color
      )
    `)
    .order('created_at', { ascending: false })

  if (listId) {
    query = query.eq('list_id', listId)
  }

  const { data, error } = await query

  if (error) throw error
  return data as (TodoItem & { todo_lists: { title: string; color: string } })[]
}

export async function getTodoItem(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todo_items')
    .select(`
      *,
      todo_lists (
        title,
        color
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as TodoItem & { todo_lists: { title: string; color: string } }
}

export async function createTodoItem(data: CreateTodoItemData) {
  const supabase = await createClient()

  const { data: result, error } = await supabase
    .from('todo_items')
    .insert([data])
    .select()
    .single()

  if (error) throw error
  return result as TodoItem
}

export async function updateTodoItem(id: string, updates: Partial<CreateTodoItemData & {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  completed_at?: string
}>) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todo_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TodoItem
}

export async function deleteTodoItem(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('todo_items')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Statistics
export async function getTodoStats() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todo_items')
    .select('status, priority')

  if (error) throw error

  const stats = {
    total: data.length,
    pending: data.filter(item => item.status === 'pending').length,
    in_progress: data.filter(item => item.status === 'in_progress').length,
    completed: data.filter(item => item.status === 'completed').length,
    high_priority: data.filter(item => item.priority === 'high').length,
  }

  return stats
}
