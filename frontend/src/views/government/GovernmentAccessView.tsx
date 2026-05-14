import { KeyRound, Landmark } from "lucide-react";
import { useEffect, useState } from "react";

import { Field } from "../../components/ui/Field";
import { SecureViewer } from "../../components/ui/SecureViewer";
import {
  approveGovernmentAccessRequest,
  createGovernmentAccessRequest,
  downloadGovernmentOriginal,
  safeRequest,
} from "../../lib/api";
import { Panel } from "../../components/ui/Panel";

export function GovernmentAccessView({ latestRecordId }: { latestRecordId: string }) {
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
    setErrorMsg("");
    setSuccessMsg("");
    const response = await safeRequest(() =>
      createGovernmentAccessRequest({ recordId, requester, requesterRole: "verifier", reason, governmentToken }),
    );
    if (response.ok) {
      setRequestId(String(response.data?.request_id ?? ""));
      setSuccessMsg("Request berhasil dibuat. Menunggu otorisasi penyetuju.");
      setStep(2);
    } else {
      setErrorMsg(response.error?.message || "Gagal membuat request.");
    }
  }

  async function approveRequest() {
    setErrorMsg("");
    setSuccessMsg("");
    const response = await safeRequest(() =>
      approveGovernmentAccessRequest({ requestId, approvedBy: "Hakim Ketua", approverToken }),
    );
    if (response.ok) {
      setAccessToken(String(response.data?.one_time_access_token ?? ""));
      setSuccessMsg("Otorisasi berhasil. Token akses diterbitkan.");
      setStep(3);
    } else {
      setErrorMsg(response.error?.message || "Gagal menyetujui request.");
    }
  }

  async function downloadOriginal() {
    setErrorMsg("");
    setSuccessMsg("");
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
    setStep(1);
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
        {errorMsg && (
          <div className="alert-card warning" style={{ marginBottom: "24px" }}>
            <strong>Akses Ditolak / Gagal</strong>
            <p>{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="alert-card success" style={{ marginBottom: "24px" }}>
            <strong>Pemberitahuan Sistem</strong>
            <p>{successMsg}</p>
          </div>
        )}

        <div className="two-column" style={{ gap: "32px" }}>
          <div className="gov-steps">
            <div className={`gov-step ${step === 1 ? "active" : ""}`}>
              <div className="gov-step-icon">1</div>
              <div className="gov-step-content">
                <h4>Permohonan Akses</h4>
                <p style={{ margin: 0, fontSize: "13px" }}>Pendaftaran alasan akses ke log audit.</p>
              </div>
            </div>
            <div className={`gov-step ${step === 2 ? "active" : ""}`}>
              <div className="gov-step-icon">2</div>
              <div className="gov-step-content">
                <h4>Otorisasi Approver</h4>
                <p style={{ margin: 0, fontSize: "13px" }}>Persetujuan dari pejabat berwenang.</p>
              </div>
            </div>
            <div className={`gov-step ${step === 3 ? "active" : ""}`}>
              <div className="gov-step-icon">3</div>
              <div className="gov-step-content">
                <h4>Penerbitan Token</h4>
                <p style={{ margin: 0, fontSize: "13px" }}>Penggunaan token sekali pakai.</p>
              </div>
            </div>
            <div className={`gov-step ${step === 4 ? "active" : ""}`}>
              <div className="gov-step-icon">4</div>
              <div className="gov-step-content">
                <h4>Tampilan Aman</h4>
                <p style={{ margin: 0, fontSize: "13px" }}>Penayangan langsung dengan pencegahan screenshot.</p>
              </div>
            </div>
          </div>

          <div
            className="form-stack"
            style={{ background: "var(--surface-strong)", padding: "24px", borderRadius: "16px" }}
          >
            {step === 1 && (
              <>
                <h4 style={{ margin: "0 0 16px", color: "var(--text)" }}>Lengkapi Detail Permohonan</h4>
                <Field label="Record ID (Dokumen Sasaran)">
                  <input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Masukkan Record ID" />
                </Field>
                <Field label="Nama Pemohon / Institusi">
                  <input value={requester} onChange={(e) => setRequester(e.target.value)} />
                </Field>
                <Field label="Alasan Akses (Akan dicatat di log)">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <Field label="Government Access Token">
                  <input type="password" value={governmentToken} onChange={(e) => setGovernmentToken(e.target.value)} />
                </Field>
                <button
                  type="button"
                  className="primary-button"
                  onClick={createRequest}
                  style={{ marginTop: "12px", width: "100%" }}
                >
                  Ajukan Permohonan Akses
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h4 style={{ margin: "0 0 16px", color: "var(--text)" }}>Otorisasi Diperlukan</h4>
                <div
                  className="key-value-list"
                  style={{ background: "var(--bg)", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}
                >
                  <div className="key-value-item">
                    <span>Request ID</span>
                    <strong>{requestId}</strong>
                  </div>
                  <div className="key-value-item">
                    <span>Pemohon</span>
                    <strong>{requester}</strong>
                  </div>
                  <div className="key-value-item">
                    <span>Alasan</span>
                    <strong>{reason}</strong>
                  </div>
                </div>
                <Field label="Approver Token (Otorisator)">
                  <input type="password" value={approverToken} onChange={(e) => setApproverToken(e.target.value)} />
                </Field>
                <button
                  type="button"
                  className="primary-button"
                  onClick={approveRequest}
                  style={{ marginTop: "12px", width: "100%" }}
                >
                  Setujui &amp; Terbitkan Token
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <h4 style={{ margin: "0 0 16px", color: "var(--text)" }}>Tarik Dokumen Asli</h4>
                <div className="alert-card warning">
                  <KeyRound size={24} color="var(--warning)" style={{ flexShrink: 0 }} />
                  <div>
                    <strong>One-Time Access Token</strong>
                    <p style={{ fontSize: "12px" }}>
                      Token ini hanya bisa digunakan tepat 1 kali. Jika tab direfresh atau token ditebak ulang, sistem
                      otomatis memblokir akses (HTTP 403).
                    </p>
                  </div>
                </div>
                <Field label="Token Akses Anda">
                  <input
                    value={accessToken}
                    readOnly
                    style={{ fontFamily: "monospace", color: "var(--danger)", fontWeight: "bold" }}
                  />
                </Field>
                <button
                  type="button"
                  className="primary-button"
                  onClick={downloadOriginal}
                  style={{ marginTop: "12px", width: "100%" }}
                >
                  Verifikasi Token &amp; Buka Brankas
                </button>
              </>
            )}

            {step === 4 && (
              <>
                <h4 style={{ margin: "0 0 16px", color: "var(--success)" }}>Otorisasi Sukses</h4>
                <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text)", marginBottom: "24px" }}>
                  Dokumen original telah berhasil di-dekripsi dan ditarik dari Sovereign Vault. Gambar akan ditampilkan
                  dalam Mode Aman (mencegah screenshot dan klik kanan).
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setViewerUrl(originalBlobUrl)}
                  style={{ width: "100%", fontSize: "16px", padding: "16px" }}
                >
                  TAMPILKAN DOKUMEN ORIGINAL
                </button>
                <button
                  type="button"
                  className="primary-button secondary-button"
                  onClick={handleCloseViewer}
                  style={{ width: "100%", marginTop: "12px" }}
                >
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
