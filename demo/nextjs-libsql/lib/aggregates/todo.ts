// Merkle DAG: todo_aggregate_definition -> single_file_domain_logic
// This file consolidates all definitions related to the TodoItem aggregate,
// including types, state transition logic (reducer), and the configured ORM manager.

import { 
  Reducer, 
  TypedActorManager, 
  StateHandlerMap, 
  Actor, 
  ReducerAggregate,
  WriteResult,
  ActorDBClient
} from "@client/actor";
import { client } from '../database/config';
import { 
  TodoEventData, 
  TodoItemCreatedEventData,
  TodoItemUpdatedEventData,
  TodoItemCompletedEventData,
  TodoItemDeletedEventData,
} from "../events/todo-events";

// --- Domain State Types ---

// Base type for all states
export interface TodoItemState {
  id: string;
  listId: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string;
  completedAt?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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


// --- Declarative State Transition Logic (Reducer) ---

export const todoItemInitialState: TodoItemState = {
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

export const todoItemReducer: Reducer<TodoItemState, TodoEventData> = {
  todo_item_created: (state, data) => ({
    ...state,
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
  }),
  todo_item_updated: (state, data) => ({
    ...state,
    ...data.updates,
    updatedAt: new Date().toISOString(),
  }),
  todo_item_completed: (state, data) => ({
    ...state,
    status: 'completed',
    completedAt: data.completedAt,
    updatedAt: new Date().toISOString(),
  }),
  todo_item_deleted: (state, data) => ({
    ...state,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
  }),
};


// --- ORM Configuration & Manager ---

const todoItemHandlerMap: StateHandlerMap<TodoItemState, { state: TodoItemState; actor: Actor }> = {
  pending: (base) => ({
    ...base,
    state: base.state as PendingTodoItem,
    update: (updates: TodoItemUpdatedEventData['updates']): Promise<WriteResult> =>
      base.actor.writeEvent('todo_item_updated', {
        type: 'todo_item_updated',
        itemId: base.actor.getAggregateId(),
        updates,
      }),
    complete: (): Promise<WriteResult> =>
      base.actor.writeEvent('todo_item_completed', {
        type: 'todo_item_completed',
        itemId: base.actor.getAggregateId(),
        completedAt: new Date().toISOString(),
      }),
    delete: (): Promise<WriteResult> =>
      base.actor.writeEvent('todo_item_deleted', {
        type: 'todo_item_deleted',
        itemId: base.actor.getAggregateId(),
      }),
  }),
  in_progress: (base) => todoItemHandlerMap.pending(base),
  completed: (base) => ({
    ...base,
    state: base.state as CompletedTodoItem,
    delete: (): Promise<WriteResult> =>
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
 */
export const todoItemManager = (client: ActorDBClient) => new TypedActorManager(
  client,
  (id, events) => new ReducerAggregate(id, todoItemInitialState, todoItemReducer, events),
  (state) => state.status,
  todoItemHandlerMap
);
