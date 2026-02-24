-- ============================================================
-- Actuary60 数据库结构
-- 在 Supabase SQL Editor 中粘贴并执行
-- ============================================================

-- 高管表
CREATE TABLE IF NOT EXISTS executives (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  title          TEXT,
  company        TEXT,
  region         TEXT,
  website        TEXT,
  bio            TEXT,
  extracted      JSONB DEFAULT '{}',
  career_path    JSONB DEFAULT '[]',
  identity       JSONB,
  education      JSONB DEFAULT '[]',
  qualifications TEXT[] DEFAULT '{}',
  board_roles    JSONB DEFAULT '[]',
  industry_roles TEXT[] DEFAULT '{}'
);

-- 关系表
CREATE TABLE IF NOT EXISTS relationships (
  id        SERIAL PRIMARY KEY,
  source_id INTEGER,
  target_id INTEGER,
  type      TEXT,
  strength  FLOAT,
  label     TEXT
);

-- 公司简介表
CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  short_name  TEXT DEFAULT '',
  website     TEXT DEFAULT '',
  region      TEXT DEFAULT 'CN',
  intro       TEXT DEFAULT '',
  fetched_url TEXT DEFAULT ''
);

-- 我认识TA
CREATE TABLE IF NOT EXISTS user_known (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  exec_id    INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, exec_id)
);

-- 报错反馈
CREATE TABLE IF NOT EXISTS user_reports (
  id          SERIAL PRIMARY KEY,
  exec_id     INTEGER,
  exec_name   TEXT,
  field       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────
ALTER TABLE executives    ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_known    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports  ENABLE ROW LEVEL SECURITY;

-- 公开读
CREATE POLICY "public read" ON executives    FOR SELECT USING (true);
CREATE POLICY "public read" ON relationships FOR SELECT USING (true);
CREATE POLICY "public read" ON companies     FOR SELECT USING (true);

-- user_known：按 user_id 操作
CREATE POLICY "insert known" ON user_known FOR INSERT WITH CHECK (true);
CREATE POLICY "select known" ON user_known FOR SELECT USING (true);
CREATE POLICY "delete known" ON user_known FOR DELETE USING (true);

-- user_reports：只写
CREATE POLICY "insert report" ON user_reports FOR INSERT WITH CHECK (true);
