import React, { useState } from "react";
import LedgerScreen from "./screens/LedgerScreen";
import SettingsScreen from "./screens/SettingsScreen";

type TabKey = "ledger" | "settings";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("ledger");

  return (
    <div className="min-h-screen bg-background-dark text-text-dark">
      <div className="pb-16">
        {activeTab === "ledger" && <LedgerScreen onNavigate={setActiveTab} />}
        {activeTab === "settings" && <SettingsScreen onNavigate={setActiveTab} />}
      </div>

      {/* Bottom bar chỉ 2 nút */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-dark bg-card-dark">
        <div className="grid grid-cols-2 text-xs font-semibold">
          <TabButton
            label="Sổ quỹ"
            icon="wallet"
            active={activeTab === "ledger"}
            onClick={() => setActiveTab("ledger")}
          />
          <TabButton
            label="Setting"
            icon="settings"
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
          />
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
}> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 py-2 ${
      active ? "text-primary" : "text-neutral-text-dark"
    }`}
  >
    <span className="material-symbols-outlined text-xl">{icon}</span>
    <span>{label}</span>
  </button>
);

export default App;
