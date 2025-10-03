// API route for Todo operations
import { NextRequest, NextResponse } from 'next/server'
import {
  getTodoLists,
  getTodoItems,
  getTodoStatistics,
  createTodoList,
  createTodoItem
} from '../../todo/actions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'lists') {
      const result = await getTodoLists()
      if (result.success) {
        return NextResponse.json({ success: true, data: result.data })
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }
    } else if (type === 'items') {
      const listId = searchParams.get('listId')
      const result = await getTodoItems(listId || undefined)
      if (result.success) {
        return NextResponse.json({ success: true, data: result.data })
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }
    } else if (type === 'stats') {
      const result = await getTodoStatistics()
      if (result.success) {
        return NextResponse.json({ success: true, data: result.data })
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Failed to get todos:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get todos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...data } = body

    if (type === 'list') {
      const result = await createTodoList(data)
      if (result.success) {
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }
    } else if (type === 'item') {
      const result = await createTodoItem(data)
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
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Failed to create todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create todo' },
      { status: 500 }
    )
  }
}
