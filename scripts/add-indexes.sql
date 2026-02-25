-- 保险高管关系图谱数据库索引优化
-- 执行这些SQL语句可以显著提升查询性能

-- 1. executives表索引
CREATE INDEX IF NOT EXISTS idx_executives_region ON executives(region);
CREATE INDEX IF NOT EXISTS idx_executives_company ON executives(company);
CREATE INDEX IF NOT EXISTS idx_executives_name ON executives(name);
CREATE INDEX IF NOT EXISTS idx_executives_region_company ON executives(region, company);

-- 2. relationships表索引
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
CREATE INDEX IF NOT EXISTS idx_relationships_source_target ON relationships(source_id, target_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type_source ON relationships(type, source_id);

-- 3. 复合索引（针对常用查询模式）
CREATE INDEX IF NOT EXISTS idx_executives_search ON executives USING gin(
    to_tsvector('english', name || ' ' || company || ' ' || COALESCE(title, ''))
);

-- 4. 统计信息更新（优化查询计划）
ANALYZE executives;
ANALYZE relationships;

-- 5. 查看现有索引
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('executives', 'relationships')
ORDER BY tablename, indexname;

-- 6. 性能测试查询
EXPLAIN ANALYZE
SELECT * FROM executives WHERE region = 'CN' LIMIT 100;

EXPLAIN ANALYZE
SELECT * FROM relationships 
WHERE source_id = 1 OR target_id = 1;

-- 索引使用建议说明：
-- 1. idx_executives_region: 加速地区筛选（最常用）
-- 2. idx_executives_company: 加速公司筛选
-- 3. idx_relationships_source_target: 加速关系查找（双向）
-- 4. idx_executives_search: 全文搜索优化（如果启用搜索功能）

-- 注意：索引会增加写入开销，但读取性能提升显著
-- 对于1,494高管 + 15,204关系的规模，索引收益很大