# PrivAI — Visual Privacy Firewall

PrivAI adalah sistem firewall privasi visual lokal berbasis AI yang mendeteksi dan meredaksi data identitas sensitif (KTP, SIM, Paspor, NIK, wajah, plat nomor) secara real-time — tanpa mengirimkan data ke cloud.

---

## Fitur Utama

| Fitur | Keterangan |
|---|---|
| Redaksi Dokumen | Upload gambar, deteksi AI lokal (YOLO), redaksi blur/pixelate/black box |
| Live Stream Privacy | Kamera browser (ephemeral) + Turbo Live MJPEG dari kamera backend |
| Sovereign Vault | Original dienkripsi AES-256-GCM + RSA-OAEP, tidak pernah disimpan di zone publik |
| Akses Pemerintah | Alur dua-pihak (pemohon + penyetuju) dengan one-time token |
| Dynamic Policy | Konfigurasi runtime confidence/mode/kelas tanpa restart |
| Audit Log | Jejak seluruh aktivitas keamanan per zona |

---

## Prasyarat

- Python 3.10+
- Node.js 18+
- Model file `models/model_deteksi.pt` (atau `models/privai_epoch50.pt`) di folder `backend/`
- (Opsional) Docker + Docker Compose untuk deployment container

---

## Menjalankan Secara Manual (Development)

### 1. Backend

```powershell
cd d:\PrivAI\backend

# Buat virtual environment (sekali saja)
python -m venv .venv

# Aktifkan venv
.venv\Scripts\Activate.ps1

# Install dependencies (sekali saja)
pip install -r requirements.txt

# Jalankan server
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

Backend tersedia di:
- API: `http://127.0.0.1:8010`
- Docs: `http://127.0.0.1:8010/docs`
- Health: `http://127.0.0.1:8010/api/health`

### 2. Frontend

```powershell
cd d:\PrivAI\frontend

# Install dependencies (sekali saja)
npm install

# Jalankan dev server (HTTPS aktif untuk akses kamera)
npm run dev
```

Frontend tersedia di:
- `https://localhost:5174/`
- `https://<IP-lokal>:5174/` (untuk akses dari perangkat lain di jaringan)

> **Catatan HTTPS:** Browser akan menampilkan peringatan sertifikat tidak tepercaya (self-signed). Klik **Advanced → Proceed anyway** untuk melanjutkan. HTTPS diperlukan agar akses kamera (`getUserMedia`) bekerja dari semua origin.

---

## Menjalankan dengan Docker

```powershell
cd d:\PrivAI
Copy-Item .env.example .env   # sesuaikan jika perlu
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000/docs |
| Health Check | http://localhost:8000/api/health |

---

## Struktur Proyek

```text
PrivAI/
├── backend/
│   ├── app/
│   │   ├── ai/           # YOLO detector & class map
│   │   ├── api/          # FastAPI routers (live, redact, vault, gov, audit, …)
│   │   ├── core/         # Config, redaction policy, runtime policy
│   │   ├── db/           # SQLAlchemy models & repositories
│   │   ├── services/     # Business logic (redaction, vault, live turbo, …)
│   │   └── utils/        # Image utils, file utils, hash utils
│   ├── models/           # Model YOLO (.pt) — tidak di-commit ke repo
│   ├── storage/          # Data runtime (DB, vault, operational zone) — gitignored
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # Single-page UI (semua view)
│   │   └── lib/api.ts    # API client & type definitions
│   ├── vite.config.ts    # Dev server HTTPS + proxy ke backend :8010
│   └── Dockerfile
├── config/
│   └── runtime.yaml
├── doc/
└── docker-compose.yml
```

---

## Konfigurasi

### Environment Variables Backend (`.env`)

```env
API_HOST=0.0.0.0
API_PORT=8010
MODEL_PATH=./models/model_deteksi.pt
MODEL_DEVICE=cpu
DATABASE_URL=sqlite:///./storage/privai.db
CORS_ORIGINS=https://localhost:5174,https://127.0.0.1:5174
GOVERNMENT_TOKEN=privai-government-demo-token
APPROVER_TOKEN=privai-approver-demo-token
CRYPTO_ADMIN_TOKEN=privai-crypto-admin-demo-token
```

### Vite Proxy

Frontend mem-proxy semua request `/api/*` ke backend di `http://127.0.0.1:8010` secara otomatis — tidak perlu konfigurasi CORS tambahan untuk development.

---

## Live Stream

### Browser Webcam (Ephemeral)
- Kamera dibuka langsung di browser
- Frame dikirim ke backend, hasil redaksi dikembalikan sebagai base64
- Frame **tidak disimpan** ke Operational Zone maupun Vault
- Membutuhkan HTTPS atau `localhost` agar `getUserMedia` tersedia

### Turbo Live (Backend Camera)
- Backend membuka kamera fisik langsung (index 0 secara default)
- Output dikirim sebagai MJPEG stream ke `<img>` tag di frontend
- Inference & redaksi berjalan di backend thread terpisah
- Cocok untuk kamera yang terhubung ke mesin backend (bukan browser)

---

## Zona Keamanan

```
User Zone          →  upload dokumen, lihat hasil redaksi
        ↓
Operational Zone   →  hanya file redacted + metadata non-sensitif
        ↓
Sovereign Vault    →  original terenkripsi, private key tidak pernah keluar
        ↓
Government Access  →  alur dua-pihak + one-time token untuk dekripsi
```

---

## Stack Teknologi

| Layer | Teknologi |
|---|---|
| Backend | FastAPI, Uvicorn, SQLAlchemy (SQLite), Pydantic |
| AI | Ultralytics YOLO, OpenCV, NumPy |
| Enkripsi | Python `cryptography` (AES-256-GCM + RSA-OAEP-SHA256) |
| Frontend | React 19, TypeScript, Vite 6 |
| Dev HTTPS | `@vitejs/plugin-basic-ssl` |
| Container | Docker, Docker Compose |
