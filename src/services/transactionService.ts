import { supabase } from "../supabaseClient";

const PENDING_KEY = "pending_transactions_v2";

function loadPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
  } catch {
    return [];
  }
}
function savePending(items: any[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

async function getUserId() {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Chưa đăng nhập");
  return user.id;
}

export async function listTransactions() {
  const user_id = await getUserId();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const pending = loadPending();
  return [...pending, ...(data || [])].sort(
    (a, b) =>
      new Date(b.created_at || b._pendingAt).getTime() -
      new Date(a.created_at || a._pendingAt).getTime()
  );
}

export async function createTransaction(payload: any) {
  const user_id = await getUserId();
  const dataToInsert = { ...payload, user_id };

  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert(dataToInsert)
      .select()
      .single();

    if (error) throw error;
    return { data, isPending: false };
  } catch (e) {
    // offline fallback
    const pending = loadPending();
    const localTx = {
      ...dataToInsert,
      id: `pending-${Date.now()}`,
      _pendingAt: new Date().toISOString(),
    };
    pending.unshift(localTx);
    savePending(pending);
    return { data: localTx, isPending: true };
  }
}

export async function updateTransaction(id: any, patch: any) {
  const user_id = await getUserId();

  // nếu pending local
  if (String(id).startsWith("pending-")) {
    const pending = loadPending();
    const idx = pending.findIndex((t: any) => t.id === id);
    if (idx >= 0) {
      const before = pending[idx];
      pending[idx] = { ...before, ...patch };
      savePending(pending);
      return { data: pending[idx], isPending: true };
    }
  }

  // lấy before để log
  const { data: beforeData } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("transactions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user_id)
    .select()
    .single();

  if (error) throw error;

  // log
  await supabase.from("transaction_logs").insert({
    tx_id: id,
    action: "updated",
    before_data: beforeData || null,
    after_data: data,
    user_id,
  });

  return { data, isPending: false };
}

export async function removeTransaction(id: any) {
  const user_id = await getUserId();

  if (String(id).startsWith("pending-")) {
    const pending = loadPending().filter((t: any) => t.id !== id);
    savePending(pending);
    return { ok: true, isPending: true };
  }

  const { data: beforeData } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user_id);

  if (error) throw error;

  await supabase.from("transaction_logs").insert({
    tx_id: id,
    action: "deleted",
    before_data: beforeData || null,
    after_data: null,
    user_id,
  });

  return { ok: true, isPending: false };
}

export async function listTransactionLogs() {
  const user_id = await getUserId();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("transaction_logs")
    .select("*")
    .eq("user_id", user_id)
    .gte("created_at", fromDate)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function syncPendingTransactions() {
  const user_id = await getUserId();
  const pending = loadPending();
  if (!pending.length) return { synced: 0 };

  let synced = 0;
  const remain: any[] = [];

  for (const p of pending) {
    try {
      const { id, _pendingAt, ...rest } = p;
      const { error } = await supabase.from("transactions").insert({
        ...rest,
        user_id,
      });
      if (error) throw error;
      synced++;
    } catch {
      remain.push(p);
    }
  }

  savePending(remain);
  return { synced, remain: remain.length };
}
