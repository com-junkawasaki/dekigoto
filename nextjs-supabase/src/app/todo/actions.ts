// Merkle DAG: todo_actions -> server_operations
// Server Actions for TODO CRUD operations
'use server'

import { revalidatePath } from 'next/cache'
import { createTodoItem, updateTodoItem, deleteTodoItem } from '@/utils/supabase/todo'

// Server Action for creating a new TODO item
export async function createTodo(formData: FormData) {
  const listId = formData.get('listId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const priority = formData.get('priority') as string
  const dueDate = formData.get('dueDate') as string
  const tags = formData.get('tags') as string

  if (!title || !listId) {
    throw new Error('Title and list ID are required')
  }

  const todoData = {
    list_id: listId,
    title,
    description: description || undefined,
    priority: (priority as 'low' | 'medium' | 'high') || 'medium',
    due_date: dueDate || undefined,
    tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
  }

  try {
    await createTodoItem(todoData)
    revalidatePath('/todo')
  } catch (error) {
    console.error('Failed to create todo:', error)
    throw new Error('Failed to create todo item')
  }
}

// Server Action for updating a TODO item
export async function updateTodoStatus(id: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  try {
    const updates: { status: 'pending' | 'in_progress' | 'completed' | 'cancelled'; completed_at?: string } = { status }
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
    } else {
      // Don't set completed_at for non-completed status
    }

    await updateTodoItem(id, updates)
    revalidatePath('/todo')
  } catch (error) {
    console.error('Failed to update todo status:', error)
    throw new Error('Failed to update todo status')
  }
}

// Server Action for deleting a TODO item
export async function deleteTodo(id: string) {
  try {
    await deleteTodoItem(id)
    revalidatePath('/todo')
  } catch (error) {
    console.error('Failed to delete todo:', error)
    throw new Error('Failed to delete todo item')
  }
}
