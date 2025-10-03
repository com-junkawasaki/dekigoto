# ActorDB Todo Demo - Next.js + LibSQL

A full-stack Todo application demonstrating ActorDB's event sourcing capabilities using Next.js and LibSQL.

## Architecture

This demo implements the ActorDB process network:

- **Write Path**: Single-writer event persistence using LibSQL
- **Read Path**: Incremental view maintenance with projections
- **Event Sourcing**: Immutable event stream with aggregate reconstruction
- **Materialized Views**: Real-time projection updates

## Features

- ✅ Event-sourced Todo management
- ✅ Real-time projections and statistics
- ✅ ACID-compliant persistence with LibSQL
- ✅ Full audit trail with event history
- ✅ Live event stream debugger
- ✅ TypeScript with full type safety
- ✅ Modern React with hooks and server actions

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: LibSQL (SQLite-compatible)
- **Event Store**: ActorDB event sourcing
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .envrc.example .envrc

# Allow direnv to load environment (optional)
direnv allow
```

### Database Setup

The application uses LibSQL for event storage. By default, it creates a local SQLite file.

```bash
# Initialize database schema
curl -X POST http://localhost:3000/api/init
```

Or use the browser to visit `/api/init` endpoint.

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── actordb/       # ActorDB event endpoints
│   │   ├── todo/          # Todo CRUD endpoints
│   │   └── init/          # Database initialization
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ActorDBDebugger.tsx # Event stream debugger
│   ├── StatsCard.tsx      # Statistics display
│   ├── TodoDashboard.tsx  # Main dashboard
│   ├── TodoForm.tsx       # Todo creation forms
│   └── TodoList.tsx       # Todo list display
└── lib/                   # Business logic
    ├── actordb/           # ActorDB implementation
    │   ├── eventstore.ts  # LibSQL event store
    │   └── projector.ts   # Projection engine
    ├── aggregates/        # Event-sourced aggregates
    ├── database/          # LibSQL configuration
    └── events/            # Event definitions
```

## API Endpoints

### Events
- `GET /api/actordb/events` - Get all events
- `POST /api/actordb/events` - Write new event

### Todos
- `GET /api/todo?type=lists` - Get todo lists
- `GET /api/todo?type=items&listId=...` - Get todo items
- `GET /api/todo?type=stats` - Get statistics
- `POST /api/todo` - Create todo list/item
- `PATCH /api/todo/[id]` - Update todo item
- `DELETE /api/todo/[id]` - Delete todo item

### Initialization
- `POST /api/init` - Initialize database and projections

## Event Sourcing Flow

1. **User Action** → Todo creation/update/completion
2. **Event Creation** → Immutable event written to LibSQL
3. **Projection Update** → Materialized views updated in real-time
4. **UI Update** → React components reflect new state

## Environment Variables

```bash
# Local development (default)
LIBSQL_URL="file:./actordb.db"

# Production with Turso
LIBSQL_URL="libsql://your-db.turso.io"
LIBSQL_AUTH_TOKEN="your-auth-token"
```

## ActorDB Concepts Demonstrated

- **Event Store**: Append-only event persistence
- **Aggregates**: State reconstruction from events
- **Projections**: Materialized views for queries
- **Eventual Consistency**: Real-time projection updates
- **Audit Trail**: Complete event history
- **Single Writer**: Per-aggregate serialization

## Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run lint
```

## License

MIT
