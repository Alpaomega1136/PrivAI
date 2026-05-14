# PrivAI - Government-First Visual Privacy Firewall

PrivAI adalah aplikasi privacy firewall visual berbasis AI untuk mendeteksi dan meredaksi data identitas sensitif pada gambar dokumen dan kamera. Sistem ini dirancang untuk skenario Smart Governance/Public Service: data sensitif diproses secara lokal, hasil redaksi disimpan di Operational Zone, dan file original disimpan terenkripsi di Sovereign Vault.

Project ini berjalan lokal tanpa cloud API, tanpa retraining model, dan tanpa mengirim dokumen pengguna ke layanan eksternal.

## Ringkasan Fitur

| Area | Fitur | Keterangan |
|---|---|---|
| User Zone | Redaksi dokumen | Upload gambar, jalankan YOLO lokal, redaksi visual, lihat hasil redacted. |
| AI Detection | Local YOLO inference | Model `.pt` lokal dari `backend/models`. Tidak ada retraining. |
| AI Guardrail | False-positive/authenticity guardrail | Post-processing untuk membedakan dokumen resmi vs gambar tangan/sketsa/palsu. |
| Operational Zone | Redacted storage | Menyimpan hanya file redacted dan metadata non-private. Original tidak disimpan plaintext. |
| Sovereign Vault | Encrypted original storage | Original dienkripsi dengan AES-256-GCM dan DEK dibungkus RSA-OAEP-SHA256. |
| Government Access | Controlled original access | Request, approval, one-time token, secure download original, token hanya sekali pakai. |
| Dynamic Policy | Runtime policy | Ubah confidence, mode redaksi, class aktif, dan label tanpa restart backend. |
| Audit Log | Security trace | Mencatat event penting seperti vault encryption, access approval, guardrail reject, dan runtime policy. |
| Live Camera | Secondary track | Backend camera MJPEG stream dengan redaksi ephemeral. Frame tidak disimpan. |

## Class Deteksi

Class canonical yang dipakai sistem:

| Class | Deskripsi |
|---|---|
| `KTP` | Kartu Tanda Penduduk. |
| `SIM` | Surat Izin Mengemudi. |
| `Paspor` | Dokumen paspor. |
| `NIK_Teks` | Teks/nomor identitas NIK. |
| `Wajah` | Wajah pada dokumen atau kamera. |
| `Plat_Nomor` | Plat nomor kendaraan. |

## Arsitektur Keamanan

```text
User Zone
  -> Local YOLO inference
  -> False-positive/authenticity guardrail
  -> Visual redaction
  -> Operational Zone: redacted image + non-private metadata
  -> Sovereign Vault: encrypted original bundle
  -> Government Access API: controlled original decryption
  -> Audit Log: security event trail
```

Prinsip utama:

- Original image tidak disimpan plaintext di Operational Zone.
- Original image hanya masuk Sovereign Vault dalam bentuk encrypted bundle.
- Private key vault tidak dikirim ke frontend/user zone.
- One-time access token tidak disimpan plaintext di database.
- Runtime policy divalidasi sebagai konfigurasi, bukan kode yang dieksekusi.
- Guardrail adalah post-processing, bukan retraining model.

## Teknologi

### Backend

- Python 3.11+
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
- easyocr optional untuk OCR guardrail/authenticity check

### Frontend

- React
- TypeScript
- Vite
- Lucide React
- Vite HTTPS dev server dengan `@vitejs/plugin-basic-ssl`

### Storage Lokal

- Database: `backend/storage/privai.db`
- Redacted files: `backend/storage/operational_zone/redacted/`
- Operational metadata: `backend/storage/operational_zone/metadata/`
- Encrypted original: `backend/storage/sovereign_vault/encrypted_original/`
- Simulated vault keys: `backend/storage/sovereign_vault/keys_simulated/`
- Runtime policy: `backend/storage/config/runtime_policy.json`

## Struktur Folder Penting

```text
PrivAI/
  backend/
    app/
      ai/                  # YOLO runtime, detector, class map
      api/                 # FastAPI routers
      core/                # config, redaction policy, runtime policy
      db/                  # SQLAlchemy models and repositories
      services/            # redaction, vault, access, audit, guardrail, live
      utils/               # image, file, hash, time utilities
    certs/                 # local HTTPS certs, pem ignored by git
    datasets/hard_negatives/ # validation set only, not for training
    models/                # local YOLO .pt model files
    storage/               # runtime data, database, vault, redacted output
    requirements.txt
    .env.example
  frontend/
    src/
      App.tsx              # main SPA views
      lib/api.ts           # API client
      styles.css
      multi-select.css
    .env.development       # Vite proxy target
    vite.config.ts
    package.json
  doc/
  SPECIFICATION.md
  README.md
```

## Model YOLO

Default expected model path:

```text
backend/models/privai_epoch50.pt
```

Fallback yang didukung oleh backend saat ini:

```text
backend/models/model_deteksi.pt
```

Jika model tidak ada, backend tetap bisa hidup, tetapi `/api/redact` dan live inference akan mengembalikan error karena model belum loaded.

Cek status model:

```powershell
curl.exe -k https://127.0.0.1:8000/api/model-info
```

## HTTPS Lokal

Project saat ini diset agar frontend dan backend sama-sama berjalan via HTTPS.

Backend HTTPS:

```text
https://127.0.0.1:8000
```

Frontend HTTPS:

```text
https://localhost:5173
```

Sertifikat lokal berada di:

```text
backend/certs/localhost-cert.pem
backend/certs/localhost-key.pem
```

File `.pem` di-ignore oleh git. Jika sertifikat belum ada, generate dengan:

```powershell
cd D:\PrivAI\backend
openssl req -x509 -newkey rsa:2048 -nodes `
  -keyout certs\localhost-key.pem `
  -out certs\localhost-cert.pem `
  -days 365 `
  -subj "/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Karena sertifikat self-signed, browser akan menampilkan peringatan keamanan. Untuk development lokal, lanjutkan melalui pilihan Advanced/Proceed.

## Menjalankan Backend

```powershell
cd D:\PrivAI\backend

py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 `
  --ssl-keyfile .\certs\localhost-key.pem `
  --ssl-certfile .\certs\localhost-cert.pem
```

Cek backend:

```powershell
curl.exe -k https://127.0.0.1:8000/api/health
curl.exe -k https://127.0.0.1:8000/api/model-info
```

Swagger docs:

```text
https://127.0.0.1:8000/docs
```

## Menjalankan Frontend

```powershell
cd D:\PrivAI\frontend
npm install
npm run dev
```

Buka:

```text
https://localhost:5173
```

Frontend memakai proxy Vite untuk `/api/*`.

File konfigurasi:

```text
frontend/.env.development
```

Isi saat ini:

```env
VITE_API_PROXY_TARGET=https://127.0.0.1:8000
```

Jika mengubah `.env.development`, restart `npm run dev` karena Vite hanya membaca env saat startup.

## Environment Backend

Contoh konfigurasi ada di:

```text
backend/.env.example
```

Contoh minimal:

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

CORS_ORIGINS=https://localhost:5173,https://127.0.0.1:5173
```

Jika membuat file `backend/.env`, pastikan CORS memakai `https://`, bukan `http://`.

## Endpoint Utama

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Status backend, model, storage, database. |
| GET | `/api/model-info` | Info path model, loaded status, class list. |
| GET | `/api/redaction-config` | Profile, mode, dan class redaction. |
| POST | `/api/redact` | Upload gambar dan jalankan pipeline redaksi government. |
| GET | `/api/files/redacted/{filename}` | Ambil hasil redacted image. |
| GET | `/api/storage/records` | Daftar Operational Zone records. |
| GET | `/api/crypto/key-info` | Info active vault key tanpa private key. |
| POST | `/api/crypto/rotate-vault-key` | Rotasi RSA vault key. |
| GET | `/api/vault/records/{record_id}` | Metadata encrypted original, tanpa plaintext. |
| GET | `/api/runtime-policy` | Lihat Dynamic Policy. |
| PUT | `/api/runtime-policy` | Update Dynamic Policy. |
| POST | `/api/runtime-policy/reset` | Reset Dynamic Policy. |
| POST | `/api/government/access-requests` | Buat request akses original. |
| POST | `/api/government/access-requests/{request_id}/approve` | Approve request dan issue one-time token. |
| GET | `/api/government/access-requests/{request_id}` | Cek status request. |
| GET | `/api/government/access-requests/{request_id}/secure-original` | Download original dengan one-time token. |
| GET | `/api/audit-logs` | Daftar audit log. |
| POST | `/api/live/redact-frame` | Redaksi satu frame ephemeral. |
| POST | `/api/live/turbo/start` | Start backend camera MJPEG stream. |
| POST | `/api/live/turbo/stop` | Stop live stream. |
| GET | `/api/live/turbo/status` | Status live stream. |
| GET | `/api/live/turbo/mjpeg` | Stream MJPEG redacted output. |

## Redaction Pipeline

Urutan `/api/redact`:

```text
1. Validate upload image
2. Decode image with OpenCV
3. Resolve runtime/manual policy
4. YOLO local inference
5. Optional document TTA for government upload
6. False-positive/authenticity guardrail
7. Redact only validated detections
8. Save redacted image to Operational Zone
9. Save original encrypted bundle to Sovereign Vault
10. Save database metadata
11. Write audit logs
12. Return redaction response
```

Response penting:

```json
{
  "record_id": "rec_...",
  "validation_summary": {},
  "detections": [],
  "redacted_detections": [],
  "skipped_detections": [],
  "rejected_detections": [],
  "operational_zone": {},
  "sovereign_vault": {}
}
```

## False-Positive / Authenticity Guardrail

Guardrail adalah layer post-processing setelah YOLO, sebelum redaction. Tujuannya membedakan dokumen resmi dari gambar tangan/sketsa/palsu di atas kertas.

Guardrail tidak melakukan retraining, tidak mengganti model, dan tidak memakai cloud API.

Class group:

| Group | Class |
|---|---|
| Official documents | `KTP`, `SIM`, `Paspor` |
| Sensitive text | `NIK_Teks` |
| Face | `Wajah` |

Query parameter:

```text
guardrail_enabled=true
guardrail_mode=precision_demo
```

Mode:

| Mode | Perilaku |
|---|---|
| `precision_demo` | Detection suspicious/rejected tidak ikut diredaksi dan masuk `rejected_detections`. Default government upload. |
| `privacy_first` | Detection suspicious tetap diredaksi, tetapi diberi status warning. |
| `off` | Guardrail dimatikan, perilaku lama. |

Field tambahan per detection:

```json
{
  "validation_status": "rejected_suspicious_handdrawn",
  "validation_score": 0.31,
  "validation_reason": ["low_official_keyword_score"],
  "guardrail_action": "skip_redaction"
}
```

Hard-negative validation set:

```text
backend/datasets/hard_negatives/
```

Folder ini untuk benchmark false positive, bukan training.

## Dynamic Policy

Runtime policy disimpan di:

```text
backend/storage/config/runtime_policy.json
```

Contoh field:

```json
{
  "policy_name": "Default Government Policy",
  "confidence_threshold": 0.35,
  "profile": "government",
  "redaction_mode": "black_box",
  "active_classes": ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"],
  "disabled_classes": [],
  "label_text": "REDACTED",
  "updated_at": "2026-05-14T18:23:59+07:00"
}
```

Dynamic Policy adalah konfigurasi tervalidasi. Tidak ada `eval` dan tidak ada eksekusi kode dinamis.

## Government Access Flow

1. Upload dokumen melalui `/api/redact` dan ambil `record_id`.
2. Buat access request dengan government token.
3. Approver menyetujui request dengan approver token.
4. Backend mengembalikan one-time token sekali saja.
5. Gunakan token untuk secure original download.
6. Token ditandai `used` dan tidak bisa dipakai ulang.
7. Semua event dicatat ke audit log.

Demo token default:

```text
GOVERNMENT_TOKEN=privai-government-demo-token
APPROVER_TOKEN=privai-approver-demo-token
CRYPTO_ADMIN_TOKEN=privai-crypto-admin-demo-token
```

## Live Camera Track

Live camera adalah secondary track dan bersifat ephemeral.

- Backend membuka kamera lokal berdasarkan `camera_index`.
- Output MJPEG ditampilkan di frontend.
- Frame tidak disimpan ke Operational Zone.
- Frame tidak masuk Sovereign Vault.
- Default active class live adalah `Wajah`, tetapi UI dapat memilih class lain untuk demo.

Endpoint utama:

```text
POST /api/live/turbo/start
POST /api/live/turbo/stop
GET  /api/live/turbo/status
GET  /api/live/turbo/mjpeg
```

## Waktu dan Timezone

Backend mengirim timestamp dalam WIB (`Asia/Jakarta`, UTC+07:00). Contoh:

```text
2026-05-14T18:23:59+07:00
```

Frontend juga memformat tanggal dengan timezone `Asia/Jakarta` dan menampilkan label `WIB`.

## Contoh Test Manual

Health:

```powershell
curl.exe -k https://127.0.0.1:8000/api/health
```

Model info:

```powershell
curl.exe -k https://127.0.0.1:8000/api/model-info
```

Redact image:

```powershell
curl.exe -k -X POST "https://127.0.0.1:8000/api/redact?profile=government&guardrail_mode=precision_demo" `
  -F "file=@D:\Lomba\sample\test.jpg"
```

Runtime policy:

```powershell
curl.exe -k https://127.0.0.1:8000/api/runtime-policy
```

Audit logs:

```powershell
curl.exe -k "https://127.0.0.1:8000/api/audit-logs?limit=20"
```

## Testing Guardrail

Gunakan dua tipe gambar:

| Test | Ekspektasi |
|---|---|
| Dokumen asli/realistic | Tetap diredaksi, `validation_status` umumnya `valid_document` atau `uncertain_document_kept`. |
| Gambar tangan KTP/SIM/Paspor di kertas | Dalam `precision_demo`, masuk `rejected_detections` dan tidak ikut redaction. |
| Tulisan NIK 16 digit | Jika OCR tersedia dan pola valid terbaca, tetap diredaksi sebagai sensitive text. |
| Catatan random/pensil tanpa pola identitas | Harus cenderung rejected/skipped, bukan dianggap dokumen resmi. |

Cek response:

```text
validation_summary
rejected_detections
detections[].validation_status
detections[].guardrail_action
```

## Troubleshooting

### Frontend masih proxy ke 8010

Pastikan:

```text
frontend/.env.development
```

berisi:

```env
VITE_API_PROXY_TARGET=https://127.0.0.1:8000
```

Lalu restart Vite:

```powershell
cd D:\PrivAI\frontend
Ctrl + C
npm run dev
```

### Browser menolak sertifikat

Buka backend docs sekali:

```text
https://127.0.0.1:8000/docs
```

Lalu accept self-signed certificate di browser.

### Backend HTTPS tidak hidup

Pastikan menjalankan uvicorn dengan SSL:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 `
  --ssl-keyfile .\certs\localhost-key.pem `
  --ssl-certfile .\certs\localhost-cert.pem
```

### Model tidak loaded

Cek file model:

```text
backend/models/privai_epoch50.pt
backend/models/model_deteksi.pt
```

Cek API:

```powershell
curl.exe -k https://127.0.0.1:8000/api/model-info
```

### Timestamp bukan WIB

Restart backend setelah update. Response API baru harus mengandung `+07:00`.

## Catatan Development

- Jangan commit file model `.pt` jika ukurannya besar atau sensitif.
- Jangan commit `backend/storage/` karena berisi data runtime.
- Jangan commit private key/cert `.pem` di `backend/certs/`.
- Guardrail dapat dituning lewat threshold di `backend/app/services/false_positive_guardrail.py` tanpa retraining.
- Untuk hackathon demo, gunakan `guardrail_mode=precision_demo` pada upload dokumen government.
