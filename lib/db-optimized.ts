/**
 * 优化的数据库查询
 * 针对大数据量进行性能优化
 */

import { supabase } from "./supabase";
import type { Executive, Relationship, Company } from "./types";

const PAGE = 1000;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 内存缓存
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // 根据查询参数生成缓存键
  static generateKey(table: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    
    return `${table}:${sortedParams}`;
  }
}

const cache = new QueryCache();

/**
 * 优化的分页查询
 * 使用游标分页而不是偏移量分页
 */
async function fetchAllOptimized<T>(
  table: string,
  filter?: Record<string, any>,
  orderBy: string = 'id',
  batchSize: number = PAGE
): Promise<T[]> {
  const cacheKey = QueryCache.generateKey(table, { filter, orderBy });
  const cached = cache.get<T[]>(cacheKey);
  if (cached) {
    console.log(`从缓存加载 ${table} (${cached.length} 条记录)`);
    return cached;
  }

  console.log(`开始查询 ${table}...`);
  const startTime = Date.now();
  
  let allRows: T[] = [];
  let lastId: number | null = null;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select("*")
      .limit(batchSize);

    // 应用过滤器
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // 使用游标分页
    if (lastId !== null) {
      query = query.gt(orderBy, lastId);
    }

    query = query.order(orderBy, { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error(`查询 ${table} 错误:`, error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    allRows = [...allRows, ...(data as T[])];
    
    // 更新最后一个ID
    const lastRow = data[data.length - 1];
    lastId = lastRow[orderBy];

    // 如果返回的数据少于批次大小，说明没有更多数据了
    if (data.length < batchSize) {
      hasMore = false;
    }

    // 显示进度
    if (allRows.length % 5000 === 0) {
      console.log(`已获取 ${table}: ${allRows.length} 条记录...`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`查询 ${table} 完成: ${allRows.length} 条记录, 耗时 ${duration}ms`);

  // 缓存结果
  cache.set(cacheKey, allRows);

  return allRows;
}

/**
 * 优化的高管查询
 * 支持按地区、公司等过滤
 */
export async function fetchExecutivesOptimized(
  region?: string,
  company?: string
): Promise<Executive[]> {
  const filter: Record<string, any> = {};
  if (region) filter.region = region;
  if (company) filter.company = company;

  const rows = await fetchAllOptimized<Record<string, unknown>>(
    "executives",
    Object.keys(filter).length > 0 ? filter : undefined,
    "id"
  );

  return rows.map((r) => {
    const { person_identity, ...rest } = r;
    return { ...rest, identity: person_identity } as unknown as Executive;
  });
}

/**
 * 优化的关系查询
 * 支持按类型、源/目标节点过滤
 */
export async function fetchRelationshipsOptimized(
  type?: string,
  sourceId?: number,
  targetId?: number
): Promise<Relationship[]> {
  const filter: Record<string, any> = {};
  if (type) filter.type = type;
  if (sourceId) filter.source_id = sourceId;
  if (targetId) filter.target_id = targetId;

  const rows = await fetchAllOptimized<{
    id: number;
    source_id: number;
    target_id: number;
    type: string;
    strength: number;
    label: string;
  }>(
    "relationships",
    Object.keys(filter).length > 0 ? filter : undefined,
    "id"
  );

  return rows.map((r) => ({
    source: r.source_id,
    target: r.target_id,
    type: r.type as Relationship["type"],
    strength: r.strength,
    label: r.label,
  }));
}

/**
 * 批量获取关系（按高管ID分组）
 * 减少重复查询
 */
export async function fetchRelationshipsByExecutives(
  execIds: number[]
): Promise<Map<number, Relationship[]>> {
  if (execIds.length === 0) {
    return new Map();
  }

  // 分批查询，避免URL过长
  const batchSize = 100;
  const result = new Map<number, Relationship[]>();
  
  for (let i = 0; i < execIds.length; i += batchSize) {
    const batch = execIds.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from("relationships")
      .select("*")
      .in("source_id", batch)
      .or(`target_id.in.(${batch.join(',')})`);

    if (error) {
      console.error("批量查询关系错误:", error.message);
      continue;
    }

    if (data) {
      data.forEach((row: any) => {
        const rel: Relationship = {
          source: row.source_id,
          target: row.target_id,
          type: row.type,
          strength: row.strength,
          label: row.label,
        };

        // 添加到源节点
        if (!result.has(row.source_id)) {
          result.set(row.source_id, []);
        }
        result.get(row.source_id)!.push(rel);

        // 添加到目标节点
        if (!result.has(row.target_id)) {
          result.set(row.target_id, []);
        }
        result.get(row.target_id)!.push(rel);
      });
    }
  }

  return result;
}

/**
 * 统计信息查询
 */
export async function fetchStatistics(): Promise<{
  totalExecutives: number;
  totalRelationships: number;
  regions: Record<string, number>;
  companies: Record<string, number>;
  relationshipTypes: Record<string, number>;
}> {
  const cacheKey = "statistics";
  const cached = cache.get<any>(cacheKey);
  if (cached) return cached;

  console.log("获取统计信息...");
  const startTime = Date.now();

  // 并行查询
  const [
    execsResult,
    relsResult,
    regionsResult,
    companiesResult,
    typesResult
  ] = await Promise.all([
    // 高管总数
    supabase.from("executives").select("id", { count: 'exact', head: true }),
    
    // 关系总数
    supabase.from("relationships").select("id", { count: 'exact', head: true }),
    
    // 地区分布
    supabase.from("executives").select("region"),
    
    // 公司分布
    supabase.from("executives").select("company"),
    
    // 关系类型分布
    supabase.from("relationships").select("type")
  ]);

  // 处理地区分布
  const regions: Record<string, number> = {};
  if (regionsResult.data) {
    regionsResult.data.forEach(row => {
      const region = row.region || '未知';
      regions[region] = (regions[region] || 0) + 1;
    });
  }

  // 处理公司分布
  const companies: Record<string, number> = {};
  if (companiesResult.data) {
    companiesResult.data.forEach(row => {
      const company = row.company || '未知';
      companies[company] = (companies[company] || 0) + 1;
    });
  }

  // 处理关系类型分布
  const relationshipTypes: Record<string, number> = {};
  if (typesResult.data) {
    typesResult.data.forEach(row => {
      const type = row.type || '未知';
      relationshipTypes[type] = (relationshipTypes[type] || 0) + 1;
    });
  }

  const stats = {
    totalExecutives: execsResult.count || 0,
    totalRelationships: relsResult.count || 0,
    regions,
    companies,
    relationshipTypes
  };

  const duration = Date.now() - startTime;
  console.log(`统计信息获取完成，耗时 ${duration}ms`);

  cache.set(cacheKey, stats);
  return stats;
}

/**
 * 搜索高管
 * 支持姓名、公司、学校搜索
 */
export async function searchExecutives(
  query: string,
  limit: number = 50
): Promise<Executive[]> {
  if (!query.trim()) {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from("executives")
    .select("*")
    .or(`name.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
    .limit(limit);

  if (error) {
    console.error("搜索高管错误:", error.message);
    return [];
  }

  return (data || []).map((r) => {
    const { person_identity, ...rest } = r;
    return { ...rest, identity: person_identity } as unknown as Executive;
  });
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  cache.clear();
  console.log("数据库缓存已清除");
}

// 导出原有函数以保持兼容性
export { fetchCompanies } from "./db";