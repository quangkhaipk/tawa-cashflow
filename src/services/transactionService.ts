// src/services/transactionService.ts
import { supabase } from "../supabaseClient";

/**
 * DB đang dùng snake_case:
 * from_wallet, to_wallet
 * UI đang dùng camelCase:
 * fromWallet, toWallet
 * => Service sẽ tự map.
 */

// ===== pending local helpers =====
const PENDING_KEY = "tawa_pending_transactions_v1";

function getPending(): any[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
  } catch {
    return [];
  }
}
function setPending(list: any[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}
function addPending(tx: any) {
  const list = getPending();
  list.push({ ...tx, _pendingAt: new Date().toISOString() });
  setPending(list);
}
function removePendingByClientId(client_id: string) {
  const list = getPending().filter((x) => x.client_id !== client_id);
  setPending(list);
}

// Detect network error only
function isNetworkError(err: any) {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("timeout") ||
    msg.includes("offline")
  );
}

function toSnake(tx: any) {
  const out = { ...tx };
  if ("fromWallet" in out) {
    out.from_wallet = out.fromWallet;
    delete out.fromWallet;
  }
  if ("toWallet" in out) {
    out.to_wallet = out.toWallet;
    delete out.toWallet;
  }
  return out;
}

// ===== CREATE =====
export async function createTransaction(payload: any) {
  const client_id = payload.client_id || crypto.randomUUID();
  const dataToInsert = toSnake({ ...payload, client_id });

  const { data, error } = await supabase
    .from("transactions")
    .insert(dataToInsert)
    .select()
    .single();

  if (!error) {
    return { data, isPending: false };
  }

  // RLS / schema errors => NOT pending
  if (!isNetworkError(error)) {
    console.error("CREATE TX ERROR (server):", error);
    throw error;
  }

  // Network error => pending local
  addPending(dataToInsert);
  return { data: dataToInsert, isPending: true };
}

// ===== UPDATE =====
export async function updateTransaction(id: string | number, patch: any) {
  const client_id = patch.client_id || crypto.randomUUID();
  const dataToUpdate = toSnake({ ...patch, client_id });

  const { data, error } = await supabase
    .from("transactions")
    .update({ ...dataToUpdate, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (!error) {
    return { data, isPending: false };
  }

  if (!isNetworkError(error)) {
    console.error("UPDATE TX ERROR (server):", error);
    throw error;
  }

  addPending({ ...dataToUpdate, id, _op: "update" });
  return { data: { ...dataToUpdate, id }, isPending: true };
}

// ===== DELETE =====
export async function removeTransaction(id: string | number) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);

  if (!error) return { ok: true, isPending: false };

  if (!isNetworkError(error)) {
    console.error("DELETE TX ERROR (server):", error);
    throw error;
  }

  addPending({ id, _op: "delete", client_id: crypto.randomUUID() });
  return { ok: true, isPending: true };
}

// ===== LIST =====
export async function listTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// ===== SYNC PENDING =====
export async function syncPendingTransactions() {
  const pending = getPending();
  if (!pending.length) return { synced: 0 };

  let synced = 0;

  for (const item of pending) {
    try {
      if (item._op === "update") {
        const { _op, _pendingAt, ...patch } = item;
        const { error } = await supabase
          .from("transactions")
          .update(patch)
          .eq("id", item.id);
        if (error) throw error;
      } else if (item._op === "delete") {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { _op, _pendingAt, ...payload } = item;
        const { error } = await supabase
          .from("transactions")
          .insert(payload);
        if (error) throw error;
      }

      synced++;
      if (item.client_id) removePendingByClientId(item.client_id);
    } catch (e: any) {
      if (isNetworkError(e)) continue; // vẫn offline => giữ lại
      console.error("SYNC PENDING ERROR:", e);
    }
  }

  return { synced };
}
