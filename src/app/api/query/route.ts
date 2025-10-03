import { NextRequest, NextResponse } from 'next/server';
import { createSecureClient } from '@client/actor';
import { appSchema } from '../../../../../../lib/domain-schema';
import { commandBus } from '../../../../../../lib/client';

// This function would determine the user's role from the request (e.g., from a JWT)
function getUserRole(req: NextRequest): 'user' | 'guest' {
  // In a real app, you'd inspect headers, cookies, etc.
  // For this demo, we'll just pretend everyone is a 'user'.
  return 'user';
}

export async function GET(req: NextRequest) {
  try {
    const role = getUserRole(req);
    const client = createSecureClient(appSchema, commandBus, role);

    const listId = req.nextUrl.searchParams.get('listId');
    if (!listId) {
      return NextResponse.json({ error: 'listId is required' }, { status: 400 });
    }
    
    // Drizzle-like, type-safe, and secure query execution.
    // If the role 'guest' tried this, it would throw an error if not permitted.
    // If a non-existent query is called, it's a compile-time error.
    const { data, error } = await client.query.todosByList({ listId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 }); // 403 Forbidden is appropriate for capability errors
  }
}
