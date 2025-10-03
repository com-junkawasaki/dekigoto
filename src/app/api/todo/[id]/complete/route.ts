import { NextRequest, NextResponse } from 'next/server';
import { actorDbClient } from '../../../../../../lib/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const itemId = params.id;
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // The API route is now extremely thin and declarative,
    // exactly like using Supabase.
    const { error } = await actorDbClient
      .actor('todoItem', itemId)
      .dispatch('todoItem.complete');

    if (error) {
      // The handler might throw an error if the state transition is invalid.
      return NextResponse.json({ error: error.message }, { status: 409 }); // 409 Conflict is a good status code here
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
