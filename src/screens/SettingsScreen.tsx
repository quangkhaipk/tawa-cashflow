import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  AppSettings,
  getSettings,
  saveSettings,
  clearAllTransactions,
} from "../services/settingsService";

const SettingsScreen: React.FC<any> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");

  const [form, setForm] = useState<AppSettings>({
    user_id: "",
    opening_cash: 0,
    opening_bank: 0,
    cash_low_threshold: 300000,
    inactive_days_threshold: 2,
    cash_low_message: "Ví tiền mặt sắp hết!",
    inactive_message: "Bạn chưa nhập giao dịch 2 ngày.",
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        alert("Bạn chưa đăng nhập.");
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const s = await getSettings(user.id);
      setForm(s);
      setLoading(false);
    };
    run();
  }, []);

  const update = (key: keyof AppSettings, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = async () => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return alert("Bạn chưa đăng nhập.");
      const saved = await saveSettings(user.id, form);
      setForm(saved);
      alert("Đã lưu cài đặt.");
      onNavigate?.("ledger");
    } catch (e: any) {
      alert(`Lỗi lưu settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const onClearData = async () => {
    if (!confirm("Xoá sạch toàn bộ giao dịch?")) return;
    if (!confirm("Chắc chắn lần nữa?")) return;
    try {
      await clearAllTransactions(userId);
      alert("Đã xoá sạch giao dịch.");
      onNavigate?.("ledger");
    } catch (e: any) {
      alert(`Lỗi xoá dữ liệu: ${e.message}`);
    }
  };

  if (loading) return <div className="p-4 text-sm opacity-70">Đang tải...</div>;

  return (
    <div className="min-h-screen p-4 bg-background-dark text-text-dark">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold">Cài đặt Sổ quỹ</h2>
        <button
          className="text-sm font-bold text-primary"
          onClick={() => onNavigate?.("ledger")}
        >
          Quay lại
        </button>
      </div>

      <div className="rounded-2xl bg-card-dark border border-border-dark p-4 mb-4">
        <div className="font-bold mb-2">Tồn quỹ đầu kỳ</div>

        <label className="text-sm opacity-70">Ví ngân hàng</label>
        <input
          type="number"
          className="w-full rounded-xl border-border-dark bg-background-dark p-2 mt-1 mb-3"
          value={form.opening_bank}
          onChange={(e) => update("opening_bank", Number(e.target.value))}
        />

        <label className="text-sm opacity-70">Ví tiền mặt</label>
        <input
          type="number"
          className="w-full rounded-xl border-border-dark bg-background-dark p-2 mt-1"
          value={form.opening_cash}
          onChange={(e) => update("opening_cash", Number(e.target.value))}
        />
      </div>

      <div className="rounded-2xl bg-card-dark border border-border-dark p-4 mb-4">
        <div className="font-bold mb-2">Cảnh báo</div>

        <label className="text-sm opacity-70">Ngưỡng ví tiền mặt thấp</label>
        <input
          type="number"
          className="w-full rounded-xl border-border-dark bg-background-dark p-2 mt-1 mb-3"
          value={form.cash_low_threshold}
          onChange={(e) => update("cash_low_threshold", Number(e.target.value))}
        />

        <label className="text-sm opacity-70">Số ngày không có giao dịch</label>
        <input
          type="number"
          className="w-full rounded-xl border-border-dark bg-background-dark p-2 mt-1 mb-3"
          value={form.inactive_days_threshold}
          onChange={(e) => update("inactive_days_threshold", Number(e.target.value))}
        />

        <label className="text-sm opacity-70">Nội dung cảnh báo ví thấp</label>
        <input
          type="text"
          className="w-full rounded-xl border-border-dark bg-background-dark p-2 mt-1 mb-3"
          value={form.cash_low_message}
          onChange={(e) => update("cash_low_message", e.target.value)}
        />

        <label className="text-sm opacity-70">Nội dung cảnh báo không nhập</label>
        <input
          type="text"
          className="w-full rounded-xl border-border-dark bg-background-dark p-2 mt-1"
          value={form.inactive_message}
          onChange={(e) => update("inactive_message", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-xl py-3 font-extrabold text-white bg-gradient-to-r from-emerald-500 to-green-600 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>

        <button
          onClick={onClearData}
          className="w-full rounded-xl py-3 font-extrabold text-danger bg-danger/10 border border-danger/30"
        >
          Xoá sạch dữ liệu giao dịch
        </button>
      </div>
    </div>
  );
};

export default SettingsScreen;
