import { supabase } from "../supabaseClient";

const LOCAL_KEY = "pending_transactions_v1";

function getLocalPending(): any[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}
function setLocalPending(items: any[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

async function requireUserId() {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error("Chưa đăng nhập");
  return userId;
}

export async function listTransactions() {
  const user_id = await requireUserId();

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const pending = getLocalPending();
  return [...pending, ...(data || [])];
}

export async function createTransaction(payload: any) {
  const user_id = await requireUserId();

  const client_id = crypto.randomUUID();
  const row = {
    ...payload,
    user_id,
    client_id,
    updated_at: new Date().toISOString(),
  };

  if (!navigator.onLine) {
    const pending = getLocalPending();
    pending.unshift({ ...row, _pendingAt: new Date().toISOString() });
    setLocalPending(pending);
    return { isPending: true, data: row };
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return { isPending: false, data };
}

export async function updateTransaction(id: number, patch: any) {
  const user_id = await requireUserId();

  const { data: before } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user_id)
    .single();

  const { data, error } = await supabase
    .from("transactions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user_id)
    .select()
    .single();

  if (error) throw error;

  await supabase.from("transaction_logs").insert({
    tx_id: id,
    action: "updated",
    before_data: before,
    after_data: data,
    user_id,
  });

  return data;
}

export async function removeTransaction(id: number) {
  const user_id = await requireUserId();

  const { data: before } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user_id)
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
    before_data: before,
    after_data: null,
    user_id,
  });

  return true;
}

export async function listTransactionLogs() {
  const user_id = await requireUserId();

  const { data, error } = await supabase
    .from("transaction_logs")
    .select("*")
    .eq("user_id", user_id)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Sync local pending when online
export async function syncPendingTransactions() {
  const user_id = await requireUserId();
  const pending = getLocalPending();
  if (pending.length === 0) return { synced: 0 };

  const toSync = pending.map((p) => {
    const { _pendingAt, ...rest } = p;
    return { ...rest, user_id, updated_at: new Date().toISOString() };
  });

  const { error } = await supabase.from("transactions").insert(toSync);
  if (error) {
    return { synced: 0, error };
  }

  setLocalPending([]);
  return { synced: toSync.length };
}
