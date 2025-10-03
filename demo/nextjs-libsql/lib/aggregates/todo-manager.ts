// Merkle DAG: todo_manager -> typed_actor_manager_instantiation
// This file configures and exports the TypedActorManager for the TodoItem aggregate.

import { TypedActorManager, StateHandlerMap, Actor, ReducerAggregate } from '@client/actor';
import { client } from '../database/config';
import { 
  TodoItemState, 
  PendingTodoItem, 
  CompletedTodoItem, 
  CancelledTodoItem 
} from './todo-types';
import { todoItemReducer, todoItemInitialState } from './todo-reducer';
import { TodoItemUpdatedEventData } from '../events/todo-events';
import { WriteResult } from '@client/types';


// --- ORM Configuration for TodoItem ---

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
export const todoItemManager = new TypedActorManager(
  client,
  (id, events) => new ReducerAggregate(id, todoItemInitialState, todoItemReducer, events),
  (state) => state.status,
  todoItemHandlerMap
);
