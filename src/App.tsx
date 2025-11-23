import React, { useEffect, useState } from "react";
import LedgerScreen from "./screens/LedgerScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { supabase } from "./supabaseClient";

type TabKey = "ledger" | "settings";

const App: React.FC = () => {
  const [tab, setTab] = useState<TabKey>("ledger");
  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Restore session + listen auth changes
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user || null);
      setSessionReady(true);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setUser(sess?.user || null);
      setSessionReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!sessionReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-background-dark text-text-dark">
        <div className="text-sm opacity-70">Đang khởi tạo...</div>
      </div>
    );
  }

  // ===== Not logged in => show Login =====
  if (!user) return <LoginScreen onLoggedIn={() => setTab("ledger")} />;

  return (
    <>
      {tab === "ledger" && <LedgerScreen onNavigate={(k: TabKey) => setTab(k)} />}
      {tab === "settings" && (
        <SettingsScreen onNavigate={(k: TabKey) => setTab(k)} />
      )}
    </>
  );
};

export default App;

// ================= Login Screen =================
const LoginScreen: React.FC<{ onLoggedIn: () => void }> = ({ onLoggedIn }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!email || !password) return setErr("Nhập email và mật khẩu.");

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert("Đăng ký xong. Giờ đăng nhập lại nhé.");
        setMode("login");
        return;
      }
      onLoggedIn();
    } catch (e: any) {
      setErr(e.message || "Lỗi đăng nhập.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark text-text-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-dark bg-card-dark p-5 shadow-xl">
        <div className="text-xl font-extrabold mb-1 text-center">
          TAWA Cashflow
        </div>
        <div className="text-xs opacity-70 text-center mb-4">
          Đăng nhập để dùng Sổ Quỹ
        </div>

        <div className="flex mb-3 rounded-xl overflow-hidden border border-border-dark">
          <button
            className={`w-1/2 py-2 text-sm font-bold ${
              mode === "login" ? "bg-primary/20 text-primary" : "bg-transparent"
            }`}
            onClick={() => setMode("login")}
          >
            Đăng nhập
          </button>
          <button
            className={`w-1/2 py-2 text-sm font-bold ${
              mode === "signup" ? "bg-primary/20 text-primary" : "bg-transparent"
            }`}
            onClick={() => setMode("signup")}
          >
            Đăng ký
          </button>
        </div>

        <input
          className="w-full rounded-xl border border-border-dark bg-background-dark py-2 px-3 mb-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full rounded-xl border border-border-dark bg-background-dark py-2 px-3 mb-2"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && <div className="text-danger text-sm mb-2">{err}</div>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-xl py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-extrabold disabled:opacity-60"
        >
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </div>
    </div>
  );
};
