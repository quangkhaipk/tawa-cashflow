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

export async function getSettings(user_id: string): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function upsertSettings(payload: Partial<AppSettings> & { user_id: string }) {
  const { data, error } = await supabase
    .from("app_settings")
    .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data as AppSettings;
}
