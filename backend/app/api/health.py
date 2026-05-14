import hashlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
        "version": "0.1.0",
    }


@router.get("/health/model")
def model_health() -> dict[str, object]:
    settings = get_settings()
    model_path = Path(settings.model_path)
    exists = model_path.exists()
    result: dict[str, object] = {
        "model_path": str(model_path),
        "exists": exists,
        "framework": "ultralytics",
    }
    if not exists:
        return result

    digest = hashlib.sha256()
    with model_path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    stat = model_path.stat()
    result.update(
        {
            "sha256": digest.hexdigest(),
            "file_size_bytes": stat.st_size,
            "last_modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        }
    )
    return result
