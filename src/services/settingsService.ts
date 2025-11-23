// src/services/settingsService.ts
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

const DEFAULT_SETTINGS: AppSettings = {
  user_id: "",
  opening_cash: 0,
  opening_bank: 0,
  cash_low_threshold: 300000,
  inactive_days_threshold: 2,
  cash_low_message: "Ví tiền mặt sắp hết!",
  inactive_message: "Bạn chưa nhập giao dịch 2 ngày.",
};

export async function getSettings(userId: string) {
  if (!userId) return DEFAULT_SETTINGS;

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows
    throw error;
  }

  return { ...DEFAULT_SETTINGS, ...(data || {}), user_id: userId } as AppSettings;
}

export async function saveSettings(userId: string, patch: Partial<AppSettings>) {
  if (!userId) throw new Error("Chưa đăng nhập hoặc user_id rỗng.");

  const payload = {
    user_id: userId,
    opening_cash: patch.opening_cash ?? 0,
    opening_bank: patch.opening_bank ?? 0,
    cash_low_threshold: patch.cash_low_threshold ?? 300000,
    inactive_days_threshold: patch.inactive_days_threshold ?? 2,
    cash_low_message: patch.cash_low_message ?? DEFAULT_SETTINGS.cash_low_message,
    inactive_message: patch.inactive_message ?? DEFAULT_SETTINGS.inactive_message,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data as AppSettings;
}

export async function clearAllTransactions(userId: string) {
  if (!userId) throw new Error("Chưa đăng nhập hoặc user_id rỗng.");

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}
