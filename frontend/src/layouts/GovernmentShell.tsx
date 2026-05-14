import { RefreshCw } from "lucide-react";
import { ReactNode } from "react";

import privaiLogo from "../assets/PrivAI_logo.png";
import { ModeSwitch } from "../components/ModeSwitch";
import { AppMode, GovernmentViewId, governmentNavItems } from "../lib/navigation";

// ╔═══ ASSET — ubah di sini ═══╗
// Logo brand di sidebar console. Ganti file di src/assets/ atau arahkan import lain.
const BRAND_LOGO = privaiLogo;
// ╚════════════════════════════╝

export function GovernmentShell({
  appMode,
  onModeChange,
  activeView,
  onNavigate,
  online,
  isLoading,
  onRefresh,
  children,
}: {
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  activeView: GovernmentViewId;
  onNavigate: (view: GovernmentViewId) => void;
  online: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  children: ReactNode;
}) {
  const activeTitle = governmentNavItems.find((item) => item.id === activeView)?.label ?? "Government Console";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <img src={BRAND_LOGO} alt="PrivAI Logo" style={{ height: 48, width: "auto", objectFit: "contain" }} />
          <small>Government Console</small>
        </div>
        <nav>
          {governmentNavItems.map((item) => (
            <button
              key={item.id}
              className={activeView === item.id ? "nav-item active" : "nav-item"}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="title-group">
            <h1>{activeTitle}</h1>
            <div className={`status-pill ${online ? "active" : "offline"}`}>
              <div className="dot" />
              {online ? "Sistem Aktif" : "Sistem Offline"}
            </div>
          </div>
          <div className="topbar-actions">
            <ModeSwitch appMode={appMode} onModeChange={onModeChange} />
            <button className="primary-button secondary-button" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={isLoading ? "spin" : ""} size={16} />
              Refresh
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
