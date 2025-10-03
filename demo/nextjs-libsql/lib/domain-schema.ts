// Merkle DAG: app_schema -> domain_definition_aggregation
// This file aggregates all domain definitions (aggregates, commands, queries)
// to configure the high-level ActorDB client, similar to how a schema is
// defined for a database ORM.

import {
  TodoItemAggregate,
  todoItemManager, // We'll still use the manager for some internal logic
} from './aggregates/todo-aggregate';

import {
  CompleteTodoItemCommand,
  // We will add more commands here, e.g., CreateTodoItemCommand
} from './application/use-cases';

export const appSchema = {
  aggregates: {
    todoItem: {
      aggregateClass: TodoItemAggregate,
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
