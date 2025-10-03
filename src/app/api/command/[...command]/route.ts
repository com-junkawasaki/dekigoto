import { NextRequest, NextResponse } from 'next/server';
import { createSecureClient } from '@client/actor';
import { appSchema } from '../../../../../../lib/domain-schema';
import { commandBus } from '../../../../../../lib/client';

// This function would determine the user's role from the request
function getUserRole(req: NextRequest): 'user' | 'guest' {
  return 'user'; // Demo: assume all users are authenticated
}

export async function POST(
  req: NextRequest,
  { params }: { params: { command: string[] } }
) {
  try {
    const role = getUserRole(req);
    // The secure client is created per-request with the user's role
    const client = createSecureClient(appSchema, commandBus, role);

    const commandName = params.command.join('.');
    const payload = await req.json();

    // The client's `dispatch` method is dynamically typed and capability-aware
    // @ts-ignore - This is a limitation of TypeScript not being able to dynamically type the proxy dispatch
    const { data, error } = await client.actor(payload.actorType, payload.actorId).dispatch(commandName, payload);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(data || { success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
