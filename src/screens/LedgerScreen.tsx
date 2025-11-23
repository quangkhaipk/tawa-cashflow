// src/screens/LedgerScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  createTransaction,
  listTransactions,
  removeTransaction,
  syncPendingTransactions,
} from "../services/transactionService";
import { getSettings, AppSettings } from "../services/settingsService";

type Period = "day" | "week" | "month";
type TxType = "income" | "expense" | "transfer";

const CASH_WALLET_KEYS = ["cash", "tiền mặt", "tien mat"];
const BANK_WALLET_KEYS = ["bank", "ngân hàng", "ngan hang"];
const WEEK_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// ===== Danh mục chuẩn Thu/Chi =====
const INCOME_CATEGORIES = ["ShopeeFood", "GrabFood", "Be", "Xanh Ngon", "Chuyển Khoản"];
const EXPENSE_CATEGORIES = ["Lương", "Điện", "Nước", "Net", "Thuê Nhà", "Nguyên Liệu", "Khác"];

const DEFAULT_SETTINGS: AppSettings = {
  user_id: "",
  opening_cash: 0,
  opening_bank: 0,
  cash_low_threshold: 300000,
  inactive_days_threshold: 2,
  cash_low_message: "Ví tiền mặt sắp hết!",
  inactive_message: "Bạn chưa nhập giao dịch 2 ngày.",
};

function isCashWallet(w?: string) {
  if (!w) return false;
  const x = w.toLowerCase();
  return CASH_WALLET_KEYS.some((k) => x.includes(k));
}
function isBankWallet(w?: string) {
  if (!w) return false;
  const x = w.toLowerCase();
  return BANK_WALLET_KEYS.some((k) => x.includes(k));
}
function fmtMoney(n: number) {
  return (n || 0).toLocaleString("vi-VN") + "₫";
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("vi-VN");
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeekMon(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 CN
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function buildRange(period: Period, offset: number) {
  const now = new Date();

  if (period === "day") {
    const target = new Date(now);
    target.setDate(now.getDate() + offset);
    const rangeStart = startOfDay(target);
    const rangeEnd = new Date(rangeStart.getTime() + 24 * 60 * 60 * 1000);
    return {
      rangeStart,
      rangeEnd,
      title: `Ngày ${fmtDate(rangeStart)}`,
      labels: ["0-4h", "4-8h", "8-12h", "12-16h", "16-20h", "20-24h"],
    };
  }

  if (period === "week") {
    const target = new Date(now);
    target.setDate(now.getDate() + offset * 7);
    const rangeStart = startOfWeekMon(target);
    const rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      rangeStart,
      rangeEnd,
      title: `Tuần ${fmtDate(rangeStart)} - ${fmtDate(new Date(rangeEnd.getTime() - 1))}`,
      labels: WEEK_LABELS,
    };
  }

  const target = new Date(now);
  target.setMonth(now.getMonth() + offset);
  const rangeStart = startOfMonth(target);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setMonth(rangeStart.getMonth() + 1);

  return {
    rangeStart,
    rangeEnd,
    title: `Tháng ${rangeStart.getMonth() + 1}/${rangeStart.getFullYear()}`,
    labels: ["W1", "W2", "W3", "W4", "W5"],
  };
}

// ===== Donut Chart (no library) =====
const DonutChart: React.FC<{
  income: number;
  expense: number;
  size?: number;
}> = ({ income, expense, size = 178 }) => {
  const total = income + expense;
  const incomePct = total > 0 ? Math.round((income / total) * 100) : 0;
  const expPct = total > 0 ? 100 - incomePct : 0;

  const bg = `conic-gradient(
    #28a745 0% ${incomePct}%,
    #dc3545 ${incomePct}% 100%
  )`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative grid place-items-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
        style={{ width: size, height: size, background: bg }}
      >
        <div
          className="grid place-items-center rounded-full bg-card-light dark:bg-card-dark"
          style={{ width: size * 0.68, height: size * 0.68 }}
        >
          <div className="text-xs opacity-70">Tổng</div>
          <div className="text-xl font-extrabold tracking-tight">{fmtMoney(total)}</div>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-success" />
          <span className="font-semibold">Thu</span>
          <span className="opacity-70">({incomePct}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-danger" />
          <span className="font-semibold">Chi</span>
          <span className="opacity-70">({expPct}%)</span>
        </div>
      </div>
    </div>
  );
};

type NotiItem = {
  id: string;
  title: string;
  desc: string;
  level: "danger" | "warning" | "info";
  timeLabel: string;
};

const LedgerScreen: React.FC<any> = ({ onNavigate }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Settings
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // UI state
  const [period, setPeriod] = useState<Period>("day");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [search, setSearch] = useState("");

  // modal add tx
  const [openModal, setOpenModal] = useState<null | "income" | "expense">(null);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState("cash");
  const [category, setCategory] = useState("");

  // report modal (list only)
  const [openReport, setOpenReport] = useState(false);

  // Sidebar + Notification
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);

  // swipe
  const touchStartX = useRef<number | null>(null);

  const goTo = (tabKey: string) => {
    if (typeof onNavigate === "function") onNavigate(tabKey);
    else alert("Chưa có điều hướng tab trong App.tsx");
  };

  // ===== fetch list + settings =====
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await listTransactions();
      setTransactions(data);
    } catch (e) {
      console.error(e);
      alert("Không thể tải giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const s = await getSettings(user.id);
      setSettings({ ...DEFAULT_SETTINGS, user_id: user.id, ...(s || {}) });
    } catch (e) {
      console.warn("settings fallback default");
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchSettings();
  }, []);

  // ===== realtime + autosync =====
  useEffect(() => {
    const channel = supabase
      .channel("tx-realtime-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions();
      })
      .subscribe();

    const onOnline = async () => {
      try {
        const r = await syncPendingTransactions();
        if (r.synced > 0) fetchTransactions();
      } catch (e) {
        console.warn("Auto sync pending failed:", e);
      }
    };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) onOnline();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // Reset offset khi đổi period
  useEffect(() => {
    setPeriodOffset(0);
  }, [period]);

  const range = useMemo(() => buildRange(period, periodOffset), [period, periodOffset]);

  // Tx trong kỳ
  const txInRange = useMemo(() => {
    const start = range.rangeStart.getTime();
    const end = range.rangeEnd.getTime();
    return transactions.filter((tx) => {
      const t = new Date(tx.created_at || tx._pendingAt || 0).getTime();
      return t >= start && t < end;
    });
  }, [transactions, range]);

  // Totals trong kỳ
  const { totalIncome, totalExpense, net } = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const tx of txInRange) {
      if (tx.type === "income") inc += Number(tx.amount || 0);
      if (tx.type === "expense") exp += Number(tx.amount || 0);
    }
    return { totalIncome: inc, totalExpense: exp, net: inc - exp };
  }, [txInRange]);

  // ===== balances overall + opening =====
  const { cashBalance, bankBalance } = useMemo(() => {
    let cash = settings.opening_cash || 0;
    let bank = settings.opening_bank || 0;

    for (const tx of transactions) {
      const sign = tx.type === "income" ? 1 : tx.type === "expense" ? -1 : 0;
      const amt = Number(tx.amount || 0) * sign;

      if (isCashWallet(tx.wallet)) cash += amt;
      else if (isBankWallet(tx.wallet)) bank += amt;
      else cash += amt;
    }
    return { cashBalance: cash, bankBalance: bank };
  }, [transactions, settings]);

  // Search list gần đây
  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = txInRange;
    if (!q) return base.slice(0, 10);
    return base
      .filter((tx) => {
        const s = `${tx.note || ""} ${tx.category || ""} ${tx.wallet || ""}`.toLowerCase();
        return s.includes(q);
      })
      .slice(0, 10);
  }, [txInRange, search]);

  // ===== notifications from settings =====
  const cashLow = cashBalance < (settings.cash_low_threshold || 0);

  const inactiveWarning = useMemo(() => {
    const days = settings.inactive_days_threshold ?? 2;
    if (transactions.length === 0) return true;

    const latest = transactions
      .map((tx) => new Date(tx.created_at || tx._pendingAt || 0).getTime())
      .reduce((a, b) => Math.max(a, b), 0);

    const diffMs = Date.now() - latest;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= days;
  }, [transactions, settings]);

  const pendingSyncCount = useMemo(
    () => transactions.filter((t) => t._pendingAt).length,
    [transactions]
  );

  const notifications: NotiItem[] = useMemo(() => {
    const items: NotiItem[] = [];
    const nowLabel = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

    if (cashLow) {
      items.push({
        id: "cash-low",
        title: settings.cash_low_message || DEFAULT_SETTINGS.cash_low_message,
        desc: `Số dư tiền mặt hiện tại: ${fmtMoney(cashBalance)} (ngưỡng: ${fmtMoney(
          settings.cash_low_threshold
        )}).`,
        level: "danger",
        timeLabel: nowLabel,
      });
    }

    if (inactiveWarning) {
      items.push({
        id: "inactive",
        title: settings.inactive_message || DEFAULT_SETTINGS.inactive_message,
        desc: `Không có giao dịch mới trong ${settings.inactive_days_threshold} ngày gần nhất.`,
        level: "warning",
        timeLabel: nowLabel,
      });
    }

    if (pendingSyncCount > 0) {
      items.push({
        id: "pending",
        title: "Có giao dịch đang chờ sync",
        desc: `Đang chờ đồng bộ: ${pendingSyncCount} giao dịch. Mở mạng để tự sync.`,
        level: "info",
        timeLabel: nowLabel,
      });
    }

    if (items.length === 0) {
      items.push({
        id: "ok",
        title: "Không có cảnh báo",
        desc: "Dòng tiền đang ổn định. Tiếp tục cập nhật giao dịch hằng ngày nhé.",
        level: "info",
        timeLabel: nowLabel,
      });
    }

    return items;
  }, [cashLow, inactiveWarning, pendingSyncCount, settings, cashBalance]);

  const notiBadge = useMemo(
    () => notifications.filter((n) => n.id !== "ok").length,
    [notifications]
  );

  // ===== create tx =====
  const submitTx = async () => {
    if (!amount || amount <= 0) return alert("Nhập số tiền > 0.");
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const payload = {
        user_id: user?.id,
        type: openModal as TxType,
        amount,
        note,
        wallet,
        category: category || null,
        created_at: new Date().toISOString(),
      };

      const res = await createTransaction(payload);
      setTransactions((prev) => [res.data, ...prev]);

      if (res.isPending) alert("Đã lưu offline. Có mạng sẽ tự sync.");

      setOpenModal(null);
      setAmount(0);
      setNote("");
      setCategory("");
      setWallet("cash");
    } catch (e: any) {
      alert(`Lỗi tạo giao dịch: ${e?.message || "Unknown"}`);
    }
  };

  const onDelete = async (id: any) => {
    if (!confirm("Xoá giao dịch?")) return;
    try {
      const res = await removeTransaction(id);
      setTransactions((prev) => prev.filter((x) => x.id !== id));
      if (res.isPending) alert("Đã xoá offline, sẽ sync khi có mạng.");
    } catch (e: any) {
      alert(`Lỗi xoá: ${e?.message || "Unknown"}`);
    }
  };

  // ===== swipe handlers =====
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - touchStartX.current;

    if (dx < -50) setPeriodOffset((o) => o - 1);
    else if (dx > 50) setPeriodOffset((o) => Math.min(0, o + 1));

    touchStartX.current = null;
  };

  const signOut = async () => {
    if (!confirm("Đăng xuất khỏi tài khoản?")) return;
    await supabase.auth.signOut();
    goTo("dashboard");
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background-light/80 dark:bg-background-dark/80 p-4 pb-3 backdrop-blur-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex size-12 shrink-0 items-center justify-start"
        >
          <span className="material-symbols-outlined text-3xl">menu</span>
        </button>

        <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-[-0.015em]">
          Sổ Quỹ Tawa HCM
        </h1>

        <button
          onClick={() => setNotiOpen(true)}
          className="relative flex w-12 items-center justify-end"
        >
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-transparent">
            <span className="material-symbols-outlined text-2xl">notifications</span>
          </div>
          {notiBadge > 0 && (
            <span className="absolute right-2 top-1.5 grid place-items-center rounded-full bg-danger text-white text-[10px] font-bold px-1.5 py-0.5">
              {notiBadge}
            </span>
          )}
        </button>
      </header>

      <main className="flex flex-col gap-6 p-4 pt-2">
        {/* Balance cards gradient */}
        <section className="grid grid-cols-2 gap-4">
          <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600">
            <div className="flex items-center gap-2 text-white/90">
              <span className="material-symbols-outlined text-lg">wallet</span>
              <p className="text-sm font-semibold">Ví tiền mặt</p>
            </div>
            <p className="text-2xl font-extrabold tracking-tight mt-1">
              {fmtMoney(cashBalance)}
            </p>
            <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-sky-500 to-indigo-600">
            <div className="flex items-center gap-2 text-white/90">
              <span className="material-symbols-outlined text-lg">account_balance</span>
              <p className="text-sm font-semibold">Ví ngân hàng</p>
            </div>
            <p className="text-2xl font-extrabold tracking-tight mt-1">
              {fmtMoney(bankBalance)}
            </p>
            <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
          </div>
        </section>

        {/* Warning cards */}
        {cashLow && (
          <section className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 shadow-sm">
            <span className="material-symbols-outlined mt-0.5 text-xl text-danger">warning</span>
            <div className="flex flex-1 flex-col">
              <p className="text-base font-bold leading-tight">
                {settings.cash_low_message || DEFAULT_SETTINGS.cash_low_message}
              </p>
              <p className="text-sm font-normal leading-normal text-danger">
                Số dư ví tiền mặt thấp hơn ngưỡng an toàn.
              </p>
            </div>
          </section>
        )}

        {inactiveWarning && (
          <section className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 shadow-sm">
            <span className="material-symbols-outlined mt-0.5 text-xl text-amber-500">schedule</span>
            <div className="flex flex-1 flex-col">
              <p className="text-base font-bold leading-tight">
                {settings.inactive_message || DEFAULT_SETTINGS.inactive_message}
              </p>
              <p className="text-sm font-normal leading-normal text-amber-600 dark:text-amber-300">
                Hãy nhập giao dịch để dữ liệu luôn chính xác.
              </p>
            </div>
          </section>
        )}

        {/* Add buttons */}
        <section className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setOpenModal("income")}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white shadow-md bg-gradient-to-r from-emerald-500 to-green-600"
          >
            <span className="material-symbols-outlined">add</span>
            Thêm Thu
          </button>

          <button
            onClick={() => setOpenModal("expense")}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white shadow-md bg-gradient-to-r from-rose-500 to-red-600"
          >
            <span className="material-symbols-outlined">remove</span>
            Thêm Chi
          </button>
        </section>

        {/* Period filter + totals + donut */}
        <section className="flex flex-col gap-4">
          <div className="flex h-12 items-center justify-center rounded-2xl border border-border-light bg-card-light p-1 dark:border-border-dark dark:bg-card-dark">
            <label className="flex h-full grow cursor-pointer items-center justify-center rounded-xl px-2 text-sm font-semibold text-neutral-text-light has-[:checked]:bg-background-light has-[:checked]:text-text-light has-[:checked]:shadow-sm dark:text-neutral-text-dark dark:has-[:checked]:bg-background-dark dark:has-[:checked]:text-text-dark">
              <span className="truncate">Ngày</span>
              <input className="invisible w-0" type="radio" checked={period === "day"} onChange={() => setPeriod("day")} />
            </label>
            <label className="flex h-full grow cursor-pointer items-center justify-center rounded-xl px-2 text-sm font-semibold text-neutral-text-light has-[:checked]:bg-background-light has-[:checked]:text-text-light has-[:checked]:shadow-sm dark:text-neutral-text-dark dark:has-[:checked]:bg-background-dark dark:has-[:checked]:text-text-dark">
              <span className="truncate">Tuần</span>
              <input className="invisible w-0" type="radio" checked={period === "week"} onChange={() => setPeriod("week")} />
            </label>
            <label className="flex h-full grow cursor-pointer items-center justify-center rounded-xl px-2 text-sm font-semibold text-neutral-text-light has-[:checked]:bg-background-light has-[:checked]:text-text-light has-[:checked]:shadow-sm dark:text-neutral-text-dark dark:has-[:checked]:bg-background-dark dark:has-[:checked]:text-text-dark">
              <span className="truncate">Tháng</span>
              <input className="invisible w-0" type="radio" checked={period === "month"} onChange={() => setPeriod("month")} />
            </label>
          </div>

          <div
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="rounded-2xl border border-border-light bg-card-light p-4 shadow-sm dark:border-border-dark dark:bg-card-dark"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold opacity-70">{range.title}</div>

              <div className="flex items-center gap-1">
                <button
                  className="rounded-lg px-2 py-1 border border-border-light dark:border-border-dark"
                  onClick={() => setPeriodOffset((o) => o - 1)}
                  title="Kỳ trước"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <button
                  className="rounded-lg px-2 py-1 border border-border-light dark:border-border-dark disabled:opacity-40"
                  onClick={() => setPeriodOffset((o) => Math.min(0, o + 1))}
                  disabled={periodOffset === 0}
                  title="Về kỳ hiện tại"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl p-3 text-white shadow bg-gradient-to-br from-emerald-500/90 to-green-600">
                <div className="text-xs opacity-90">Tổng thu</div>
                <div className="text-lg font-extrabold">{fmtMoney(totalIncome)}</div>
              </div>
              <div className="rounded-2xl p-3 text-white shadow bg-gradient-to-br from-rose-500/90 to-red-600">
                <div className="text-xs opacity-90">Tổng chi</div>
                <div className="text-lg font-extrabold">{fmtMoney(totalExpense)}</div>
              </div>
            </div>

            <div>
              <div className="text-center font-bold mb-2">Tỷ trọng Thu - Chi</div>
              <DonutChart income={totalIncome} expense={totalExpense} />
            </div>

            <button
              onClick={() => setOpenReport(true)}
              className="mt-4 w-full rounded-xl border border-border-light dark:border-border-dark py-2 text-sm font-bold text-primary"
            >
              Xem danh sách giao dịch kỳ này
            </button>

            <div className="mt-2 text-center text-[11px] opacity-60">
              Vuốt trái/phải để xem kỳ trước
            </div>
          </div>
        </section>

        {/* Recent transactions */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Giao dịch gần đây</h3>
            <button onClick={() => setSearch("")} className="text-sm font-bold text-primary">
              Xem tất cả
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-grow">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-text-light dark:text-neutral-text-dark">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border-border-light bg-card-light py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-primary/50 dark:border-border-dark dark:bg-card-dark"
                placeholder="Tìm giao dịch..."
                type="text"
              />
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark">
              <span className="material-symbols-outlined text-neutral-text-light dark:text-neutral-text-dark">
                filter_list
              </span>
            </button>
          </div>

          <ul className="flex flex-col">
            {loading && <li className="py-3 text-sm">Đang tải...</li>}
            {!loading && filteredRecent.length === 0 && (
              <li className="py-3 text-sm">Chưa có giao dịch</li>
            )}

            {filteredRecent.map((tx, idx) => {
              const isIncome = tx.type === "income";
              const moneyCls = isIncome ? "text-success" : "text-danger";
              const sign = isIncome ? "+" : "-";
              const time = new Date(tx.created_at || tx._pendingAt || Date.now())
                .toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

              return (
                <li
                  key={tx.id || tx.client_id || idx}
                  className={`flex items-center justify-between py-3 ${
                    idx > 0 ? "border-t border-border-light dark:border-border-dark" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-sm ${
                        isIncome ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}
                    >
                      <span className="material-symbols-outlined">
                        {isIncome ? "arrow_downward" : "arrow_upward"}
                      </span>
                    </div>

                    <div>
                      <p className="font-semibold">{tx.note || "Giao dịch"}</p>
                      <p className="text-sm text-neutral-text-light dark:text-neutral-text-dark">
                        {time} • {tx.wallet || "Ví tiền mặt"}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        {tx.category && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/5 dark:bg-white/10">
                            {tx.category}
                          </span>
                        )}
                        {tx._pendingAt && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/15 text-amber-600 dark:text-amber-300">
                            Chờ sync
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className={`font-extrabold ${moneyCls}`}>
                      {sign}{fmtMoney(Number(tx.amount || 0))}
                    </p>
                    <button onClick={() => onDelete(tx.id)} className="text-xs text-danger">
                      Xoá
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {/* ===== Sidebar Drawer ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full w-[78%] max-w-[320px] bg-card-light dark:bg-card-dark shadow-2xl p-4 animate-[slideInLeft_.18s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-extrabold">TAWA Cashflow</div>
                <div className="text-xs opacity-70">Quản lý dòng tiền</div>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              <button
                onClick={() => { setSidebarOpen(false); goTo("ledger"); }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="material-symbols-outlined">wallet</span>
                <div className="font-semibold">Sổ quỹ</div>
              </button>

              <button
                onClick={() => { setSidebarOpen(false); goTo("settings"); }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="material-symbols-outlined">settings</span>
                <div className="font-semibold">Cài đặt</div>
              </button>

              <button
                onClick={() => { setSidebarOpen(false); setOpenReport(true); }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="material-symbols-outlined">bar_chart</span>
                <div className="font-semibold">Báo cáo kỳ này</div>
              </button>

              <div className="my-2 border-t border-border-light dark:border-border-dark" />

              <button
                onClick={signOut}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-danger hover:bg-danger/10"
              >
                <span className="material-symbols-outlined">logout</span>
                <div className="font-semibold">Đăng xuất</div>
              </button>
            </nav>

            <div className="absolute bottom-4 left-4 right-4 text-xs opacity-60">
              v9 • Sidebar + Notification Center
            </div>
          </div>
        </div>
      )}

      {/* ===== Notification Center Drawer ===== */}
      {notiOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setNotiOpen(false)}
          />
          <div className="relative h-full w-[85%] max-w-[360px] bg-card-light dark:bg-card-dark shadow-2xl p-4 animate-[slideInRight_.18s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-extrabold">Thông báo</div>
              <button onClick={() => setNotiOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {notifications.map((n) => {
                const tone =
                  n.level === "danger"
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : n.level === "warning"
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300"
                    : "border-border-light bg-black/5 dark:bg-white/5";

                const icon =
                  n.level === "danger"
                    ? "warning"
                    : n.level === "warning"
                    ? "schedule"
                    : "info";

                return (
                  <div key={n.id} className={`rounded-2xl border p-3 shadow-sm ${tone}`}>
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined mt-0.5">{icon}</span>
                      <div className="flex-1">
                        <div className="font-bold leading-tight">{n.title}</div>
                        <div className="text-sm opacity-80 mt-1">{n.desc}</div>
                        <div className="text-[11px] opacity-60 mt-2">{n.timeLabel}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs opacity-60">
              Mọi cảnh báo lấy theo cài đặt trong Settings.
            </div>
          </div>
        </div>
      )}

      {/* Modal add Thu/Chi */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-card-light dark:bg-card-dark p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-bold">
                {openModal === "income" ? "Thêm Thu" : "Thêm Chi"}
              </h4>
              <button onClick={() => setOpenModal(null)} className="opacity-70">
                Đóng
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="number"
                className="w-full rounded-xl border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                placeholder="Số tiền"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />

              <select
                className="w-full rounded-xl border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Chọn danh mục</option>
                {(openModal === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                className="w-full rounded-xl border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
              >
                <option value="cash">Ví tiền mặt</option>
                <option value="bank">Ví ngân hàng</option>
              </select>

              <input
                type="text"
                className="w-full rounded-xl border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                placeholder="Ghi chú"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <button
                onClick={submitTx}
                className={`w-full rounded-xl py-3 text-base font-bold text-white shadow ${
                  openModal === "income"
                    ? "bg-gradient-to-r from-emerald-500 to-green-600"
                    : "bg-gradient-to-r from-rose-500 to-red-600"
                }`}
              >
                Lưu giao dịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {openReport && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full max-h-[85vh] overflow-auto rounded-t-2xl bg-card-light dark:bg-card-dark p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-bold">Giao dịch kỳ này</h4>
              <button onClick={() => setOpenReport(false)} className="opacity-70">
                Đóng
              </button>
            </div>

            <div className="text-sm opacity-70 mb-3">{range.title}</div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl p-3 text-white bg-gradient-to-br from-emerald-500 to-green-600">
                <div className="text-xs opacity-90">Tổng thu</div>
                <div className="font-extrabold">{fmtMoney(totalIncome)}</div>
              </div>
              <div className="rounded-xl p-3 text-white bg-gradient-to-br from-rose-500 to-red-600">
                <div className="text-xs opacity-90">Tổng chi</div>
                <div className="font-extrabold">{fmtMoney(totalExpense)}</div>
              </div>
              <div className="rounded-xl p-3 text-white bg-gradient-to-br from-slate-600 to-slate-800">
                <div className="text-xs opacity-90">Chênh lệch</div>
                <div className="font-extrabold">{fmtMoney(net)}</div>
              </div>
            </div>

            <ul className="flex flex-col">
              {txInRange.map((tx, idx) => {
                const isIncome = tx.type === "income";
                const moneyCls = isIncome ? "text-success" : "text-danger";
                const sign = isIncome ? "+" : "-";
                const time = new Date(tx.created_at || tx._pendingAt || Date.now()).toLocaleString(
                  "vi-VN",
                  { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }
                );

                return (
                  <li
                    key={tx.id || tx.client_id || idx}
                    className={`flex items-center justify-between py-3 ${
                      idx > 0 ? "border-t border-border-light dark:border-border-dark" : ""
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{tx.note || "Giao dịch"}</div>
                      <div className="text-xs opacity-70">
                        {time} • {tx.wallet || "Ví"} • {tx.category || "—"}
                      </div>
                    </div>
                    <div className={`font-extrabold ${moneyCls}`}>
                      {sign}
                      {fmtMoney(Number(tx.amount || 0))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: .7; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: .7; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LedgerScreen;
