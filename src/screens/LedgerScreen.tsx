import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  createTransaction,
  listTransactions,
  removeTransaction,
  updateTransaction,
  listTransactionLogs,
  syncPendingTransactions,
} from "../services/transactionService";
import { getSettings, AppSettings } from "../services/settingsService";

type Period = "day" | "week" | "month";
type TxType = "income" | "expense";

const CASH_WALLET_KEYS = ["cash", "tiền mặt", "tien mat"];
const BANK_WALLET_KEYS = ["bank", "ngân hàng", "ngan hang"];

const INCOME_CATEGORIES = [
  "ShopeeFood",
  "GrabFood",
  "Be",
  "Xanh Ngon",
  "Chuyển Khoản",
];

const EXPENSE_CATEGORIES = [
  "Lương",
  "Điện",
  "Nước",
  "Net",
  "Thuê Nhà",
  "Nguyên Liệu",
  "Marketing",
  "Bao Bì",
  "Khác",
];

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
      title: `Ngày ${rangeStart.toLocaleDateString("vi-VN")}`,
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
      title: `Tuần ${rangeStart.toLocaleDateString("vi-VN")} - ${new Date(
        rangeEnd.getTime() - 1
      ).toLocaleDateString("vi-VN")}`,
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
  };
}

// ===== Donut chart =====
const DonutChart: React.FC<{ income: number; expense: number; size?: number }> = ({
  income,
  expense,
  size = 180,
}) => {
  const total = income + expense;
  const incomePct = total > 0 ? Math.round((income / total) * 100) : 0;
  const expPct = total > 0 ? 100 - incomePct : 0;

  const bg = `conic-gradient(#28a745 0% ${incomePct}%, #dc3545 ${incomePct}% 100%)`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative grid place-items-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        style={{ width: size, height: size, background: bg }}
      >
        <div
          className="grid place-items-center rounded-full bg-card-dark"
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

// ===== Input tiền format realtime =====
function formatMoneyInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return { digits: "", display: "" };
  const num = Number(digits);
  return { digits, display: num.toLocaleString("vi-VN") };
}

const LedgerScreen: React.FC<any> = ({ onNavigate }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [period, setPeriod] = useState<Period>("day");
  const [periodOffset, setPeriodOffset] = useState(0);

  const [search, setSearch] = useState("");

  // Add/Edit modal
  const [openModal, setOpenModal] = useState<null | "income" | "expense">(null);
  const [editTx, setEditTx] = useState<any>(null);

  const [amountDigits, setAmountDigits] = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState("bank"); // DEFAULT NGÂN HÀNG
  const [category, setCategory] = useState("");

  // Filter
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Sidebar + Noti + History
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const touchStartX = useRef<number | null>(null);

  const goTo = (tabKey: string) => onNavigate?.(tabKey);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await listTransactions();
      setTransactions(data);

      const logData = await listTransactionLogs();
      setLogs(logData);
    } catch (e) {
      alert("Không thể tải dữ liệu.");
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
    } catch {}
  };

  useEffect(() => {
    fetchAll();
    fetchSettings();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("tx-realtime-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => fetchAll()
      )
      .subscribe();

    const onOnline = async () => {
      const r = await syncPendingTransactions();
      if (r.synced > 0) fetchAll();
    };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) onOnline();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => setPeriodOffset(0), [period]);

  const range = useMemo(() => buildRange(period, periodOffset), [period, periodOffset]);

  const txInRange = useMemo(() => {
    const start = range.rangeStart.getTime();
    const end = range.rangeEnd.getTime();
    return transactions.filter((tx) => {
      const t = new Date(tx.created_at || tx._pendingAt || 0).getTime();
      return t >= start && t < end;
    });
  }, [transactions, range]);

  // Balances overall incl opening
  const { cashBalance, bankBalance } = useMemo(() => {
    let cash = settings.opening_cash || 0;
    let bank = settings.opening_bank || 0;
    for (const tx of transactions) {
      const sign = tx.type === "income" ? 1 : -1;
      const amt = Number(tx.amount || 0) * sign;
      if (isCashWallet(tx.wallet)) cash += amt;
      else if (isBankWallet(tx.wallet)) bank += amt;
      else cash += amt;
    }
    return { cashBalance: cash, bankBalance: bank };
  }, [transactions, settings]);

  // Apply filters
  const filteredTx = useMemo(() => {
    let arr = [...txInRange];

    if (filterType !== "all") arr = arr.filter((t) => t.type === filterType);

    if (filterCats.length > 0) {
      arr = arr.filter((t) => filterCats.includes(t.category));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((t) =>
        `${t.note || ""} ${t.category || ""} ${t.wallet || ""}`
          .toLowerCase()
          .includes(q)
      );
    }

    return arr;
  }, [txInRange, filterType, filterCats, search]);

  const filterTotals = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const t of filteredTx) {
      if (t.type === "income") inc += Number(t.amount || 0);
      else exp += Number(t.amount || 0);
    }
    return { inc, exp, net: inc - exp };
  }, [filteredTx]);

  const totalsInRange = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const t of txInRange) {
      if (t.type === "income") inc += Number(t.amount || 0);
      else exp += Number(t.amount || 0);
    }
    return { inc, exp };
  }, [txInRange]);

  const openAdd = (type: "income" | "expense") => {
    setEditTx(null);
    setOpenModal(type);
    setAmountDigits("");
    setAmountDisplay("");
    setWallet("bank");
    setCategory("");
    setNote("");
  };

  const openEdit = (tx: any) => {
    setEditTx(tx);
    setOpenModal(tx.type);
    const digits = String(tx.amount || "");
    setAmountDigits(digits);
    setAmountDisplay(Number(digits).toLocaleString("vi-VN"));
    setWallet(tx.wallet || "bank");
    setCategory(tx.category || "");
    setNote(tx.note || "");
  };

  const submitTx = async () => {
    const amount = Number(amountDigits);
    if (!amount || amount <= 0) return alert("Nhập số tiền > 0.");

    try {
      if (editTx) {
        await updateTransaction(editTx.id, {
          amount,
          note,
          wallet,
          category,
          type: openModal,
        });
        alert("Đã cập nhật giao dịch.");
      } else {
        const res = await createTransaction({
          type: openModal,
          amount,
          note,
          wallet,
          category: category || null,
          created_at: new Date().toISOString(),
        });
        if (res.isPending) alert("Đã lưu offline. Có mạng sẽ tự sync.");
      }

      setOpenModal(null);
      fetchAll();
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`);
    }
  };

  const onDelete = async () => {
    if (!editTx) return;
    if (!confirm("Xoá giao dịch này?")) return;
    try {
      await removeTransaction(editTx.id);
      alert("Đã xoá.");
      setOpenModal(null);
      fetchAll();
    } catch (e: any) {
      alert(`Lỗi xoá: ${e.message}`);
    }
  };

  // swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) setPeriodOffset((o) => o - 1);
    else if (dx > 50) setPeriodOffset((o) => Math.min(0, o + 1));
    touchStartX.current = null;
  };

  const pendingSyncCount = useMemo(
    () => transactions.filter((t) => t._pendingAt).length,
    [transactions]
  );

  const cashLow = cashBalance < (settings.cash_low_threshold || 0);

  const notifications = useMemo(() => {
    const items: any[] = [];
    const nowLabel = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (cashLow)
      items.push({
        id: "cash",
        title: settings.cash_low_message,
        desc: `Số dư tiền mặt: ${fmtMoney(cashBalance)}`,
        level: "danger",
        timeLabel: nowLabel,
      });
    if (pendingSyncCount > 0)
      items.push({
        id: "pending",
        title: "Có giao dịch chờ sync",
        desc: `${pendingSyncCount} giao dịch đang chờ đồng bộ`,
        level: "info",
        timeLabel: nowLabel,
      });
    if (items.length === 0)
      items.push({
        id: "ok",
        title: "Không có cảnh báo",
        desc: "Dữ liệu ổn định.",
        level: "info",
        timeLabel: nowLabel,
      });
    return items;
  }, [cashLow, pendingSyncCount, settings, cashBalance]);

  const notiBadge = notifications.filter((n) => n.id !== "ok").length;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-dark text-text-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background-dark/90 p-4 pb-3 backdrop-blur-sm border-b border-border-dark">
        <button onClick={() => setSidebarOpen(true)} className="flex size-12 items-center">
          <span className="material-symbols-outlined text-3xl">menu</span>
        </button>

        <h1 className="flex-1 text-center text-lg font-bold tracking-tight">
          Sổ Quỹ Tawa HCM
        </h1>

        <button onClick={() => setNotiOpen(true)} className="relative flex w-12 justify-end">
          <span className="material-symbols-outlined text-2xl">notifications</span>
          {notiBadge > 0 && (
            <span className="absolute right-0 top-0 rounded-full bg-danger text-white text-[10px] font-bold px-1.5 py-0.5">
              {notiBadge}
            </span>
          )}
        </button>
      </header>

      <main className="flex flex-col gap-6 p-4 pt-2">
        {/* Balance cards */}
        <section className="grid grid-cols-2 gap-4">
          <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600">
            <div className="flex items-center gap-2 text-white/90">
              <span className="material-symbols-outlined text-lg">wallet</span>
              <p className="text-sm font-semibold">Ví tiền mặt</p>
            </div>
            <p className="text-2xl font-extrabold mt-1">{fmtMoney(cashBalance)}</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-sky-500 to-indigo-600">
            <div className="flex items-center gap-2 text-white/90">
              <span className="material-symbols-outlined text-lg">
                account_balance
              </span>
              <p className="text-sm font-semibold">Ví ngân hàng</p>
            </div>
            <p className="text-2xl font-extrabold mt-1">{fmtMoney(bankBalance)}</p>
          </div>
        </section>

        {/* Add buttons */}
        <section className="grid grid-cols-2 gap-4">
          <button
            onClick={() => openAdd("income")}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-base font-extrabold text-white shadow-md bg-gradient-to-r from-emerald-500 to-green-600"
          >
            <span className="material-symbols-outlined">add</span>
            Thêm Thu
          </button>

          <button
            onClick={() => openAdd("expense")}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-base font-extrabold text-white shadow-md bg-gradient-to-r from-rose-500 to-red-600"
          >
            <span className="material-symbols-outlined">remove</span>
            Thêm Chi
          </button>
        </section>

        {/* Period + donut */}
        <section className="flex flex-col gap-4">
          <div className="flex h-12 rounded-2xl border border-border-dark bg-card-dark p-1">
            {[
              { key: "day", label: "Ngày" },
              { key: "week", label: "Tuần" },
              { key: "month", label: "Tháng" },
            ].map((p) => (
              <label
                key={p.key}
                className={`flex h-full grow cursor-pointer items-center justify-center rounded-xl px-2 text-sm font-semibold ${
                  period === p.key
                    ? "bg-background-dark text-text-dark shadow-sm"
                    : "text-neutral-text-dark"
                }`}
              >
                {p.label}
                <input
                  className="invisible w-0"
                  type="radio"
                  checked={period === (p.key as Period)}
                  onChange={() => setPeriod(p.key as Period)}
                />
              </label>
            ))}
          </div>

          <div
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="rounded-2xl border border-border-dark bg-card-dark p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold opacity-70">
                {range.title}
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="rounded-lg px-2 py-1 border border-border-dark"
                  onClick={() => setPeriodOffset((o) => o - 1)}
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_left
                  </span>
                </button>
                <button
                  className="rounded-lg px-2 py-1 border border-border-dark disabled:opacity-40"
                  onClick={() => setPeriodOffset((o) => Math.min(0, o + 1))}
                  disabled={periodOffset === 0}
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl p-3 text-white bg-gradient-to-br from-emerald-500/90 to-green-600">
                <div className="text-xs opacity-90">Tổng thu</div>
                <div className="text-lg font-extrabold">
                  {fmtMoney(totalsInRange.inc)}
                </div>
              </div>
              <div className="rounded-2xl p-3 text-white bg-gradient-to-br from-rose-500/90 to-red-600">
                <div className="text-xs opacity-90">Tổng chi</div>
                <div className="text-lg font-extrabold">
                  {fmtMoney(totalsInRange.exp)}
                </div>
              </div>
            </div>

            <div className="text-center font-bold mb-2">
              Tỷ trọng Thu - Chi
            </div>
            <DonutChart
              income={totalsInRange.inc}
              expense={totalsInRange.exp}
            />

            <div className="mt-3 text-center text-[11px] opacity-60">
              Vuốt trái/phải để xem kỳ trước
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-border-dark bg-card-dark p-3">
          <div className="flex items-center justify-between">
            <div className="font-bold">Bộ lọc</div>
            <button
              onClick={() => setFilterOpen(true)}
              className="text-sm font-bold text-primary"
            >
              Chọn lọc
            </button>
          </div>

          {(filterType !== "all" || filterCats.length > 0) && (
            <div className="mt-2 text-sm opacity-80">
              Đang lọc:{" "}
              <b>
                {filterType === "all"
                  ? "Tất cả"
                  : filterType === "income"
                  ? "Thu"
                  : "Chi"}
              </b>
              {filterCats.length > 0 && (
                <>
                  {" • "}
                  {filterCats.join(", ")}
                </>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2 bg-success/10 text-success text-center font-bold text-sm">
              Thu lọc: {fmtMoney(filterTotals.inc)}
            </div>
            <div className="rounded-xl p-2 bg-danger/10 text-danger text-center font-bold text-sm">
              Chi lọc: {fmtMoney(filterTotals.exp)}
            </div>
            <div className="rounded-xl p-2 bg-white/5 text-center font-bold text-sm">
              Net: {fmtMoney(filterTotals.net)}
            </div>
          </div>
        </section>

        {/* Recent list */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Giao dịch</h3>
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-sm font-bold text-primary"
            >
              Lịch sử sửa/xoá
            </button>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-text-dark">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border-border-dark bg-card-dark py-2 pl-10 pr-4 text-sm"
              placeholder="Tìm giao dịch..."
              type="text"
            />
          </div>

          <ul className="flex flex-col rounded-2xl border border-border-dark bg-card-dark overflow-hidden">
            {loading && <li className="p-3 text-sm">Đang tải...</li>}
            {!loading && filteredTx.length === 0 && (
              <li className="p-3 text-sm">Không có giao dịch</li>
            )}

            {filteredTx.map((tx, idx) => {
              const isIncome = tx.type === "income";
              const moneyCls = isIncome ? "text-success" : "text-danger";
              const sign = isIncome ? "+" : "-";
              const time = new Date(tx.created_at || tx._pendingAt || Date.now())
                .toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

              return (
                <li
                  key={tx.id || tx.client_id || idx}
                  onClick={() => openEdit(tx)}
                  className={`flex items-center justify-between px-3 py-3 cursor-pointer ${
                    idx > 0 ? "border-t border-border-dark" : ""
                  } hover:bg-white/5`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-sm ${
                        isIncome
                          ? "bg-success/15 text-success"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      <span className="material-symbols-outlined">
                        {isIncome ? "arrow_downward" : "arrow_upward"}
                      </span>
                    </div>

                    <div>
                      <p className="font-semibold">
                        {tx.note || "Giao dịch"}
                      </p>
                      <p className="text-sm text-neutral-text-dark">
                        {time} • {tx.wallet || "Ví"}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        {tx.category && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10">
                            {tx.category}
                          </span>
                        )}
                        {tx._pendingAt && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/15 text-amber-300">
                            Chờ sync
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className={`font-extrabold ${moneyCls}`}>
                    {sign}
                    {fmtMoney(Number(tx.amount || 0))}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {/* ===== Filter modal ===== */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full rounded-t-2xl bg-card-dark p-4 border-t border-border-dark">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-lg">Chọn bộ lọc</div>
              <button onClick={() => setFilterOpen(false)}>Đóng</button>
            </div>

            <div className="mb-3">
              <div className="text-sm font-bold mb-2">Loại giao dịch</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: "all", t: "Tất cả" },
                  { k: "income", t: "Thu" },
                  { k: "expense", t: "Chi" },
                ].map((x) => (
                  <button
                    key={x.k}
                    onClick={() => setFilterType(x.k as any)}
                    className={`rounded-xl py-2 border ${
                      filterType === x.k
                        ? "border-primary bg-primary/15 text-primary font-bold"
                        : "border-border-dark"
                    }`}
                  >
                    {x.t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold mb-2">
                Danh mục (chọn nhiều)
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-auto">
                {(filterType === "expense"
                  ? EXPENSE_CATEGORIES
                  : INCOME_CATEGORIES
                ).map((c) => {
                  const active = filterCats.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() =>
                        setFilterCats((prev) =>
                          active ? prev.filter((x) => x !== c) : [...prev, c]
                        )
                      }
                      className={`rounded-xl py-2 border text-sm ${
                        active
                          ? "border-primary bg-primary/15 text-primary font-bold"
                          : "border-border-dark"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setFilterType("all");
                  setFilterCats([]);
                }}
                className="rounded-xl py-3 border border-border-dark font-bold"
              >
                Reset lọc
              </button>

              <button
                onClick={() => setFilterOpen(false)}
                className="rounded-xl py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-extrabold"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Sidebar ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full w-[78%] max-w-[320px] bg-[#0B1411] shadow-2xl p-4 animate-[slideInLeft_.18s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-extrabold">TAWA Cashflow</div>
                <div className="text-xs opacity-70">Sổ quỹ + Setting</div>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  goTo("ledger");
                }}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 bg-[#12231C] hover:bg-[#163026]"
              >
                <span className="material-symbols-outlined">wallet</span>
                <div className="font-semibold">Sổ quỹ</div>
              </button>

              <button
                onClick={() => {
                  setSidebarOpen(false);
                  goTo("settings");
                }}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 bg-[#12231C] hover:bg-[#163026]"
              >
                <span className="material-symbols-outlined">settings</span>
                <div className="font-semibold">Cài đặt</div>
              </button>

              <button
                onClick={() => {
                  setSidebarOpen(false);
                  setHistoryOpen(true);
                }}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 bg-[#12231C] hover:bg-[#163026]"
              >
                <span className="material-symbols-outlined">history</span>
                <div className="font-semibold">Lịch sử sửa/xoá</div>
              </button>
            </nav>

            <div className="absolute bottom-4 left-4 right-4 text-xs opacity-60">
              v10 • Dark only
            </div>
          </div>
        </div>
      )}

      {/* ===== Notification drawer ===== */}
      {notiOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setNotiOpen(false)}
          />
          <div className="relative h-full w-[85%] max-w-[360px] bg-card-dark shadow-2xl p-4 animate-[slideInRight_.18s_ease-out]">
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
                    : "border-border-dark bg-white/5";

                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl border p-3 shadow-sm ${tone}`}
                  >
                    <div className="font-bold">{n.title}</div>
                    <div className="text-sm opacity-80 mt-1">{n.desc}</div>
                    <div className="text-[11px] opacity-60 mt-2">
                      {n.timeLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== History modal ===== */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full max-h-[85vh] overflow-auto rounded-t-2xl bg-card-dark p-4 border-t border-border-dark">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-lg">
                Lịch sử sửa / xoá (30 ngày)
              </div>
              <button onClick={() => setHistoryOpen(false)}>Đóng</button>
            </div>

            {logs.length === 0 && (
              <div className="text-sm opacity-70">Chưa có lịch sử.</div>
            )}

            <ul className="flex flex-col gap-2">
              {logs.map((l: any) => (
                <li
                  key={l.id}
                  className="rounded-xl border border-border-dark bg-white/5 p-3"
                >
                  <div className="flex justify-between text-sm">
                    <div className="font-bold">
                      {l.action === "updated"
                        ? "Sửa giao dịch"
                        : "Xoá giao dịch"}
                    </div>
                    <div className="opacity-70">
                      {new Date(l.created_at).toLocaleString("vi-VN")}
                    </div>
                  </div>

                  {l.before_data && (
                    <div className="text-xs opacity-80 mt-2">
                      Trước: {fmtMoney(l.before_data.amount)} •{" "}
                      {l.before_data.category} • {l.before_data.wallet}
                    </div>
                  )}
                  {l.after_data && (
                    <div className="text-xs opacity-80 mt-1">
                      Sau: {fmtMoney(l.after_data.amount)} •{" "}
                      {l.after_data.category} • {l.after_data.wallet}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ===== Add/Edit modal ===== */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60">
          <div className="w-full rounded-t-2xl bg-card-dark p-4 border-t border-border-dark">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-bold">
                {editTx
                  ? "Sửa giao dịch"
                  : openModal === "income"
                  ? "Thêm Thu"
                  : "Thêm Chi"}
              </h4>
              <button
                onClick={() => setOpenModal(null)}
                className="opacity-70"
              >
                Đóng
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                className="w-full rounded-xl border-border-dark bg-background-dark py-3 px-3 text-lg font-bold"
                placeholder="Nhập số tiền"
                value={amountDisplay}
                onChange={(e) => {
                  const f = formatMoneyInput(e.target.value);
                  setAmountDigits(f.digits);
                  setAmountDisplay(f.display);
                }}
              />

              <select
                className="w-full rounded-xl border-border-dark bg-background-dark py-2 px-3"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Chọn danh mục</option>
                {(openModal === "income"
                  ? INCOME_CATEGORIES
                  : EXPENSE_CATEGORIES
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                className="w-full rounded-xl border-border-dark bg-background-dark py-2 px-3"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
              >
                <option value="bank">Ví ngân hàng</option>
                <option value="cash">Ví tiền mặt</option>
              </select>

              <input
                type="text"
                className="w-full rounded-xl border-border-dark bg-background-dark py-2 px-3"
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
                {editTx ? "Lưu thay đổi" : "Lưu giao dịch"}
              </button>

              {editTx && (
                <button
                  onClick={onDelete}
                  className="w-full rounded-xl py-3 text-base font-bold text-danger bg-danger/10 border border-danger/30"
                >
                  Xoá giao dịch
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
