// src/App.tsx
import React, { useState } from "react";

import DashboardScreen from "./screens/DashboardScreen";
import LedgerScreen from "./screens/LedgerScreen";
import OrdersScreen from "./screens/OrdersScreen";
import ReconciliationScreen from "./screens/ReconciliationScreen";
import ReportsScreen from "./screens/ReportsScreen";
import SettingsScreen from "./screens/SettingsScreen";

type TabKey = "dashboard" | "ledger" | "orders" | "reconciliation" | "reports" | "settings";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("ledger");

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen onNavigate={setActiveTab} />;
      case "ledger":
        return <LedgerScreen onNavigate={setActiveTab} />;
      case "orders":
        return <OrdersScreen onNavigate={setActiveTab} />;
      case "reconciliation":
        return <ReconciliationScreen onNavigate={setActiveTab} />;
      case "reports":
        return <ReportsScreen onNavigate={setActiveTab} />;
      case "settings":
        return <SettingsScreen onNavigate={setActiveTab} />;
      default:
        return <LedgerScreen onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      {/* Main screen */}
      <div className="pb-16">{renderScreen()}</div>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark">
        <div className="grid grid-cols-5 text-xs font-semibold">
          <TabButton label="Sổ quỹ" icon="wallet" active={activeTab === "ledger"} onClick={() => setActiveTab("ledger")} />
          <TabButton label="Dashboard" icon="dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />
          <TabButton label="Đơn" icon="receipt_long" active={activeTab === "orders"} onClick={() => setActiveTab("orders")} />
          <TabButton label="Báo cáo" icon="bar_chart" active={activeTab === "reports"} onClick={() => setActiveTab("reports")} />
          <TabButton label="Setting" icon="settings" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        </div>
      </nav>
    </div>
  );
};

const TabButton: React.FC<{
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}> = ({ label, icon, active, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2 ${
        active ? "text-primary" : "text-neutral-text-light dark:text-neutral-text-dark"
      }`}
    >
      <span className="material-symbols-outlined text-xl">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

export default App;
