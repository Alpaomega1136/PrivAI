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
  Copy
} from "lucide-react";
import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useState } from "react";

import {
  ApiError,
  ApiResult,
  AuditLog,
  AuditLogFilters,
  buildBackendFileUrl,
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

type ViewId = "overview" | "user-zone" | "operational-zone" | "vault" | "government" | "dynamic" | "audit";

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
  { id: "overview", label: "Beranda", icon: <Gauge size={20} />, description: "Overview sistem" },
  { id: "user-zone", label: "Redaksi Dokumen", icon: <FileText size={20} />, description: "Upload & proses" },
  { id: "operational-zone", label: "Operational Zone", icon: <Database size={20} />, description: "Data tersensor" },
  { id: "vault", label: "Sovereign Vault", icon: <LockKeyhole size={20} />, description: "Penyimpanan asli" },
  { id: "government", label: "Akses Pemerintah", icon: <Landmark size={20} />, description: "Otorisasi khusus" },
  { id: "dynamic", label: "Dynamic Policy", icon: <SlidersHorizontal size={20} />, description: "Aturan runtime" },
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
          <div className="brand-icon"><ShieldCheck size={32} /></div>
          <strong>PrivAI</strong>
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
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.35);
  const [profile, setProfile] = useState("government");
  const [redactionMode, setRedactionMode] = useState("default");
  
  const availableClasses = ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"];
  const [activeClasses, setActiveClasses] = useState<string[]>(availableClasses);
  const [disabledClasses, setDisabledClasses] = useState<string[]>([]);
  
  const [useRuntimePolicy, setUseRuntimePolicy] = useState(false);
  const [documentTta, setDocumentTta] = useState(true);
  const [result, setResult] = useState<ApiResult<Record<string, unknown>> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPreview(nextFile ? URL.createObjectURL(nextFile) : "");
    setResult(null);
  }

  function toggleClass(className: string) {
    if (activeClasses.includes(className)) {
      setActiveClasses(activeClasses.filter(c => c !== className));
      setDisabledClasses([...disabledClasses, className]);
    } else {
      setActiveClasses([...activeClasses, className]);
      setDisabledClasses(disabledClasses.filter(c => c !== className));
    }
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
      documentTta, 
      ttaAngles: "0,180" 
    }));
    setResult(nextResult);
    setIsSubmitting(false);
    if (nextResult.ok) await onRefresh();
  }

  const redactedUrl = buildBackendFileUrl(readNestedString(result?.data, ["operational_zone", "redacted_file", "url"]));
  const detectionCount = result?.ok ? (result.data?.detections as any[])?.length ?? 0 : 0;
  const redactedCount = result?.ok ? (result.data?.operational_zone as any)?.redacted_count ?? 0 : 0;
  const latency = result?.ok ? (result.data?.metadata as any)?.latency_ms ?? 0 : 0;
  const recordId = result?.ok ? (result.data?.operational_zone as any)?.record_id ?? "" : "";

  return (
    <div className="view-stack">
      <div className="two-column">
        <Panel title="Upload Dokumen" eyebrow="Redaksi Visual" icon={<FileText />}>
          <form className="form-stack" onSubmit={submit}>
            <label className="file-drop">
              <input type="file" accept="image/*" onChange={onFileChange} />
              <FileText size={32} color="var(--primary)" />
              <span>{file ? file.name : "Drag & drop atau pilih gambar"}</span>
              <small>Mendukung format gambar standar (JPG, PNG)</small>
            </label>
            
            <div className="form-grid">
              <Field label={`Confidence (${confidenceThreshold})`}>
                <input type="range" min="0.01" max="0.99" step="0.01" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(Number(e.target.value))} />
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
              <div className="chip-group">
                {availableClasses.map(cls => (
                  <div key={cls} className={`chip ${activeClasses.includes(cls) ? 'active' : ''}`} onClick={() => toggleClass(cls)}>
                    {cls}
                  </div>
                ))}
              </div>
            </Field>

            <div className="inline-form">
              <label className="checkbox-line"><input type="checkbox" checked={useRuntimePolicy} onChange={(e) => setUseRuntimePolicy(e.target.checked)} /> Gunakan Dynamic Policy</label>
              <label className="checkbox-line"><input type="checkbox" checked={documentTta} onChange={(e) => setDocumentTta(e.target.checked)} /> Document Rotation TTA</label>
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
                  <span>Latency</span>
                  <strong>{latency} ms</strong>
                </div>
                <div className="meta-item">
                  <span>Deteksi</span>
                  <strong>{detectionCount} objek</strong>
                </div>
                <div className="meta-item">
                  <span>Diredaksi</span>
                  <strong>{redactedCount} area</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {(result.data?.detections as any[])?.map((d: any, i: number) => (
                  <div key={i} className="badge copper">{d.class_name} {(d.confidence * 100).toFixed(0)}%</div>
                ))}
              </div>
              <button type="button" className="primary-button secondary-button" onClick={() => window.open(redactedUrl, "_blank")}>Buka Gambar Redaksi</button>
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
  return (
    <div className="view-stack">
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
                {records.map((record) => (
                  <tr key={String(record.record_id)}>
                    <td><strong>{String(record.record_id).substring(0,8)}...</strong></td>
                    <td>{String(record.original_filename ?? "-")}</td>
                    <td>
                      <div className="badge muted">{String(record.redaction_profile ?? "-")}</div>
                      <div className="badge muted" style={{marginLeft: '4px'}}>{String(record.redaction_mode ?? "-")}</div>
                    </td>
                    <td>
                      <small>{Number(record.detection_count ?? 0)} deteksi</small>
                      <small>{Number(record.redacted_count ?? 0)} diredaksi</small>
                    </td>
                    <td><small>{new Date(String(record.created_at)).toLocaleString('id-ID')}</small></td>
                    <td>
                      {Boolean(record.redacted_file_url) && (
                        <button type="button" className="primary-button secondary-button" style={{padding: '6px 12px', fontSize: '12px'}} onClick={() => window.open(buildBackendFileUrl(String(record.redacted_file_url)), "_blank")}>Lihat</button>
                      )}
                    </td>
                  </tr>
                ))}
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

  const kInfo = keyInfo.data as any;

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
          <Panel title="Pencarian Metadata Vault" eyebrow="Lookup" icon={<Database />}>
            <div className="inline-form" style={{marginTop: 0}}>
              <input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Masukkan Record ID" />
              <button type="button" className="primary-button" onClick={async () => setVaultResult(await safeRequest(() => getVaultRecord(recordId)))}>Cari</button>
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
        </div>
      </div>
    </div>
  );
}

function GovernmentAccess({ latestRecordId }: { latestRecordId: string }) {
  const [step, setStep] = useState(1);
  const [recordId, setRecordId] = useState(latestRecordId);
  const [requestId, setRequestId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  
  const [requester, setRequester] = useState("Dukcapil Officer");
  const [reason, setReason] = useState("Demo controlled original access");
  const [governmentToken, setGovernmentToken] = useState("privai-government-demo-token");
  const [approverToken, setApproverToken] = useState("privai-approver-demo-token");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (latestRecordId && !recordId) setRecordId(latestRecordId);
  }, [latestRecordId, recordId]);

  async function createRequest() {
    setErrorMsg("");
    const response = await safeRequest(() => createGovernmentAccessRequest({ recordId, requester, requesterRole: "verifier", reason, governmentToken }));
    if (response.ok) {
      setRequestId(String(response.data?.request_id ?? ""));
      setStep(2);
    } else {
      setErrorMsg(response.error?.message || "Gagal membuat request.");
    }
  }

  async function approveRequest() {
    setErrorMsg("");
    const response = await safeRequest(() => approveGovernmentAccessRequest({ requestId, approvedBy: "Demo Approver", approverToken }));
    if (response.ok) {
      setAccessToken(String(response.data?.one_time_access_token ?? ""));
      setStep(3);
    } else {
      setErrorMsg(response.error?.message || "Gagal menyetujui request.");
    }
  }

  async function downloadOriginal() {
    setErrorMsg("");
    const response = await safeRequest(() => downloadGovernmentOriginal({ requestId, accessToken, governmentToken }));
    if (response.ok && response.data) {
      const url = URL.createObjectURL(response.data.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.data.filename;
      link.click();
      URL.revokeObjectURL(url);
      setSuccessMsg("Original berhasil diunduh.");
      setStep(4);
    } else {
      if (response.error?.status === 403) {
        setErrorMsg("Token sudah digunakan atau tidak valid.");
      } else {
        setErrorMsg(response.error?.message || "Gagal mengunduh dokumen asli.");
      }
    }
  }

  return (
    <div className="view-stack">
      <Panel title="Pusat Otorisasi Dokumen Asli" eyebrow="Akses Pemerintah" icon={<Landmark />}>
        <div className="stepper" style={{marginTop: '0', marginBottom: '32px'}}>
          <div className={`step ${step >= 1 ? 'active' : ''}`}><div className="step-dot">1</div> Request</div>
          <div className="step-line" />
          <div className={`step ${step >= 2 ? 'active' : ''}`}><div className="step-dot">2</div> Approval</div>
          <div className="step-line" />
          <div className={`step ${step >= 3 ? 'active' : ''}`}><div className="step-dot">3</div> Token</div>
          <div className="step-line" />
          <div className={`step ${step >= 4 ? 'active' : ''}`}><div className="step-dot">4</div> Selesai</div>
        </div>

        {errorMsg && <div className="alert-card warning"><strong>Error</strong><p>{errorMsg}</p></div>}
        {successMsg && <div className="alert-card success"><strong>Berhasil</strong><p>{successMsg}</p></div>}

        <div className="two-column" style={{gap: '40px'}}>
          <div className="form-stack">
            {step === 1 && (
              <>
                <Field label="Record ID"><input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Masukkan Record ID" /></Field>
                <Field label="Nama Pemohon"><input value={requester} onChange={(e) => setRequester(e.target.value)} /></Field>
                <Field label="Alasan Akses"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                <Field label="Government Token (Demo)"><input type="password" value={governmentToken} onChange={(e) => setGovernmentToken(e.target.value)} /></Field>
                <button type="button" className="primary-button" onClick={createRequest} style={{marginTop: '8px'}}>Buat Request Akses</button>
              </>
            )}
            
            {step === 2 && (
              <>
                <div className="key-value-list" style={{marginBottom: '16px'}}>
                  <div className="key-value-item"><span>Request ID</span><strong>{requestId}</strong></div>
                  <div className="key-value-item"><span>Status</span><strong>Menunggu Persetujuan</strong></div>
                </div>
                <Field label="Approver Token (Demo)"><input type="password" value={approverToken} onChange={(e) => setApproverToken(e.target.value)} /></Field>
                <button type="button" className="primary-button" onClick={approveRequest} style={{marginTop: '8px'}}>Setujui Request</button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="alert-card warning">
                  <KeyRound size={24} color="var(--warning)" />
                  <div>
                    <strong>Peringatan Keamanan</strong>
                    <p>Token hanya ditampilkan sekali dan hanya dapat digunakan satu kali.</p>
                  </div>
                </div>
                <Field label="One-Time Access Token">
                  <input value={accessToken} readOnly style={{fontFamily: 'monospace', background: 'var(--surface-strong)', color: 'var(--primary)'}} />
                </Field>
                <button type="button" className="primary-button" onClick={downloadOriginal} style={{marginTop: '8px'}}>Unduh Dokumen Asli</button>
              </>
            )}

            {step === 4 && (
              <div className="empty-state-small" style={{textAlign: 'left'}}>
                <h4 style={{margin: '0 0 8px 0', color: 'var(--success)'}}>Akses Selesai</h4>
                <p style={{margin: 0, fontSize: '13px', color: 'var(--text)'}}>Dokumen original telah diunduh. Token akses telah hangus dan tidak dapat digunakan kembali.</p>
                <button type="button" className="primary-button secondary-button" onClick={() => setStep(1)} style={{marginTop: '16px'}}>Buat Request Baru</button>
              </div>
            )}
          </div>
          
          <div style={{background: 'var(--surface-strong)', padding: '24px', borderRadius: '16px'}}>
            <h4 style={{margin: '0 0 12px 0', color: 'var(--primary)'}}>Tentang Akses Pemerintah</h4>
            <p style={{fontSize: '13px', lineHeight: '1.6', color: 'var(--muted)', margin: 0}}>
              Proses ini memastikan bahwa dokumen identitas yang tidak disensor (original) tidak pernah tersentuh oleh operasional standar.
              Dokumen asli hanya dapat diakses melalui portal Sovereign Vault yang membutuhkan autentikasi ganda (Pemohon & Penyetuju) serta mencatatkan aktivitas ini ke dalam Audit Log.
            </p>
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
    profile: "government", 
    redaction_mode: "black_box", 
    active_classes: ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"], 
    disabled_classes: [], 
    label_text: "REDACTED", 
    injection_note: "Frontend contract draft" 
  });
  const [result, setResult] = useState<ApiResult<Record<string, unknown>> | null>(null);

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

  async function savePolicy() {
    const response = await safeRequest(() => updateRuntimePolicy(policy)); 
    setResult(response); 
    if (response.ok && response.data?.policy && typeof response.data.policy === "object") {
      setPolicy(response.data.policy);
    }
    await onRefresh();
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
            <Field label="Confidence Threshold"><input type="number" min="0.01" max="0.99" step="0.01" value={Number(policy.confidence_threshold ?? 0.35)} onChange={(e) => updateField("confidence_threshold", Number(e.target.value))} /></Field>
            <Field label="Mode Redaksi">
              <select value={String(policy.redaction_mode ?? "black_box")} onChange={(e) => updateField("redaction_mode", e.target.value)}>
                {(redactionConfig?.allowed_modes ?? ["black_box", "blur", "pixelate"]).map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          </div>
          
          <div className="form-grid">
            <Field label="Active Classes (CSV)"><input value={(policy.active_classes as string[] | undefined)?.join(",") ?? ""} onChange={(e) => updateField("active_classes", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></Field>
            <Field label="Disabled Classes (CSV)"><input value={(policy.disabled_classes as string[] | undefined)?.join(",") ?? ""} onChange={(e) => updateField("disabled_classes", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></Field>
          </div>
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
          <Field label="Limit Maksimal"><input type="number" value={filters.limit} onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value) })} /></Field>
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
                      <td><small>{log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "-"}</small></td>
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
  return <label className="field"><span>{label}</span>{children}</label>;
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
