// Merkle DAG: todo_events -> event_definitions
// Event definitions for TODO application with event sourcing

import { Event } from '../actordb/eventstore'
import { EventFactory } from '../../../../client/typescript/src/actor';

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

const todoListEventFactory = new EventFactory<TodoListCreatedEventData>(
  'todo_list',
  (data) => data.listId,
  (data) => ({ userId: data.userId })
);

type TodoItemEventWithId = (
  | TodoItemCreatedEventData
  | TodoItemUpdatedEventData
  | TodoItemCompletedEventData
  | TodoItemDeletedEventData
) & { itemId: string };

const todoItemEventFactory = new EventFactory<TodoItemEventWithId>(
  'todo_item',
  (data) => data.itemId,
  (data) => {
    const metadata: Record<string, any> = {};
    if ('userId' in data && typeof data.userId === 'string') {
      metadata.userId = data.userId;
    }
    if ('listId' in data && typeof data.listId === 'string') {
      metadata.listId = data.listId;
    }
    return metadata;
  }
);

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
  return todoListEventFactory.create(data, 1) as TodoEvent;
}

export function createTodoItemCreatedEvent(data: TodoItemCreatedEventData): TodoEvent {
  return todoItemEventFactory.create(data, 1) as TodoEvent;
}

export function createTodoItemUpdatedEvent(
  itemId: string,
  sequence: number,
  updates: TodoItemUpdatedEventData['updates']
): TodoEvent {
  const data: TodoItemUpdatedEventData = {
    type: 'todo_item_updated',
    itemId,
    updates,
  };
  return todoItemEventFactory.create(data, sequence + 1) as TodoEvent;
}

export function createTodoItemCompletedEvent(itemId: string, sequence: number): TodoEvent {
  const data: TodoItemCompletedEventData = {
    type: 'todo_item_completed',
    itemId,
    completedAt: new Date().toISOString(),
  };
  return todoItemEventFactory.create(data, sequence + 1) as TodoEvent;
}

export function createTodoItemDeletedEvent(itemId: string, sequence: number): TodoEvent {
  const data: TodoItemDeletedEventData = {
    type: 'todo_item_deleted',
    itemId,
  };
  return todoItemEventFactory.create(data, sequence + 1) as TodoEvent;
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
