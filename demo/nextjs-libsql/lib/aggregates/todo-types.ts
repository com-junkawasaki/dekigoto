// Merkle DAG: todo_types -> domain_state_definitions
// This file centralizes the type definitions for the domain's state,
// which were previously inside the aggregate class file.

import { TodoItem, TodoList } from "./todo-aggregate"; // Re-using base types for now

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
