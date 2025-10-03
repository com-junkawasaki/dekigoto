// Merkle DAG: todo_reducer -> declarative_state_transition_logic
// This file defines the state transition logic for the TodoItem aggregate
// in a declarative, functional way, using the Reducer pattern.

import { Reducer } from "@client/actor";
import { 
  TodoItemState, 
  TodoList,
  PendingTodoItem,
  CompletedTodoItem,
  CancelledTodoItem,
} from "./todo-types"; // We will create this file next
import { 
  TodoEventData, 
  TodoItemCreatedEventData,
  TodoItemUpdatedEventData,
  TodoItemCompletedEventData,
  TodoItemDeletedEventData,
} from "../events/todo-events";

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
