-- add_source_fields.sql
-- 为 executives 表追加溯源相关字段
-- 在 Supabase SQL Editor 中执行一次即可

ALTER TABLE executives ADD COLUMN IF NOT EXISTS source_url  TEXT;
ALTER TABLE executives ADD COLUMN IF NOT EXISTS scraped_at  TIMESTAMPTZ;
ALTER TABLE executives ADD COLUMN IF NOT EXISTS verified    BOOLEAN DEFAULT false;
ALTER TABLE executives ADD COLUMN IF NOT EXISTS bio_raw     TEXT;

-- 为 source_url 和 verified 添加索引（便于筛选未核验/已溯源记录）
CREATE INDEX IF NOT EXISTS idx_executives_verified   ON executives(verified);
CREATE INDEX IF NOT EXISTS idx_executives_source_url ON executives(source_url);

SELECT '✅ source_url / scraped_at / verified / bio_raw 字段添加完成' AS message;
