import { ICommand, ICommandHandler } from "@client/actor";
import { CompleteTodoItemCommand, CompleteTodoItemHandler } from "../application/use-cases";
import { actorDbClient } from '../client';
import { TodoItemAggregate, todoItemManager } from './todo';

// --- Command ---
export class CreateTodoItemCommand implements ICommand {
  readonly type = 'CreateTodoItem';
  constructor(
    public readonly listId: string,
    public readonly title: string,
    public readonly userId: string
  ) {}
}

// --- Handler ---
export class CreateTodoItemHandler implements ICommandHandler<CreateTodoItemCommand> {
  async handle(command: CreateTodoItemCommand): Promise<{ itemId: string }> {
    const itemId = crypto.randomUUID();

    // Use the Supabase-style client to dispatch the underlying event-creating command
    const { error } = await actorDbClient
      .actor('todoItem', itemId)
      .dispatch('todoItem.create', {
        ...command,
        itemId,
        type: 'todo_item_created',
        // other properties for the event...
      });

    if (error) {
      throw new Error(`Failed to create todo item: ${error.message}`);
    }

    return { itemId };
  }
}
