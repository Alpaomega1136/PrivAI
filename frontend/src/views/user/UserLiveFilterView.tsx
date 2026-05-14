import { Camera, RefreshCw, Radio, Settings2, ShieldCheck, Square, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Collapsible } from "../../components/ui/Collapsible";
import { Field } from "../../components/ui/Field";
import { JsonBlock } from "../../components/ui/JsonBlock";
import { MultiSelectDropdown } from "../../components/ui/MultiSelectDropdown";
import { NumericInput } from "../../components/ui/NumericInput";
import {
  buildTurboMjpegUrl,
  getTurboLiveStatus,
  safeRequest,
  startTurboLive,
  stopTurboLive,
} from "../../lib/api";
import { PRIVACY_CLASSES } from "../../lib/constants";

const PAGE_ASSETS = {
  banner: "" as string,
};

const CAMERA_OPTIONS = [
  { index: 0, label: "Built-in / Main Camera", helper: "Camera 0 - default laptop atau webcam utama." },
  { index: 1, label: "External USB Webcam", helper: "Camera 1 - webcam tambahan yang tersambung." },
  { index: 2, label: "Virtual Camera / OBS", helper: "Camera 2 - virtual camera atau capture device." },
];

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
  const selectedCamera = CAMERA_OPTIONS.find((camera) => camera.index === cameraIndex) ?? CAMERA_OPTIONS[0];

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
    setMessage(`${selectedCamera.label} aktif. PrivAI sedang meredaksi frame secara ephemeral.`);
  }

  async function stopLiveCamera() {
    setIsBusy(true);
    const response = await safeRequest(() => stopTurboLive(sessionId));
    setIsBusy(false);
    if (response.ok) {
      setStatus(response.data ?? null);
      setStreamUrl("");
      setMjpegError(false);
      setMessage("Live stream dihentikan.");
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
    <div className="view-stack user-live-page">
      {PAGE_ASSETS.banner && <img className="page-banner" src={PAGE_ASSETS.banner} alt="" />}
      <section className="user-hero user-hero-compact live-hero">
        <div className="user-hero-copy">
          <h1>Live Stream Privacy Filter.</h1>
          <p>
            Kamera backend diproses seperti live platform: tampilkan feed, aktifkan redaksi, dan jaga frame tetap
            ephemeral tanpa masuk vault maupun storage.
          </p>
        </div>
      </section>

      <section className="live-studio-layout">
        <div className="live-stage-card">
          <div className="live-platform-bar">
            <div className={`live-status-chip ${running ? "is-live" : "is-offline"}`}>
              <span />
              {running ? "LIVE" : "OFFLINE"}
            </div>
            <div className="live-stream-title">
              <strong>PrivAI Secure Stream</strong>
              <small>{selectedCamera.label}</small>
            </div>
            <div className="live-platform-count">Session: {sessionId}</div>
          </div>

          <div className="live-frame live-platform-frame">
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
              <div className="empty-state live-empty-state">
                <p style={{ color: "#ff6b6b", marginBottom: "12px" }}>Stream terputus.</p>
                <button type="button" className="live-action-button secondary" onClick={openStream}>
                  Reconnect Stream
                </button>
              </div>
            ) : running ? (
              <div className="empty-state live-empty-state">
                <p style={{ marginBottom: "12px" }}>Sesi aktif di backend.</p>
                <button type="button" className="live-action-button secondary" onClick={openStream}>
                  Sambungkan Stream
                </button>
              </div>
            ) : (
              <div className="empty-state live-empty-state">
                <Video size={46} />
                <strong>Stream belum berjalan</strong>
                <span>Pilih kamera dan tekan Start Live untuk membuka feed redaksi.</span>
              </div>
            )}
          </div>

          <div className="live-control-dock">
            <div className="live-main-actions">
              {!running ? (
                <button type="button" className="live-action-button start" onClick={startLiveCamera} disabled={isBusy}>
                  {isBusy ? <RefreshCw className="spin" size={18} /> : <Radio size={18} />}
                  {isBusy ? "Starting..." : "Start Live"}
                </button>
              ) : (
                <button type="button" className="live-action-button stop" onClick={stopLiveCamera} disabled={isBusy}>
                  {isBusy ? <RefreshCw className="spin" size={18} /> : <Square size={16} />}
                  {isBusy ? "Stopping..." : "End Stream"}
                </button>
              )}
              <button type="button" className="live-action-button secondary" onClick={() => void refreshStatus()}>
                <RefreshCw size={16} /> Status
              </button>
            </div>

            <details className="live-settings-dropdown">
              <summary>
                <Settings2 size={16} /> Stream Settings
              </summary>
              <div className="live-settings-menu">
                <Field label="Camera Source">
                  <select value={cameraIndex} onChange={(event) => setCameraIndex(Number(event.target.value))}>
                    {CAMERA_OPTIONS.map((camera) => (
                      <option key={camera.index} value={camera.index}>
                        {camera.label}
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">{selectedCamera.helper}</small>
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
                <Field label="Redaction Mode">
                  <select value={redactionMode} onChange={(event) => setRedactionMode(event.target.value)}>
                    <option value="blur">Soft Blur</option>
                    <option value="pixelate">Pixelate</option>
                    <option value="black_box">Black Box</option>
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
                <div className="form-grid compact-form-grid">
                  <Field label="Frame Width">
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
              </div>
            </details>
          </div>

          {(message || error) && (
            <div className={`live-toast ${error ? "error" : "success"}`}>{error || message}</div>
          )}
        </div>

        <aside className="live-side-panel">
          <div className="live-creator-card">
            <div className="live-avatar"><Camera size={22} /></div>
            <div>
              <strong>{selectedCamera.label}</strong>
              <span>{selectedCamera.helper}</span>
            </div>
          </div>

          <div className="live-stat-grid">
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

          <div className="alert-card success live-privacy-card">
            <ShieldCheck size={24} color="var(--success)" />
            <div>
              <strong>Ephemeral Processing</strong>
              <p>
                Frame live diproses sementara, tidak disimpan ke storage dan tidak masuk vault. Cocok untuk demo
                privacy filtering real-time.
              </p>
            </div>
          </div>

          <Collapsible title="Detail Status">
            <JsonBlock data={status} />
          </Collapsible>
        </aside>
      </section>
    </div>
  );
}
