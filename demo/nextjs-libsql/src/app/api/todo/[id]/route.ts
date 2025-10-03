// API route for individual Todo operations
import { NextRequest, NextResponse } from 'next/server'
import {
  updateTodoItem,
  completeTodoItem,
  deleteTodoItem
} from '../../../todo/actions'

interface RouteParams {
  params: {
    id: string
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'update') {
      const result = await updateTodoItem(params.id, data.updates)
      if (result.success) {
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }
    } else if (action === 'complete') {
      const result = await completeTodoItem(params.id)
      if (result.success) {
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action parameter' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Failed to update todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update todo' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await deleteTodoItem(params.id)
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Failed to delete todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete todo' },
      { status: 500 }
    )
  }
}
