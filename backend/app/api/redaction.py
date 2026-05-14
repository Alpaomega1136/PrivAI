import json
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.ai.runtime import detector
from app.core.config import get_settings
from app.core.redaction_policy import build_active_classes, get_redaction_rule, validate_redaction_mode
from app.core.runtime_policy import load_runtime_policy
from app.db.database import get_db
from app.db.models import OperationalMetadata
from app.db.repositories import OperationalMetadataRepository
from app.services.audit_service import create_audit_log
from app.services.authenticity_service import analyze_detections
from app.services.false_positive_guardrail import apply_false_positive_guardrail, validate_guardrail_mode
from app.services.redaction_service import redact_image
from app.services.robustness_service import robust_predict_with_tta
from app.services.storage_service import save_operational_metadata, save_redacted_image_to_operational_zone
from app.services.vault_service import encrypt_original_for_vault
from app.utils.image_utils import get_image_shape, read_image_bytes_to_cv2, validate_image_filename

router = APIRouter(tags=["redaction"])
settings = get_settings()


@router.post("/redact")
async def redact_upload(
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile, File(...)],
    confidence_threshold: float = Query(default=settings.model_confidence, ge=0.01, le=0.99),
    profile: str = "government",
    redaction_mode: str | None = None,
    active_classes: str | None = None,
    disabled_classes: str | None = None,
    use_runtime_policy: bool = False,
    document_tta: bool = True,
    tta_angles: str = "0,180",
    guardrail_enabled: bool = True,
    guardrail_mode: str = "precision_demo",
) -> dict[str, Any]:
    if not detector.loaded:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Model not loaded: {detector.load_error or 'missing model'}")

    validate_image_filename(file.filename)
    original_bytes = await file.read()
    image = read_image_bytes_to_cv2(original_bytes)
    filename = file.filename or "upload.jpg"
    dynamic_injection = None

    if use_runtime_policy:
        policy = load_runtime_policy()
        confidence_threshold = float(policy["confidence_threshold"])
        profile = str(policy["profile"])
        redaction_mode = str(policy["redaction_mode"])
        active_classes = ",".join(policy["active_classes"])
        disabled_classes = ",".join(policy["disabled_classes"])
        label_text = str(policy.get("label_text") or "REDACTED")
        dynamic_injection = {"enabled": True, "policy": policy}
    else:
        label_text = "REDACTED"

    rule = get_redaction_rule(profile)
    mode = validate_redaction_mode(redaction_mode or rule.mode)
    active = build_active_classes(rule.active_classes, active_classes, disabled_classes)
    prediction = robust_predict_with_tta(detector, image, confidence_threshold, tta_angles=tta_angles) if document_tta and profile == "government" else detector.predict(image, confidence_threshold)
    try:
        normalized_guardrail_mode = validate_guardrail_mode(guardrail_mode)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not guardrail_enabled:
        normalized_guardrail_mode = "off"
    guardrail = apply_false_positive_guardrail(
        image=image,
        detections=prediction["detections"],
        guardrail_mode=normalized_guardrail_mode,
        profile=profile,
        active_classes=active,
    )
    # KTP authenticity heuristics — run on the original image, before redaction hides the card.
    ktp_authenticity = analyze_detections(image, prediction["detections"], run_ocr=True)
    redaction = redact_image(image, guardrail["validated_detections"], mode=mode, active_classes=active, label_enabled=rule.label_enabled, label_text=label_text)

    record_id = f"rec_{uuid.uuid4().hex}"
    upload_session_id = f"upl_{uuid.uuid4().hex}"
    redacted_file = save_redacted_image_to_operational_zone(redaction["image"], filename, record_id)
    detected_classes = sorted({item["class_name"] for item in prediction["detections"]})
    metadata_file = save_operational_metadata({
        "record_id": record_id,
        "upload_session_id": upload_session_id,
        "original_filename": filename,
        "redacted_file": redacted_file,
        "redaction_profile": profile,
        "redaction_mode": mode,
        "active_classes": active,
        "confidence_threshold": confidence_threshold,
        "detection_count": prediction["detection_count"],
        "redacted_count": redaction["redacted_count"],
        "latency_ms": prediction["latency_ms"],
        "detected_classes": detected_classes,
        "false_positive_guardrail": {
            "enabled": normalized_guardrail_mode != "off",
            "mode": normalized_guardrail_mode,
            "validation_summary": guardrail["validation_summary"],
            "rejected_count": len(guardrail["rejected_detections"]),
        },
        "stores_private_original_in_operational_zone": False,
    })

    OperationalMetadataRepository(db).add(OperationalMetadata(
        record_id=record_id,
        upload_session_id=upload_session_id,
        original_filename=filename,
        redacted_filename=redacted_file["filename"],
        redacted_path=redacted_file["path"],
        redaction_profile=profile,
        redaction_mode=mode,
        active_classes_json=json.dumps(active),
        confidence_threshold=confidence_threshold,
        detection_count=prediction["detection_count"],
        redacted_count=redaction["redacted_count"],
        latency_ms=prediction["latency_ms"],
        detected_classes_json=json.dumps(detected_classes),
        stores_private_original_in_operational_zone=False,
    ))
    vault_record, vault_bundle = encrypt_original_for_vault(db, record_id, upload_session_id, filename, original_bytes)
    create_audit_log(db, record_id, "Operational Zone", "redacted_output_created", "system", "Redacted output created", {"redacted_file": redacted_file})
    create_audit_log(db, record_id, "Sovereign Vault", "encrypted_original_stored", "system", "Encrypted original stored", {"key_version": vault_record.key_version})
    if guardrail["rejected_detections"]:
        create_audit_log(
            db,
            record_id,
            "AI Guardrail",
            "false_positive_guardrail_applied",
            "system",
            "Rejected suspicious hand-drawn or non-authentic detections before redaction.",
            {
                "guardrail_mode": normalized_guardrail_mode,
                "rejected_count": len(guardrail["rejected_detections"]),
                "validation_summary": guardrail["validation_summary"],
            },
        )
    if dynamic_injection:
        create_audit_log(db, record_id, "Dynamic Injection", "runtime_policy_applied", "system", "Runtime policy applied to redaction", dynamic_injection)
    flagged_ktp = [item for item in ktp_authenticity if item["verdict"] in ("suspicious", "likely_fake")]
    if flagged_ktp:
        create_audit_log(
            db,
            record_id,
            "Operational Zone",
            "ktp_authenticity_flagged",
            "system",
            f"{len(flagged_ktp)} KTP detection(s) flagged by authenticity heuristics",
            {"flagged": [{"verdict": i["verdict"], "fake_likelihood": i["fake_likelihood"], "signals": i["signals"]} for i in flagged_ktp]},
        )
    db.commit()

    return {
        "record_id": record_id,
        "upload_session_id": upload_session_id,
        "filename": filename,
        "image_shape": get_image_shape(image),
        "redaction_policy": {
            "profile": profile,
            "mode": mode,
            "active_classes": active,
            "label_enabled": rule.label_enabled,
            "label_text": label_text,
            "guardrail_enabled": normalized_guardrail_mode != "off",
            "guardrail_mode": normalized_guardrail_mode,
            "guardrail_note": "False positive guardrail is post-processing only. The YOLO model is not retrained.",
        },
        "dynamic_injection": dynamic_injection,
        "robustness": prediction.get("robustness"),
        "confidence_threshold": confidence_threshold,
        "device": prediction["device"],
        "latency_ms": prediction["latency_ms"],
        "detection_count": prediction["detection_count"],
        "redacted_count": redaction["redacted_count"],
        "detected_classes": detected_classes,
        "detections": guardrail["detections"],
        "redacted_detections": redaction["redacted_detections"],
        "skipped_detections": redaction["skipped_detections"] + guardrail["rejected_detections"],
        "rejected_detections": guardrail["rejected_detections"],
        "validation_summary": guardrail["validation_summary"],
        "ktp_authenticity": ktp_authenticity,
        "operational_zone": {"redacted_file": redacted_file, "metadata_file": metadata_file, "stores_private_original": False},
        "sovereign_vault": {"encrypted": True, "key_id": vault_record.key_id, "key_version": vault_record.key_version, "encrypted_bundle_path": vault_record.encrypted_bundle_path, "original_sha256": vault_bundle["original_sha256"], "plaintext_stored": False},
    }
