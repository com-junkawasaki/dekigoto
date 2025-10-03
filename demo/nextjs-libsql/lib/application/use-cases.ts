import { ICommand, ICommandHandler } from "@client/actor";
import { todoItemManager } from "../../aggregates/todo-aggregate";

// --- Command ---
export class CompleteTodoItemCommand implements ICommand {
  readonly type = 'CompleteTodoItem';
  constructor(public readonly itemId: string) {}
}

// --- Handler ---
export class CompleteTodoItemHandler implements ICommandHandler<CompleteTodoItemCommand> {
  async handle(command: CompleteTodoItemCommand): Promise<void> {
    const { itemId } = command;

    const handle = await todoItemManager.getHandle(itemId, 'todo_item');

    if (!handle) {
      throw new Error(`Todo item with ID ${itemId} not found.`);
    }

    // This is where the business process orchestration now lives.
    // The UI layer no longer needs to know about these state checks.
    if (handle.state.status === 'pending' || handle.state.status === 'in_progress') {
      await handle.complete();
    } else if (handle.state.status === 'completed') {
      // It's already completed, so we can just ignore.
      console.log(`Item ${itemId} is already completed.`);
    } else {
      throw new Error(`Cannot complete a todo item in state: ${handle.state.status}`);
    }
  }
}
