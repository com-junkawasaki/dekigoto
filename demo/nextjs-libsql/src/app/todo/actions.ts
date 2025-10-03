// Server actions for Todo operations
'use server'

import { getEventStore } from '../../../lib/actordb/eventstore'
import { getProjectionEngine } from '../../../lib/actordb/projector'
import {
  createTodoListCreatedEvent,
  createTodoItemCreatedEvent,
  createTodoItemUpdatedEvent,
  createTodoItemCompletedEvent,
  createTodoItemDeletedEvent,
  type TodoListCreatedEventData,
  type TodoItemCreatedEventData,
  type TodoItemUpdatedEventData
} from '../../../lib/events/todo-events'
import { revalidatePath } from 'next/cache'

const eventStore = getEventStore()
const projectionEngine = getProjectionEngine()

// Initialize projections
projectionEngine.registerProjection({
  name: 'todo_lists',
  eventTypes: ['todo_list_created'],
  initialState: () => ({ lists: [] }),
  reducer: (state, event) => {
    if (event.eventType === 'todo_list_created') {
      const data = event.data as TodoListCreatedEventData
      return {
        ...state,
        lists: [...state.lists, {
          id: data.listId,
          title: data.title,
          description: data.description,
          color: data.color,
          isDefault: data.isDefault,
          userId: data.userId,
          createdAt: event.timestamp.toISOString()
        }]
      }
    }
    return state
  }
})

projectionEngine.registerProjection({
  name: 'todo_items',
  eventTypes: ['todo_item_created', 'todo_item_updated', 'todo_item_completed', 'todo_item_deleted'],
  initialState: () => ({ items: [] }),
  reducer: (state, event) => {
    if (event.eventType === 'todo_item_created') {
      const data = event.data as TodoItemCreatedEventData
      return {
        ...state,
        items: [...state.items, {
          id: data.itemId,
          listId: data.listId,
          title: data.title,
          description: data.description,
          priority: data.priority,
          status: 'pending',
          dueDate: data.dueDate,
          tags: data.tags,
          userId: data.userId,
          createdAt: event.timestamp.toISOString(),
          updatedAt: event.timestamp.toISOString()
        }]
      }
    } else if (event.eventType === 'todo_item_updated') {
      const data = event.data as TodoItemUpdatedEventData
      return {
        ...state,
        items: state.items.map((item: any) =>
          item.id === data.itemId
            ? { ...item, ...data.updates, updatedAt: event.timestamp.toISOString() }
            : item
        )
      }
    } else if (event.eventType === 'todo_item_completed') {
      const data = event.data
      return {
        ...state,
        items: state.items.map((item: any) =>
          item.id === data.itemId
            ? { ...item, status: 'completed', completedAt: data.completedAt, updatedAt: event.timestamp.toISOString() }
            : item
        )
      }
    } else if (event.eventType === 'todo_item_deleted') {
      const data = event.data
      return {
        ...state,
        items: state.items.map((item: any) =>
          item.id === data.itemId
            ? { ...item, status: 'cancelled', updatedAt: event.timestamp.toISOString() }
            : item
        )
      }
    }
    return state
  }
})

// Todo list actions
export async function createTodoList(data: TodoListCreatedEventData) {
  try {
    const event = createTodoListCreatedEvent(data)
    const result = await eventStore.writeEvent(event)

    if (result.success) {
      await projectionEngine.processEvent(event)
      revalidatePath('/')
      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error) {
    return { success: false, error: 'Failed to create todo list' }
  }
}

export async function getTodoLists() {
  try {
    const projection = await projectionEngine.queryProjection('todo_lists')
    return { success: true, data: projection.lists }
  } catch (error) {
    return { success: false, error: 'Failed to get todo lists' }
  }
}

// Todo item actions
export async function createTodoItem(data: TodoItemCreatedEventData) {
  try {
    const event = createTodoItemCreatedEvent(data)
    const result = await eventStore.writeEvent(event)

    if (result.success) {
      await projectionEngine.processEvent(event)
      revalidatePath('/')
      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error) {
    return { success: false, error: 'Failed to create todo item' }
  }
}

export async function updateTodoItem(itemId: string, updates: TodoItemUpdatedEventData['updates']) {
  try {
    // Get current sequence
    const actorState = await eventStore.getActorState(itemId)
    if (!actorState) {
      return { success: false, error: 'Todo item not found' }
    }

    const event = createTodoItemUpdatedEvent(itemId, actorState.lastSequence, updates)
    const result = await eventStore.writeEvent(event)

    if (result.success) {
      await projectionEngine.processEvent(event)
      revalidatePath('/')
      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error) {
    return { success: false, error: 'Failed to update todo item' }
  }
}

export async function completeTodoItem(itemId: string) {
  try {
    // Get current sequence
    const actorState = await eventStore.getActorState(itemId)
    if (!actorState) {
      return { success: false, error: 'Todo item not found' }
    }

    const event = createTodoItemCompletedEvent(itemId, actorState.lastSequence)
    const result = await eventStore.writeEvent(event)

    if (result.success) {
      await projectionEngine.processEvent(event)
      revalidatePath('/')
      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error) {
    return { success: false, error: 'Failed to complete todo item' }
  }
}

export async function deleteTodoItem(itemId: string) {
  try {
    // Get current sequence
    const actorState = await eventStore.getActorState(itemId)
    if (!actorState) {
      return { success: false, error: 'Todo item not found' }
    }

    const event = createTodoItemDeletedEvent(itemId, actorState.lastSequence)
    const result = await eventStore.writeEvent(event)

    if (result.success) {
      await projectionEngine.processEvent(event)
      revalidatePath('/')
      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error) {
    return { success: false, error: 'Failed to delete todo item' }
  }
}

export async function getTodoItems(listId?: string) {
  try {
    const projection = await projectionEngine.queryProjection('todo_items')
    let items = projection.items

    if (listId) {
      items = items.filter((item: any) => item.listId === listId)
    }

    return { success: true, data: items }
  } catch (error) {
    return { success: false, error: 'Failed to get todo items' }
  }
}

export async function getTodoStatistics() {
  try {
    const projection = await projectionEngine.queryProjection('todo_items')
    const items = projection.items

    const stats = {
      total: items.length,
      pending: items.filter((item: any) => item.status === 'pending').length,
      inProgress: items.filter((item: any) => item.status === 'in_progress').length,
      completed: items.filter((item: any) => item.status === 'completed').length,
      highPriority: items.filter((item: any) => item.priority === 'high').length
    }

    return { success: true, data: stats }
  } catch (error) {
    return { success: false, error: 'Failed to get statistics' }
  }
}
