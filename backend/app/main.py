from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings

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


@app.get("/")
def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "model_loaded": False,
        "model_exists": settings.model_exists,
        "device": settings.model_device,
        "operational_zone": "ready" if settings.operational_redacted_dir.exists() else "missing",
        "sovereign_vault": "ready" if settings.vault_encrypted_original_dir.exists() else "missing",
    }
