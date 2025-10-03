import { CommandBus } from "@client/actor";
import { CompleteTodoItemCommand, CompleteTodoItemHandler } from "./use-cases";

const bus = new CommandBus();

// Register all command handlers
bus.registerCommandHandler(new CompleteTodoItemCommand('').type, new CompleteTodoItemHandler());

// Register all query handlers...

export const commandBus = bus;
