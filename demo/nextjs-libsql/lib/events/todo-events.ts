// Merkle DAG: todo_events -> event_definitions
// Event definitions for TODO application with event sourcing

import { Event } from '../actordb/eventstore'

// Base event interface for TODO events
export interface TodoEvent extends Omit<Event, 'data'> {
  data: TodoEventData
}

// Union type for all TODO event data
export type TodoEventData =
  | TodoListCreatedEventData
  | TodoItemCreatedEventData
  | TodoItemUpdatedEventData
  | TodoItemCompletedEventData
  | TodoItemDeletedEventData

// Event data types
export interface TodoListCreatedEventData {
  type: 'todo_list_created'
  listId: string
  title: string
  description?: string
  color: string
  isDefault: boolean
  userId: string
}

export interface TodoItemCreatedEventData {
  type: 'todo_item_created'
  itemId: string
  listId: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  tags: string[]
  userId: string
}

export interface TodoItemUpdatedEventData {
  type: 'todo_item_updated'
  itemId: string
  updates: Partial<{
    title: string
    description: string
    priority: 'low' | 'medium' | 'high'
    dueDate: string
    tags: string[]
  }>
}

export interface TodoItemCompletedEventData {
  type: 'todo_item_completed'
  itemId: string
  completedAt: string
}

export interface TodoItemDeletedEventData {
  type: 'todo_item_deleted'
  itemId: string
}

// Event creation helpers
export function createTodoListCreatedEvent(data: TodoListCreatedEventData): TodoEvent {
  return {
    aggregateId: data.listId,
    aggregateType: 'todo_list',
    sequence: 1, // This will be set by the event store
    eventType: 'todo_list_created',
    data,
    timestamp: new Date(),
    eventTime: new Date(),
    metadata: {
      userId: data.userId,
      eventVersion: '1.0'
    }
  }
}

export function createTodoItemCreatedEvent(data: TodoItemCreatedEventData): TodoEvent {
  return {
    aggregateId: data.itemId,
    aggregateType: 'todo_item',
    sequence: 1, // This will be set by the event store
    eventType: 'todo_item_created',
    data,
    timestamp: new Date(),
    eventTime: new Date(),
    metadata: {
      userId: data.userId,
      listId: data.listId,
      eventVersion: '1.0'
    }
  }
}

export function createTodoItemUpdatedEvent(
  itemId: string,
  sequence: number,
  updates: TodoItemUpdatedEventData['updates']
): TodoEvent {
  return {
    aggregateId: itemId,
    aggregateType: 'todo_item',
    sequence: sequence + 1,
    eventType: 'todo_item_updated',
    data: {
      type: 'todo_item_updated',
      itemId,
      updates
    },
    timestamp: new Date(),
    eventTime: new Date(),
    metadata: {
      eventVersion: '1.0'
    }
  }
}

export function createTodoItemCompletedEvent(itemId: string, sequence: number): TodoEvent {
  return {
    aggregateId: itemId,
    aggregateType: 'todo_item',
    sequence: sequence + 1,
    eventType: 'todo_item_completed',
    data: {
      type: 'todo_item_completed',
      itemId,
      completedAt: new Date().toISOString()
    },
    timestamp: new Date(),
    eventTime: new Date(),
    metadata: {
      eventVersion: '1.0'
    }
  }
}

export function createTodoItemDeletedEvent(itemId: string, sequence: number): TodoEvent {
  return {
    aggregateId: itemId,
    aggregateType: 'todo_item',
    sequence: sequence + 1,
    eventType: 'todo_item_deleted',
    data: {
      type: 'todo_item_deleted',
      itemId
    },
    timestamp: new Date(),
    eventTime: new Date(),
    metadata: {
      eventVersion: '1.0'
    }
  }
}

// Type guards for event data
export function isTodoListCreatedEvent(data: TodoEventData): data is TodoListCreatedEventData {
  return data.type === 'todo_list_created'
}

export function isTodoItemCreatedEvent(data: TodoEventData): data is TodoItemCreatedEventData {
  return data.type === 'todo_item_created'
}

export function isTodoItemUpdatedEvent(data: TodoEventData): data is TodoItemUpdatedEventData {
  return data.type === 'todo_item_updated'
}

export function isTodoItemCompletedEvent(data: TodoEventData): data is TodoItemCompletedEventData {
  return data.type === 'todo_item_completed'
}

export function isTodoItemDeletedEvent(data: TodoEventData): data is TodoItemDeletedEventData {
  return data.type === 'todo_item_deleted'
}
