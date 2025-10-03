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
import { 
  AggregateRoot, 
  projectFromEvents,
  TypedActorManager,
  StateHandlerMap,
} from '../../../../client/typescript/src/actor';
import { Actor } from '../actordb/actor';
import { WriteResult } from '../actordb/types';
import { client } from '../database/config';

// Merkle DAG: typed_actor_handle -> fsm_state_types
// By defining distinct types for each state, we can create handles
// that only expose valid methods for that state, inspired by Statecharts.

// Base type for all states
export interface TodoItemState extends TodoItem {
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

// State-specific types
export interface PendingTodoItem extends TodoItemState {
  status: 'pending' | 'in_progress';
}
export interface CompletedTodoItem extends TodoItemState {
  status: 'completed';
}
export interface CancelledTodoItem extends TodoItemState {
  status: 'cancelled';
}

// Type guard to check if a todo is in a pending state
function isPending(todo: TodoItemState | null): todo is PendingTodoItem {
  return todo?.status === 'pending' || todo?.status === 'in_progress';
}

// Type guard to check if a todo is completed
function isCompleted(todo: TodoItemState | null): todo is CompletedTodoItem {
  return todo?.status === 'completed';
}


// --- Type-Safe Actor Handles ---
// These handles expose methods based on the actor's current state.

interface BaseTodoItemActorHandle {
  state: TodoItemState;
  actor: Actor;
}

export interface PendingTodoItemActorHandle extends BaseTodoItemActorHandle {
  state: PendingTodoItem;
  update: (updates: TodoItemUpdatedEventData['updates']) => Promise<WriteResult>;
  complete: () => Promise<WriteResult>;
  delete: () => Promise<WriteResult>;
}

export interface CompletedTodoItemActorHandle extends BaseTodoItemActorHandle {
  state: CompletedTodoItem;
  delete: () => Promise<WriteResult>;
  // Note: `update` and `complete` methods are not available here.
}

export interface CancelledTodoItemActorHandle extends BaseTodoItemActorHandle {
  state: CancelledTodoItem;
  // No actions are possible on a cancelled item.
}

// A union of all possible handles
export type TypedTodoItemActorHandle =
  | PendingTodoItemActorHandle
  | CompletedTodoItemActorHandle
  | CancelledTodoItemActorHandle;


// --- ORM Configuration for TodoItem ---

const todoItemHandlerMap: StateHandlerMap<TodoItemState, { state: TodoItemState; actor: Actor }> = {
  pending: (base) => ({
    ...base,
    state: base.state as PendingTodoItem,
    update: (updates) =>
      base.actor.writeEvent('todo_item_updated', {
        type: 'todo_item_updated',
        itemId: base.actor.getAggregateId(),
        updates,
      }),
    complete: () =>
      base.actor.writeEvent('todo_item_completed', {
        type: 'todo_item_completed',
        itemId: base.actor.getAggregateId(),
        completedAt: new Date().toISOString(),
      }),
    delete: () =>
      base.actor.writeEvent('todo_item_deleted', {
        type: 'todo_item_deleted',
        itemId: base.actor.getAggregateId(),
      }),
  }),
  in_progress: (base) => todoItemHandlerMap.pending(base), // Treat in_progress the same as pending
  completed: (base) => ({
    ...base,
    state: base.state as CompletedTodoItem,
    delete: () =>
      base.actor.writeEvent('todo_item_deleted', {
        type: 'todo_item_deleted',
        itemId: base.actor.getAggregateId(),
      }),
  }),
  cancelled: (base) => ({
    ...base,
    state: base.state as CancelledTodoItem,
  }),
};

/**
 * The configured State-Session-ORM for TodoItem actors.
 * This manager is the primary entry point for interacting with TodoItem aggregates.
 */
export const todoItemManager = new TypedActorManager(
  client,
  TodoItemAggregate,
  (state) => state.status,
  todoItemHandlerMap
);


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

/**
 * High-level factory to get a type-safe handle for a TodoItem actor.
 * This is the primary entry point for interacting with a specific TodoItem.
 */
export async function getTypedTodoItemActor(
  actor: Actor,
  events: Event[]
): Promise<TypedTodoItemActorHandle | null> {
  const aggregate = new TodoItemAggregate(actor.getAggregateId(), events);
  const state = aggregate.getState() as TodoItemState;

  await actor.loadSequence();
  const currentSequence = actor.getSequence();

  const baseHandle = { state, actor };

  if (isPending(state)) {
    return {
      ...baseHandle,
      state,
      update: (updates) =>
        actor.writeEvent('todo_item_updated', {
          type: 'todo_item_updated',
          itemId: actor.getAggregateId(),
          updates,
        }),
      complete: () =>
        actor.writeEvent('todo_item_completed', {
          type: 'todo_item_completed',
          itemId: actor.getAggregateId(),
          completedAt: new Date().toISOString(),
        }),
      delete: () =>
        actor.writeEvent('todo_item_deleted', {
          type: 'todo_item_deleted',
          itemId: actor.getAggregateId(),
        }),
    };
  }

  if (isCompleted(state)) {
    return {
      ...baseHandle,
      state,
      delete: () =>
        actor.writeEvent('todo_item_deleted', {
          type: 'todo_item_deleted',
          itemId: actor.getAggregateId(),
        }),
    };
  }
  
  if (state && state.status === 'cancelled') {
    return {
      ...baseHandle,
      state: state as CancelledTodoItem,
    };
  }

  return null;
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
