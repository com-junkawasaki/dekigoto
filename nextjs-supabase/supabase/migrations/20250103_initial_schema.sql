-- ActorDB Event Store Tables
-- Merkle DAG: actordb_events -> event_persistence
-- Process Network: write_aggregate -> event_stream

-- Events table for storing all ActorDB events
CREATE TABLE actordb_events (
    id BIGSERIAL PRIMARY KEY,
    aggregate_id TEXT NOT NULL,
    sequence BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_time TIMESTAMPTZ NOT NULL,
    aggregate_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure sequence uniqueness per aggregate
    UNIQUE(aggregate_id, sequence)
);

-- Indexes for efficient querying
CREATE INDEX idx_actordb_events_aggregate_id ON actordb_events(aggregate_id);
CREATE INDEX idx_actordb_events_sequence ON actordb_events(sequence);
CREATE INDEX idx_actordb_events_event_type ON actordb_events(event_type);
CREATE INDEX idx_actordb_events_timestamp ON actordb_events(timestamp);
CREATE INDEX idx_actordb_events_aggregate_type ON actordb_events(aggregate_type);

-- Actor snapshots table for performance optimization
CREATE TABLE actordb_snapshots (
    id BIGSERIAL PRIMARY KEY,
    aggregate_id TEXT NOT NULL UNIQUE,
    snapshot_sequence BIGINT NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TODO Application Tables
-- Merkle DAG: todo_app -> task_management
-- Process Network: query_interface -> todo_crud

-- TODO lists table
CREATE TABLE todo_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TODO items table
CREATE TABLE todo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for TODO tables
CREATE INDEX idx_todo_lists_user_id ON todo_lists(user_id);
CREATE INDEX idx_todo_items_list_id ON todo_items(list_id);
CREATE INDEX idx_todo_items_user_id ON todo_items(user_id);
CREATE INDEX idx_todo_items_status ON todo_items(status);
CREATE INDEX idx_todo_items_due_date ON todo_items(due_date);
CREATE INDEX idx_todo_items_priority ON todo_items(priority);

-- Row Level Security (RLS) policies
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own todo lists
CREATE POLICY "Users can view own todo lists" ON todo_lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own todo lists" ON todo_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todo lists" ON todo_lists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todo lists" ON todo_lists
    FOR DELETE USING (auth.uid() = user_id);

-- Users can only see todo items from their lists
CREATE POLICY "Users can view own todo items" ON todo_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create todo items in own lists" ON todo_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todo items" ON todo_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todo items" ON todo_items
    FOR DELETE USING (auth.uid() = user_id);

-- Create default todo list for new users
CREATE OR REPLACE FUNCTION create_default_todo_list()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO todo_lists (user_id, title, description, is_default)
    VALUES (NEW.id, 'My Tasks', 'Default task list', TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default list when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_default_todo_list();

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_actordb_events_updated_at
    BEFORE UPDATE ON actordb_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_actordb_snapshots_updated_at
    BEFORE UPDATE ON actordb_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_lists_updated_at
    BEFORE UPDATE ON todo_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_items_updated_at
    BEFORE UPDATE ON todo_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
