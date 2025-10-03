// Merkle DAG: todo_aggregate -> event_sourced_model
// Event-sourced aggregates for TODO application

import { Event } from '../actordb/eventstore'
import {
  TodoEventData,
  isTodoListCreatedEvent,
  isTodoItemCreatedEvent,
  isTodoItemUpdatedEvent,
  isTodoItemCompletedEvent,
  isTodoItemDeletedEvent,
  TodoListCreatedEventData,
  TodoItemCreatedEventData,
  TodoItemUpdatedEventData,
  TodoItemCompletedEventData,
  TodoItemDeletedEventData,
} from '../events/todo-events'
import { AggregateRoot, projectFromEvents } from '../../../../client/typescript/src/actor';

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
export class TodoListAggregate extends AggregateRoot<TodoList, TodoEventData> {
  constructor(id: string, events: Event[]) {
    const initialState: TodoList = {
      id: '',
      userId: '',
      title: '',
      color: '',
      isDefault: false,
      createdAt: '',
      updatedAt: '',
    };
    super(id, initialState);

    this.register<TodoListCreatedEventData>('todo_list_created', this.onTodoListCreated);

    this.applyAll(events);
  }

  private onTodoListCreated(_state: TodoList, data: TodoListCreatedEventData): TodoList {
    return {
      id: data.listId,
      userId: data.userId,
      title: data.title,
      description: data.description,
      color: data.color,
      isDefault: data.isDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export class TodoItemAggregate extends AggregateRoot<TodoItem, TodoEventData> {
  constructor(id: string, events: Event[]) {
    const initialState: TodoItem = {
      id: '',
      listId: '',
      userId: '',
      title: '',
      priority: 'low',
      status: 'pending',
      tags: [],
      createdAt: '',
      updatedAt: '',
    };
    super(id, initialState);

    this.register<TodoItemCreatedEventData>('todo_item_created', this.onTodoItemCreated);
    this.register<TodoItemUpdatedEventData>('todo_item_updated', this.onTodoItemUpdated);
    this.register<TodoItemCompletedEventData>('todo_item_completed', this.onTodoItemCompleted);
    this.register<TodoItemDeletedEventData>('todo_item_deleted', this.onTodoItemDeleted);

    this.applyAll(events);
  }

  private onTodoItemCreated(_state: TodoItem, data: TodoItemCreatedEventData): TodoItem {
    return {
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
      updatedAt: new Date().toISOString(),
    };
  }

  private onTodoItemUpdated(state: TodoItem, data: TodoItemUpdatedEventData): TodoItem {
    return {
      ...state,
      ...data.updates,
      updatedAt: new Date().toISOString(),
    };
  }

  private onTodoItemCompleted(state: TodoItem, data: TodoItemCompletedEventData): TodoItem {
    return {
      ...state,
      status: 'completed',
      completedAt: data.completedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  private onTodoItemDeleted(state: TodoItem, _data: TodoItemDeletedEventData): TodoItem {
    return {
      ...state,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
  }
}

// Factory functions for creating aggregates from events
export function createTodoListFromEvents(events: Event[]): TodoList | null {
  if (events.length === 0) return null;
  const aggregate = new TodoListAggregate(events[0].aggregateId, events);
  return aggregate.getState();
}

export function createTodoItemFromEvents(events: Event[]): TodoItem | null {
  if (events.length === 0) return null;
  const aggregate = new TodoItemAggregate(events[0].aggregateId, events);
  const finalState = aggregate.getState();
  // Don't return deleted items
  if (finalState.status === 'cancelled') return null;
  return finalState;
}

// Helper functions for working with aggregates
export function getAllTodoLists(events: Event[]): TodoList[] {
  return projectFromEvents(events, 'todo_list', (id, evts) => new TodoListAggregate(id, evts));
}

export function getAllTodoItems(events: Event[]): TodoItem[] {
  return projectFromEvents(events, 'todo_item', (id, evts) => new TodoItemAggregate(id, evts));
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
