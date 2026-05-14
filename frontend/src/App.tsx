import {
  Activity,
  Building2,
  ChevronDown,
  ChevronRight,
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
  Video,
  Copy
} from "lucide-react";
import { ChangeEvent, DragEvent, FormEvent, ReactNode, useCallback, useEffect, useState, useRef } from "react";
import privaiLogo from "./assets/PrivAI_logo.png";

import {
  ApiError,
  ApiResult,
  AuditLog,
  AuditLogFilters,
  buildBackendFileUrl,
  buildTurboMjpegUrl,
  createGovernmentAccessRequest,
  downloadGovernmentOriginal,
  getAuditLogs,
  getCryptoKeyInfo,
  getGovernmentAccessRequest,
  getHealth,
  getModelInfo,
  getRedactionConfig,
  getRuntimePolicy,
  getStorageRecords,
  getTurboLiveStatus,
  getVaultRecord,
  HealthResponse,
  redactImage,
  RedactionConfigResponse,
  resetRuntimePolicy,
  rotateVaultKey,
  safeRequest,
  startTurboLive,
  stopTurboLive,
  updateRuntimePolicy,
  approveGovernmentAccessRequest,
} from "./lib/api";

import "./multi-select.css";

type ViewId = "overview" | "user-zone" | "operational-zone" | "vault" | "government" | "dynamic" | "live" | "audit";

type DashboardState = {
  health: ApiResult<HealthResponse>;
  modelInfo: ApiResult<Record<string, unknown>>;
  redactionConfig: ApiResult<RedactionConfigResponse>;
  cryptoKeyInfo: ApiResult<Record<string, unknown>>;
  storageRecords: ApiResult<{ records: Array<Record<string, unknown>> } & Record<string, unknown>>;
  auditLogs: ApiResult<{ logs: AuditLog[]; count: number }>;
};

const emptyResult = <T,>(): ApiResult<T> => ({ ok: false, error: { status: 0, message: "Not loaded" } });

const PRIVACY_CLASSES = ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"];
const PERFORMANCE_MODES = [
  {
    value: "fast",
    label: "Fast Demo",
    description: "Recommended untuk live hackathon demo. 1x inference, tanpa OCR, tanpa heavy TTA.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Recommended untuk verifikasi normal. TTA 0 dan 180, OCR mati default.",
  },
  {
    value: "robust",
    label: "Robust Verification",
    description: "Untuk dokumen sulit. Lebih banyak rotasi, guardrail OCR-capable, lebih lambat.",
  },
];

function formatWibDate(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatMs(value: unknown): string {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0 ms";
  return `${number >= 100 ? number.toFixed(0) : number.toFixed(1)} ms`;
}

function normalizePrivacyClasses(value: unknown, fallback: string[] = PRIVACY_CLASSES): string[] {
  const rawItems = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : fallback;
  return PRIVACY_CLASSES.filter((className) => rawItems.includes(className));
}

function getDisabledPrivacyClasses(activeClasses: string[]): string[] {
  return PRIVACY_CLASSES.filter((className) => !activeClasses.includes(className));
}

// Default confidence per kelas, dikalibrasi dari kurva F1/PR per kelas model.
const DEFAULT_CLASS_CONFIDENCE: Record<string, number> = {
  KTP: 0.35,
  SIM: 0.35,
  Paspor: 0.35,
  NIK_Teks: 0.3,
  Wajah: 0.25,
  Plat_Nomor: 0.35,
};

function normalizeClassConfidence(value: unknown): Record<string, number> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const result: Record<string, number> = {};
  for (const className of PRIVACY_CLASSES) {
    const candidate = Number(raw[className]);
    result[className] = Number.isFinite(candidate) ? candidate : DEFAULT_CLASS_CONFIDENCE[className];
  }
  return result;
}

function withDerivedPolicyClasses(policy: Record<string, unknown>): Record<string, unknown> {
  const activeClasses = normalizePrivacyClasses(policy.active_classes);
  return {
    ...policy,
    active_classes: activeClasses,
    disabled_classes: getDisabledPrivacyClasses(activeClasses),
  };
}

const navItems: Array<{ id: ViewId; label: string; icon: ReactNode; description: string }> = [
  { id: "overview", label: "Beranda", icon: <Gauge size={20} />, description: "Overview sistem" },
  { id: "user-zone", label: "Redaksi Dokumen", icon: <FileText size={20} />, description: "Upload & proses" },
  { id: "operational-zone", label: "Operational Zone", icon: <Database size={20} />, description: "Data tersensor" },
  { id: "vault", label: "Sovereign Vault", icon: <LockKeyhole size={20} />, description: "Penyimpanan asli" },
  { id: "government", label: "Akses Pemerintah", icon: <Landmark size={20} />, description: "Otorisasi khusus" },
  { id: "dynamic", label: "Dynamic Policy", icon: <SlidersHorizontal size={20} />, description: "Aturan runtime" },
  { id: "live", label: "Live Camera", icon: <Video size={20} />, description: "Privasi kamera real-time" },
  { id: "audit", label: "Audit Log", icon: <Activity size={20} />, description: "Jejak aktivitas" },
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
  const activeTitle = navItems.find((n) => n.id === activeView)?.label ?? "PrivAI";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <img src={privaiLogo} alt="PrivAI Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          <small>Visual Privacy Firewall</small>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={activeView === item.id ? "nav-item active" : "nav-item"} onClick={() => setActiveView(item.id)}>
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
            <div className={`status-pill ${dashboard.health.ok ? "active" : "offline"}`}>
              <div className="dot" />
              {dashboard.health.ok ? "Sistem Aktif" : "Sistem Offline"}
            </div>
          </div>
          <button className="primary-button secondary-button" onClick={refreshDashboard} disabled={isLoading}>
            <RefreshCw className={isLoading ? "spin" : ""} size={16} />
            Refresh
          </button>
        </header>

        {activeView === "overview" && <Overview dashboard={dashboard} records={records} />}
        {activeView === "user-zone" && <UserZone redactionConfig={dashboard.redactionConfig.data ?? null} onRefresh={refreshDashboard} />}
        {activeView === "operational-zone" && <OperationalZone recordsResult={dashboard.storageRecords} />}
        {activeView === "vault" && <VaultView records={records} keyInfo={dashboard.cryptoKeyInfo} />}
        {activeView === "government" && <GovernmentAccess latestRecordId={latestRecordId} />}
        {activeView === "dynamic" && <DynamicInjection redactionConfig={dashboard.redactionConfig.data ?? null} onRefresh={refreshDashboard} />}
        <div style={{ display: activeView === "live" ? "" : "none" }}>
          <LiveStream isActive={activeView === "live"} />
        </div>
        {activeView === "audit" && <AuditLogView initialLogs={dashboard.auditLogs} />}
      </main>
    </div>
  );
}

function Overview({ dashboard, records }: { dashboard: DashboardState; records: Array<Record<string, unknown>> }) {
  const encryptedCount = records.filter(r => r.vault_encrypted === true).length;
  const modelActive = dashboard.modelInfo.ok;
  
  return (
    <div className="view-stack">
      <section className="hero-panel">
        <h2>PrivAI melindungi data identitas sebelum dokumen diproses.</h2>
        <p className="lead">Deteksi AI lokal, redaksi visual, penyimpanan terenkripsi, dan akses original berbasis otorisasi.</p>
        
        <div className="stepper">
          <div className="step active"><div className="step-dot">1</div> User Zone</div>
          <div className="step-line" />
          <div className="step active"><div className="step-dot">2</div> AI Detection</div>
          <div className="step-line" />
          <div className="step active"><div className="step-dot">3</div> Redaction</div>
          <div className="step-line" />
          <div className="step active"><div className="step-dot">4</div> Operational Zone</div>
          <div className="step-line" />
          <div className="step active"><div className="step-dot">5</div> Sovereign Vault</div>
          <div className="step-line" />
          <div className="step active"><div className="step-dot">6</div> Government Access</div>
        </div>
      </section>

      <section className="status-grid">
        <div className="metric-card">
          <span>Dokumen Diproses</span>
          <strong>{records.length}</strong>
        </div>
        <div className="metric-card">
          <span>Original Terenkripsi</span>
          <strong>{encryptedCount}</strong>
          {encryptedCount > 0 && <div className="badge green">AMAN</div>}
        </div>
        <div className="metric-card">
          <span>Audit Events</span>
          <strong>{dashboard.auditLogs.data?.count ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>Model AI</span>
          <strong>{modelActive ? "Aktif" : "Tidak tersedia"}</strong>
          <div className={`badge ${modelActive ? "green" : "danger"}`}>{modelActive ? "READY" : "OFFLINE"}</div>
        </div>
      </section>
    </div>
  );
}

function UserZone({ redactionConfig, onRefresh }: { redactionConfig: RedactionConfigResponse | null; onRefresh: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.35);
  const [profile, setProfile] = useState("government");
  const [redactionMode, setRedactionMode] = useState("default");
  
  const availableClasses = PRIVACY_CLASSES;
  const [activeClasses, setActiveClasses] = useState<string[]>(availableClasses);
  const disabledClasses = getDisabledPrivacyClasses(activeClasses);
  
  const [useRuntimePolicy, setUseRuntimePolicy] = useState(false);
  const [performanceMode, setPerformanceMode] = useState("fast");
  const [authenticityOcr, setAuthenticityOcr] = useState(false);
  const [result, setResult] = useState<ApiResult<Record<string, unknown>> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedPerformanceMode = PERFORMANCE_MODES.find((item) => item.value === performanceMode) ?? PERFORMANCE_MODES[0];

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (performanceMode !== "robust" && authenticityOcr) {
      setAuthenticityOcr(false);
    }
  }, [performanceMode, authenticityOcr]);

  function selectFile(nextFile: File | null) {
    setResult(null);
    setFileError("");

    if (!nextFile) {
      setFile(null);
      setPreview("");
      return;
    }

    const isSupportedImage = nextFile.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(nextFile.name);
    if (!isSupportedImage) {
      setFile(null);
      setPreview("");
      setFileError("File harus berupa gambar JPG, PNG, atau WEBP.");
      return;
    }

    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    selectFile(nextFile);
    event.target.value = "";
  }

  function onFileDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function onFileDragEnter(event: DragEvent<HTMLLabelElement>) {
    onFileDrag(event);
    setIsDraggingFile(true);
  }

  function onFileDragLeave(event: DragEvent<HTMLLabelElement>) {
    onFileDrag(event);
    setIsDraggingFile(false);
  }

  function onFileDrop(event: DragEvent<HTMLLabelElement>) {
    onFileDrag(event);
    setIsDraggingFile(false);
    const nextFile = event.dataTransfer.files?.[0] ?? null;
    selectFile(nextFile);
    event.dataTransfer.clearData();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setIsSubmitting(true);
    const nextResult = await safeRequest(() => redactImage({ 
      file, 
      confidenceThreshold, 
      profile, 
      redactionMode, 
      activeClasses: activeClasses.join(","), 
      disabledClasses: disabledClasses.join(","), 
      useRuntimePolicy, 
      performanceMode,
      authenticityOcr: performanceMode === "robust" && authenticityOcr,
    }));
    setResult(nextResult);
    setIsSubmitting(false);
    if (nextResult.ok) await onRefresh();
  }

  const redactedUrl = buildBackendFileUrl(readNestedString(result?.data, ["operational_zone", "redacted_file", "url"]));
  const detectionCount = result?.ok ? (result.data?.detections as any[])?.length ?? 0 : 0;
  const redactedCount = result?.ok ? Number(result.data?.redacted_count ?? 0) : 0;
  const performance = result?.ok ? ((result.data?.performance as Record<string, unknown> | undefined) ?? null) : null;
  const timing = result?.ok ? ((result.data?.timing as Record<string, unknown> | undefined) ?? null) : null;
  const latency = result?.ok ? Number(timing?.total_ms ?? result.data?.total_latency_ms ?? result.data?.latency_ms ?? 0) : 0;
  const detectorLatency = result?.ok ? Number(performance?.detector_latency_ms ?? result.data?.latency_ms ?? 0) : 0;
  const recordId = result?.ok ? String(result.data?.record_id ?? "") : "";
  const rejectedDetections = result?.ok ? ((result.data?.rejected_detections as any[]) ?? []) : [];
  const validationSummary = result?.ok ? ((result.data?.validation_summary as Record<string, unknown> | undefined) ?? null) : null;
  const rejectedCount = Number(validationSummary?.rejected_count ?? rejectedDetections.length);
  const timingItems = timing ? [
    ["Total", timing.total_ms],
    ["Inference", timing.inference_ms],
    ["Guardrail", timing.guardrail_ms],
    ["Redaction", timing.redaction_ms],
    ["Storage", timing.storage_ms],
    ["Vault", timing.vault_ms],
  ] : [];

  return (
    <div className="view-stack">
      <div className="two-column">
        <Panel title="Upload Dokumen" eyebrow="Redaksi Visual" icon={<FileText />}>
          <form className="form-stack" onSubmit={submit}>
            <label
              className={`file-drop${isDraggingFile ? " is-dragging" : ""}${file ? " has-file" : ""}`}
              onDragEnter={onFileDragEnter}
              onDragOver={onFileDrag}
              onDragLeave={onFileDragLeave}
              onDrop={onFileDrop}
            >
              <input type="file" accept="image/*" onChange={onFileChange} />
              <FileText size={32} color="var(--primary)" />
              <span>{file ? file.name : "Drag & drop atau pilih gambar"}</span>
              <small>{isDraggingFile ? "Lepaskan gambar di area ini" : "Mendukung format gambar standar (JPG, PNG, WEBP)"}</small>
            </label>
            {fileError && <div className="field-warning">{fileError}</div>}
            
            <div className="form-grid">
              <Field label={`Confidence (${confidenceThreshold})`}>
                <input type="range" min="0.01" max="0.99" step="0.01" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(Number(e.target.value))} />
              </Field>
              <Field label="Performance Mode">
                <select value={performanceMode} onChange={(e) => setPerformanceMode(e.target.value)}>
                  {PERFORMANCE_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <small className="field-hint">{selectedPerformanceMode.description}</small>
              </Field>
              <Field label="Profile">
                <select value={profile} onChange={(e) => setProfile(e.target.value)}>
                  {Object.keys(redactionConfig?.profiles ?? { government: null, live_webcam: null }).map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Redaction Mode">
                <select value={redactionMode} onChange={(e) => setRedactionMode(e.target.value)}>
                  <option value="default">default</option>
                  {(redactionConfig?.allowed_modes ?? ["black_box", "blur", "pixelate"]).map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Target Kelas Aktif">
              <ClassSelectionGrid
                options={availableClasses}
                selected={activeClasses}
                onChange={setActiveClasses}
                helper="Kelas yang aktif akan diredaksi. Kelas yang tidak dipilih otomatis dikirim sebagai disabled_classes."
              />
            </Field>

            <div className="inline-form">
              <label className="checkbox-line"><input type="checkbox" checked={useRuntimePolicy} onChange={(e) => setUseRuntimePolicy(e.target.checked)} /> Gunakan Dynamic Policy</label>
              <label className="checkbox-line"><input type="checkbox" checked={authenticityOcr} disabled={performanceMode !== "robust"} onChange={(e) => setAuthenticityOcr(e.target.checked)} /> OCR detail KTP</label>
            </div>
            
            <button className="primary-button" disabled={!file || isSubmitting}>
              {isSubmitting ? <><RefreshCw className="spin" size={16} /> Memproses...</> : "Jalankan Redaksi"}
            </button>
          </form>
        </Panel>

        <Panel title="Hasil Redaksi" eyebrow="Preview" icon={<EyeOff />}>
          <div className="preview-grid">
            <div className="preview-card">
              <span>Original</span>
              {preview ? <img src={preview} alt="Original" /> : <div className="empty-state">Belum ada gambar</div>}
            </div>
            <div className="preview-card">
              <span>Redacted</span>
              {redactedUrl ? <img src={redactedUrl} alt="Redacted" /> : <div className="empty-state">Hasil redaksi akan tampil di sini</div>}
            </div>
          </div>
          
          {result?.ok && (
            <div className="result-box success-box">
              <div className="meta-row">
                <div className="meta-item">
                  <span>Record ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>{recordId}</strong>
                    <button className="copy-button" type="button" onClick={() => navigator.clipboard.writeText(recordId)} title="Copy ID"><Copy size={14} /></button>
                  </div>
                </div>
                <div className="meta-item">
                  <span>Total Latency</span>
                  <strong>{formatMs(latency)}</strong>
                  <small>Detector: {formatMs(detectorLatency)}</small>
                </div>
                <div className="meta-item">
                  <span>Deteksi</span>
                  <strong>{detectionCount} objek</strong>
                </div>
                <div className="meta-item">
                  <span>Diredaksi</span>
                  <strong>{redactedCount} area</strong>
                </div>
                <div className="meta-item">
                  <span>Ditolak Guardrail</span>
                  <strong>{rejectedCount} objek</strong>
                </div>
              </div>
              {timingItems.length > 0 && (
                <div className="timing-grid">
                  {timingItems.map(([label, value]) => (
                    <div className="timing-card" key={String(label)}>
                      <span>{String(label)}</span>
                      <strong>{formatMs(value)}</strong>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {(result.data?.detections as any[])?.map((d: any, i: number) => (
                  <div key={i} className={`badge ${String(d.guardrail_action) === "skip_redaction" ? "danger" : "copper"}`}>
                    {d.class_name} {(d.confidence * 100).toFixed(0)}%
                    {d.validation_status ? ` - ${d.validation_status}` : ""}
                  </div>
                ))}
              </div>
              {rejectedCount > 0 && (
                <div className="alert-card warning" style={{ marginBottom: 0 }}>
                  <ShieldCheck size={24} color="var(--warning)" />
                  <div>
                    <strong>Guardrail menolak {rejectedCount} kandidat</strong>
                    <p>Deteksi yang dicurigai sebagai gambar tangan/sketsa atau tidak punya bukti dokumen resmi tidak ikut diredaksi pada mode precision demo.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {result && !result.ok && (
             <div className="alert-card warning">
               <ShieldCheck size={24} color="var(--danger)" />
               <div>
                 <strong>Gagal Memproses Dokumen</strong>
                 <p>{result.error?.message || "Terjadi kesalahan pada sistem."}</p>
               </div>
             </div>
          )}

          {result && (
            <Collapsible title="Detail Teknis (JSON)">
              <JsonBlock data={result.ok ? result.data : result.error} />
            </Collapsible>
          )}
        </Panel>
      </div>
    </div>
  );
}

function OperationalZone({ recordsResult }: { recordsResult: ApiResult<{ records: Array<Record<string, unknown>> } & Record<string, unknown>> }) {
  const records = recordsResult.data?.records ?? [];
  const [viewerUrl, setViewerUrl] = useState("");

  function getRedactedUrl(record: Record<string, unknown>) {
    return buildBackendFileUrl(
      String(record.redacted_url ?? record.redacted_file_url ?? "")
    );
  }

  return (
    <div className="view-stack">
      {viewerUrl && (
        <SecureViewer 
          url={viewerUrl} 
          title="Pratinjau Dokumen Tersensor" 
          onClose={() => setViewerUrl("")} 
          isSensitive={false} 
        />
      )}
      
      <Panel title="Daftar Dokumen Redacted" eyebrow="Operational Data" icon={<Database />}>
        <div className="alert-card success">
          <ShieldCheck size={24} color="var(--success)" />
          <div>
            <strong>Penyimpanan Aman</strong>
            <p>Original tidak disimpan di Operational Zone. Hanya file yang telah diredaksi visual dan metadata non-sensitif yang tersedia di sini.</p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="empty-state">Belum ada dokumen yang diproses.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Original Filename</th>
                  <th>Profile / Mode</th>
                  <th>Stats</th>
                  <th>Dibuat Pada</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const redactedUrl = getRedactedUrl(record);
                  return (
                    <tr key={String(record.record_id)}>
                      <td><strong>{String(record.record_id).substring(0,8)}...</strong></td>
                      <td>
                        {String(record.original_filename ?? "-")}
                        {Boolean(record.redacted_filename) && <small>Redacted: {String(record.redacted_filename)}</small>}
                      </td>
                      <td>
                        <div className="badge muted">{String(record.redaction_profile ?? "-")}</div>
                        <div className="badge muted" style={{marginLeft: '4px'}}>{String(record.redaction_mode ?? "-")}</div>
                      </td>
                      <td>
                        <small>{Number(record.detection_count ?? 0)} deteksi</small>
                        <small>{Number(record.redacted_count ?? 0)} diredaksi</small>
                      </td>
                      <td><small>{formatWibDate(record.created_at)} WIB</small></td>
                      <td>
                        {redactedUrl ? (
                          <div className="table-actions">
                            <button type="button" className="primary-button secondary-button compact-button" onClick={() => setViewerUrl(redactedUrl)}>
                              Preview
                            </button>
                          </div>
                        ) : (
                          <span className="badge muted">Tidak tersedia</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function VaultView({ records, keyInfo }: { records: Array<Record<string, unknown>>; keyInfo: ApiResult<Record<string, unknown>> }) {
  const [recordId, setRecordId] = useState(String(records[0]?.record_id ?? ""));
  const [cryptoAdminToken, setCryptoAdminToken] = useState("privai-crypto-admin-demo-token");
  const [vaultResult, setVaultResult] = useState<ApiResult<Record<string, unknown>> | null>(null);
  const [rotateResult, setRotateResult] = useState<ApiResult<Record<string, unknown>> | null>(null);
  const [search, setSearch] = useState("");

  const kInfo = keyInfo.data as any;

  const filteredRecords = records.filter(r => {
    const rId = String(r.record_id ?? "").toLowerCase();
    const fName = String(r.original_filename ?? "").toLowerCase();
    const s = search.toLowerCase();
    return rId.includes(s) || fName.includes(s);
  });

  async function handleRowClick(id: string) {
    setRecordId(id);
    const result = await safeRequest(() => getVaultRecord(id));
    setVaultResult(result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="view-stack">
      <div className="two-column">
        <Panel title="Status Enkripsi" eyebrow="Sovereign Vault" icon={<LockKeyhole />}>
          <div className="alert-card warning">
            <LockKeyhole size={24} color="var(--warning)" />
            <div>
              <strong>Security Protocol</strong>
              <p>Private key tidak pernah dikirim ke User Zone atau Operational Zone. Semua enkripsi/dekripsi dilakukan secara lokal di backend.</p>
            </div>
          </div>

          <div className="key-value-list">
            <div className="key-value-item">
              <span>Active Key Version</span>
              <strong>{kInfo?.active_version ?? "-"}</strong>
            </div>
            <div className="key-value-item">
              <span>Key ID</span>
              <strong>{kInfo?.key_id ?? "-"}</strong>
            </div>
            <div className="key-value-item">
              <span>Algoritma Simetris</span>
              <strong>AES-256-GCM</strong>
            </div>
            <div className="key-value-item">
              <span>Pembungkusan Kunci</span>
              <strong>RSA-OAEP-SHA256</strong>
            </div>
            <div className="key-value-item">
              <span>Public Fingerprint</span>
              <strong>{kInfo?.public_fingerprint ?? "-"}</strong>
            </div>
          </div>
        </Panel>

        <div style={{ display: 'grid', gap: '24px', alignContent: 'start' }}>
          <Panel title="Rotasi Kunci (Admin Crypto)" eyebrow="Maintenance" icon={<KeyRound />}>
            <div className="inline-form" style={{marginTop: 0}}>
              <input value={cryptoAdminToken} onChange={(e) => setCryptoAdminToken(e.target.value)} type="password" placeholder="Admin Token" />
              <button type="button" className="primary-button secondary-button" onClick={async () => setRotateResult(await safeRequest(() => rotateVaultKey(cryptoAdminToken)))}>Rotasi Kunci</button>
            </div>
            {rotateResult && (
              <div className={`result-box ${rotateResult.ok ? 'success-box' : 'error-box'}`}>
                {rotateResult.ok ? "Rotasi kunci berhasil diinisiasi." : "Gagal merotasi kunci."}
              </div>
            )}
          </Panel>

          <Panel title="Detail Metadata Vault" eyebrow="Lookup" icon={<Database />}>
            <div className="inline-form" style={{marginTop: 0}}>
              <input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Masukkan Record ID" />
              <button type="button" className="primary-button" onClick={async () => setVaultResult(await safeRequest(() => getVaultRecord(recordId)))}>Cari Manual</button>
            </div>
            {vaultResult && (
              <div className="result-box">
                {vaultResult.ok ? (
                  <div className="key-value-list">
                    <div className="key-value-item"><span>Record ID</span><strong>{vaultResult.data?.record_id as string}</strong></div>
                    <div className="key-value-item"><span>Encrypted Blob</span><strong>Tersedia ({(vaultResult.data?.encrypted_blob_size as number) || 0} bytes)</strong></div>
                    <div className="key-value-item"><span>Key Version</span><strong>{vaultResult.data?.key_version as string}</strong></div>
                  </div>
                ) : (
                  <div className="error-box" style={{padding: '12px', borderRadius: '8px'}}>{vaultResult.error?.message || "Data tidak ditemukan"}</div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Daftar Dokumen di Vault" eyebrow="Vault Records" icon={<Database />}>
        <div style={{ marginBottom: '16px' }}>
          <input 
            type="text" 
            placeholder="Cari berdasarkan Record ID atau Filename..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ maxWidth: '400px' }}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Original Filename</th>
                <th>Terenkripsi</th>
                <th>Dibuat Pada</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={String(record.record_id)}>
                  <td><strong>{String(record.record_id).substring(0,8)}...</strong></td>
                  <td>{String(record.original_filename ?? "-")}</td>
                  <td>{record.vault_encrypted ? <span className="badge green">Ya</span> : <span className="badge danger">Tidak</span>}</td>
                  <td><small>{formatWibDate(record.created_at)} WIB</small></td>
                  <td>
                    <button type="button" className="primary-button secondary-button" style={{padding: '6px 12px', fontSize: '12px'}} onClick={() => handleRowClick(String(record.record_id))}>Lihat Detail</button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} style={{textAlign: 'center', padding: '24px', color: 'var(--muted)'}}>Tidak ada record yang sesuai dengan pencarian.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function GovernmentAccess({ latestRecordId }: { latestRecordId: string }) {
  const [step, setStep] = useState(1);
  const [recordId, setRecordId] = useState(latestRecordId);
  const [requestId, setRequestId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  
  const [requester, setRequester] = useState("Pejabat Dukcapil");
  const [reason, setReason] = useState("Investigasi resmi No. 123/2026");
  const [governmentToken, setGovernmentToken] = useState("privai-government-demo-token");
  const [approverToken, setApproverToken] = useState("privai-approver-demo-token");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const [viewerUrl, setViewerUrl] = useState("");
  const [originalBlobUrl, setOriginalBlobUrl] = useState("");

  useEffect(() => {
    if (latestRecordId && !recordId) setRecordId(latestRecordId);
  }, [latestRecordId, recordId]);

  async function createRequest() {
    setErrorMsg(""); setSuccessMsg("");
    const response = await safeRequest(() => createGovernmentAccessRequest({ recordId, requester, requesterRole: "verifier", reason, governmentToken }));
    if (response.ok) {
      setRequestId(String(response.data?.request_id ?? ""));
      setSuccessMsg("Request berhasil dibuat. Menunggu otorisasi penyetuju.");
      setStep(2);
    } else {
      setErrorMsg(response.error?.message || "Gagal membuat request.");
    }
  }

  async function approveRequest() {
    setErrorMsg(""); setSuccessMsg("");
    const response = await safeRequest(() => approveGovernmentAccessRequest({ requestId, approvedBy: "Hakim Ketua", approverToken }));
    if (response.ok) {
      setAccessToken(String(response.data?.one_time_access_token ?? ""));
      setSuccessMsg("Otorisasi berhasil. Token akses diterbitkan.");
      setStep(3);
    } else {
      setErrorMsg(response.error?.message || "Gagal menyetujui request.");
    }
  }

  async function downloadOriginal() {
    setErrorMsg(""); setSuccessMsg("");
    const response = await safeRequest(() => downloadGovernmentOriginal({ requestId, accessToken, governmentToken }));
    if (response.ok && response.data) {
      const url = URL.createObjectURL(response.data.blob);
      setOriginalBlobUrl(url);
      setSuccessMsg("Dokumen ditarik dari vault. Siap untuk ditampilkan.");
      setStep(4);
    } else {
      if (response.error?.status === 403) {
        setErrorMsg("Token sudah digunakan atau tidak valid (Akses Ditolak).");
      } else {
        setErrorMsg(response.error?.message || "Gagal menarik dokumen asli.");
      }
    }
  }

  function handleCloseViewer() {
    setViewerUrl("");
    if (originalBlobUrl) {
      URL.revokeObjectURL(originalBlobUrl);
      setOriginalBlobUrl("");
    }
    setStep(1); // Reset back to start after viewing
    setSuccessMsg("Sesi tampilan diakhiri dengan aman. Token satu kali telah hangus.");
  }

  return (
    <div className="view-stack">
      {viewerUrl && (
        <SecureViewer 
          url={viewerUrl} 
          title="DOKUMEN ASLI (RESTRICTED ACCESS)" 
          onClose={handleCloseViewer} 
          isSensitive={true} 
        />
      )}

      <Panel title="Pusat Otorisasi Dokumen Asli" eyebrow="Government Access" icon={<Landmark />}>
        {errorMsg && <div className="alert-card warning" style={{marginBottom: '24px'}}><strong>Akses Ditolak / Gagal</strong><p>{errorMsg}</p></div>}
        {successMsg && <div className="alert-card success" style={{marginBottom: '24px'}}><strong>Pemberitahuan Sistem</strong><p>{successMsg}</p></div>}

        <div className="two-column" style={{gap: '32px'}}>
          <div className="gov-steps">
            <div className={`gov-step ${step === 1 ? 'active' : ''}`}>
              <div className="gov-step-icon">1</div>
              <div className="gov-step-content">
                <h4>Permohonan Akses</h4>
                <p style={{margin:0, fontSize:'13px'}}>Pendaftaran alasan akses ke log audit.</p>
              </div>
            </div>
            <div className={`gov-step ${step === 2 ? 'active' : ''}`}>
              <div className="gov-step-icon">2</div>
              <div className="gov-step-content">
                <h4>Otorisasi Approver</h4>
                <p style={{margin:0, fontSize:'13px'}}>Persetujuan dari pejabat berwenang.</p>
              </div>
            </div>
            <div className={`gov-step ${step === 3 ? 'active' : ''}`}>
              <div className="gov-step-icon">3</div>
              <div className="gov-step-content">
                <h4>Penerbitan Token</h4>
                <p style={{margin:0, fontSize:'13px'}}>Penggunaan token sekali pakai.</p>
              </div>
            </div>
            <div className={`gov-step ${step === 4 ? 'active' : ''}`}>
              <div className="gov-step-icon">4</div>
              <div className="gov-step-content">
                <h4>Tampilan Aman</h4>
                <p style={{margin:0, fontSize:'13px'}}>Penayangan langsung dengan pencegahan screenshot.</p>
              </div>
            </div>
          </div>

          <div className="form-stack" style={{background: 'var(--surface-strong)', padding: '24px', borderRadius: '16px'}}>
            {step === 1 && (
              <>
                <h4 style={{margin: '0 0 16px', color: 'var(--text)'}}>Lengkapi Detail Permohonan</h4>
                <Field label="Record ID (Dokumen Sasaran)"><input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Masukkan Record ID" /></Field>
                <Field label="Nama Pemohon / Institusi"><input value={requester} onChange={(e) => setRequester(e.target.value)} /></Field>
                <Field label="Alasan Akses (Akan dicatat di log)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                <Field label="Government Access Token"><input type="password" value={governmentToken} onChange={(e) => setGovernmentToken(e.target.value)} /></Field>
                <button type="button" className="primary-button" onClick={createRequest} style={{marginTop: '12px', width: '100%'}}>Ajukan Permohonan Akses</button>
              </>
            )}
            
            {step === 2 && (
              <>
                <h4 style={{margin: '0 0 16px', color: 'var(--text)'}}>Otorisasi Diperlukan</h4>
                <div className="key-value-list" style={{background: 'var(--bg)', padding: '16px', borderRadius: '12px', marginBottom: '16px'}}>
                  <div className="key-value-item"><span>Request ID</span><strong>{requestId}</strong></div>
                  <div className="key-value-item"><span>Pemohon</span><strong>{requester}</strong></div>
                  <div className="key-value-item"><span>Alasan</span><strong>{reason}</strong></div>
                </div>
                <Field label="Approver Token (Otorisator)"><input type="password" value={approverToken} onChange={(e) => setApproverToken(e.target.value)} /></Field>
                <button type="button" className="primary-button" onClick={approveRequest} style={{marginTop: '12px', width: '100%'}}>Setujui & Terbitkan Token</button>
              </>
            )}

            {step === 3 && (
              <>
                <h4 style={{margin: '0 0 16px', color: 'var(--text)'}}>Tarik Dokumen Asli</h4>
                <div className="alert-card warning">
                  <KeyRound size={24} color="var(--warning)" style={{flexShrink: 0}} />
                  <div>
                    <strong>One-Time Access Token</strong>
                    <p style={{fontSize: '12px'}}>Token ini hanya bisa digunakan tepat 1 kali. Jika tab direfresh atau token ditebak ulang, sistem otomatis memblokir akses (HTTP 403).</p>
                  </div>
                </div>
                <Field label="Token Akses Anda">
                  <input value={accessToken} readOnly style={{fontFamily: 'monospace', color: 'var(--danger)', fontWeight: 'bold'}} />
                </Field>
                <button type="button" className="primary-button" onClick={downloadOriginal} style={{marginTop: '12px', width: '100%'}}>Verifikasi Token & Buka Brankas</button>
              </>
            )}

            {step === 4 && (
              <>
                 <h4 style={{margin: '0 0 16px', color: 'var(--success)'}}>Otorisasi Sukses</h4>
                 <p style={{fontSize: '13px', lineHeight: '1.6', color: 'var(--text)', marginBottom: '24px'}}>
                   Dokumen original telah berhasil di-dekripsi dan ditarik dari Sovereign Vault.
                   Gambar akan ditampilkan dalam Mode Aman (mencegah screenshot dan klik kanan).
                 </p>
                 <button type="button" className="primary-button" onClick={() => setViewerUrl(originalBlobUrl)} style={{width: '100%', fontSize: '16px', padding: '16px'}}>
                   TAMPILKAN DOKUMEN ORIGINAL
                 </button>
                 <button type="button" className="primary-button secondary-button" onClick={handleCloseViewer} style={{width: '100%', marginTop: '12px'}}>
                   Akhiri Sesi
                 </button>
              </>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function DynamicInjection({ redactionConfig, onRefresh }: { redactionConfig: RedactionConfigResponse | null; onRefresh: () => Promise<void> }) {
  const [policy, setPolicy] = useState<Record<string, unknown>>({
    policy_name: "Default Government Policy",
    confidence_threshold: 0.35,
    class_confidence_threshold: { ...DEFAULT_CLASS_CONFIDENCE },
    profile: "government",
    redaction_mode: "black_box",
    active_classes: ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"],
    disabled_classes: [],
    label_text: "REDACTED",
    injection_note: "Frontend contract draft"
  });
  const [result, setResult] = useState<ApiResult<Record<string, unknown>> | null>(null);

  const availableClasses = PRIVACY_CLASSES;
  const activeClassesList = normalizePrivacyClasses(policy.active_classes);
  const disabledClassesList = getDisabledPrivacyClasses(activeClassesList);
  const classConfidence = normalizeClassConfidence(policy.class_confidence_threshold);

  function updateClassConfidence(className: string, value: number) {
    setPolicy((current) => ({
      ...current,
      class_confidence_threshold: { ...normalizeClassConfidence(current.class_confidence_threshold), [className]: value },
    }));
  }

  function updateField(key: string, value: unknown) {
    setPolicy((current) => ({ ...current, [key]: value }));
  }

  async function loadPolicy() {
    const response = await safeRequest(getRuntimePolicy);
    setResult(response);
    if (response.ok && response.data?.policy && typeof response.data.policy === "object") {
      setPolicy(withDerivedPolicyClasses(response.data.policy));
    }
  }

  async function savePolicy() {
    const payload = withDerivedPolicyClasses(policy);
    const response = await safeRequest(() => updateRuntimePolicy(payload)); 
    setResult(response); 
    if (response.ok && response.data?.policy && typeof response.data.policy === "object") {
      setPolicy(withDerivedPolicyClasses(response.data.policy));
    }
    await onRefresh();
  }

  async function resetPolicy() {
    const response = await safeRequest(resetRuntimePolicy);
    setResult(response);
    if (response.ok && response.data?.policy && typeof response.data.policy === "object") {
      setPolicy(withDerivedPolicyClasses(response.data.policy));
    }
    await onRefresh();
  }

  return (
    <div className="view-stack">
      <Panel title="Editor Policy" eyebrow="Dynamic Injection" icon={<SlidersHorizontal />}>
        <div className="alert-card warning">
          <ShieldCheck size={24} color="var(--warning)" />
          <div>
            <strong>Validasi Keamanan</strong>
            <p>Dynamic Injection di PrivAI adalah konfigurasi runtime tervalidasi, bukan eksekusi kode (No eval). Seluruh struktur JSON divalidasi oleh backend sebelum diterapkan.</p>
          </div>
        </div>

        <div className="form-stack">
          <div className="form-grid">
            <Field label="Nama Policy"><input value={String(policy.policy_name ?? "")} onChange={(e) => updateField("policy_name", e.target.value)} /></Field>
            <Field label="Target Profile">
              <select value={String(policy.profile ?? "government")} onChange={(e) => updateField("profile", e.target.value)}>
                {Object.keys(redactionConfig?.profiles ?? { government: null, live_webcam: null }).map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Confidence Threshold">
              <NumericInput
                min={0.01}
                max={0.99}
                step={0.01}
                value={Number(policy.confidence_threshold ?? 0.35)}
                fallbackValue={0.35}
                onValueChange={(value) => updateField("confidence_threshold", value)}
              />
            </Field>
            <Field label="Mode Redaksi">
              <select value={String(policy.redaction_mode ?? "black_box")} onChange={(e) => updateField("redaction_mode", e.target.value)}>
                {(redactionConfig?.allowed_modes ?? ["black_box", "blur", "pixelate"]).map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          </div>
          
          <Field label="Target Kelas Aktif">
            <ClassSelectionGrid
              options={availableClasses}
              selected={activeClassesList}
              helper="Yang dipilih menjadi active_classes. Yang tidak dipilih otomatis menjadi disabled_classes."
              onChange={(newSelected) => {
                setPolicy((current) => ({
                  ...current,
                  active_classes: newSelected,
                  disabled_classes: getDisabledPrivacyClasses(newSelected),
                }));
              }}
            />
          </Field>
          <div className="policy-class-summary">
            <span>Aktif: {activeClassesList.length ? activeClassesList.join(", ") : "Tidak ada"}</span>
            <span>Nonaktif: {disabledClassesList.length ? disabledClassesList.join(", ") : "Tidak ada"}</span>
          </div>

          <Field label="Confidence Threshold per Kelas">
            <div className="form-grid">
              {availableClasses.map((className) => (
                <Field key={className} label={className}>
                  <NumericInput
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    value={classConfidence[className]}
                    fallbackValue={DEFAULT_CLASS_CONFIDENCE[className]}
                    onValueChange={(value) => updateClassConfidence(className, value)}
                  />
                </Field>
              ))}
            </div>
            <small className="field-hint">
              Threshold deteksi per kelas, dikalibrasi dari kurva F1/PR. Kelas tanpa nilai pakai Confidence Threshold global sebagai fallback.
            </small>
          </Field>

          <Field label="Injection Note"><input value={String(policy.injection_note ?? "")} onChange={(e) => updateField("injection_note", e.target.value)} /></Field>
          
          <div className="button-row">
            <button type="button" className="primary-button" onClick={savePolicy}>Simpan Policy</button>
            <button type="button" className="primary-button secondary-button" onClick={loadPolicy}>Muat Policy</button>
            <button type="button" className="primary-button secondary-button" onClick={resetPolicy}>Reset Default</button>
          </div>
        </div>

        {result && (
          <div className={`result-box ${result.ok ? 'success-box' : 'error-box'}`}>
            {result.ok ? "Operasi policy berhasil." : result.error?.message}
          </div>
        )}

        <Collapsible title="Detail Policy JSON">
          <JsonBlock data={policy} />
        </Collapsible>
      </Panel>
    </div>
  );
}

function LiveStream({ isActive }: { isActive: boolean }) {
  const statusIntervalRef = useRef<number | null>(null);

  const [sessionId] = useState("default");
  const [cameraIndex, setCameraIndex] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.25);
  const [redactionMode, setRedactionMode] = useState("blur");
  const [activeClasses, setActiveClasses] = useState<string[]>(["Wajah"]);
  const [targetWidth, setTargetWidth] = useState(640);
  const [inferIntervalMs, setInferIntervalMs] = useState(90);
  const [jpegQuality, setJpegQuality] = useState(75);
  const [boxHoldMs, setBoxHoldMs] = useState(700);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [mjpegError, setMjpegError] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const classOptions = ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"];

  function openStream() {
    setMjpegError(false);
    setError("");
    setStreamUrl(`${buildTurboMjpegUrl(sessionId)}&t=${Date.now()}`);
  }

  async function refreshStatus() {
    const response = await safeRequest(() => getTurboLiveStatus(sessionId));
    if (response.ok) {
      setStatus(response.data ?? null);
      return;
    }
    setError(response.error?.message || "Gagal membaca status Live Camera.");
  }

  async function startLiveCamera() {
    setIsBusy(true);
    setError("");
    setMessage("");
    const response = await safeRequest(() => startTurboLive({
      sessionId,
      cameraIndex,
      confidenceThreshold,
      redactionMode,
      activeClasses: activeClasses.join(","),
      targetWidth,
      inferIntervalMs,
      jpegQuality,
      boxHoldMs,
    }));
    setIsBusy(false);

    if (!response.ok) {
      const detail = response.error?.detail;
      const detailMessage = detail && typeof detail === "object" && "detail" in detail
        ? String((detail as Record<string, unknown>).detail)
        : "";
      setError(detailMessage || response.error?.message || "Gagal memulai Live Camera.");
      return;
    }

    setStatus(response.data ?? null);
    openStream();
    setMessage("Live Camera berjalan dari kamera lokal backend.");
  }

  async function stopLiveCamera() {
    setIsBusy(true);
    const response = await safeRequest(() => stopTurboLive(sessionId));
    setIsBusy(false);
    if (response.ok) {
      setStatus(response.data ?? null);
      setStreamUrl("");
      setMjpegError(false);
      setMessage("Live Camera dihentikan.");
      setError("");
      return;
    }
    setError(response.error?.message || "Gagal menghentikan Live Camera.");
  }

  useEffect(() => {
    if (!isActive) {
      if (statusIntervalRef.current) {
        window.clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      return;
    }

    void refreshStatus();
    statusIntervalRef.current = window.setInterval(() => void refreshStatus(), 2000);
    return () => {
      if (statusIntervalRef.current) {
        window.clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [isActive, sessionId]);

  const running = status?.running === true;
  const latestStats = (status?.latest_stats ?? {}) as Record<string, unknown>;

  return (
    <div className="view-stack">
      <section className="hero-panel live-hero">
        <h2>Live Camera Privacy Filter</h2>
        <p className="lead">Kamera lokal backend diproses real-time dengan deteksi AI dan redaksi visual. Frame diproses sementara dan tidak disimpan di Operational Zone maupun Sovereign Vault.</p>
      </section>

      <div className="two-column">
        <Panel title="Pengaturan Live Camera" eyebrow="Backend Camera" icon={<Video />}>
          <div className="form-grid">
            <Field label="Camera Index">
              <NumericInput min={0} value={cameraIndex} fallbackValue={0} onValueChange={setCameraIndex} />
            </Field>
            <Field label={`Confidence (${confidenceThreshold})`}>
              <input type="range" min="0.01" max="0.99" step="0.01" value={confidenceThreshold} onChange={(event) => setConfidenceThreshold(Number(event.target.value))} />
            </Field>
            <Field label="Mode">
              <select value={redactionMode} onChange={(event) => setRedactionMode(event.target.value)}>
                <option value="blur">blur</option>
                <option value="pixelate">pixelate</option>
                <option value="black_box">black_box</option>
              </select>
            </Field>
            <Field label="Target Classes">
              <MultiSelectDropdown
                label="Kelas"
                options={classOptions}
                selected={activeClasses}
                onChange={setActiveClasses}
              />
            </Field>
            <Field label="Target Width">
              <NumericInput min={240} max={1280} value={targetWidth} fallbackValue={640} onValueChange={setTargetWidth} />
            </Field>
            <Field label="Infer Interval (ms)">
              <NumericInput min={50} max={2000} value={inferIntervalMs} fallbackValue={90} onValueChange={setInferIntervalMs} />
            </Field>
            <Field label="JPEG Quality">
              <NumericInput min={35} max={95} value={jpegQuality} fallbackValue={75} onValueChange={setJpegQuality} />
            </Field>
            <Field label="Box Hold (ms)">
              <NumericInput min={100} max={5000} value={boxHoldMs} fallbackValue={700} onValueChange={setBoxHoldMs} />
            </Field>
          </div>
          <div className="button-row">
            <button type="button" onClick={startLiveCamera} disabled={isBusy}>
              {isBusy ? <><RefreshCw className="spin" size={16} /> Working...</> : "Start Live Camera"}
            </button>
            <button type="button" className="secondary-button" onClick={stopLiveCamera} disabled={isBusy}>Stop</button>
            <button type="button" className="secondary-button" onClick={() => void refreshStatus()}>Refresh Status</button>
          </div>
          {message && <div className="result-box success-box">{message}</div>}
          {error && <div className="result-box error-box">{error}</div>}
          <div className="alert-card success">
            <ShieldCheck size={24} color="var(--success)" />
            <div>
              <strong>Ephemeral Processing</strong>
              <p>Frame live diproses sementara, tidak disimpan ke storage dan tidak masuk vault. Berbeda dari flow dokumen pemerintah.</p>
            </div>
          </div>
        </Panel>

        <Panel title="Live Camera Output" eyebrow={running ? "Running" : "Stopped"} icon={<Video />}>
          <div className="live-frame">
            {streamUrl && !mjpegError ? (
              <img
                src={streamUrl}
                alt="Live camera MJPEG stream"
                onError={() => {
                  setMjpegError(true);
                  setError("Stream terputus atau tidak dapat dibuka. Pastikan sesi masih berjalan lalu klik Reconnect.");
                }}
              />
            ) : mjpegError ? (
              <div className="empty-state">
                <p style={{ color: "var(--danger)", marginBottom: "12px" }}>Stream terputus.</p>
                <button type="button" className="primary-button secondary-button" onClick={openStream}>Reconnect Stream</button>
              </div>
            ) : running ? (
              <div className="empty-state">
                <p style={{ marginBottom: "12px" }}>Sesi aktif di backend.</p>
                <button type="button" className="primary-button secondary-button" onClick={openStream}>Sambungkan Stream</button>
              </div>
            ) : (
              <div className="empty-state">Klik Start Live Camera untuk membuka stream dari kamera backend.</div>
            )}
          </div>
          <div className="meta-row">
            <div className="meta-item"><span>Frames</span><strong>{String(status?.frame_counter ?? 0)}</strong></div>
            <div className="meta-item"><span>Inference</span><strong>{String(status?.inference_counter ?? 0)}</strong></div>
            <div className="meta-item"><span>Latency</span><strong>{String(latestStats.latency_ms ?? 0)} ms</strong></div>
            <div className="meta-item"><span>Redacted</span><strong>{String(latestStats.redacted_count ?? 0)}</strong></div>
          </div>
          <Collapsible title="Detail Status">
            <JsonBlock data={status} />
          </Collapsible>
        </Panel>
      </div>
    </div>
  );
}

function AuditLogView({ initialLogs }: { initialLogs: ApiResult<{ logs: AuditLog[]; count: number }> }) {
  const [filters, setFilters] = useState<Required<Pick<AuditLogFilters, "limit" | "recordId" | "zone" | "eventType">>>({ limit: 50, recordId: "", zone: "", eventType: "" });
  const [result, setResult] = useState(initialLogs);

  useEffect(() => {
    setResult(initialLogs);
  }, [initialLogs]);

  const logs = result.data?.logs ?? [];

  return (
    <div className="view-stack">
      <Panel title="Pencarian Log" eyebrow="Audit Trail" icon={<Activity />}>
        <div className="form-grid">
          <Field label="Limit Maksimal">
            <NumericInput min={1} max={200} value={filters.limit} fallbackValue={50} onValueChange={(value) => setFilters({ ...filters, limit: value })} />
          </Field>
          <Field label="Filter Record ID"><input value={filters.recordId} onChange={(e) => setFilters({ ...filters, recordId: e.target.value })} placeholder="Opsional" /></Field>
          <Field label="Zone">
            <select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}>
              <option value="">Semua Zone</option>
              <option value="Sovereign Vault">Sovereign Vault</option>
              <option value="Operational Zone">Operational Zone</option>
              <option value="Government Access API">Government Access API</option>
              <option value="Dynamic Injection">Dynamic Injection</option>
            </select>
          </Field>
          <Field label="Event Type"><input value={filters.eventType} onChange={(e) => setFilters({ ...filters, eventType: e.target.value })} placeholder="Opsional" /></Field>
        </div>
        <button type="button" className="primary-button" onClick={async () => setResult(await safeRequest(() => getAuditLogs(filters)))} style={{marginTop: '16px'}}>Terapkan Filter</button>
      </Panel>

      <Panel title="Daftar Peristiwa Keamanan" eyebrow={`Menampilkan ${logs.length} event`} icon={<ShieldCheck />}>
        {logs.length === 0 ? (
          <div className="empty-state">Tidak ada event audit yang sesuai filter.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Zone</th>
                  <th>Actor</th>
                  <th>Record ID</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  let badgeClass = "muted";
                  if (log.zone === "Sovereign Vault") badgeClass = "green";
                  if (log.zone === "Operational Zone") badgeClass = "copper";
                  if (log.zone === "Government Access API") badgeClass = "danger";
                  if (log.zone === "Dynamic Injection") badgeClass = "brown";

                  return (
                    <tr key={log.id}>
                      <td>
                        <strong>{log.event_type}</strong>
                        <small>{log.action}</small>
                      </td>
                      <td><div className={`badge ${badgeClass}`}>{log.zone}</div></td>
                      <td>{log.actor}</td>
                      <td>{log.record_id ? String(log.record_id).substring(0,8) + "..." : "-"}</td>
                      <td><small>{formatWibDate(log.created_at)} WIB</small></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// UI Components
function SecureViewer({ url, title, onClose, isSensitive }: { url: string; title: string; onClose: () => void; isSensitive: boolean }) {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    const handleBlur = () => { if (isSensitive) setIsBlurred(true); };
    const handleFocus = () => { if (isSensitive) setIsBlurred(false); };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Basic anti-screenshot best effort
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4'))) {
        if (isSensitive) {
          setIsBlurred(true);
          setTimeout(() => setIsBlurred(false), 3000);
        }
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("keydown", handleKeyDown);
    
    // Disable right click globally while viewer is open if sensitive
    const preventContext = (e: MouseEvent) => { if (isSensitive) e.preventDefault(); };
    document.addEventListener("contextmenu", preventContext);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", preventContext);
    };
  }, [isSensitive]);

  return (
    <div className="secure-modal-backdrop">
      <div className="secure-modal-content">
        <div className="secure-modal-header">
          <h3>{isSensitive ? <ShieldCheck size={20} /> : <EyeOff size={20} />} {title}</h3>
          <button className="secondary-button" style={{padding: '6px 16px', borderRadius: '8px'}} onClick={onClose}>Tutup</button>
        </div>
        <div className="secure-modal-body" onContextMenu={(e) => { if (isSensitive) e.preventDefault(); }}>
          <div className="secure-image-container">
            <img src={url} className={`secure-image ${isBlurred ? 'secure-blur' : ''}`} draggable="false" />
            {isSensitive && (
              <div className="secure-watermark">
                CONFIDENTIAL • CONFIDENTIAL • CONFIDENTIAL<br />
                RESTRICTED GOVERNMENT ACCESS ONLY
              </div>
            )}
          </div>
          <p style={{color: '#888', marginTop: '16px', fontSize: '13px', textAlign: 'center'}}>
            {isSensitive ? "Tangkap layar (Screenshot) dan klik kanan dilarang. Aktivitas ini dipantau secara ketat." : "Mode pratinjau gambar."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ClassSelectionGrid({
  options,
  selected,
  onChange,
  helper,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  helper?: string;
}) {
  const normalizedSelected = options.filter((option) => selected.includes(option));

  function toggleOption(option: string) {
    const nextSelected = normalizedSelected.includes(option)
      ? normalizedSelected.filter((item) => item !== option)
      : [...normalizedSelected, option];
    onChange(options.filter((item) => nextSelected.includes(item)));
  }

  return (
    <div className="class-toggle-panel">
      <div className="class-toggle-toolbar">
        <span>{normalizedSelected.length} dari {options.length} kelas aktif</span>
        <div>
          <button type="button" className="text-button" onClick={() => onChange([...options])}>Pilih Semua</button>
          <button type="button" className="text-button" onClick={() => onChange([])}>Kosongkan</button>
        </div>
      </div>
      <div className="class-toggle-grid">
        {options.map((option) => {
          const isActive = normalizedSelected.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={`class-toggle-card ${isActive ? "active" : ""}`}
              onClick={() => toggleOption(option)}
              aria-pressed={isActive}
            >
              <strong>{option}</strong>
              <small>{isActive ? "Aktif" : "Nonaktif"}</small>
            </button>
          );
        })}
      </div>
      {helper && <small className="field-hint">{helper}</small>}
      {normalizedSelected.length === 0 && <small className="field-warning">Tidak ada kelas aktif. Hasil redaksi bisa kosong.</small>}
    </div>
  );
}

function MultiSelectDropdown({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (selected: string[]) => void; label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedSelected = options.filter((option) => selected.includes(option));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    const next = normalizedSelected.includes(opt)
      ? normalizedSelected.filter((item) => item !== opt)
      : [...normalizedSelected, opt];
    onChange(options.filter((option) => next.includes(option)));
  };

  return (
    <div className="multi-select-container" ref={containerRef}>
      <button type="button" className="multi-select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {normalizedSelected.length === 0 
            ? `Pilih ${label}...` 
            : normalizedSelected.length <= 2 
              ? normalizedSelected.join(", ") 
              : `${normalizedSelected.length} ${label} dipilih`}
        </span>
        {isOpen ? <ChevronDown size={16} style={{ flexShrink: 0 }} /> : <ChevronRight size={16} style={{ flexShrink: 0 }} />}
      </button>
      {isOpen && (
        <div className="multi-select-popover">
          {options.map((opt) => (
            <button key={opt} type="button" className="multi-select-option" onClick={() => toggleOption(opt)}>
              <input type="checkbox" checked={normalizedSelected.includes(opt)} readOnly tabIndex={-1} />
              <span>{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, eyebrow, icon, children }: { title: string; eyebrow: string; icon: ReactNode; children: ReactNode }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div className="section-icon">{icon}</div>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {children}
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><span>{label}</span>{children}</div>;
}

function NumericInput({
  value,
  fallbackValue,
  onValueChange,
  min,
  max,
  step,
}: {
  value: number;
  fallbackValue: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  function commitValue() {
    const rawValue = draft.trim() === "" ? fallbackValue : Number(draft);
    let nextValue = Number.isFinite(rawValue) ? rawValue : fallbackValue;
    if (typeof min === "number") nextValue = Math.max(min, nextValue);
    if (typeof max === "number") nextValue = Math.min(max, nextValue);
    setDraft(String(nextValue));
    onValueChange(nextValue);
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitValue}
    />
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return <pre className="json-block">{JSON.stringify(data ?? null, null, 2)}</pre>;
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="collapsible">
      <div className="collapsible-header" onClick={() => setIsOpen(!isOpen)}>
        <span>{title}</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

// Utils
function readNestedString(source: unknown, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}
