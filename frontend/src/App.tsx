import { Activity, Database, FileClock, Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { AuditLog, getAuditLogs, getHealth, HealthResponse } from "./lib/api";

type LoadState = {
  health: HealthResponse | null;
  auditLogs: AuditLog[];
  error: string | null;
  loading: boolean;
};

const backendMilestones = [
  "Modular FastAPI scaffold aktif",
  "SQLite database foundation siap",
  "Audit service dan endpoint /api/audit-logs tersedia",
];

export default function App() {
  const [state, setState] = useState<LoadState>({
    health: null,
    auditLogs: [],
    error: null,
    loading: true,
  });

  const loadBackendState = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [health, audit] = await Promise.all([getHealth(), getAuditLogs({ limit: 20 })]);
      setState({ health, auditLogs: audit.logs, error: null, loading: false });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Backend tidak dapat diakses.",
      }));
    }
  }, []);

  useEffect(() => {
    void loadBackendState();
  }, [loadBackendState]);

  const readiness = useMemo(() => {
    if (!state.health) return 0;
    const checks = [
      state.health.status === "ok",
      state.health.database === "ready",
      state.health.operational_zone === "ready",
      state.health.sovereign_vault === "ready",
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [state.health]);

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="brand-mark"><ShieldCheck size={30} /></div>
          <p className="eyebrow">PrivAI Backend Console</p>
          <h1>Government privacy firewall status</h1>
          <p className="lead">
            UI ini mengikuti backend commit yang sudah dibuat: scaffold, SQLite foundation, dan audit log. Fitur redact, vault, dan government access akan muncul setelah endpoint backend-nya tersedia.
          </p>
          <div className="actions">
            <button onClick={loadBackendState} disabled={state.loading}>
              {state.loading ? "Memuat..." : "Refresh Backend"}
            </button>
            <span className="api-pill">API: {import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"}</span>
          </div>
        </div>
        <div className="readiness-card">
          <span>Readiness</span>
          <strong>{readiness}%</strong>
          <p>{state.health?.app ?? "PrivAI"}</p>
        </div>
      </section>

      {state.error && <div className="error-banner">{state.error}</div>}

      <section className="status-grid">
        <StatusCard icon={<Activity />} label="Backend API" value={state.health?.status ?? "checking"} />
        <StatusCard icon={<Database />} label="SQLite DB" value={state.health?.database ?? "checking"} />
        <StatusCard icon={<Landmark />} label="Operational Zone" value={state.health?.operational_zone ?? "checking"} />
        <StatusCard icon={<LockKeyhole />} label="Sovereign Vault" value={state.health?.sovereign_vault ?? "checking"} />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <FileClock />
            <div>
              <p className="eyebrow">Implemented Backend Commits</p>
              <h2>Fitur yang sudah bisa dilihat</h2>
            </div>
          </div>
          <ul className="milestone-list">
            {backendMilestones.map((milestone) => (
              <li key={milestone}>{milestone}</li>
            ))}
          </ul>
        </article>

        <article className="panel audit-panel">
          <div className="panel-heading">
            <Activity />
            <div>
              <p className="eyebrow">Audit Log</p>
              <h2>Security event stream</h2>
            </div>
          </div>
          <AuditTable logs={state.auditLogs} />
        </article>
      </section>
    </main>
  );
}

function StatusCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const normalized = String(value).toLowerCase();
  const good = normalized === "ok" || normalized === "ready";
  return (
    <article className="status-card">
      <div className="status-icon">{icon}</div>
      <span>{label}</span>
      <strong className={good ? "good" : "muted"}>{value}</strong>
    </article>
  );
}

function AuditTable({ logs }: { logs: AuditLog[] }) {
  if (!logs.length) {
    return <p className="empty-state">Belum ada audit event. Event akan muncul setelah backend menulis security action.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Zone</th>
            <th>Actor</th>
            <th>Record</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>
                <strong>{log.event_type}</strong>
                <small>{log.action}</small>
              </td>
              <td>{log.zone}</td>
              <td>{log.actor}</td>
              <td>{log.record_id ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

