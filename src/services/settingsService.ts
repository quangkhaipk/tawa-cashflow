import { supabase } from "../supabaseClient";

export type AppSettings = {
  user_id: string;
  opening_cash: number;
  opening_bank: number;
  cash_low_threshold: number;
  inactive_days_threshold: number;
  cash_low_message: string;
  inactive_message: string;
};

async function requireUserId() {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error("Chưa đăng nhập");
  return userId;
}

export async function getSettings(user_id?: string) {
  const uid = user_id || (await requireUserId());

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const user_id = await requireUserId();
  const row = { user_id, ...patch, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resetAllData() {
  const user_id = await requireUserId();

  await supabase.from("transactions").delete().eq("user_id", user_id);
  await supabase.from("transaction_logs").delete().eq("user_id", user_id);
}
