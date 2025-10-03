import { NextRequest, NextResponse } from 'next/server';
import { commandBus } from '../../../../../../lib/application/bus';
import { CompleteTodoItemCommand } from '../../../../../../lib/application/use-cases';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const itemId = params.id;
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // The API route's only responsibility is to dispatch a command.
    // All business logic is handled by the handler.
    await commandBus.send(new CompleteTodoItemCommand(itemId));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
