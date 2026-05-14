# PrivAI

PrivAI adalah Visual Firewall lokal untuk mendeteksi dan meredaksi data privasi seperti KTP, SIM, Paspor, NIK, wajah, dan plat nomor tanpa mengirim data sensitif ke cloud.

## Quick Start Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Frontend: http://localhost:5173
Backend API: http://localhost:8000/docs
Health check: http://localhost:8000/api/health
Model integrity: http://localhost:8000/api/health/model

## Struktur Utama

```text
backend/   FastAPI, model runtime, data lokal
frontend/  React + Vite UI
config/    runtime.yaml hot-reloadable config
doc/       dokumen proposal
research/  artefak riset non-runtime
scripts/   helper scripts
```

