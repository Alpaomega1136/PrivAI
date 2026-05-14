import { RefreshCw, ShieldCheck, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Collapsible } from "../../components/ui/Collapsible";
import { Field } from "../../components/ui/Field";
import { JsonBlock } from "../../components/ui/JsonBlock";
import { MultiSelectDropdown } from "../../components/ui/MultiSelectDropdown";
import { NumericInput } from "../../components/ui/NumericInput";
import { Panel } from "../../components/ui/Panel";
import {
  buildTurboMjpegUrl,
  getTurboLiveStatus,
  safeRequest,
  startTurboLive,
  stopTurboLive,
} from "../../lib/api";
import { PRIVACY_CLASSES } from "../../lib/constants";

// ╔═══ ASSET PAGE INI — ubah di sini ═══╗
// Taruh file di src/assets/ lalu uncomment import & isi nama file.
// import banner from "../../assets/live-banner.png";
const PAGE_ASSETS = {
  banner: "" as string, // banner gambar di atas halaman; "" = tidak ditampilkan
};
// ╚══════════════════════════════════════╝

export function UserLiveFilterView({ isActive }: { isActive: boolean }) {
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

  const classOptions = PRIVACY_CLASSES;

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
    const response = await safeRequest(() =>
      startTurboLive({
        sessionId,
        cameraIndex,
        confidenceThreshold,
        redactionMode,
        activeClasses: activeClasses.join(","),
        targetWidth,
        inferIntervalMs,
        jpegQuality,
        boxHoldMs,
      }),
    );
    setIsBusy(false);

    if (!response.ok) {
      const detail = response.error?.detail;
      const detailMessage =
        detail && typeof detail === "object" && "detail" in detail
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sessionId]);

  const running = status?.running === true;
  const latestStats = (status?.latest_stats ?? {}) as Record<string, unknown>;

  return (
    <div className="view-stack">
      {PAGE_ASSETS.banner && <img className="page-banner" src={PAGE_ASSETS.banner} alt="" />}
      <section className="hero-panel live-hero">
        <h2>Live Stream Privacy Filter</h2>
        <p className="lead">
          Kamera lokal backend diproses real-time dengan deteksi AI dan redaksi visual. Frame diproses sementara dan
          tidak disimpan di Operational Zone maupun Sovereign Vault.
        </p>
      </section>

      <div className="two-column">
        <Panel title="Pengaturan Live Camera" eyebrow="Backend Camera" icon={<Video />}>
          <div className="form-grid">
            <Field label="Camera Index">
              <NumericInput min={0} value={cameraIndex} fallbackValue={0} onValueChange={setCameraIndex} />
            </Field>
            <Field label={`Confidence (${confidenceThreshold})`}>
              <input
                type="range"
                min="0.01"
                max="0.99"
                step="0.01"
                value={confidenceThreshold}
                onChange={(event) => setConfidenceThreshold(Number(event.target.value))}
              />
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
              <NumericInput
                min={50}
                max={2000}
                value={inferIntervalMs}
                fallbackValue={90}
                onValueChange={setInferIntervalMs}
              />
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
              {isBusy ? (
                <>
                  <RefreshCw className="spin" size={16} /> Working...
                </>
              ) : (
                "Start Live Camera"
              )}
            </button>
            <button type="button" className="secondary-button" onClick={stopLiveCamera} disabled={isBusy}>
              Stop
            </button>
            <button type="button" className="secondary-button" onClick={() => void refreshStatus()}>
              Refresh Status
            </button>
          </div>
          {message && <div className="result-box success-box">{message}</div>}
          {error && <div className="result-box error-box">{error}</div>}
          <div className="alert-card success">
            <ShieldCheck size={24} color="var(--success)" />
            <div>
              <strong>Ephemeral Processing</strong>
              <p>
                Frame live diproses sementara, tidak disimpan ke storage dan tidak masuk vault. Berbeda dari flow
                dokumen pemerintah.
              </p>
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
                <button type="button" className="primary-button secondary-button" onClick={openStream}>
                  Reconnect Stream
                </button>
              </div>
            ) : running ? (
              <div className="empty-state">
                <p style={{ marginBottom: "12px" }}>Sesi aktif di backend.</p>
                <button type="button" className="primary-button secondary-button" onClick={openStream}>
                  Sambungkan Stream
                </button>
              </div>
            ) : (
              <div className="empty-state">Klik Start Live Camera untuk membuka stream dari kamera backend.</div>
            )}
          </div>
          <div className="meta-row">
            <div className="meta-item">
              <span>Frames</span>
              <strong>{String(status?.frame_counter ?? 0)}</strong>
            </div>
            <div className="meta-item">
              <span>Inference</span>
              <strong>{String(status?.inference_counter ?? 0)}</strong>
            </div>
            <div className="meta-item">
              <span>Latency</span>
              <strong>{String(latestStats.latency_ms ?? 0)} ms</strong>
            </div>
            <div className="meta-item">
              <span>Redacted</span>
              <strong>{String(latestStats.redacted_count ?? 0)}</strong>
            </div>
          </div>
          <Collapsible title="Detail Status">
            <JsonBlock data={status} />
          </Collapsible>
        </Panel>
      </div>
    </div>
  );
}
