import time
from pathlib import Path
from threading import Lock, Thread
from typing import Any

import numpy as np

from app.ai.class_map import normalize_class_name


class YoloDetector:
    def __init__(self, model_path: Path, device: str = "cpu") -> None:
        self.model_path = model_path
        self.device = device
        self.model: Any | None = None
        self.load_error: str | None = None
        self.loaded = False
        self.loading = False
        self._lock = Lock()

    @property
    def model_exists(self) -> bool:
        return self.model_path.exists()

    def load(self) -> None:
        with self._lock:
            if self.loading:
                return
            if self.loaded and self.model is not None:
                return
            self.loading = True
            self.loaded = False
            self.load_error = None
            self.model = None

        if not self.model_exists:
            self.load_error = "model file not found"
            self.loading = False
            return

        try:
            from ultralytics import YOLO

            self.model = YOLO(str(self.model_path))
            self.loaded = True
            self._warm_up()
        except Exception as exc:  # pragma: no cover - depends on local ML runtime
            self.load_error = str(exc)
            self.model = None
            self.loaded = False
        finally:
            self.loading = False

    def load_in_background(self) -> None:
        if self.loaded or self.loading or not self.model_exists:
            return
        Thread(target=self.load, name="privai-yolo-loader", daemon=True).start()

    def _warm_up(self) -> None:
        try:
            dummy = np.zeros((64, 64, 3), dtype=np.uint8)
            self.model.predict(dummy, conf=0.25, device=self.device, verbose=False)
        except Exception as exc:  # warm-up failure should not kill API
            self.load_error = f"warm-up warning: {exc}"

    def predict(
        self,
        image: np.ndarray,
        confidence_threshold: float | dict[str, float],
    ) -> dict[str, Any]:
        if not self.loaded or self.model is None:
            if self.model_exists and not self.loading:
                self.load()
            if not self.loaded or self.model is None:
                raise RuntimeError(self.load_error or "model not loaded")

        # Per-class threshold: YOLO predict() hanya menerima conf skalar, jadi kita
        # inference di floor = threshold terendah lalu post-filter tiap deteksi
        # dengan threshold spesifik kelasnya.
        if isinstance(confidence_threshold, dict):
            class_thresholds: dict[str, float] | None = confidence_threshold
            floor_conf = min(confidence_threshold.values()) if confidence_threshold else 0.01
        else:
            class_thresholds = None
            floor_conf = float(confidence_threshold)

        started = time.perf_counter()
        results = self.model.predict(image, conf=floor_conf, device=self.device, verbose=False)
        latency_ms = (time.perf_counter() - started) * 1000
        detections: list[dict[str, Any]] = []
        if results:
            result = results[0]
            names = getattr(result, "names", None) or getattr(self.model, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is not None:
                for box in boxes:
                    class_id = int(box.cls[0].item()) if hasattr(box.cls[0], "item") else int(box.cls[0])
                    raw_name = str(names.get(class_id, class_id)) if isinstance(names, dict) else str(class_id)
                    try:
                        class_name = normalize_class_name(raw_name)
                    except Exception:
                        class_name = "Unknown"
                    confidence = float(box.conf[0].item()) if hasattr(box.conf[0], "item") else float(box.conf[0])
                    if class_thresholds is not None:
                        min_conf = class_thresholds.get(class_name, floor_conf)
                        if confidence < min_conf:
                            continue
                    coords = box.xyxy[0].tolist()
                    detections.append(
                        {
                            "class_id": class_id,
                            "class_name": class_name,
                            "confidence": confidence,
                            "box": {
                                "x1": float(coords[0]),
                                "y1": float(coords[1]),
                                "x2": float(coords[2]),
                                "y2": float(coords[3]),
                            },
                        }
                    )
        return {
            "device": self.device,
            "latency_ms": round(latency_ms, 2),
            "detection_count": len(detections),
            "detections": detections,
        }
