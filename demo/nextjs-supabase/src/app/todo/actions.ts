// Merkle DAG: todo_actions -> event_sourced_operations
// Server Actions for event-sourced TODO operations using ActorDB
'use server'

import { revalidatePath } from 'next/cache'

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

  const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const eventData = {
    type: 'item' as const,
    itemId,
    listId,
    title,
    description: description || undefined,
    priority: (priority as 'low' | 'medium' | 'high') || 'medium',
    dueDate: dueDate || undefined,
    tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
    userId: 'current_user' // TODO: Get from auth context
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/todo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create todo item')
    }

    revalidatePath('/todo')
  } catch (error) {
    console.error('Failed to create todo:', error)
    throw new Error('Failed to create todo item')
  }
}

// Server Action for updating a TODO item status
export async function updateTodoStatus(id: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  try {
    const requestBody = status === 'completed'
      ? { action: 'complete' }
      : { status }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/todo/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update todo item')
    }

    revalidatePath('/todo')
  } catch (error) {
    console.error('Failed to update todo status:', error)
    throw new Error('Failed to update todo status')
  }
}

// Server Action for deleting a TODO item
export async function deleteTodo(id: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/todo/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete todo item')
    }

    revalidatePath('/todo')
  } catch (error) {
    console.error('Failed to delete todo:', error)
    throw new Error('Failed to delete todo item')
  }
}
