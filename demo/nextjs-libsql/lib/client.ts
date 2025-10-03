// Merkle DAG: client_entrypoint -> schema_driven_client_instantiation
// This file creates and exports the single, high-level client for the application,
// configured with the domain schema and the command bus.

import { SupabaseStyleClient } from "@client/actor";
import { appSchema } from "./domain-schema";
import { commandBus } from "./application/bus";

// The type parameter `typeof appSchema` provides strong type safety to the client.
export const actorDbClient = new SupabaseStyleClient(appSchema, commandBus);
