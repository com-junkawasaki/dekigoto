// Merkle DAG: client_entrypoint -> framework_bootstrapper_instantiation
// This file is the single entry point for configuring and creating the high-level
// application client using the ApplicationBuilder.

import { ApplicationBuilder } from "@client/actor";
import { appSchema } from "./domain-schema";
import { CompleteTodoItemCommand, CompleteTodoItemHandler } from "./application/use-cases";
import { ActorDBClient } from "@client/client";
import { LibSQLDB } from "@client/database/libsql";

// --- Database Configuration ---
// This would typically come from environment variables.
const dbConfig = {
  url: process.env.LIBSQL_URL || 'file:actordb.db',
  authToken: process.env.LIBSQL_AUTH_TOKEN,
};
const db = new LibSQLDB(dbConfig);
export const lowLevelClient = new ActorDBClient(db);


// --- Application Bootstrapping ---

export const actorDbClient = new ApplicationBuilder(appSchema)
  // Register all command handlers declaratively
  .addCommandHandler(CompleteTodoItemCommand, new CompleteTodoItemHandler())
  // .addCommandHandler(CreateTodoItemCommand, new CreateTodoItemHandler())
  // .addQueryHandler(...)
  .build();
