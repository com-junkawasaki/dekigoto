// Merkle DAG: todo_aggregate -> event_sourced_model
// Event-sourced aggregates for TODO application

import { Event } from '@/lib/actordb/eventstore'
import {
  TodoEventData,
  isTodoListCreatedEvent,
  isTodoItemCreatedEvent,
  isTodoItemUpdatedEvent,
  isTodoItemCompletedEvent,
  isTodoItemDeletedEvent
} from '@/lib/events/todo-events'

// Current state interfaces
export interface TodoList {
  id: string
  userId: string
  title: string
  description?: string
  color: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface TodoItem {
  id: string
  listId: string
  userId: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  dueDate?: string
  completedAt?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

// Aggregate classes for state reconstruction
export class TodoListAggregate {
  private state: TodoList | null = null

  constructor(events: Event[]) {
    this.applyEvents(events)
  }

  private applyEvents(events: Event[]): void {
    for (const event of events) {
      this.applyEvent(event.data as TodoEventData)
    }
  }

  private applyEvent(data: TodoEventData): void {
    if (isTodoListCreatedEvent(data)) {
      this.state = {
        id: data.listId,
        userId: data.userId,
        title: data.title,
        description: data.description,
        color: data.color,
        isDefault: data.isDefault,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
  }

  getState(): TodoList | null {
    return this.state
  }
}

export class TodoItemAggregate {
  private state: TodoItem | null = null

  constructor(events: Event[]) {
    this.applyEvents(events)
  }

  private applyEvents(events: Event[]): void {
    for (const event of events) {
      this.applyEvent(event.data as TodoEventData)
    }
  }

  private applyEvent(data: TodoEventData): void {
    if (isTodoItemCreatedEvent(data)) {
      this.state = {
        id: data.itemId,
        listId: data.listId,
        userId: data.userId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: 'pending',
        dueDate: data.dueDate,
        tags: data.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    } else if (isTodoItemUpdatedEvent(data) && this.state) {
      // Apply updates
      if (data.updates.title !== undefined) this.state.title = data.updates.title
      if (data.updates.description !== undefined) this.state.description = data.updates.description
      if (data.updates.priority !== undefined) this.state.priority = data.updates.priority
      if (data.updates.dueDate !== undefined) this.state.dueDate = data.updates.dueDate
      if (data.updates.tags !== undefined) this.state.tags = data.updates.tags
      this.state.updatedAt = new Date().toISOString()
    } else if (isTodoItemCompletedEvent(data) && this.state) {
      this.state.status = 'completed'
      this.state.completedAt = data.completedAt
      this.state.updatedAt = new Date().toISOString()
    } else if (isTodoItemDeletedEvent(data) && this.state) {
      // Mark as deleted (soft delete)
      this.state.status = 'cancelled'
      this.state.updatedAt = new Date().toISOString()
    }
  }

  getState(): TodoItem | null {
    return this.state
  }
}

// Factory functions for creating aggregates from events
export function createTodoListFromEvents(events: Event[]): TodoList | null {
  const aggregate = new TodoListAggregate(events)
  return aggregate.getState()
}

export function createTodoItemFromEvents(events: Event[]): TodoItem | null {
  const aggregate = new TodoItemAggregate(events)
  return aggregate.getState()
}

// Helper functions for working with aggregates
export function getAllTodoLists(events: Event[]): TodoList[] {
  const lists = new Map<string, Event[]>()

  // Group events by list ID
  for (const event of events) {
    if (event.aggregateType === 'todo_list') {
      const listId = event.aggregateId
      if (!lists.has(listId)) {
        lists.set(listId, [])
      }
      lists.get(listId)!.push(event)
    }
  }

  // Create aggregates from event groups
  const result: TodoList[] = []
  for (const [listId, listEvents] of lists) {
    const list = createTodoListFromEvents(listEvents)
    if (list) {
      result.push(list)
    }
  }

  return result
}

export function getAllTodoItems(events: Event[]): TodoItem[] {
  const items = new Map<string, Event[]>()

  // Group events by item ID
  for (const event of events) {
    if (event.aggregateType === 'todo_item') {
      const itemId = event.aggregateId
      if (!items.has(itemId)) {
        items.set(itemId, [])
      }
      items.get(itemId)!.push(event)
    }
  }

  // Create aggregates from event groups
  const result: TodoItem[] = []
  for (const [itemId, itemEvents] of items) {
    const item = createTodoItemFromEvents(itemEvents)
    if (item) {
      result.push(item)
    }
  }

  return result
}

export function getTodoItemsByList(events: Event[], listId: string): TodoItem[] {
  return getAllTodoItems(events).filter(item => item.listId === listId)
}

export function getTodoStatistics(events: Event[]): {
  total: number
  pending: number
  inProgress: number
  completed: number
  highPriority: number
} {
  const items = getAllTodoItems(events)

  return {
    total: items.length,
    pending: items.filter(item => item.status === 'pending').length,
    inProgress: items.filter(item => item.status === 'in_progress').length,
    completed: items.filter(item => item.status === 'completed').length,
    highPriority: items.filter(item => item.priority === 'high').length
  }
}
