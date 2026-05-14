import { useState } from "react";

import { GovernmentShell } from "./layouts/GovernmentShell";
import { UserShell } from "./layouts/UserShell";
import { AppMode, GovernmentViewId, UserViewId } from "./lib/navigation";
import { useDashboard } from "./lib/useDashboard";

import { UserHomeView } from "./views/user/UserHomeView";
import { UserDocumentUploadView } from "./views/user/UserDocumentUploadView";
import { UserLiveFilterView } from "./views/user/UserLiveFilterView";
import { UserPrivacyView } from "./views/user/UserPrivacyView";
import { UserHowItWorksView } from "./views/user/UserHowItWorksView";

import { GovernmentOverviewView } from "./views/government/GovernmentOverviewView";
import { OperationalZoneView } from "./views/government/OperationalZoneView";
import { SovereignVaultView } from "./views/government/SovereignVaultView";
import { GovernmentAccessView } from "./views/government/GovernmentAccessView";
import { DynamicInjectionView } from "./views/government/DynamicInjectionView";
import { AuditLogView } from "./views/government/AuditLogView";
import { MetricsView } from "./views/government/MetricsView";

import "./multi-select.css";

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>("user");
  const [activeUserView, setActiveUserView] = useState<UserViewId>("home");
  const [activeGovernmentView, setActiveGovernmentView] = useState<GovernmentViewId>("overview");

  const { dashboard, isLoading, refreshDashboard } = useDashboard();

  const records = dashboard.storageRecords.data?.records ?? [];
  const latestRecordId = String(records[0]?.record_id ?? "");

  if (appMode === "user") {
    // The live filter view stays mounted (display-toggled) so an active
    // backend camera session is not torn down while navigating within user mode.
    const renderActiveUserView = () => {
      switch (activeUserView) {
        case "home":
          return <UserHomeView onNavigate={setActiveUserView} />;
        case "document-upload":
          return (
            <UserDocumentUploadView
              redactionConfig={dashboard.redactionConfig.data ?? null}
              onRefresh={refreshDashboard}
            />
          );
        case "privacy":
          return <UserPrivacyView />;
        case "how-it-works":
          return <UserHowItWorksView onNavigate={setActiveUserView} />;
        case "live-filter":
          return null;
        default:
          return <UserHomeView onNavigate={setActiveUserView} />;
      }
    };

    return (
      <UserShell
        appMode={appMode}
        onModeChange={setAppMode}
        activeView={activeUserView}
        onNavigate={setActiveUserView}
      >
        {activeUserView !== "live-filter" && renderActiveUserView()}
        <div style={{ display: activeUserView === "live-filter" ? "" : "none" }}>
          <UserLiveFilterView isActive={activeUserView === "live-filter"} />
        </div>
      </UserShell>
    );
  }

  const renderGovernmentView = () => {
    switch (activeGovernmentView) {
      case "overview":
        return (
          <GovernmentOverviewView dashboard={dashboard} records={records} onNavigate={setActiveGovernmentView} />
        );
      case "operational-zone":
        return <OperationalZoneView recordsResult={dashboard.storageRecords} />;
      case "sovereign-vault":
        return <SovereignVaultView records={records} keyInfo={dashboard.cryptoKeyInfo} />;
      case "government-access":
        return <GovernmentAccessView latestRecordId={latestRecordId} />;
      case "dynamic-injection":
        return (
          <DynamicInjectionView
            redactionConfig={dashboard.redactionConfig.data ?? null}
            onRefresh={refreshDashboard}
          />
        );
      case "audit-log":
        return <AuditLogView initialLogs={dashboard.auditLogs} />;
      case "metrics":
        return <MetricsView dashboard={dashboard} />;
      default:
        return (
          <GovernmentOverviewView dashboard={dashboard} records={records} onNavigate={setActiveGovernmentView} />
        );
    }
  };

  return (
    <GovernmentShell
      appMode={appMode}
      onModeChange={setAppMode}
      activeView={activeGovernmentView}
      onNavigate={setActiveGovernmentView}
      online={dashboard.health.ok}
      isLoading={isLoading}
      onRefresh={refreshDashboard}
    >
      {renderGovernmentView()}
    </GovernmentShell>
  );
}
