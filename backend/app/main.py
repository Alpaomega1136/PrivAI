from typing import Annotated

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_database_path, get_db, init_db
from app.services.audit_service import list_audit_logs

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Government-first local visual privacy firewall API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health() -> dict[str, object]:
    database_path = get_database_path()
    return {
        "status": "ok",
        "app": settings.app_name,
        "model_loaded": False,
        "model_exists": settings.model_exists,
        "device": settings.model_device,
        "operational_zone": "ready" if settings.operational_redacted_dir.exists() else "missing",
        "sovereign_vault": "ready" if settings.vault_encrypted_original_dir.exists() else "missing",
        "database": "ready" if database_path and database_path.exists() else "pending_startup",
    }


@app.get("/api/audit-logs")
def get_audit_logs(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    record_id: str | None = None,
    zone: str | None = None,
    event_type: str | None = None,
) -> dict[str, object]:
    logs = list_audit_logs(
        db=db,
        limit=limit,
        record_id=record_id,
        zone=zone,
        event_type=event_type,
    )
    return {
        "logs": logs,
        "count": len(logs),
        "filters": {
            "limit": limit,
            "record_id": record_id,
            "zone": zone,
            "event_type": event_type,
        },
    }
