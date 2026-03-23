-- ============================================================
-- SETUP COMPLET : tables King Sejong + policies d'import
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor
-- ============================================================

-- 1. TABLE LESSONS
CREATE TABLE IF NOT EXISTS lessons (
    lesson_number   INTEGER PRIMARY KEY,
    title_ko        TEXT NOT NULL,
    title_fr        TEXT NOT NULL,
    topic_ko        TEXT NOT NULL,
    topic_fr        TEXT NOT NULL,
    volume          INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLE ITEMS
CREATE TABLE IF NOT EXISTS items (
    id                      SERIAL PRIMARY KEY,
    lesson_number           INTEGER NOT NULL REFERENCES lessons(lesson_number),
    volume                  INTEGER DEFAULT 1,
    type                    TEXT NOT NULL CHECK (type IN ('vocabulary','expression','grammar')),
    korean                  TEXT NOT NULL,
    french                  TEXT NOT NULL,
    grammar_explanation     TEXT DEFAULT '',
    grammar_form_note       TEXT DEFAULT '',
    example_sentence        TEXT DEFAULT '',
    sort_order              INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLE USER_PROGRESS (révision espacée)
CREATE TABLE IF NOT EXISTS user_progress (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    ease_factor     NUMERIC(4,2) DEFAULT 2.5,
    interval_days   INTEGER DEFAULT 0,
    repetitions     INTEGER DEFAULT 0,
    due_date        DATE DEFAULT CURRENT_DATE,
    last_reviewed   TIMESTAMPTZ,
    correct_count   INTEGER DEFAULT 0,
    wrong_count     INTEGER DEFAULT 0,
    UNIQUE (user_id, item_id)
);

-- 4. INDEX
CREATE INDEX IF NOT EXISTS idx_items_lesson  ON items(lesson_number);
CREATE INDEX IF NOT EXISTS idx_items_type    ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_volume  ON items(volume);
CREATE INDEX IF NOT EXISTS idx_lessons_volume ON lessons(volume);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_due  ON user_progress(user_id, due_date);

-- 5. ROW LEVEL SECURITY
ALTER TABLE lessons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Lecture publique (app web)
CREATE POLICY "Lessons lisibles par tous"
    ON lessons FOR SELECT USING (true);

CREATE POLICY "Items lisibles par tous"
    ON items FOR SELECT USING (true);

-- INSERT pour le script d'import (clé anon)
CREATE POLICY "Import lessons autorisé"
    ON lessons FOR INSERT WITH CHECK (true);

CREATE POLICY "Import items autorisé"
    ON items FOR INSERT WITH CHECK (true);

-- Progression utilisateur : chacun gère la sienne
CREATE POLICY "Users can manage their own progress"
    ON user_progress FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
