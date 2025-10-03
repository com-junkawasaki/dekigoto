import { ICommand, ICommandHandler, ActorDBClient } from "@client/actor";
import { CompleteTodoItemCommand, CompleteTodoItemHandler } from "../application/use-cases";
import { todoItemManager } from "../../aggregates/todo";
import { CreateTodoItemCommand } from "./use-cases"; // Assume it's in the same file

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
  constructor(private readonly client: ActorDBClient) {}

  async handle(command: CreateTodoItemCommand): Promise<{ itemId: string }> {
    const itemId = crypto.randomUUID();
    // This handler would create events, etc.
    // It would use this.client for database operations.
    console.log(`Creating item ${itemId} for user ${command.userId}`);
    return { itemId };
  }
}

export class CompleteTodoItemHandler implements ICommandHandler<CompleteTodoItemCommand> {
  // The handler now receives dependencies via the constructor
  constructor(private readonly client: ActorDBClient) {}

  async handle(command: CompleteTodoItemCommand): Promise<void> {
    const { itemId } = command;
    // It uses its own manager instance, now configured with the injected client
    const manager = todoItemManager(this.client); 
    const handle = await manager.getHandle(itemId, 'todo_item');
    // ... rest of the logic
  }
}
