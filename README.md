# PrivAI

PrivAI adalah aplikasi **government-first visual privacy firewall** untuk mendeteksi dan meredaksi data identitas sensitif pada dokumen dan live camera feed. Aplikasi ini dibuat untuk skenario Smart Governance/Public Service: data diproses oleh backend sendiri, hasil redaksi masuk Operational Zone, original disimpan terenkripsi di Sovereign Vault, dan akses original dikontrol lewat Government Access API.

PrivAI tidak melakukan retraining model saat runtime, tidak memakai MySQL/MinIO untuk MVP, dan tidak memanggil external cloud AI API untuk proses deteksi. Deployment cloud hanya dipakai sebagai hosting aplikasi.

## Status Online

Aplikasi sudah berjalan online di Azure Container Apps.

| Komponen | URL |
|---|---|
| Frontend | `https://privai-frontend.orangebeach-03038aed.southeastasia.azurecontainerapps.io` |
| Backend | `https://privai-backend.orangebeach-03038aed.southeastasia.azurecontainerapps.io` |
| Backend health | `https://privai-backend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/api/health` |
| Backend docs | `https://privai-backend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/docs` |
| Frontend proxied health | `https://privai-frontend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/api/health` |

Deployment saat ini:

| Resource | Nilai |
|---|---|
| Resource group | `rg-privai-demo` |
| Container Apps environment | `env-privai-demo` |
| ACR | `acrprivairaymond2026.azurecr.io` |
| Backend image | `acrprivairaymond2026.azurecr.io/privai-backend:latest` |
| Frontend image | `acrprivairaymond2026.azurecr.io/privai-frontend:latest` |
| Backend Container App | `privai-backend` |
| Frontend Container App | `privai-frontend` |

Catatan: Azure Static Web Apps tidak dipakai karena policy subscription memblokir region yang tersedia untuk resource type tersebut. Frontend dideploy sebagai container nginx di Azure Container Apps.

## Fitur Utama

| Area | Fungsi |
|---|---|
| User Zone | Upload dokumen, drag and drop, pilih performance mode, jalankan deteksi dan redaksi. |
| AI Detection | YOLO `.pt` lokal melalui Ultralytics. Model tidak diretrain saat runtime. |
| Performance Mode | `fast`, `balanced`, `robust` untuk memilih tradeoff kecepatan vs verifikasi. |
| Per-Class Confidence | Threshold dapat berbeda per class seperti `Wajah`, `NIK_Teks`, `KTP`, `SIM`, `Paspor`, `Plat_Nomor`. |
| Authenticity Guardrail | Layer post-processing untuk mengurangi false positive dari gambar tangan/sketsa dokumen. |
| Operational Zone | Menyimpan output redacted dan metadata non-private. Tidak menyimpan original plaintext. |
| Sovereign Vault | Menyimpan original sebagai encrypted bundle AES-256-GCM dengan DEK dibungkus RSA-OAEP-SHA256. |
| Key Rotation | Rotasi key vault untuk upload baru, key lama tetap dipertahankan untuk record lama. |
| Government Access | Request, approval, one-time token, secure original download, token sekali pakai. |
| Dynamic Injection | Runtime policy tervalidasi untuk profile, mode redaksi, active class, disabled class, threshold, dan label. |
| Audit Log | Jejak event keamanan untuk redaksi, vault, policy, government access, dan key rotation. |
| Live Stream Track | Secondary track untuk redaksi frame/live camera secara ephemeral. |

## Class Deteksi

Class canonical yang digunakan:

| Class | Keterangan |
|---|---|
| `KTP` | Kartu Tanda Penduduk. |
| `SIM` | Surat Izin Mengemudi. |
| `Paspor` | Paspor. |
| `NIK_Teks` | Nomor identitas atau teks NIK. |
| `Wajah` | Wajah pada dokumen atau frame kamera. |
| `Plat_Nomor` | Plat nomor kendaraan. |

Default confidence per class berada di `backend/app/core/config.py`.

```python
DEFAULT_CLASS_CONFIDENCE = {
    "KTP": 0.35,
    "SIM": 0.35,
    "Paspor": 0.35,
    "NIK_Teks": 0.30,
    "Wajah": 0.25,
    "Plat_Nomor": 0.35,
}
```

## Arsitektur Alur Data

```text
User Zone
  -> local YOLO inference
  -> performance preset / TTA if enabled
  -> authenticity and false-positive guardrail
  -> visual redaction
  -> Operational Zone stores redacted output + non-private metadata
  -> Sovereign Vault stores encrypted original bundle
  -> Government Access API controls original download
  -> Audit Log records security events
```

Prinsip keamanan:

- Original image tidak disimpan plaintext di Operational Zone.
- Original image hanya disimpan dalam encrypted bundle di Sovereign Vault.
- Private key tidak pernah dikirim ke frontend.
- One-time token government access tidak disimpan plaintext di database.
- Runtime policy hanya konfigurasi tervalidasi, bukan kode yang dieksekusi.
- Guardrail adalah post-processing, bukan retraining model.

## Struktur Folder

```text
PrivAI/
  backend/
    app/
      ai/                  # YOLO detector, runtime loader, class map
      api/                 # FastAPI routers
      core/                # config, redaction policy, runtime policy
      db/                  # SQLAlchemy database, models, repositories
      services/            # redaction, vault, access, audit, guardrail, live stream
      utils/               # image, file, hash, time utilities
    models/                # YOLO .pt model
    storage/               # SQLite DB, redacted output, vault bundle, keys, policy
    datasets/hard_negatives/ # validation/benchmark only, not training
    requirements.txt
    Dockerfile
    .env.example
  frontend/
    src/
      components/
      layouts/
      lib/api.ts           # API client
      views/               # User and Government pages
      styles.css
    assets/
    Dockerfile
    nginx.conf
    vite.config.ts
    package.json
  doc/
  research/
  scripts/
  docker-compose.yml
  README.md
```

## Tech Stack

Backend:

- Python 3.11
- FastAPI
- Uvicorn
- SQLAlchemy
- SQLite
- Ultralytics YOLO
- OpenCV
- NumPy
- Pillow
- cryptography
- pydantic / pydantic-settings
- python-dotenv
- EasyOCR for OCR-capable guardrail validation

Frontend:

- React
- TypeScript
- Vite
- Lucide React
- CSS custom styling
- nginx for production container serving

Deployment:

- Azure Container Apps
- Azure Container Registry
- Docker

## Model YOLO

Default expected model path:

```text
backend/models/privai_epoch50.pt
```

Fallback yang didukung backend:

```text
backend/models/model_deteksi.pt
```

Jika model belum tersedia, backend tetap bisa hidup. Endpoint `/api/health` dan `/api/model-info` akan menunjukkan `model_loaded=false` atau `model_loading=true`, sedangkan endpoint yang butuh inference akan mengembalikan error service unavailable sampai model siap.

Cek status model:

```powershell
curl.exe http://127.0.0.1:8000/api/model-info
```

Untuk online:

```powershell
curl.exe https://privai-backend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/api/model-info
```

## Menjalankan Lokal

### Backend Lokal

```powershell
cd D:\PrivAI\backend

py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Cek backend:

```powershell
curl.exe http://127.0.0.1:8000/api/health
curl.exe http://127.0.0.1:8000/api/model-info
```

Swagger docs lokal:

```text
http://127.0.0.1:8000/docs
```

### Frontend Lokal

```powershell
cd D:\PrivAI\frontend
npm install
npm run dev
```

Buka:

```text
http://localhost:5173
```

Frontend development memakai Vite proxy. File konfigurasi:

```text
frontend/.env.development
```

Isi saat ini:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

Jika `.env.development` diubah, restart `npm run dev`.

## Menjalankan Dengan Docker Compose Lokal

```powershell
cd D:\PrivAI
docker compose up --build
```

Default local docker URL:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
Docs:     http://localhost:8000/docs
```

Catatan penting untuk Docker Compose lokal: jika `frontend/.env.production` berisi backend Azure, build production frontend akan mengarah ke backend Azure. Untuk full local Docker Compose, kosongkan atau sesuaikan `VITE_API_BASE_URL` sebelum build image frontend.

## Environment Backend

Contoh env ada di:

```text
backend/.env.example
```

Isi penting:

```env
APP_NAME=PrivAI
API_HOST=127.0.0.1
API_PORT=8000

MODEL_PATH=./models/privai_epoch50.pt
MODEL_CONFIDENCE=0.35
MODEL_DEVICE=cpu

DATABASE_URL=sqlite:///./storage/privai.db

GOVERNMENT_TOKEN=privai-government-demo-token
APPROVER_TOKEN=privai-approver-demo-token
CRYPTO_ADMIN_TOKEN=privai-crypto-admin-demo-token

RUNTIME_POLICY_PATH=./storage/config/runtime_policy.json

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Untuk online Azure, backend CORS sudah ditambahkan agar menerima frontend:

```text
https://privai-frontend.orangebeach-03038aed.southeastasia.azurecontainerapps.io
```

## Environment Frontend

Development:

```text
frontend/.env.development
```

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

Production build untuk Azure:

```text
frontend/.env.production
```

```env
VITE_API_BASE_URL=https://privai-backend.orangebeach-03038aed.southeastasia.azurecontainerapps.io
```

Frontend production juga memiliki fallback proxy di nginx untuk `/api`, `/docs`, dan `/openapi.json` ke backend Azure.

## Endpoint Utama

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Status backend, model, storage, database. |
| GET | `/api/model-info` | Info model, path efektif, status loaded/loading, class list. |
| GET | `/api/redaction-config` | Profile, redaction mode, dan class canonical. |
| POST | `/api/redact` | Upload gambar dan jalankan pipeline redaksi. |
| GET | `/api/files/redacted/{filename}` | Ambil hasil gambar redacted. |
| GET | `/api/storage/records` | Operational Zone registry. |
| GET | `/api/crypto/key-info` | Info active vault key tanpa private key. |
| POST | `/api/crypto/rotate-vault-key` | Rotasi key vault. |
| GET | `/api/vault/records/{record_id}` | Metadata encrypted original, tanpa plaintext. |
| GET | `/api/runtime-policy` | Lihat runtime policy Dynamic Injection. |
| PUT | `/api/runtime-policy` | Update runtime policy. |
| POST | `/api/runtime-policy/reset` | Reset runtime policy default. |
| POST | `/api/government/access-requests` | Buat request akses original. |
| POST | `/api/government/access-requests/{request_id}/approve` | Approve request dan issue one-time token. |
| GET | `/api/government/access-requests/{request_id}` | Cek status request akses. |
| GET | `/api/government/access-requests/{request_id}/secure-original` | Download original dengan one-time token. |
| GET | `/api/audit-logs` | Daftar audit log. |
| POST | `/api/live/redact-frame` | Redaksi satu frame ephemeral. |
| POST | `/api/live/turbo/start` | Start backend live camera session. |
| POST | `/api/live/turbo/stop` | Stop live camera session. |
| GET | `/api/live/turbo/status` | Status live camera session. |
| GET | `/api/live/turbo/mjpeg` | Stream MJPEG hasil redaksi. |

## Redaction Pipeline

Endpoint utama:

```text
POST /api/redact
```

Pipeline:

```text
1. Validate image upload
2. Decode image with OpenCV
3. Resolve manual policy or Dynamic Injection runtime policy
4. Apply Performance Mode settings
5. Run YOLO inference
6. Optional document rotation TTA
7. Apply authenticity / false-positive guardrail
8. Redact validated detections
9. Save redacted output to Operational Zone
10. Encrypt original into Sovereign Vault
11. Save SQLite metadata
12. Write audit logs
13. Return response to frontend
```

Query parameter penting:

| Parameter | Default | Keterangan |
|---|---|---|
| `profile` | `government` | Redaction profile. |
| `performance_mode` | `fast` | `fast`, `balanced`, atau `robust`. |
| `confidence_threshold` | `0.35` | Fallback confidence global. |
| `redaction_mode` | profile default | `black_box`, `blur`, atau `pixelate`. |
| `active_classes` | profile default | CSV class yang aktif. |
| `disabled_classes` | empty | CSV class yang dimatikan. |
| `use_runtime_policy` | `false` | Pakai Dynamic Injection policy. |
| `document_tta` | `true` | Rotation TTA untuk dokumen. Effective value bisa di-override performance mode. |
| `tta_angles` | mode dependent | Contoh `0,180` atau `0,90,180,270`. |
| `guardrail_enabled` | `true` | Aktifkan false-positive guardrail. |
| `guardrail_mode` | mode dependent | `precision_demo`, `privacy_first`, atau `off`. |
| `authenticity_ocr` | `false` | OCR guardrail, terutama untuk robust validation. |

## Performance Mode

| Mode | Perilaku | Cocok Untuk |
|---|---|---|
| `fast` | 1x inference, no TTA, no OCR, guardrail ringan. | Demo cepat. |
| `balanced` | TTA `0,180`, no OCR default. | Dokumen normal dan upside-down. |
| `robust` | TTA lebih lengkap, OCR-capable guardrail. | Verifikasi dokumen sulit. |

Response `/api/redact` memiliki `timing` breakdown seperti `total_ms`, `inference_ms`, `guardrail_ms`, `redaction_ms`, `storage_ms`, dan `vault_ms` untuk melihat bottleneck.

## Authenticity Guardrail

Guardrail dipakai setelah YOLO dan sebelum redaction untuk mengurangi false positive dari gambar tangan atau sketsa di atas kertas.

Mode:

| Mode | Perilaku |
|---|---|
| `precision_demo` | Detection suspicious dapat masuk `rejected_detections` dan tidak diredaksi sebagai dokumen resmi. |
| `privacy_first` | Detection suspicious tetap diredaksi, tetapi diberi status validasi. |
| `off` | Guardrail dimatikan. |

Field tambahan detection:

```json
{
  "validation_status": "rejected_suspicious_handdrawn",
  "validation_score": 0.31,
  "validation_reason": ["low_official_keyword_score"],
  "guardrail_action": "skip_redaction"
}
```

Hard-negative validation set dapat diletakkan di:

```text
backend/datasets/hard_negatives/
```

Folder tersebut untuk benchmark dan kalibrasi guardrail, bukan training.

## Dynamic Injection

Dynamic Injection di PrivAI adalah runtime policy yang tervalidasi. Tidak ada `eval` dan tidak ada eksekusi kode arbitrer.

File policy runtime:

```text
backend/storage/config/runtime_policy.json
```

Field utama:

```json
{
  "policy_name": "Default Government Policy",
  "confidence_threshold": 0.35,
  "class_confidence_threshold": {
    "KTP": 0.35,
    "SIM": 0.35,
    "Paspor": 0.35,
    "NIK_Teks": 0.30,
    "Wajah": 0.25,
    "Plat_Nomor": 0.35
  },
  "profile": "government",
  "redaction_mode": "black_box",
  "active_classes": ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"],
  "disabled_classes": [],
  "label_text": "REDACTED",
  "injection_note": "Default policy"
}
```

Frontend menyediakan UI untuk memilih class aktif, class disabled, mode redaksi, threshold, dan reset policy.

## Operational Zone

Operational Zone menyimpan:

```text
backend/storage/operational_zone/redacted/
backend/storage/operational_zone/metadata/
```

Yang disimpan:

- gambar hasil redaksi
- metadata proses non-private
- URL preview redacted output

Yang tidak boleh disimpan:

- original plaintext
- private key
- raw one-time token

## Sovereign Vault

Sovereign Vault menyimpan encrypted original bundle di:

```text
backend/storage/sovereign_vault/encrypted_original/
```

Key simulasi disimpan di:

```text
backend/storage/sovereign_vault/keys_simulated/
```

Skema:

```text
Original bytes
  -> random DEK per upload
  -> AES-256-GCM encrypt original
  -> RSA-OAEP-SHA256 wrap DEK
  -> store encrypted JSON bundle
```

Key rotation:

- membuat key version baru
- key baru dipakai untuk upload berikutnya
- key lama tetap disimpan agar record lama masih bisa didekripsi lewat flow resmi
- private key tidak dikirim ke frontend

## Government Access Flow

1. Upload dokumen dan ambil `record_id`.
2. Buat access request dengan `GOVERNMENT_TOKEN`.
3. Approver menyetujui dengan `APPROVER_TOKEN`.
4. Backend mengembalikan one-time access token sekali saja.
5. Gunakan token untuk secure original download.
6. Token ditandai `used` dan tidak bisa digunakan ulang.
7. Audit log mencatat request, approval, dan authorized decryption.

Demo token default:

```text
GOVERNMENT_TOKEN=privai-government-demo-token
APPROVER_TOKEN=privai-approver-demo-token
CRYPTO_ADMIN_TOKEN=privai-crypto-admin-demo-token
```

## Live Stream Track

Live Stream adalah secondary track.

Endpoint:

```text
POST /api/live/redact-frame
POST /api/live/turbo/start
POST /api/live/turbo/stop
GET  /api/live/turbo/status
GET  /api/live/turbo/mjpeg
```

Catatan deployment online: backend Azure berjalan di cloud, sehingga tidak bisa memakai webcam laptop lokal melalui `camera_index`. Fitur backend camera lebih cocok untuk demo lokal. Untuk online, gunakan upload/document flow atau frame-based endpoint jika frontend mengirim frame dari browser.

## Audit Log

Audit log mencatat event seperti:

- `vault_key_initialized`
- `vault_key_rotated`
- `redacted_output_created`
- `encrypted_original_stored`
- `runtime_policy_updated`
- `runtime_policy_reset`
- `runtime_policy_applied`
- `access_request_created`
- `access_request_approved`
- `authorized_original_decryption`
- `false_positive_guardrail_applied`
- `performance_mode_applied`

Endpoint:

```text
GET /api/audit-logs?limit=50
```

Filter yang didukung:

```text
record_id
zone
event_type
limit
```

## Waktu dan Timezone

Backend menggunakan utilitas waktu WIB (`Asia/Jakarta`, UTC+07:00). Frontend juga menampilkan tanggal dengan label WIB.

## Contoh Test Manual

Health online:

```powershell
curl.exe https://privai-frontend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/api/health
curl.exe https://privai-backend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/api/health
```

Health lokal:

```powershell
curl.exe http://127.0.0.1:8000/api/health
```

Upload redaction lokal:

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/redact?profile=government&performance_mode=fast" `
  -F "file=@D:\PrivAI\sample\test.jpg"
```

Runtime policy:

```powershell
curl.exe http://127.0.0.1:8000/api/runtime-policy
```

Audit logs:

```powershell
curl.exe "http://127.0.0.1:8000/api/audit-logs?limit=20"
```

## Azure Redeploy Commands

Login ACR:

```powershell
az acr login --name acrprivairaymond2026
```

Build dan push frontend:

```powershell
cd D:\PrivAI\frontend

docker build -t acrprivairaymond2026.azurecr.io/privai-frontend:latest .
docker push acrprivairaymond2026.azurecr.io/privai-frontend:latest

$suffix = "fe" + (Get-Date -Format "HHmmss")
az containerapp update `
  --name privai-frontend `
  --resource-group rg-privai-demo `
  --image acrprivairaymond2026.azurecr.io/privai-frontend:latest `
  --revision-suffix $suffix
```

Build dan push backend:

```powershell
cd D:\PrivAI\backend

docker build -t acrprivairaymond2026.azurecr.io/privai-backend:latest .
docker push acrprivairaymond2026.azurecr.io/privai-backend:latest

$suffix = "be" + (Get-Date -Format "HHmmss")
az containerapp update `
  --name privai-backend `
  --resource-group rg-privai-demo `
  --image acrprivairaymond2026.azurecr.io/privai-backend:latest `
  --revision-suffix $suffix
```

Update CORS backend jika URL frontend berubah:

```powershell
az containerapp update `
  --name privai-backend `
  --resource-group rg-privai-demo `
  --set-env-vars CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,https://privai-frontend.orangebeach-03038aed.southeastasia.azurecontainerapps.io"
```

## Troubleshooting

### Frontend online terbuka tapi API gagal

Cek health lewat frontend origin:

```powershell
curl.exe https://privai-frontend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/api/health
```

Jika error nginx, cek log frontend:

```powershell
az containerapp logs show `
  --name privai-frontend `
  --resource-group rg-privai-demo `
  --tail 80
```

### Backend online tidak respons

```powershell
az containerapp logs show `
  --name privai-backend `
  --resource-group rg-privai-demo `
  --tail 120
```

### CORS error di browser

Pastikan backend env `CORS_ORIGINS` mengandung URL frontend yang dipakai browser.

### Model belum loaded

Cek:

```powershell
curl.exe https://privai-backend.orangebeach-03038aed.southeastasia.azurecontainerapps.io/api/model-info
```

Jika `model_loading=true`, tunggu beberapa saat. Jika `load_error` muncul, cek model path dan log backend.

### Data hilang setelah redeploy cloud

MVP memakai SQLite dan local filesystem storage. Untuk production yang perlu durable storage, gunakan persistent volume seperti Azure Files atau database managed. Untuk hackathon demo, storage lokal container cukup selama lifecycle demo, tetapi tidak boleh dianggap sebagai production retention.

## Catatan Keamanan MVP

- Ini adalah MVP hackathon, bukan sistem production-ready untuk dokumen negara sungguhan.
- Private key disimpan dalam local simulated vault. Production harus memakai HSM/KMS non-exportable.
- Token demo default harus diganti jika dipakai di environment publik.
- SQLite/local filesystem cukup untuk demo, tetapi production perlu storage dan database yang durable serta access control yang lebih ketat.
- Dataset hard-negative dipakai untuk validasi false positive, bukan retraining.