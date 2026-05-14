import {
  Activity,
  Building2,
  Cpu,
  Database,
  EyeOff,
  FileText,
  Gauge,
  KeyRound,
  Landmark,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  ApiResult,
  AuditLog,
  AuditLogFilters,
  buildBackendFileUrl,
  createGovernmentAccessRequest,
  downloadGovernmentOriginal,
  getApiBaseUrl,
  getApiBaseCandidates,
  getAuditLogs,
  getCryptoKeyInfo,
  getGovernmentAccessRequest,
  getHealth,
  getModelInfo,
  getRedactionConfig,
  getRequiredBackendEndpoints,
  getRuntimePolicy,
  getStorageRecords,
  getVaultRecord,
  HealthResponse,
  redactImage,
  RedactionConfigResponse,
  resetRuntimePolicy,
  rotateVaultKey,
  safeRequest,
  updateRuntimePolicy,
  approveGovernmentAccessRequest,
} from "./lib/api";

type ViewId = "overview" | "user-zone" | "operational-zone" | "vault" | "government" | "dynamic" | "audit" | "contract";

type DashboardState = {
  health: ApiResult<HealthResponse>;
  modelInfo: ApiResult<Record<string, unknown>>;
  redactionConfig: ApiResult<RedactionConfigResponse>;
  cryptoKeyInfo: ApiResult<Record<string, unknown>>;
  storageRecords: ApiResult<{ records: Array<Record<string, unknown>> } & Record<string, unknown>>;
  auditLogs: ApiResult<{ logs: AuditLog[]; count: number }>;
};

const emptyResult = <T,>(): ApiResult<T> => ({ ok: false, error: { status: 0, message: "Not loaded" } });

const navItems: Array<{ id: ViewId; label: string; icon: ReactNode; description: string }> = [
  { id: "overview", label: "Overview", icon: <Gauge />, description: "System readiness" },
  { id: "user-zone", label: "User Zone", icon: <FileText />, description: "Upload and redact" },
  { id: "operational-zone", label: "Operational Zone", icon: <Database />, description: "Redacted metadata" },
  { id: "vault", label: "Sovereign Vault", icon: <LockKeyhole />, description: "Encrypted original" },
  { id: "government", label: "Government Access", icon: <Landmark />, description: "Original gateway" },
  { id: "dynamic", label: "Dynamic Injection", icon: <SlidersHorizontal />, description: "Runtime policy" },
  { id: "audit", label: "Audit Log", icon: <Activity />, description: "Security trace" },
  { id: "contract", label: "Backend Contract", icon: <ShieldCheck />, description: "Required APIs" },
];

const initialDashboard: DashboardState = {
  health: emptyResult(),
  modelInfo: emptyResult(),
  redactionConfig: emptyResult(),
  cryptoKeyInfo: emptyResult(),
  storageRecords: emptyResult(),
  auditLogs: emptyResult(),
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [dashboard, setDashboard] = useState<DashboardState>(initialDashboard);
  const [isLoading, setIsLoading] = useState(false);

  const refreshDashboard = useCallback(async () => {
    setIsLoading(true);
    const [health, modelInfo, redactionConfig, cryptoKeyInfo, storageRecords, auditLogs] = await Promise.all([
      safeRequest(getHealth),
      safeRequest(getModelInfo),
      safeRequest(getRedactionConfig),
      safeRequest(getCryptoKeyInfo),
      safeRequest(() => getStorageRecords(20)),
      safeRequest(() => getAuditLogs({ limit: 30 })),
    ]);
    setDashboard({ health, modelInfo, redactionConfig, cryptoKeyInfo, storageRecords, auditLogs });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const records = dashboard.storageRecords.data?.records ?? [];
  const latestRecordId = String(records[0]?.record_id ?? "");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-icon"><Building2 /></div>
          <span>PrivAI</span>
          <strong>Government Privacy Console</strong>
          <small>Frontend contract for backend implementation</small>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={activeView === item.id ? "nav-item active" : "nav-item"} onClick={() => setActiveView(item.id)}>
              <span>{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">API Base</p>
            <h1>{getApiBaseUrl()}</h1>
            <small className="api-hint">Fallback candidates: {getApiBaseCandidates().join(" | ")}</small>
          </div>
          <button className="primary-button" onClick={refreshDashboard} disabled={isLoading}>
            <RefreshCw className={isLoading ? "spin" : ""} size={17} />
            {isLoading ? "Refreshing" : "Refresh All"}
          </button>
        </header>

        {activeView === "overview" && <Overview dashboard={dashboard} records={records} />}
        {activeView === "user-zone" && <UserZone redactionConfig={dashboard.redactionConfig.data ?? null} onRefresh={refreshDashboard} />}
        {activeView === "operational-zone" && <OperationalZone recordsResult={dashboard.storageRecords} />}
        {activeView === "vault" && <VaultView records={records} keyInfo={dashboard.cryptoKeyInfo} />}
        {activeView === "government" && <GovernmentAccess latestRecordId={latestRecordId} />}
        {activeView === "dynamic" && <DynamicInjection redactionConfig={dashboard.redactionConfig.data ?? null} onRefresh={refreshDashboard} />}
        {activeView === "audit" && <AuditLogView initialLogs={dashboard.auditLogs} />}
        {activeView === "contract" && <ContractView dashboard={dashboard} />}
      </main>
    </div>
  );
}

function Overview({ dashboard, records }: { dashboard: DashboardState; records: Array<Record<string, unknown>> }) {
  const health = dashboard.health.data;
  const readyCount = [
    dashboard.health.ok,
    dashboard.redactionConfig.ok,
    dashboard.auditLogs.ok,
    dashboard.modelInfo.ok,
    dashboard.cryptoKeyInfo.ok,
    dashboard.storageRecords.ok,
  ].filter(Boolean).length;

  return (
    <div className="view-stack">
      <section className="hero-panel">
        <div>
          <div className="brand-mark"><ShieldCheck /></div>
          <p className="eyebrow">Smart Governance / Public Service</p>
          <h2>Visual privacy firewall untuk dokumen identitas pemerintah.</h2>
          <p className="lead">Frontend ini memetakan seluruh flow yang backend perlu dukung: User Zone, Operational Zone, Sovereign Vault, Government Access, Dynamic Injection, dan Audit Log.</p>
        </div>
        <div className="readiness-card"><span>API Ready</span><strong>{readyCount}/6</strong><small>{health?.app ?? "PrivAI"}</small></div>
      </section>

      <section className="status-grid">
        <StatusCard icon={<Activity />} label="Backend" result={dashboard.health} value={health?.status} />
        <StatusCard icon={<Cpu />} label="Model Info" result={dashboard.modelInfo} value={dashboard.modelInfo.ok ? "ready" : "missing"} />
        <StatusCard icon={<EyeOff />} label="Redaction Config" result={dashboard.redactionConfig} value={dashboard.redactionConfig.ok ? "ready" : "missing"} />
        <StatusCard icon={<KeyRound />} label="Crypto Key" result={dashboard.cryptoKeyInfo} value={dashboard.cryptoKeyInfo.ok ? "ready" : "pending"} />
        <StatusCard icon={<Database />} label="Storage Records" result={dashboard.storageRecords} value={`${records.length} records`} />
        <StatusCard icon={<Activity />} label="Audit Logs" result={dashboard.auditLogs} value={`${dashboard.auditLogs.data?.count ?? 0} events`} />
      </section>

      <section className="two-column">
        <Panel title="Current /api/health" eyebrow="Backend State" icon={<Gauge />}>
          <JsonBlock data={dashboard.health.data ?? dashboard.health.error} />
        </Panel>
        <Panel title="Implementation map" eyebrow="What backend must satisfy" icon={<ShieldCheck />}>
          <ul className="milestone-list">
            <li>Upload image must produce redacted preview, operational metadata, encrypted vault bundle, and audit events.</li>
            <li>Government Access must create request, approve it, issue one-time token, and allow one secure original download.</li>
            <li>Dynamic Injection must update runtime policy and affect /api/redact when enabled.</li>
          </ul>
        </Panel>
      </section>
    </div>
  );
}

function UserZone({ redactionConfig, onRefresh }: { redactionConfig: RedactionConfigResponse | null; onRefresh: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.35);
  const [profile, setProfile] = useState("government");
  const [redactionMode, setRedactionMode] = useState("default");
  const [activeClasses, setActiveClasses] = useState("KTP,SIM,Paspor,NIK_Teks,Wajah,Plat_Nomor");
  const [disabledClasses, setDisabledClasses] = useState("");
  const [useRuntimePolicy, setUseRuntimePolicy] = useState(false);
  const [documentTta, setDocumentTta] = useState(true);
  const [result, setResult] = useState<ApiResult<Record<string, unknown>>>(emptyResult());
  const [isSubmitting, setIsSubmitting] = useState(false);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPreview(nextFile ? URL.createObjectURL(nextFile) : "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setIsSubmitting(true);
    const nextResult = await safeRequest(() => redactImage({ file, confidenceThreshold, profile, redactionMode, activeClasses, disabledClasses, useRuntimePolicy, documentTta, ttaAngles: "0,180" }));
    setResult(nextResult);
    setIsSubmitting(false);
    if (nextResult.ok) await onRefresh();
  }

  const redactedUrl = buildBackendFileUrl(readNestedString(result.data, ["operational_zone", "redacted_file", "url"]));

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="User Zone" title="Document redaction upload" subtitle="Target backend: POST /api/redact. Jika endpoint belum ada, panel akan menampilkan status 404/503 sebagai contract feedback." icon={<FileText />} />
      <section className="two-column wide-left">
        <Panel title="Upload and policy" eyebrow="Request Builder" icon={<FileText />}>
          <form className="form-stack" onSubmit={submit}>
            <label className="file-drop"><input type="file" accept="image/*" onChange={onFileChange} /><span>{file ? file.name : "Choose KTP/SIM/Paspor image"}</span></label>
            <div className="form-grid">
              <Field label="Confidence"><input type="number" min="0.01" max="0.99" step="0.01" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(Number(e.target.value))} /></Field>
              <Field label="Profile"><select value={profile} onChange={(e) => setProfile(e.target.value)}>{Object.keys(redactionConfig?.profiles ?? { government: null, live_webcam: null }).map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Mode"><select value={redactionMode} onChange={(e) => setRedactionMode(e.target.value)}><option value="default">default</option>{(redactionConfig?.allowed_modes ?? ["black_box", "blur", "pixelate"]).map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Document TTA"><select value={String(documentTta)} onChange={(e) => setDocumentTta(e.target.value === "true")}><option value="true">true</option><option value="false">false</option></select></Field>
            </div>
            <Field label="Active classes"><input value={activeClasses} onChange={(e) => setActiveClasses(e.target.value)} /></Field>
            <Field label="Disabled classes"><input value={disabledClasses} onChange={(e) => setDisabledClasses(e.target.value)} placeholder="optional csv" /></Field>
            <label className="checkbox-line"><input type="checkbox" checked={useRuntimePolicy} onChange={(e) => setUseRuntimePolicy(e.target.checked)} /> Use runtime policy</label>
            <button className="primary-button" disabled={!file || isSubmitting}>{isSubmitting ? "Processing" : "Run Redaction"}</button>
          </form>
        </Panel>
        <Panel title="Preview and response" eyebrow="Result" icon={<EyeOff />}>
          <div className="preview-grid">
            <div>{preview ? <img src={preview} alt="Original preview" /> : <p className="empty-state">Original preview</p>}</div>
            <div>{redactedUrl ? <img src={redactedUrl} alt="Redacted preview" /> : <p className="empty-state">Redacted output appears after backend returns operational_zone.redacted_file.url.</p>}</div>
          </div>
          <ResultBox result={result} />
        </Panel>
      </section>
    </div>
  );
}

function OperationalZone({ recordsResult }: { recordsResult: ApiResult<{ records: Array<Record<string, unknown>> } & Record<string, unknown>> }) {
  const records = recordsResult.data?.records ?? [];
  return (
    <div className="view-stack">
      <SectionTitle eyebrow="Operational Zone" title="Redacted output registry" subtitle="Target backend: GET /api/storage/records dan GET /api/files/redacted/{filename}. Operational Zone tidak boleh menyimpan plaintext original." icon={<Database />} />
      <Panel title="Records" eyebrow="Non-private metadata" icon={<Database />}>
        <ResultBox result={recordsResult} />
        <RecordList records={records} />
      </Panel>
    </div>
  );
}

function VaultView({ records, keyInfo }: { records: Array<Record<string, unknown>>; keyInfo: ApiResult<Record<string, unknown>> }) {
  const [recordId, setRecordId] = useState(String(records[0]?.record_id ?? ""));
  const [cryptoAdminToken, setCryptoAdminToken] = useState("privai-crypto-admin-demo-token");
  const [vaultResult, setVaultResult] = useState<ApiResult<Record<string, unknown>>>(emptyResult());
  const [rotateResult, setRotateResult] = useState<ApiResult<Record<string, unknown>>>(emptyResult());

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="Sovereign Vault" title="Encrypted original metadata and key rotation" subtitle="Target backend: crypto key info, vault record metadata, and key rotation. Private key must never be returned." icon={<LockKeyhole />} />
      <section className="two-column">
        <Panel title="Crypto key info" eyebrow="GET /api/crypto/key-info" icon={<KeyRound />}><ResultBox result={keyInfo} /></Panel>
        <Panel title="Vault record lookup" eyebrow="GET /api/vault/records/{record_id}" icon={<LockKeyhole />}>
          <div className="inline-form"><input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="record_id" /><button onClick={async () => setVaultResult(await safeRequest(() => getVaultRecord(recordId)))}>Lookup</button></div>
          <ResultBox result={vaultResult} />
        </Panel>
        <Panel title="Rotate vault key" eyebrow="POST /api/crypto/rotate-vault-key" icon={<KeyRound />}>
          <div className="inline-form"><input value={cryptoAdminToken} onChange={(e) => setCryptoAdminToken(e.target.value)} /><button onClick={async () => setRotateResult(await safeRequest(() => rotateVaultKey(cryptoAdminToken)))}>Rotate</button></div>
          <ResultBox result={rotateResult} />
        </Panel>
      </section>
    </div>
  );
}

function GovernmentAccess({ latestRecordId }: { latestRecordId: string }) {
  const [recordId, setRecordId] = useState(latestRecordId);
  const [requestId, setRequestId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [governmentToken, setGovernmentToken] = useState("privai-government-demo-token");
  const [approverToken, setApproverToken] = useState("privai-approver-demo-token");
  const [result, setResult] = useState<ApiResult<Record<string, unknown>>>(emptyResult());

  useEffect(() => {
    if (latestRecordId && !recordId) setRecordId(latestRecordId);
  }, [latestRecordId, recordId]);

  async function createRequest() {
    const response = await safeRequest(() => createGovernmentAccessRequest({ recordId, requester: "Dukcapil Officer", requesterRole: "verifier", reason: "Demo controlled original access", governmentToken }));
    setResult(response);
    const nextRequestId = String(response.data?.request_id ?? "");
    if (nextRequestId) setRequestId(nextRequestId);
  }

  async function approveRequest() {
    const response = await safeRequest(() => approveGovernmentAccessRequest({ requestId, approvedBy: "Demo Approver", approverToken }));
    setResult(response);
    const nextToken = String(response.data?.one_time_access_token ?? "");
    if (nextToken) setAccessToken(nextToken);
  }

  async function downloadOriginal() {
    const response = await safeRequest(() => downloadGovernmentOriginal({ requestId, accessToken, governmentToken }));
    if (response.ok && response.data) {
      const url = URL.createObjectURL(response.data.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.data.filename;
      link.click();
      URL.revokeObjectURL(url);
      setResult({ ok: true, data: { status: "downloaded", filename: response.data.filename } });
    } else {
      setResult(response as ApiResult<Record<string, unknown>>);
    }
  }

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="Government Access API" title="Controlled original access workflow" subtitle="Target backend: create request, approve request, one-time token, secure original download, and token reuse failure." icon={<Landmark />} />
      <Panel title="Access workflow" eyebrow="Step-by-step gateway" icon={<Landmark />}>
        <div className="form-grid">
          <Field label="Record ID"><input value={recordId} onChange={(e) => setRecordId(e.target.value)} /></Field>
          <Field label="Request ID"><input value={requestId} onChange={(e) => setRequestId(e.target.value)} /></Field>
          <Field label="One-time token"><input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} /></Field>
          <Field label="Government token"><input value={governmentToken} onChange={(e) => setGovernmentToken(e.target.value)} /></Field>
          <Field label="Approver token"><input value={approverToken} onChange={(e) => setApproverToken(e.target.value)} /></Field>
        </div>
        <div className="button-row"><button onClick={createRequest}>1. Create Request</button><button onClick={approveRequest}>2. Approve</button><button onClick={async () => setResult(await safeRequest(() => getGovernmentAccessRequest({ requestId, governmentToken })))}>3. Check Status</button><button onClick={downloadOriginal}>4. Download Original</button></div>
        <ResultBox result={result} />
      </Panel>
    </div>
  );
}

function DynamicInjection({ redactionConfig, onRefresh }: { redactionConfig: RedactionConfigResponse | null; onRefresh: () => Promise<void> }) {
  const [policy, setPolicy] = useState<Record<string, unknown>>({ policy_name: "Default Government Policy", confidence_threshold: 0.35, profile: "government", redaction_mode: "black_box", active_classes: ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"], disabled_classes: [], label_text: "REDACTED", injection_note: "Frontend contract draft" });
  const [result, setResult] = useState<ApiResult<Record<string, unknown>>>(emptyResult());

  function updateField(key: string, value: unknown) {
    setPolicy((current) => ({ ...current, [key]: value }));
  }

  async function loadPolicy() {
    const response = await safeRequest(getRuntimePolicy);
    setResult(response);
    if (response.ok && response.data?.policy && typeof response.data.policy === "object") {
      setPolicy(response.data.policy);
    }
  }

  async function resetPolicy() {
    const response = await safeRequest(resetRuntimePolicy);
    setResult(response);
    if (response.ok && response.data?.policy && typeof response.data.policy === "object") {
      setPolicy(response.data.policy);
    }
    await onRefresh();
  }

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="Dynamic Injection" title="Runtime policy editor" subtitle="Target backend: validated runtime config only. No eval, no arbitrary code execution." icon={<SlidersHorizontal />} />
      <section className="two-column wide-left">
        <Panel title="Policy editor" eyebrow="PUT /api/runtime-policy" icon={<SlidersHorizontal />}>
          <div className="form-grid">
            <Field label="Policy name"><input value={String(policy.policy_name ?? "")} onChange={(e) => updateField("policy_name", e.target.value)} /></Field>
            <Field label="Confidence"><input type="number" min="0.01" max="0.99" step="0.01" value={Number(policy.confidence_threshold ?? 0.35)} onChange={(e) => updateField("confidence_threshold", Number(e.target.value))} /></Field>
            <Field label="Profile"><select value={String(policy.profile ?? "government")} onChange={(e) => updateField("profile", e.target.value)}>{Object.keys(redactionConfig?.profiles ?? { government: null, live_webcam: null }).map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Mode"><select value={String(policy.redaction_mode ?? "black_box")} onChange={(e) => updateField("redaction_mode", e.target.value)}>{(redactionConfig?.allowed_modes ?? ["black_box", "blur", "pixelate"]).map((item) => <option key={item}>{item}</option>)}</select></Field>
          </div>
          <Field label="Active classes CSV"><input value={(policy.active_classes as string[] | undefined)?.join(",") ?? ""} onChange={(e) => updateField("active_classes", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></Field>
          <Field label="Disabled classes CSV"><input value={(policy.disabled_classes as string[] | undefined)?.join(",") ?? ""} onChange={(e) => updateField("disabled_classes", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></Field>
          <Field label="Injection note"><input value={String(policy.injection_note ?? "")} onChange={(e) => updateField("injection_note", e.target.value)} /></Field>
          <div className="button-row"><button onClick={loadPolicy}>Load</button><button onClick={async () => { const response = await safeRequest(() => updateRuntimePolicy(policy)); setResult(response); if (response.ok && response.data?.policy && typeof response.data.policy === "object") setPolicy(response.data.policy); await onRefresh(); }}>Save</button><button onClick={resetPolicy}>Reset</button></div>
        </Panel>
        <Panel title="Runtime response" eyebrow="Dynamic Injection Result" icon={<ShieldCheck />}><ResultBox result={result} /><JsonBlock data={policy} /></Panel>
      </section>
    </div>
  );
}

function AuditLogView({ initialLogs }: { initialLogs: ApiResult<{ logs: AuditLog[]; count: number }> }) {
  const [filters, setFilters] = useState<Required<Pick<AuditLogFilters, "limit" | "recordId" | "zone" | "eventType">>>({ limit: 50, recordId: "", zone: "", eventType: "" });
  const [result, setResult] = useState(initialLogs);

  useEffect(() => {
    setResult(initialLogs);
  }, [initialLogs]);

  return (
    <div className="view-stack">
      <SectionTitle eyebrow="Audit Log" title="Security event trace" subtitle="Target backend: GET /api/audit-logs with limit, record_id, zone, event_type." icon={<Activity />} />
      <Panel title="Filters" eyebrow="Audit query" icon={<Activity />}>
        <div className="form-grid"><Field label="Limit"><input type="number" value={filters.limit} onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value) })} /></Field><Field label="Record ID"><input value={filters.recordId} onChange={(e) => setFilters({ ...filters, recordId: e.target.value })} /></Field><Field label="Zone"><input value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} /></Field><Field label="Event Type"><input value={filters.eventType} onChange={(e) => setFilters({ ...filters, eventType: e.target.value })} /></Field></div>
        <button onClick={async () => setResult(await safeRequest(() => getAuditLogs(filters)))}>Apply Filters</button>
      </Panel>
      <Panel title="Events" eyebrow={`${result.data?.count ?? 0} loaded`} icon={<Activity />}><AuditTable logs={result.data?.logs ?? []} /><ResultBox result={result} /></Panel>
    </div>
  );
}

function ContractView({ dashboard }: { dashboard: DashboardState }) {
  const endpointStatus = (path: string) => {
    if (path === "/api/health") return dashboard.health.ok;
    if (path === "/api/model-info") return dashboard.modelInfo.ok;
    if (path === "/api/redaction-config") return dashboard.redactionConfig.ok;
    if (path === "/api/crypto/key-info") return dashboard.cryptoKeyInfo.ok;
    if (path === "/api/storage/records") return dashboard.storageRecords.ok;
    if (path === "/api/audit-logs") return dashboard.auditLogs.ok;
    return false;
  };
  return <div className="view-stack"><SectionTitle eyebrow="Backend Contract" title="Endpoint checklist for backend implementation" subtitle="Frontend ini sengaja menampilkan endpoint yang belum tersedia agar backend dapat mengerjakan sesuai prioritas." icon={<ShieldCheck />} /><Panel title="Required endpoints" eyebrow="Frontend contract" icon={<ShieldCheck />}><div className="endpoint-list">{getRequiredBackendEndpoints().map((endpoint) => <div key={`${endpoint.method}:${endpoint.path}`} className="endpoint-row"><span className="method">{endpoint.method}</span><code>{endpoint.path}</code><strong className={endpointStatus(endpoint.path) ? "good" : "muted"}>{endpointStatus(endpoint.path) ? "available" : "needed"}</strong><small>{endpoint.feature}</small></div>)}</div></Panel></div>;
}

function SectionTitle({ eyebrow, title, subtitle, icon }: { eyebrow: string; title: string; subtitle: string; icon: ReactNode }) {
  return <section className="section-title"><div className="section-icon">{icon}</div><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{subtitle}</p></div></section>;
}

function Panel({ title, eyebrow, icon, children }: { title: string; eyebrow: string; icon: ReactNode; children: ReactNode }) {
  return <article className="panel"><div className="panel-heading"><span>{icon}</span><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div></div>{children}</article>;
}

function StatusCard({ icon, label, result, value }: { icon: ReactNode; label: string; result: ApiResult<unknown>; value?: string }) {
  return <article className="status-card"><div className="status-icon">{icon}</div><span>{label}</span><strong className={result.ok ? "good" : "muted"}>{value ?? (result.ok ? "ready" : statusText(result.error))}</strong></article>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function ResultBox<T>({ result }: { result: ApiResult<T> }) {
  if (!result.ok) return <div className="result-box error-box"><strong>{statusText(result.error)}</strong><JsonBlock data={result.error} /></div>;
  return <div className="result-box"><strong>Success</strong><JsonBlock data={result.data} /></div>;
}

function JsonBlock({ data }: { data: unknown }) {
  return <pre className="json-block">{JSON.stringify(data ?? null, null, 2)}</pre>;
}

function readNestedString(source: unknown, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}

function statusText(error?: ApiError) {
  if (!error) return "not loaded";
  if (error.status === 404) return "not implemented";
  if (error.status === 503) return "service unavailable";
  if (error.status === 0) return "offline";
  return `error ${error.status}`;
}

function RecordList({ records }: { records: Array<Record<string, unknown>> }) {
  if (!records.length) return <p className="empty-state">No records yet. Run User Zone redaction after backend /api/redact is ready.</p>;
  return <div className="record-list">{records.map((record, index) => <div key={String(record.record_id ?? index)}><strong>{String(record.record_id ?? "record")}</strong><small>{String(record.original_filename ?? "-")}</small><JsonBlock data={record} /></div>)}</div>;
}

function AuditTable({ logs }: { logs: AuditLog[] }) {
  if (!logs.length) return <p className="empty-state">No audit events yet.</p>;
  return <div className="table-wrap"><table><thead><tr><th>Event</th><th>Zone</th><th>Actor</th><th>Record</th><th>Created</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><strong>{log.event_type}</strong><small>{log.action}</small></td><td>{log.zone}</td><td>{log.actor}</td><td>{log.record_id ?? "-"}</td><td>{log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "-"}</td></tr>)}</tbody></table></div>;
}
