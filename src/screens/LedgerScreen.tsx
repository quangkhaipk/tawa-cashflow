// src/screens/LedgerScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  createTransaction,
  listTransactions,
  removeTransaction,
  syncPendingTransactions,
} from "../services/transactionService";

type TxType = "income" | "expense" | "transfer";

const LedgerScreen: React.FC<any> = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [type, setType] = useState<TxType>("income");
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [wallet, setWallet] = useState<string>("");

  // fetch list
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

  // realtime + autosync
  useEffect(() => {
    const channel = supabase
      .channel("tx-realtime-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => fetchTransactions()
      )
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

  const total = useMemo(() => {
    let t = 0;
    for (const x of transactions) {
      const sign = x.type === "income" ? 1 : x.type === "expense" ? -1 : 0;
      t += sign * Number(x.amount || 0);
    }
    return t;
  }, [transactions]);

  // create
  const onCreate = async () => {
    if (!amount || amount <= 0) return alert("Nhập số tiền > 0.");
    try {
      const user = (await supabase.auth.getUser()).data.user;

      const payload = {
        user_id: user?.id,
        type,
        amount,
        note,
        category: category || null,
        wallet: wallet || null,
        created_at: new Date().toISOString(),
      };

      const res = await createTransaction(payload);

      // optimistic add
      setTransactions((prev) => [res.data, ...prev]);

      if (res.isPending) {
        alert("Đã lưu offline. Có mạng sẽ tự sync.");
      }

      setAmount(0);
      setNote("");
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

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Sổ Quỹ</h2>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={type} onChange={(e) => setType(e.target.value as TxType)}>
            <option value="income">Thu</option>
            <option value="expense">Chi</option>
            <option value="transfer">Chuyển</option>
          </select>

          <input
            type="number"
            placeholder="Số tiền"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Danh mục (tuỳ chọn)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            placeholder="Ví / Ngân hàng (tuỳ chọn)"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        <input
          type="text"
          placeholder="Ghi chú"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />

        <button onClick={onCreate} style={{ width: "100%" }}>
          Tạo giao dịch
        </button>
      </div>

      <div style={{ marginTop: 12, fontWeight: 700 }}>
        Tổng quỹ: {total.toLocaleString("vi-VN")} đ
      </div>

      <div style={{ marginTop: 12 }}>
        {loading && <div>Đang tải...</div>}
        {!loading && transactions.length === 0 && <div>Chưa có giao dịch</div>}

        <ul style={{ listStyle: "none", padding: 0 }}>
          {transactions.map((tx) => (
            <li
              key={tx.id || tx.client_id}
              style={{
                padding: 10,
                marginBottom: 8,
                border: "1px solid #eee",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {tx.type === "income" ? "Thu" : tx.type === "expense" ? "Chi" : "Chuyển"} —{" "}
                  {Number(tx.amount || 0).toLocaleString("vi-VN")} đ
                </div>
                {tx.category && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Danh mục: {tx.category}
                  </div>
                )}
                {tx.wallet && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Ví: {tx.wallet}
                  </div>
                )}
                {tx.note && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {tx.note}
                  </div>
                )}
                {tx._pendingAt && (
                  <div style={{ fontSize: 12, color: "#d97706" }}>
                    Chờ sync
                  </div>
                )}
              </div>

              <button onClick={() => onDelete(tx.id)} style={{ color: "red" }}>
                Xoá
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LedgerScreen;
