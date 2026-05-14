# Menjalankan PrivAI dengan Docker

Setup ini membungkus **backend** (FastAPI + YOLO + OpenCV + EasyOCR) dan
**frontend** (Vite build, disajikan oleh nginx) menjadi dua container yang siap
dijalankan di mana saja — cukup butuh Docker.

## Prasyarat
- Docker Desktop / Docker Engine + Docker Compose v2 (`docker compose ...`).

## Menjalankan

```bash
# dari folder root projek (d:\PrivAI)
docker compose up --build
```

- Build pertama lama (~5–15 menit) karena mengunduh PyTorch + dependency AI.
- Setelah jalan:
  - Aplikasi   → http://localhost:5173
  - API docs   → http://localhost:8000/docs

Menghentikan: `Ctrl+C`, lalu `docker compose down`.
Menjalankan lagi (tanpa rebuild): `docker compose up`.

## Konfigurasi (opsional)

Salin `.env.example` menjadi `.env` di folder root untuk mengubah port atau token:

```bash
cp .env.example .env
```

## Arsitektur container

```
browser ──▶ frontend (nginx :80)  ──proxy /api/*──▶  backend (uvicorn :8000)
                  │                                        │
            static SPA bundle                       YOLO · OpenCV · EasyOCR
                                                     SQLite · Sovereign Vault
```

Frontend memanggil `/api/*` di origin-nya sendiri; nginx mem-proxy-kan ke
service `backend`. Jadi tidak ada masalah CORS dan tidak perlu tahu URL backend.

## Data persisten

Disimpan di Docker named volumes (tetap ada walau container di-recreate):

| Volume | Isi |
|---|---|
| `privai-storage` | SQLite DB, Sovereign Vault, Operational Zone, runtime policy |
| `privai-easyocr` | Cache model EasyOCR (biar tidak diunduh ulang) |

Reset total data: `docker compose down -v` (menghapus volume).

## Mengganti model AI

Model `backend/models/model_deteksi.pt` ikut dibangun ke dalam image. Untuk
mengganti model: timpa file itu lalu `docker compose build backend`. Atau mount
folder model sebagai volume di `docker-compose.yml`.

## Catatan
- Image berjalan **CPU-only**. Untuk GPU perlu NVIDIA Container Toolkit dan
  penyesuaian compose (`deploy.resources.devices`) — belum dikonfigurasi di sini.
- Folder `privai/` di root adalah salinan scaffold lama dengan Docker file
  terpisah — tidak dipakai oleh setup ini dan bisa dihapus.
