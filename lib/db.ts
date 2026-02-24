import { supabase } from "./supabase";
import type { Executive, Relationship, Company } from "./types";

const PAGE = 1000;

/** 分页拉取全表（绕过 Supabase 默认 1000 行限制） */
async function fetchAll<T>(table: string): Promise<T[]> {
  let rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows = [...rows, ...(data as T[])];
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

/** relationships 表列名是 source_id / target_id，需转成前端用的 source / target */
async function fetchRelationshipsRaw(): Promise<Relationship[]> {
  const rows = await fetchAll<{
    id: number;
    source_id: number;
    target_id: number;
    type: string;
    strength: number;
    label: string;
  }>("relationships");
  return rows.map((r) => ({
    source: r.source_id,
    target: r.target_id,
    type: r.type as Relationship["type"],
    strength: r.strength,
    label: r.label,
  }));
}

/** person_identity → identity 字段重命名（避开 PostgreSQL 保留字） */
async function fetchExecutivesImpl(): Promise<Executive[]> {
  const rows = await fetchAll<Record<string, unknown>>("executives");
  return rows.map((r) => {
    const { person_identity, ...rest } = r;
    return { ...rest, identity: person_identity } as unknown as Executive;
  });
}

export const fetchExecutives = fetchExecutivesImpl;
export const fetchRelationships = fetchRelationshipsRaw;
export const fetchCompanies = () => fetchAll<Company>("companies");

// ── 匿名用户 ID（localStorage 单例） ──────────────────────
export function getAnonymousUserId(): string {
  const KEY = "g_user_id";
  let uid = localStorage.getItem(KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(KEY, uid);
  }
  return uid;
}

// ── 我认识TA ──────────────────────────────────────────────
export async function checkIsKnown(userId: string, execId: number): Promise<boolean> {
  const { data } = await supabase
    .from("user_known")
    .select("id")
    .eq("user_id", userId)
    .eq("exec_id", execId)
    .maybeSingle();
  return data !== null;
}

export async function setKnown(userId: string, execId: number, known: boolean): Promise<void> {
  if (known) {
    await supabase
      .from("user_known")
      .upsert({ user_id: userId, exec_id: execId }, { onConflict: "user_id,exec_id" });
  } else {
    await supabase
      .from("user_known")
      .delete()
      .eq("user_id", userId)
      .eq("exec_id", execId);
  }
}

// ── 报错反馈 ──────────────────────────────────────────────
export async function submitReport(params: {
  execId: number;
  execName: string;
  field: string;
  description: string;
}): Promise<void> {
  await supabase.from("user_reports").insert({
    exec_id: params.execId,
    exec_name: params.execName,
    field: params.field,
    description: params.description,
  });
}
