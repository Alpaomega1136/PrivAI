import time
from threading import Event, Lock, Thread
from typing import Any

import cv2
import numpy as np

from app.ai.class_map import normalize_class_name
from app.core.redaction_policy import build_active_classes, get_redaction_rule, validate_redaction_mode
from app.services.redaction_service import redact_image


def _filter_active_detections(detections: list[dict[str, Any]], active_classes: list[str]) -> list[dict[str, Any]]:
    """Return only detections whose class_name is in active_classes, without image manipulation."""
    active = set(active_classes)
    result: list[dict[str, Any]] = []
    for d in detections:
        try:
            class_name = normalize_class_name(str(d.get("class_name", "")))
        except Exception:
            continue
        if class_name in active:
            result.append({**d, "class_name": class_name})
    return result


def resize_keep_aspect(frame: np.ndarray, target_width: int) -> np.ndarray:
    if target_width <= 0:
        return frame
    height, width = frame.shape[:2]
    if width <= target_width:
        return frame
    target_height = max(1, int(height * (target_width / width)))
    return cv2.resize(frame, (target_width, target_height), interpolation=cv2.INTER_AREA)


class LiveTurboSession:
    """Fast local webcam pipeline with ephemeral frame processing only."""

    def __init__(
        self,
        session_id: str,
        detector,
        camera_index: int = 0,
        confidence_threshold: float = 0.25,
        redaction_mode: str = "blur",
        active_classes: str | None = "Wajah",
        disabled_classes: str | None = None,
        target_width: int = 416,
        infer_interval_ms: int = 90,
        jpeg_quality: int = 75,
        box_hold_ms: int = 700,
    ) -> None:
        self.session_id = session_id
        self.detector = detector
        self.camera_index = camera_index
        self.confidence_threshold = confidence_threshold
        self.redaction_mode = validate_redaction_mode(redaction_mode)
        self.rule = get_redaction_rule("live_webcam")
        self.active_classes = build_active_classes(self.rule.active_classes, active_classes, disabled_classes)
        self.disabled_classes = disabled_classes or ""
        self.target_width = max(240, min(int(target_width), 1280))
        self.infer_interval_ms = max(50, min(int(infer_interval_ms), 2000))
        self.jpeg_quality = max(35, min(int(jpeg_quality), 95))
        self.box_hold_ms = max(100, min(int(box_hold_ms), 5000))

        self.cap: cv2.VideoCapture | None = None
        self.stop_event = Event()
        self.lock = Lock()
        self.capture_thread: Thread | None = None
        self.inference_thread: Thread | None = None
        self.started_at: float | None = None
        self.running = False

        self.latest_frame: np.ndarray | None = None
        self.latest_detections: list[dict[str, Any]] = []
        self.latest_detection_at = 0.0
        self.latest_stats: dict[str, Any] = {}
        self.last_error: str | None = None
        self.frame_counter = 0
        self.inference_counter = 0

    def start(self) -> None:
        if self.running:
            return
        api_preference = cv2.CAP_DSHOW if hasattr(cv2, "CAP_DSHOW") else 0
        self.cap = cv2.VideoCapture(self.camera_index, api_preference)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.target_width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, int(self.target_width * 0.75))
        if not self.cap.isOpened():
            self.cap.release()
            self.cap = None
            raise RuntimeError(f"Failed to open camera index {self.camera_index}.")

        self.stop_event.clear()
        self.running = True
        self.started_at = time.time()
        self.capture_thread = Thread(target=self._capture_loop, name=f"PrivAI-Live-Capture-{self.session_id}", daemon=True)
        self.inference_thread = Thread(target=self._inference_loop, name=f"PrivAI-Live-Inference-{self.session_id}", daemon=True)
        self.capture_thread.start()
        self.inference_thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        self.running = False
        if self.capture_thread and self.capture_thread.is_alive():
            self.capture_thread.join(timeout=1.5)
        if self.inference_thread and self.inference_thread.is_alive():
            self.inference_thread.join(timeout=1.5)
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    def _capture_loop(self) -> None:
        while not self.stop_event.is_set():
            if self.cap is None:
                break
            ok, frame = self.cap.read()
            if not ok or frame is None:
                self.last_error = "Camera frame read failed"
                time.sleep(0.05)
                continue
            frame = resize_keep_aspect(frame, self.target_width)
            with self.lock:
                self.latest_frame = frame
                self.frame_counter += 1
            time.sleep(0.01)

    def _inference_loop(self) -> None:
        while not self.stop_event.is_set():
            started = time.perf_counter()
            with self.lock:
                frame = None if self.latest_frame is None else self.latest_frame.copy()
            if frame is None:
                time.sleep(0.05)
                continue
            try:
                prediction = self.detector.predict(frame, self.confidence_threshold)
                filtered = _filter_active_detections(prediction["detections"], self.active_classes)
                with self.lock:
                    self.latest_detections = filtered
                    self.latest_detection_at = time.time()
                    self.latest_stats = {
                        "device": prediction["device"],
                        "latency_ms": prediction["latency_ms"],
                        "raw_detection_count": prediction["detection_count"],
                        "detection_count": len(filtered),
                        "redacted_count": len(filtered),
                        "box_hold_ms": self.box_hold_ms,
                        "storage_policy": self.storage_policy(),
                    }
                    self.inference_counter += 1
                    self.last_error = None
            except Exception as exc:  # camera pipelines must keep running after transient model/frame errors
                self.last_error = str(exc)
            elapsed_ms = (time.perf_counter() - started) * 1000
            time.sleep(max(0.01, (self.infer_interval_ms - elapsed_ms) / 1000))

    def storage_policy(self) -> dict[str, Any]:
        return {
            "operational_zone_persisted": False,
            "sovereign_vault_persisted": False,
            "audit_log_per_frame": False,
            "note": "Live frames are processed ephemerally and are not stored.",
        }

    def get_status(self) -> dict[str, Any]:
        uptime = 0 if self.started_at is None else round(time.time() - self.started_at, 2)
        return {
            "session_id": self.session_id,
            "running": self.running,
            "camera_index": self.camera_index,
            "profile": "live_webcam",
            "redaction_mode": self.redaction_mode,
            "active_classes": self.active_classes,
            "confidence_threshold": self.confidence_threshold,
            "target_width": self.target_width,
            "infer_interval_ms": self.infer_interval_ms,
            "jpeg_quality": self.jpeg_quality,
            "box_hold_ms": self.box_hold_ms,
            "frame_counter": self.frame_counter,
            "inference_counter": self.inference_counter,
            "uptime_seconds": uptime,
            "latest_stats": self.latest_stats,
            "last_error": self.last_error,
            "storage_policy": self.storage_policy(),
        }

    def _placeholder_frame(self) -> np.ndarray:
        frame = np.zeros((360, 640, 3), dtype=np.uint8)
        cv2.putText(frame, "PrivAI Live Stream", (42, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (245, 247, 237), 2)
        cv2.putText(frame, "Waiting for camera frame...", (42, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (210, 220, 210), 2)
        return frame

    def get_encoded_frame(self) -> bytes:
        with self.lock:
            frame = None if self.latest_frame is None else self.latest_frame.copy()
            detections = list(self.latest_detections)
            detection_age_ms = (time.time() - self.latest_detection_at) * 1000 if self.latest_detection_at else 999999
        if frame is None:
            frame = self._placeholder_frame()
            detections = []
        if detection_age_ms > self.box_hold_ms:
            detections = []
        redaction = redact_image(
            frame,
            detections,
            mode=self.redaction_mode,
            active_classes=self.active_classes,
            label_enabled=False,
            label_text="",
            box_padding_ratio=0.04,
        )
        output = redaction["image"]
        ok, encoded = cv2.imencode(".jpg", output, [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality])
        if not ok:
            raise RuntimeError("Failed to encode MJPEG frame.")
        return encoded.tobytes()

    def mjpeg_generator(self):
        boundary = b"--frame\r\n"
        while self.running and not self.stop_event.is_set():
            try:
                frame_bytes = self.get_encoded_frame()
                yield boundary + b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            except Exception as exc:
                self.last_error = str(exc)
                time.sleep(0.1)
            time.sleep(0.03)


_sessions: dict[str, LiveTurboSession] = {}
_sessions_lock = Lock()


def start_session(session_id: str, detector, **kwargs) -> LiveTurboSession:
    with _sessions_lock:
        old_session = _sessions.get(session_id)
        if old_session:
            old_session.stop()
        session = LiveTurboSession(session_id=session_id, detector=detector, **kwargs)
        session.start()
        _sessions[session_id] = session
        return session


def stop_session(session_id: str) -> dict[str, Any]:
    with _sessions_lock:
        session = _sessions.get(session_id)
        if not session:
            return {"session_id": session_id, "running": False, "message": "Session was not running."}
        session.stop()
        status = session.get_status()
        _sessions.pop(session_id, None)
        return {**status, "message": "Session stopped."}


def get_session(session_id: str) -> LiveTurboSession | None:
    with _sessions_lock:
        return _sessions.get(session_id)


def get_session_status(session_id: str) -> dict[str, Any]:
    session = get_session(session_id)
    if not session:
        return {"session_id": session_id, "running": False, "storage_policy": {"operational_zone_persisted": False, "sovereign_vault_persisted": False}}
    return session.get_status()