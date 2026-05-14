import base64
from typing import Annotated, Any

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse

from app.ai.runtime import detector
from app.core.redaction_policy import build_active_classes, get_redaction_rule, validate_redaction_mode
from app.services.live_turbo_service import get_session, get_session_status, start_session, stop_session
from app.services.redaction_service import redact_image
from app.utils.image_utils import cv2_image_to_bytes, get_image_shape, read_image_bytes_to_cv2, validate_image_filename

router = APIRouter(tags=["live-stream"])


def _ensure_model_loaded() -> None:
    if not detector.loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model not loaded: {detector.load_error or 'model is still loading or missing'}",
        )


@router.post("/live/redact-frame")
async def live_redact_frame(
    file: Annotated[UploadFile, File(...)],
    confidence_threshold: float = Query(default=0.25, ge=0.01, le=0.99),
    redaction_mode: str = Query(default="blur"),
    active_classes: str | None = Query(default="Wajah"),
    disabled_classes: str | None = Query(default=None),
) -> dict[str, Any]:
    """Process one webcam frame ephemerally. No Operational Zone or Vault persistence."""
    _ensure_model_loaded()
    validate_image_filename(file.filename or "frame.jpg")
    frame_bytes = await file.read()
    image = read_image_bytes_to_cv2(frame_bytes)
    rule = get_redaction_rule("live_webcam")
    mode = validate_redaction_mode(redaction_mode)
    active = build_active_classes(rule.active_classes, active_classes, disabled_classes)

    prediction = detector.predict(image, confidence_threshold)
    redaction = redact_image(
        image,
        prediction["detections"],
        mode=mode,
        active_classes=active,
        label_enabled=False,
        label_text="",
        box_padding_ratio=0.04,
    )
    output_bytes = cv2_image_to_bytes(redaction["image"], ".jpg")
    return {
        "profile": "live_webcam",
        "redaction_mode": mode,
        "active_classes": active,
        "confidence_threshold": confidence_threshold,
        "device": prediction["device"],
        "latency_ms": prediction["latency_ms"],
        "image_shape": get_image_shape(image),
        "raw_detection_count": prediction["detection_count"],
        "detection_count": prediction["detection_count"],
        "redacted_count": redaction["redacted_count"],
        "detections": prediction["detections"],
        "redacted_detections": redaction["redacted_detections"],
        "skipped_detections": redaction["skipped_detections"],
        "mime_type": "image/jpeg",
        "frame_image_base64": base64.b64encode(output_bytes).decode("ascii"),
        "storage_policy": {
            "operational_zone_persisted": False,
            "sovereign_vault_persisted": False,
            "audit_log_per_frame": False,
            "note": "Live frame processed ephemerally and not stored.",
        },
    }


@router.post("/live/turbo/start")
def live_turbo_start(
    session_id: str = Query(default="default"),
    camera_index: int = Query(default=0, ge=0),
    confidence_threshold: float = Query(default=0.25, ge=0.01, le=0.99),
    redaction_mode: str = Query(default="blur"),
    active_classes: str | None = Query(default="Wajah"),
    disabled_classes: str | None = Query(default=None),
    target_width: int = Query(default=416, ge=240, le=1280),
    infer_interval_ms: int = Query(default=90, ge=50, le=2000),
    jpeg_quality: int = Query(default=75, ge=35, le=95),
    box_hold_ms: int = Query(default=700, ge=100, le=5000),
) -> dict[str, Any]:
    _ensure_model_loaded()
    try:
        session = start_session(
            session_id=session_id,
            detector=detector,
            camera_index=camera_index,
            confidence_threshold=confidence_threshold,
            redaction_mode=redaction_mode,
            active_classes=active_classes,
            disabled_classes=disabled_classes,
            target_width=target_width,
            infer_interval_ms=infer_interval_ms,
            jpeg_quality=jpeg_quality,
            box_hold_ms=box_hold_ms,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"status": "started", **session.get_status(), "mjpeg_url": f"/api/live/turbo/mjpeg?session_id={session_id}"}


@router.post("/live/turbo/stop")
def live_turbo_stop(session_id: str = Query(default="default")) -> dict[str, Any]:
    return {"status": "stopped", **stop_session(session_id)}


@router.get("/live/turbo/status")
def live_turbo_status(session_id: str = Query(default="default")) -> dict[str, Any]:
    return get_session_status(session_id)


@router.get("/live/turbo/mjpeg")
def live_turbo_mjpeg(session_id: str = Query(default="default")) -> StreamingResponse:
    session = get_session(session_id)
    if not session or not session.running:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live turbo session is not running")
    return StreamingResponse(
        session.mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"},
    )