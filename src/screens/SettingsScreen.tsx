// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { getSettings, upsertSettings, AppSettings } from "../services/settingsService";
import { deleteAllTransactions } from "../services/transactionService";

const DEFAULTS: AppSettings = {
  user_id: "",
  opening_cash: 0,
  opening_bank: 0,
  cash_low_threshold: 300000,
  inactive_days_threshold: 2,
  cash_low_message: "Ví tiền mặt sắp hết!",
  inactive_message: "Bạn chưa nhập giao dịch 2 ngày.",
};

const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const s = await getSettings(user.id);
      setSettings({ ...DEFAULTS, user_id: user.id, ...(s || {}) });
    } catch (e: any) {
      alert("Không load được settings, dùng mặc định.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      await upsertSettings(settings);
      alert("Đã lưu cài đặt.");
    } catch (e: any) {
      alert(`Lỗi lưu settings: ${e.message || "Unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = async () => {
    if (!confirm("Xoá sạch toàn bộ giao dịch của tài khoản này?")) return;
    if (!confirm("Chắc chắn lần 2? Xoá là mất luôn.")) return;

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      await deleteAllTransactions(user.id);
      alert("Đã xoá sạch dữ liệu giao dịch.");
    } catch (e: any) {
      alert(`Lỗi xoá dữ liệu: ${e.message || "Unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <h1 className="text-xl font-extrabold mb-4">Cài đặt Sổ Quỹ</h1>

      {loading && <div className="text-sm opacity-70 mb-2">Đang xử lý...</div>}

      <div className="rounded-2xl p-4 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark space-y-4">
        <div>
          <div className="font-bold mb-1">Tồn quỹ ban đầu</div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className="rounded-lg p-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark"
              placeholder="Tiền mặt ban đầu"
              value={settings.opening_cash}
              onChange={(e) => setSettings(s => ({ ...s, opening_cash: Number(e.target.value) }))}
            />
            <input
              type="number"
              className="rounded-lg p-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark"
              placeholder="Ngân hàng ban đầu"
              value={settings.opening_bank}
              onChange={(e) => setSettings(s => ({ ...s, opening_bank: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="border-t border-border-light dark:border-border-dark pt-4">
          <div className="font-bold mb-1">Thông báo</div>

          <label className="text-sm opacity-80">Ví tiền mặt thấp hơn (₫)</label>
          <input
            type="number"
            className="w-full rounded-lg p-2 mt-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark"
            value={settings.cash_low_threshold}
            onChange={(e) => setSettings(s => ({ ...s, cash_low_threshold: Number(e.target.value) }))}
          />

          <label className="text-sm opacity-80 mt-3 block">Nội dung cảnh báo ví thấp</label>
          <input
            type="text"
            className="w-full rounded-lg p-2 mt-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark"
            value={settings.cash_low_message}
            onChange={(e) => setSettings(s => ({ ...s, cash_low_message: e.target.value }))}
          />

          <label className="text-sm opacity-80 mt-3 block">Số ngày không nhập giao dịch</label>
          <input
            type="number"
            className="w-full rounded-lg p-2 mt-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark"
            value={settings.inactive_days_threshold}
            onChange={(e) => setSettings(s => ({ ...s, inactive_days_threshold: Number(e.target.value) }))}
          />

          <label className="text-sm opacity-80 mt-3 block">Nội dung cảnh báo không nhập</label>
          <input
            type="text"
            className="w-full rounded-lg p-2 mt-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark"
            value={settings.inactive_message}
            onChange={(e) => setSettings(s => ({ ...s, inactive_message: e.target.value }))}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            className="flex-1 rounded-lg py-3 font-bold bg-primary text-background-dark"
          >
            Lưu cài đặt
          </button>
          <button
            onClick={resetAll}
            className="flex-1 rounded-lg py-3 font-bold bg-danger/20 text-danger dark:bg-danger/30"
          >
            Xoá sạch dữ liệu
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
