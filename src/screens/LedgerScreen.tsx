// src/screens/LedgerScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  createTransaction,
  listTransactions,
  removeTransaction,
  syncPendingTransactions,
} from "../services/transactionService";

type Period = "day" | "week" | "month";
type TxType = "income" | "expense" | "transfer";

const CASH_WALLET_KEYS = ["cash", "tiền mặt", "tien mat"];
const BANK_WALLET_KEYS = ["bank", "ngân hàng", "ngan hang"];
const WEEK_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

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
  const diff = day === 0 ? 6 : day - 1; // về T2
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

// Build chart buckets by period + offset (0 = current, -1 = previous)
function buildChartData(
  transactions: any[],
  period: Period,
  offset: number
) {
  const now = new Date();

  if (period === "day") {
    const target = new Date(now);
    target.setDate(now.getDate() + offset);
    const dayStart = startOfDay(target);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const labels = ["0-4h", "4-8h", "8-12h", "12-16h", "16-20h", "20-24h"];
    const buckets = labels.map(() => ({ income: 0, expense: 0 }));

    for (const tx of transactions) {
      const t = new Date(tx.created_at || tx._pendingAt || 0);
      if (t < dayStart || t >= dayEnd) continue;

      const hour = t.getHours();
      const idx =
        hour < 4 ? 0 : hour < 8 ? 1 : hour < 12 ? 2 : hour < 16 ? 3 : hour < 20 ? 4 : 5;

      if (tx.type === "income") buckets[idx].income += Number(tx.amount || 0);
      if (tx.type === "expense") buckets[idx].expense += Number(tx.amount || 0);
    }

    return {
      labels,
      buckets,
      rangeStart: dayStart,
      rangeEnd: dayEnd,
      title: `Ngày ${fmtDate(dayStart)}`,
    };
  }

  if (period === "week") {
    const target = new Date(now);
    target.setDate(now.getDate() + offset * 7);

    const weekStart = startOfWeekMon(target);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const labels = WEEK_LABELS;
    const buckets = labels.map(() => ({ income: 0, expense: 0 }));

    for (const tx of transactions) {
      const t = new Date(tx.created_at || tx._pendingAt || 0);
      if (t < weekStart || t >= weekEnd) continue;

      let day = t.getDay(); // 0 CN
      day = day === 0 ? 6 : day - 1; // map T2=0...CN=6

      if (tx.type === "income") buckets[day].income += Number(tx.amount || 0);
      if (tx.type === "expense") buckets[day].expense += Number(tx.amount || 0);
    }

    return {
      labels,
      buckets,
      rangeStart: weekStart,
      rangeEnd: weekEnd,
      title: `Tuần ${fmtDate(weekStart)} - ${fmtDate(new Date(weekEnd.getTime() - 1))}`,
    };
  }

  // month
  const target = new Date(now);
  target.setMonth(now.getMonth() + offset);

  const monthStart = startOfMonth(target);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(monthStart.getMonth() + 1);

  const labels = ["W1", "W2", "W3", "W4", "W5"];
  const buckets = labels.map(() => ({ income: 0, expense: 0 }));

  for (const tx of transactions) {
    const t = new Date(tx.created_at || tx._pendingAt || 0);
    if (t < monthStart || t >= nextMonthStart) continue;

    const dayOfMonth = t.getDate();
    const weekIdx = Math.min(4, Math.floor((dayOfMonth - 1) / 7));

    if (tx.type === "income") buckets[weekIdx].income += Number(tx.amount || 0);
    if (tx.type === "expense") buckets[weekIdx].expense += Number(tx.amount || 0);
  }

  return {
    labels,
    buckets,
    rangeStart: monthStart,
    rangeEnd: nextMonthStart,
    title: `Tháng ${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`,
  };
}

const LedgerScreen: React.FC<any> = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [period, setPeriod] = useState<Period>("day");
  const [periodOffset, setPeriodOffset] = useState(0); // 0 hiện tại, -1 kỳ trước
  const [search, setSearch] = useState("");

  // modal add tx
  const [openModal, setOpenModal] = useState<null | "income" | "expense">(null);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState("cash");
  const [category, setCategory] = useState("");

  // full report modal
  const [openReport, setOpenReport] = useState(false);

  // tooltip state
  const [activeBar, setActiveBar] = useState<{ i: number; kind: "income" | "expense" } | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  // swipe state
  const touchStartX = useRef<number | null>(null);

  // ===== fetch list =====
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

  useEffect(() => {
    fetchTransactions();
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

  // Reset offset when period changes
  useEffect(() => {
    setPeriodOffset(0);
    setActiveBar(null);
  }, [period]);

  // Chart data theo period + offset
  const chart = useMemo(() => buildChartData(transactions, period, periodOffset), [
    transactions,
    period,
    periodOffset,
  ]);

  const chartMax = useMemo(() => {
    let m = 0;
    for (const b of chart.buckets) m = Math.max(m, b.income, b.expense);
    return m || 1;
  }, [chart]);

  // Filter by rangeStart/end for totals + report list
  const txInRange = useMemo(() => {
    const start = chart.rangeStart.getTime();
    const end = chart.rangeEnd.getTime();
    return transactions.filter((tx) => {
      const t = new Date(tx.created_at || tx._pendingAt || 0).getTime();
      return t >= start && t < end;
    });
  }, [transactions, chart.rangeStart, chart.rangeEnd]);

  // Search for recent list
  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = txInRange;
    if (!q) return base.slice(0, 8);
    return base
      .filter((tx) => {
        const s = `${tx.note || ""} ${tx.category || ""} ${tx.wallet || ""}`.toLowerCase();
        return s.includes(q);
      })
      .slice(0, 8);
  }, [txInRange, search]);

  // ===== balances overall =====
  const { cashBalance, bankBalance } = useMemo(() => {
    let cash = 0, bank = 0;
    for (const tx of transactions) {
      const sign = tx.type === "income" ? 1 : tx.type === "expense" ? -1 : 0;
      const amt = Number(tx.amount || 0) * sign;
      if (isCashWallet(tx.wallet)) cash += amt;
      else if (isBankWallet(tx.wallet)) bank += amt;
      else cash += amt;
    }
    return { cashBalance: cash, bankBalance: bank };
  }, [transactions]);

  // ===== totals in range =====
  const { totalIncome, totalExpense, net } = useMemo(() => {
    let inc = 0, exp = 0;
    for (const tx of txInRange) {
      if (tx.type === "income") inc += Number(tx.amount || 0);
      if (tx.type === "expense") exp += Number(tx.amount || 0);
    }
    return { totalIncome: inc, totalExpense: exp, net: inc - exp };
  }, [txInRange]);

  const cashLow = cashBalance < 300000;

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

    // swipe threshold
    if (dx < -50) {
      // swipe left => go previous period (offset -1)
      setPeriodOffset((o) => o - 1);
      setActiveBar(null);
    } else if (dx > 50) {
      // swipe right => go toward current (offset +1) but not beyond 0
      setPeriodOffset((o) => Math.min(0, o + 1));
      setActiveBar(null);
    }
    touchStartX.current = null;
  };

  // Tooltip computed
  const tooltip = useMemo(() => {
    if (!activeBar) return null;
    const b = chart.buckets[activeBar.i];
    const value = activeBar.kind === "income" ? b.income : b.expense;
    return {
      label: chart.labels[activeBar.i],
      kind: activeBar.kind,
      value,
    };
  }, [activeBar, chart]);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background-light/80 dark:bg-background-dark/80 p-4 pb-3 backdrop-blur-sm">
        <div className="flex size-12 shrink-0 items-center justify-start">
          <span className="material-symbols-outlined text-3xl">menu</span>
        </div>
        <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-[-0.015em]">
          Sổ Quỹ Tawa HCM
        </h1>
        <div className="flex w-12 items-center justify-end">
          <button className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-transparent">
            <span className="material-symbols-outlined text-2xl">notifications</span>
          </button>
        </div>
      </header>

      <main className="flex flex-col gap-6 p-4 pt-2">
        {/* Balance cards */}
        <section className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 rounded-xl border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark">
            <div className="flex items-center gap-2 text-neutral-text-light dark:text-neutral-text-dark">
              <span className="material-symbols-outlined text-lg">wallet</span>
              <p className="text-sm font-medium">Tiền mặt</p>
            </div>
            <p className="text-xl font-bold leading-tight tracking-tighter">
              {fmtMoney(cashBalance)}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark">
            <div className="flex items-center gap-2 text-neutral-text-light dark:text-neutral-text-dark">
              <span className="material-symbols-outlined text-lg">account_balance</span>
              <p className="text-sm font-medium">Ngân hàng</p>
            </div>
            <p className="text-xl font-bold leading-tight tracking-tighter">
              {fmtMoney(bankBalance)}
            </p>
          </div>
        </section>

        {/* Warning */}
        {cashLow && (
          <section className="flex items-start gap-3 rounded-lg border border-danger/50 bg-danger/10 p-4">
            <span className="material-symbols-outlined mt-0.5 text-xl text-danger">warning</span>
            <div className="flex flex-1 flex-col">
              <p className="text-base font-bold leading-tight">Ví tiền mặt sắp hết!</p>
              <p className="text-sm font-normal leading-normal text-danger">
                Số dư hiện tại thấp hơn mức an toàn. Vui lòng kiểm tra.
              </p>
            </div>
          </section>
        )}

        {/* Add buttons */}
        <section className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setOpenModal("income")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-base font-bold text-background-dark"
          >
            <span className="material-symbols-outlined">add</span>
            Thêm Thu
          </button>

          <button
            onClick={() => setOpenModal("expense")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-danger/20 py-3 text-base font-bold text-danger dark:bg-danger/30"
          >
            <span className="material-symbols-outlined">remove</span>
            Thêm Chi
          </button>
        </section>

        {/* Period filter + summary + chart */}
        <section className="flex flex-col gap-4">
          <div className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border-light bg-card-light p-1 dark:border-border-dark dark:bg-card-dark">
            <label className="flex h-full grow cursor-pointer items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium text-neutral-text-light has-[:checked]:bg-background-light has-[:checked]:text-text-light has-[:checked]:shadow-sm dark:text-neutral-text-dark dark:has-[:checked]:bg-background-dark dark:has-[:checked]:text-text-dark">
              <span className="truncate">Ngày</span>
              <input
                className="invisible w-0"
                type="radio"
                checked={period === "day"}
                onChange={() => setPeriod("day")}
              />
            </label>
            <label className="flex h-full grow cursor-pointer items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium text-neutral-text-light has-[:checked]:bg-background-light has-[:checked]:text-text-light has-[:checked]:shadow-sm dark:text-neutral-text-dark dark:has-[:checked]:bg-background-dark dark:has-[:checked]:text-text-dark">
              <span className="truncate">Tuần</span>
              <input
                className="invisible w-0"
                type="radio"
                checked={period === "week"}
                onChange={() => setPeriod("week")}
              />
            </label>
            <label className="flex h-full grow cursor-pointer items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium text-neutral-text-light has-[:checked]:bg-background-light has-[:checked]:text-text-light has-[:checked]:shadow-sm dark:text-neutral-text-dark dark:has-[:checked]:bg-background-dark dark:has-[:checked]:text-text-dark">
              <span className="truncate">Tháng</span>
              <input
                className="invisible w-0"
                type="radio"
                checked={period === "month"}
                onChange={() => setPeriod("month")}
              />
            </label>
          </div>

          <div className="rounded-xl border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold opacity-70">{chart.title}</div>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-neutral-text-light dark:text-neutral-text-dark">
                  <div className="size-2 rounded-full bg-success"></div>
                  <p className="text-sm font-medium">Tổng thu</p>
                </div>
                <p className="text-lg font-bold text-success">{fmtMoney(totalIncome)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-neutral-text-light dark:text-neutral-text-dark">
                  <div className="size-2 rounded-full bg-danger"></div>
                  <p className="text-sm font-medium">Tổng chi</p>
                </div>
                <p className="text-lg font-bold text-danger">{fmtMoney(totalExpense)}</p>
              </div>
            </div>

            {/* Chart + Tooltip */}
            <div
              ref={chartRef}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              className="relative mt-4 h-44 w-full select-none"
            >
              {/* Tooltip bubble */}
              {tooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 top-1 z-10 rounded-xl bg-black/80 text-white px-3 py-2 text-xs shadow-lg">
                  <div className="font-semibold">
                    {tooltip.kind === "income" ? "Thu" : "Chi"} • {tooltip.label}
                  </div>
                  <div className="text-sm font-bold">{fmtMoney(tooltip.value)}</div>
                  <div className="opacity-70">
                    {chart.rangeStart && `(${fmtDate(chart.rangeStart)})`}
                  </div>
                </div>
              )}

              <div className="flex h-full w-full items-end justify-between gap-2 px-2">
                {chart.labels.map((label, i) => {
                  const b = chart.buckets[i];
                  const incH = Math.round((b.income / chartMax) * 100);
                  const expH = Math.round((b.expense / chartMax) * 100);

                  return (
                    <div key={label} className="flex w-full flex-col items-center gap-1">
                      <div className="flex h-full w-full items-end gap-1">
                        <button
                          onClick={() => setActiveBar({ i, kind: "income" })}
                          onMouseEnter={() => setActiveBar({ i, kind: "income" })}
                          onMouseLeave={() => setActiveBar(null)}
                          className="w-1/2 rounded-t bg-success"
                          style={{ height: `${incH}%` }}
                          title={`Thu: ${fmtMoney(b.income)}`}
                        />
                        <button
                          onClick={() => setActiveBar({ i, kind: "expense" })}
                          onMouseEnter={() => setActiveBar({ i, kind: "expense" })}
                          onMouseLeave={() => setActiveBar(null)}
                          className="w-1/2 rounded-t bg-danger"
                          style={{ height: `${expH}%` }}
                          title={`Chi: ${fmtMoney(b.expense)}`}
                        />
                      </div>
                      <p className="text-xs text-neutral-text-light dark:text-neutral-text-dark">
                        {label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Swipe hint */}
              <div className="absolute bottom-0 left-0 right-0 text-center text-[11px] opacity-60">
                Vuốt trái/phải để xem kỳ trước
              </div>
            </div>

            {/* View full report */}
            <button
              onClick={() => setOpenReport(true)}
              className="mt-3 w-full rounded-lg border border-border-light dark:border-border-dark py-2 text-sm font-bold text-primary"
            >
              Xem báo cáo chi tiết
            </button>
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
                className="w-full rounded-lg border-border-light bg-card-light py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-primary/50 dark:border-border-dark dark:bg-card-dark"
                placeholder="Tìm giao dịch..."
                type="text"
              />
            </div>

            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark">
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
              const iconBg = isIncome ? "bg-success/10 text-success" : "bg-danger/10 text-danger";
              const icon = isIncome ? "arrow_downward" : "arrow_upward";
              const moneyCls = isIncome ? "text-success" : "text-danger";
              const sign = isIncome ? "+" : "-";
              const time = new Date(tx.created_at || tx._pendingAt || Date.now())
                .toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

              return (
                <li
                  key={tx.id || tx.client_id || idx}
                  className={`flex items-center justify-between py-3.5 ${
                    idx > 0 ? "border-t border-border-light dark:border-border-dark" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
                      <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{tx.note || "Giao dịch"}</p>
                      <p className="text-sm text-neutral-text-light dark:text-neutral-text-dark">
                        {time} - {tx.wallet || "Ví tiền mặt"}
                      </p>
                      {tx._pendingAt && <p className="text-xs text-danger">Chờ sync</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className={`font-bold ${moneyCls}`}>
                      {sign}
                      {fmtMoney(Number(tx.amount || 0))}
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
                className="w-full rounded-lg border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                placeholder="Số tiền"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />

              <input
                type="text"
                className="w-full rounded-lg border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                placeholder="Danh mục (tuỳ chọn)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />

              <select
                className="w-full rounded-lg border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
              >
                <option value="cash">Ví tiền mặt</option>
                <option value="bank">Ví ngân hàng</option>
              </select>

              <input
                type="text"
                className="w-full rounded-lg border-border-light bg-background-light dark:bg-background-dark py-2 px-3"
                placeholder="Ghi chú"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <button
                onClick={submitTx}
                className={`w-full rounded-lg py-3 text-base font-bold ${
                  openModal === "income"
                    ? "bg-primary text-background-dark"
                    : "bg-danger/20 text-danger dark:bg-danger/30"
                }`}
              >
                Lưu giao dịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full report modal */}
      {openReport && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full max-h-[85vh] overflow-auto rounded-t-2xl bg-card-light dark:bg-card-dark p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-bold">Báo cáo chi tiết</h4>
              <button onClick={() => setOpenReport(false)} className="opacity-70">
                Đóng
              </button>
            </div>

            <div className="text-sm opacity-70 mb-2">
              {chart.title}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg border border-border-light dark:border-border-dark p-3">
                <div className="text-xs opacity-70">Tổng thu</div>
                <div className="font-bold text-success">{fmtMoney(totalIncome)}</div>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-3">
                <div className="text-xs opacity-70">Tổng chi</div>
                <div className="font-bold text-danger">{fmtMoney(totalExpense)}</div>
              </div>
              <div className="rounded-lg border border-border-light dark:border-border-dark p-3">
                <div className="text-xs opacity-70">Chênh lệch</div>
                <div className={`font-bold ${net >= 0 ? "text-success" : "text-danger"}`}>
                  {fmtMoney(net)}
                </div>
              </div>
            </div>

            {/* Bucket table */}
            <div className="mb-4">
              <div className="font-semibold mb-2">Tổng hợp theo {period === "day" ? "giờ" : period === "week" ? "ngày" : "tuần"}</div>
              <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-background-light dark:bg-background-dark">
                    <tr>
                      <th className="p-2 text-left">Mốc</th>
                      <th className="p-2 text-right text-success">Thu</th>
                      <th className="p-2 text-right text-danger">Chi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.labels.map((lb, i) => (
                      <tr key={lb} className="border-t border-border-light dark:border-border-dark">
                        <td className="p-2">{lb}</td>
                        <td className="p-2 text-right text-success">{fmtMoney(chart.buckets[i].income)}</td>
                        <td className="p-2 text-right text-danger">{fmtMoney(chart.buckets[i].expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Full tx list */}
            <div>
              <div className="font-semibold mb-2">Danh sách giao dịch ({txInRange.length})</div>
              <ul className="flex flex-col">
                {txInRange.map((tx, idx) => {
                  const isIncome = tx.type === "income";
                  const moneyCls = isIncome ? "text-success" : "text-danger";
                  const sign = isIncome ? "+" : "-";
                  const time = new Date(tx.created_at || tx._pendingAt || Date.now())
                    .toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

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
                      <div className={`font-bold ${moneyCls}`}>
                        {sign}{fmtMoney(Number(tx.amount || 0))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerScreen;
