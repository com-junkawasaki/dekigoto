# Dekigoto - Next.js + Supabase Example

This is a Next.js application with Supabase authentication, built as an example for the ActorDB (Dekigoto) project. It demonstrates DAG-based routing with Φ-monotonic authentication flow.

## Features

- **Next.js 15** with App Router
- **Supabase Authentication** with server-side session management
- **DAG-based Routing** with Φ-monotonic authentication (Φ=2→1→0)
- **Middleware Protection** for all authenticated routes
- **TypeScript** throughout the application
- **Tailwind CSS** for styling
- **ActorDB Integration Ready** - prepared for event-driven architecture
- **TODO Task Management** - Complete CRUD application with lists and items
- **ActorDB Migration Tools** - Migrate existing ActorDB data to Supabase

## Architecture

### Process Network Graph
```
authentication_flow:
  - Φ=2: Unauthenticated → /signin|/signup
  - Φ=1: Additional requirements → /onboarding|/mfa
  - Φ=0: Fully authenticated → /app (protected)
```

### Key Components

- **Middleware**: Centralized authentication with DAG routing
- **Server Components**: Server-side authentication checks
- **Client Components**: Supabase Auth UI integration
- **Route Handlers**: OAuth callbacks and email verification

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Authentication → Settings
3. Configure your site URL and redirect URLs:
   - Site URL: `http://localhost:3000` (development)
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Database URL for direct database access
DATABASE_URL=your_database_url
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Authentication Flow

### Public Routes
- `/` - Landing page with authentication status
- `/signin` - Sign in with email/password or OAuth
- `/signup` - Create new account
- `/auth/confirm` - Email verification
- `/error-safe` - Fallback for authentication errors

### Protected Routes
- `/app` - Main application dashboard (requires Φ=0)
- `/todo` - TODO task management application

### Middleware Protection
The middleware automatically handles:
- Token refresh and cookie management
- Φ-monotonic routing (Φ decreasing only)
- Redirect loop protection (max 3 redirects)
- Fallback to safe error page

## TODO Task Management

The example includes a complete TODO application with:

### Features
- **Multiple Lists**: Organize tasks into different lists
- **Task CRUD**: Create, read, update, delete tasks
- **Priority Levels**: Low, medium, high priority tasks
- **Due Dates**: Set deadlines for tasks
- **Tags**: Categorize tasks with tags
- **Status Tracking**: Pending, in progress, completed, cancelled
- **Statistics Dashboard**: Overview of task completion status
- **Real-time Updates**: Immediate UI updates after changes

### Database Schema
The TODO application uses Row Level Security (RLS) to ensure users can only access their own data:

- `todo_lists` - Task lists owned by users
- `todo_items` - Individual tasks within lists
- Automatic default list creation for new users

## ActorDB Migration

### Migration Tools

The project includes migration tools to transfer ActorDB data to Supabase:

```bash
# Build the migration tool
cd tools/migration
go build -o migration-tool main.go

# Run migration
./migration-tool <source_config.yaml> <supabase_host> <supabase_password>
```

### Database Schema

The migration creates the following tables in Supabase:

- `actordb_events` - Event store for ActorDB events
- `actordb_snapshots` - Actor state snapshots
- `todo_lists` - TODO application lists
- `todo_items` - TODO application items

### Migration Process

1. **Schema Creation**: Run the SQL migrations in `supabase/migrations/`
2. **Data Transfer**: Use the Go migration tool to transfer events
3. **Verification**: Check data integrity after migration

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication routes
│   │   ├── callback/      # OAuth callback handler
│   │   ├── confirm/       # Email confirmation
│   │   └── signout/       # Sign out handler
│   ├── app/               # Protected application
│   ├── error-safe/        # Fallback error page
│   ├── signin/            # Sign in page
│   ├── signup/            # Sign up page
│   ├── layout.tsx         # Root layout with SessionProvider
│   └── page.tsx           # Landing page
├── components/            # React components
│   └── SessionProvider.tsx # Supabase session provider
└── utils/supabase/        # Supabase client utilities
    ├── client.ts          # Browser client
    └── server.ts          # Server client
```

## Key Rules Followed

### SOLID Principles
- **Single Responsibility**: Each route/component has one clear purpose
- **Open/Closed**: Extensible authentication flow
- **Liskov Substitution**: Compatible client/server patterns
- **Interface Segregation**: Minimal, focused utilities
- **Dependency Inversion**: Abstracted Supabase dependencies

### DAG-based Process Network
- **Merkle DAG**: Hierarchical process nodes with hash-based integrity
- **Topological Execution**: Deterministic process ordering
- **Φ-monotonic Routing**: Authentication state reduction only
- **Reverse Resolution**: Problem diagnosis via inverse DAG

### Authentication Rules
- **Server-side First**: `supabase.auth.getUser()` for server components
- **Middleware Centralization**: All auth logic in `middleware.ts`
- **Cookie-based Sessions**: SSR-compatible session management
- **No Client Redirects**: Middleware handles all routing decisions

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Adding New Features

1. Update `story.jsonnet` with new process nodes
2. Ensure topological ordering is maintained
3. Add Merkle DAG comments to new code
4. Test authentication flow thoroughly

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

Ensure your deployment platform supports:
- Node.js 18+
- Environment variables
- Next.js middleware

## Integration with ActorDB

This example is designed to integrate with ActorDB for:
- **Event Sourcing**: User actions as events
- **CQRS**: Separate read/write models
- **Projection Engine**: Materialized views
- **Query Interface**: Declarative data access

See the main ActorDB documentation for integration patterns.

## Contributing

1. Follow the established DAG-based architecture
2. Add Merkle DAG comments to new code
3. Test authentication flows thoroughly
4. Update documentation as needed

## License

MIT - See LICENSE file in the root directory.
