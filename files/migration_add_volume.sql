-- ============================================================
-- MIGRATION UPDATE: add 'volume' column to existing tables
-- Run this if you already ran migration.sql (Vol.2)
-- ============================================================

-- Add volume to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS volume INTEGER DEFAULT 2;

-- Add volume to items table  
ALTER TABLE items ADD COLUMN IF NOT EXISTS volume INTEGER DEFAULT 2;

-- Update existing Vol.2 rows
UPDATE lessons SET volume = 2 WHERE volume IS NULL;
UPDATE items SET volume = 2 WHERE volume IS NULL;

-- Update index
CREATE INDEX IF NOT EXISTS idx_items_volume ON items(volume);
CREATE INDEX IF NOT EXISTS idx_lessons_volume ON lessons(volume);
