// Merkle DAG: app_schema -> secure_declarative_domain_definition
// This file is the Single Source of Truth for the entire domain, including
// state, commands, queries, and security capabilities.

import { ReducerAggregate } from '@client/actor';
import { todoItemReducer, todoItemInitialState, todoItemManager, TodoItemState } from './aggregates/todo';
import { CompleteTodoItemCommand, CreateTodoItemCommand } from './application/use-cases';

// --- Query Definitions ---
export const queries = {
  todosByList: {
    // zod schema for input validation
    // input: z.object({ listId: z.string() }), 
    handler: async (input: { listId: string }): Promise<TodoItemState[]> => {
      // In a real implementation, this would fetch events and project them.
      console.log(`Fetching todos for list: ${input.listId}`);
      return []; 
    }
  }
};

// --- Capability Definitions ---
const USER_CAPABILITIES = {
  canDispatch: [
    'todoItem.create',
    'todoItem.complete',
    'todoItem.update',
    'todoItem.delete',
  ],
  canExecute: [
    'todosByList',
  ],
};

const GUEST_CAPABILITIES = {
  canDispatch: [],
  canExecute: ['todosByList'], // Guests can perhaps view public lists
};

// --- App Schema ---
export const appSchema = {
  aggregates: {
    todoItem: {
      aggregateFactory: (id: string, events: any[]) =>
        new ReducerAggregate(id, todoItemInitialState, todoItemReducer, events),
      manager: todoItemManager,
    },
  },
  commands: {
    'todoItem.create': CreateTodoItemCommand,
    'todoItem.complete': CompleteTodoItemCommand,
  },
  queries,
  capabilities: {
    user: USER_CAPABILITIES,
    guest: GUEST_CAPABILITIES,
  }
};

export type AppSchema = typeof appSchema;
