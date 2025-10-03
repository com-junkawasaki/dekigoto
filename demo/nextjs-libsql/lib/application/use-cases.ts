import { ICommand, ICommandHandler, ActorDBClient } from "@client/actor";
import { todoItemManager } from "../../aggregates/todo";

// --- Create Command & Handler ---
export class CreateTodoItemCommand implements ICommand {
  readonly type = 'CreateTodoItem';
  constructor(
    public readonly listId: string,
    public readonly title: string,
    public readonly userId: string
  ) {}
}

export class CreateTodoItemHandler implements ICommandHandler<CreateTodoItemCommand, { itemId: string }> {
  constructor(private readonly client: ActorDBClient) {}

  async handle(command: CreateTodoItemCommand): Promise<{ itemId: string }> {
    const itemId = crypto.randomUUID();
    // This is a simplified example. A real implementation would create a
    // 'todo_item_created' event and write it to the event store.
    console.log(`Creating item ${itemId} for user ${command.userId} in list ${command.listId}`);
    // await this.client.writeEvent(...)
    return { itemId };
  }
}


// --- Complete Command & Handler ---
export class CompleteTodoItemCommand implements ICommand {
  readonly type = 'CompleteTodoItem';
  constructor(public readonly itemId: string) {}
}

export class CompleteTodoItemHandler implements ICommandHandler<CompleteTodoItemCommand> {
  constructor(private readonly client: ActorDBClient) {}

  async handle(command: CompleteTodoItemCommand): Promise<void> {
    const { itemId } = command;

    // The manager is now a factory that needs the client instance.
    const manager = todoItemManager(this.client);
    const handle = await manager.getHandle(itemId, 'todoItem');

    if (!handle) {
      throw new Error(`Todo item with ID ${itemId} not found.`);
    }

    if (handle.state.status === 'pending' || handle.state.status === 'in_progress') {
      await handle.complete();
    } else if (handle.state.status === 'completed') {
      console.log(`Item ${itemId} is already completed.`);
    } else {
      throw new Error(`Cannot complete a todo item in state: ${handle.state.status}`);
    }
  }
}
