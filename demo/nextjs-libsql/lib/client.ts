// Merkle DAG: app_bootstrap -> dynamic_secure_client_generation
// This file is responsible for bootstrapping the application's core components
// that are used to generate a secure, per-request client instance.

import { ApplicationBuilder } from "@client/actor";
import { appSchema } from "./domain-schema";
import { 
  CompleteTodoItemCommand, 
  CompleteTodoItemHandler,
  CreateTodoItemCommand,
  CreateTodoItemHandler
} from "./application/use-cases";
import { ActorDBClient } from "@client/client";
import { LibSQLDB } from "@client/database/libsql";

// --- Low-Level Client (Singleton) ---
const dbConfig = {
  url: process.env.LIBSQL_URL || 'file:actordb.db',
  authToken: process.env.LIBSQL_AUTH_TOKEN,
};
const db = new LibSQLDB(dbConfig);
export const lowLevelClient = new ActorDBClient(db);

// --- Command Bus (Singleton) ---
// The bus is configured once at startup with all possible handlers.
const builder = new ApplicationBuilder(appSchema)
  .addCommandHandler(CompleteTodoItemCommand, new CompleteTodoItemHandler(lowLevelClient))
  .addCommandHandler(CreateTodoItemCommand, new CreateTodoItemHandler(lowLevelClient));
  
export const commandBus = builder.getBus(); // A new method to get the bus from the builder
