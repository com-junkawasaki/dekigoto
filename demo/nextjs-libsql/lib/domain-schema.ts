// Merkle DAG: app_schema -> domain_definition_aggregation
// This file aggregates all domain definitions (aggregates, commands, queries)
// to configure the high-level ActorDB client, similar to how a schema is
// defined for a database ORM.

import { ReducerAggregate } from '@client/actor';
import { todoItemReducer, todoItemInitialState, todoItemManager } from './aggregates/todo';

import {
  CompleteTodoItemCommand,
  // We will add more commands here, e.g., CreateTodoItemCommand
} from './application/use-cases';

export const appSchema = {
  aggregates: {
    todoItem: {
      // Instead of a class, we provide the config for the generic ReducerAggregate
      aggregateFactory: (id: string, events: any[]) =>
        new ReducerAggregate(id, todoItemInitialState, todoItemReducer, events),
      manager: todoItemManager,
    },
    // todoList: { ... }
  },
  commands: {
    'todoItem.complete': {
      commandClass: CompleteTodoItemCommand,
    },
    // 'todoItem.create': { ... }
  },
  queries: {
    // 'todo.getAll': { ... }
  },
  projections: {
    // 'allTodos': { ... }
  },
};

// This type helps infer all possible actor and command names for type safety
export type AppSchema = typeof appSchema;
