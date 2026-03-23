-- ============================================================
-- King Sejong Vol.2 — Supabase migration
-- Tables: lessons, items, user_progress
-- ============================================================

-- LESSONS
CREATE TABLE IF NOT EXISTS lessons (
    lesson_number   INTEGER PRIMARY KEY,
    title_ko        TEXT NOT NULL,
    title_fr        TEXT NOT NULL,
    topic_ko        TEXT NOT NULL,
    topic_fr        TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ITEMS  (vocabulary / expressions / grammar)
CREATE TABLE IF NOT EXISTS items (
    id                      SERIAL PRIMARY KEY,
    lesson_number           INTEGER NOT NULL REFERENCES lessons(lesson_number),
    type                    TEXT NOT NULL CHECK (type IN ('vocabulary','expression','grammar')),
    korean                  TEXT NOT NULL,
    french                  TEXT NOT NULL,
    grammar_explanation     TEXT DEFAULT '',
    grammar_form_note       TEXT DEFAULT '',
    example_sentence        TEXT DEFAULT '',
    sort_order              INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- USER PROGRESS  (spaced repetition / daily exercises)
CREATE TABLE IF NOT EXISTS user_progress (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    -- Spaced repetition fields (SM-2 compatible)
    ease_factor     NUMERIC(4,2) DEFAULT 2.5,
    interval_days   INTEGER DEFAULT 0,
    repetitions     INTEGER DEFAULT 0,
    due_date        DATE DEFAULT CURRENT_DATE,
    last_reviewed   TIMESTAMPTZ,
    -- Stats
    correct_count   INTEGER DEFAULT 0,
    wrong_count     INTEGER DEFAULT 0,
    UNIQUE (user_id, item_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_items_lesson ON items(lesson_number);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_due ON user_progress(user_id, due_date);

-- ROW LEVEL SECURITY
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own progress"
    ON user_progress FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Make lessons and items readable by all authenticated users
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lessons are readable by all" ON lessons FOR SELECT USING (true);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items are readable by all" ON items FOR SELECT USING (true);

