# PrivAI Guard — Specification Document

**Versi Dokumen:** 1.0
**Tanggal:** Mei 2026
**Tim:** TIMOREX
**Kompetisi:** FindIT! 2026 — Hackathon Track A (Edge Vision)
**Status:** Master Specification for 24-Hour Hackathon Implementation

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Konteks dan Latar Belakang](#2-konteks-dan-latar-belakang)
3. [Tujuan dan Sasaran](#3-tujuan-dan-sasaran)
4. [Ruang Lingkup (Scope)](#4-ruang-lingkup-scope)
5. [Stakeholder dan Pengguna](#5-stakeholder-dan-pengguna)
6. [Arsitektur Sistem](#6-arsitektur-sistem)
7. [Kebutuhan Fungsional](#7-kebutuhan-fungsional)
8. [Kebutuhan Non-Fungsional](#8-kebutuhan-non-fungsional)
9. [Spesifikasi Teknis Detail](#9-spesifikasi-teknis-detail)
10. [Data Models dan Skema Basis Data](#10-data-models-dan-skema-basis-data)
11. [API Specification](#11-api-specification)
12. [Dynamic Injection Strategy](#12-dynamic-injection-strategy)
13. [MVP Component Breakdown](#13-mvp-component-breakdown)
14. [User Journey dan Demo Scenarios](#14-user-journey-dan-demo-scenarios)
15. [Implementation Plan](#15-implementation-plan)
16. [Repository Structure](#16-repository-structure)
17. [Risk Register dan Mitigation](#17-risk-register-dan-mitigation)
18. [Testing Strategy](#18-testing-strategy)
19. [Deliverables dan Acceptance Criteria](#19-deliverables-dan-acceptance-criteria)
20. [Appendix](#20-appendix)

---

## 1. Ringkasan Eksekutif

**PrivAI Guard** adalah aplikasi *Visual Firewall* berbasis kecerdasan buatan yang melakukan intersepsi cerdas antara kamera/input visual pengguna dengan platform layanan publik atau privat. Sistem ini mendeteksi enam kategori data sensitif (KTP, SIM, Paspor, NIK Teks, Wajah Pihak Ketiga, dan Plat Nomor Kendaraan) secara *real-time* di perangkat lokal pengguna, kemudian menerapkan redaksi visual untuk versi publik sambil mengenkripsi data asli dalam *Sovereign Vault* lokal yang hanya bisa dibuka oleh pejabat berwenang.

Solusi ini menjawab tema kompetisi **"Digital Sovereignty: Empowering National Resilience with Adaptive Intelligence"** dengan menempatkan dirinya sebagai infrastruktur kedaulatan data pribadi—mencegah kebocoran identitas di sumbernya, tanpa mengirim data sensitif ke server pihak ketiga.

Aplikasi dirancang dengan filosofi *Zero-Trust Edge Computing*: seluruh inferensi AI dan enkripsi dieksekusi murni di *localhost*, tanpa ketergantungan pada *cloud*. Model AI yang digunakan adalah YOLO11n hasil pelatihan Tahap 2 dengan ukuran 5.3 MB, *recall* 96.66%, dan latensi inferensi ~200-300 ms pada CPU standar.

Untuk memenuhi tantangan **Dynamic Injection** di Tahap 3, arsitektur aplikasi dibangun dengan pendekatan *config-driven* di mana seluruh perilaku kunci (kelas deteksi, kebijakan redaksi, format audit, ambang kepercayaan) di-eksternalisasi ke berkas konfigurasi YAML yang dapat di-*hot-reload* tanpa menghentikan layanan.

---

## 2. Konteks dan Latar Belakang

### 2.1 Konteks Masalah

Indonesia berada di puncak hiper-konektivitas digital dengan 212 juta pengguna internet aktif dan 143 juta identitas media sosial. Namun, paradoks fundamental muncul: kuantitas konektivitas tidak diiringi literasi keamanan digital. Survei APJII 2024 menunjukkan 66.82% pengguna tidak memahami manajemen kata sandi, dan kekhawatiran terhadap penipuan daring melonjak dari 10.3% menjadi 32.5% dalam setahun.

Dua sumber kebocoran data identitas utama:

1. **Keteledoran Individual (Oversharing)** — Lebih dari 84% pengguna mengunggah informasi pribadi mingguan, dengan 42% di antaranya membagikan detail sensitif termasuk dokumen identitas legal (KTP, SIM, Paspor) tanpa sensor.

2. **Kegagalan Struktural Sentralistik** — Insiden ransomware Pusat Data Nasional (Juni 2024) dan kebocoran 4.7 juta data ASN dari BKN menunjukkan cacat mendasar paradigma data tersentralisasi yang menciptakan *single point of failure*.

### 2.2 Mengapa Solusi Ini Diperlukan

Solusi konvensional (Google Vision API, AWS Rekognition) menawarkan akurasi tinggi namun **mewajibkan eksfiltrasi data sensitif ke server luar negeri**, secara langsung melanggar UU PDP No. 27 Tahun 2022 dan prinsip kedaulatan data nasional.

PrivAI Guard mengisi gap ini sebagai satu-satunya alternatif yang:
- Beroperasi **100% offline** di perangkat lokal
- Mengkompres model AI hingga 5.3 MB sehingga dapat berjalan di CPU loket pemerintahan
- Mengenkripsi data asli dengan AES-256-GCM lokal sehingga server jebol = data tetap aman
- Memberikan *audit trail* lengkap untuk kepatuhan UU PDP

### 2.3 Pemosisian Produk

| Aspek | PrivAI Guard | Cloud API Konvensional |
|---|---|---|
| Lokasi Inferensi | Localhost (Edge) | Server pihak ketiga |
| Kedaulatan Data | Penuh | Hilang saat upload |
| Latensi | 200-300 ms | 500-2000 ms (network-dependent) |
| Biaya | Sekali bayar (license/SaaS) | Per-request (bisa membengkak) |
| Compliance UU PDP | Patuh penuh | Berpotensi melanggar |
| Offline Capability | Ya | Tidak |

---

## 3. Tujuan dan Sasaran

### 3.1 Tujuan Strategis (Strategic Goals)

**G1. Membangun MVP fungsional dalam 24 jam** yang mampu mendemonstrasikan seluruh pipeline: Detect → Redact → Encrypt → Store → Audit.

**G2. Memenuhi 100% kriteria penilaian Tahap 3** dengan distribusi bobot:
- AI Judge (Live Inference, Integrity, Optimization, Tech Defense)
- Software Engineering Judge (Integration, Dynamic Adaptability, Tech/UI, Architecture Clarity)
- Product Management Judge (Augmenting, UX, Storytelling, Viability)

**G3. Membuktikan klaim teknis Tahap 2** yaitu *recall* 96.66%, latensi <300 ms, ukuran <50 MB, dan operasi penuh di CPU tanpa cloud.

**G4. Menangani Dynamic Injection** yang akan diumumkan panitia di awal Tahap 3 dengan respon yang elegan tanpa refactoring kode mayor.

### 3.2 Sasaran Spesifik (Specific Objectives)

| ID | Sasaran | Metrik Keberhasilan |
|---|---|---|
| O1 | Live camera detection beroperasi *real-time* | ≥ 25 FPS, latensi ≤ 400 ms |
| O2 | Upload batch processing | 10 dokumen dalam ≤ 5 detik |
| O3 | Dual pipeline storage (Public DMZ + Sovereign Vault) | Dapat diverifikasi via filesystem inspection |
| O4 | Enkripsi data asli AES-256-GCM | Verifikasi via decrypt test |
| O5 | Audit log lengkap | Setiap aksi tercatat dengan trace_id |
| O6 | Privacy Risk Score real-time | Update setiap deteksi, akurat menggambarkan risiko |
| O7 | Config hot-reload | Perubahan YAML berlaku tanpa restart |
| O8 | Demo storytelling preset | 3 skenario auto-playable |
| O9 | Virtual camera integration | Muncul sebagai opsi kamera di Google Meet/Zoom |
| O10 | Dokumentasi repo lengkap | README, ARCHITECTURE.md, INJECTION_POINTS.md tersedia |

### 3.3 Pemetaan ke Kriteria Penilaian

#### A. AI Judge

| Kriteria | Bobot | Bagaimana Dipenuhi |
|---|---|---|
| Live Inference Quality | 30% | Demo webcam real-time dengan FPS + latency display permanen di UI |
| Integrity & Konsistensi | 25% | Endpoint `/api/health/model` menampilkan SHA256 dan params count untuk verifikasi model identik dengan Tahap 2 |
| Optimasi Integrasi | 25% | Resource monitor menunjukkan konsumsi RAM/CPU saat inference; benchmarking script |
| Pertahanan Teknis (Q&A) | 20% | FAQ document tertulis dengan 15+ pertanyaan + jawaban + bukti |

#### B. Software Engineering Judge

| Kriteria | Bobot | Bagaimana Dipenuhi |
|---|---|---|
| Integrasi & Alur Sistem | 30% | API contract jelas, WebSocket untuk live stream, dual pipeline visualizer di UI |
| Adaptabilitas Dinamis | 30% | Config-driven YAML, hot reload endpoint, plugin folders untuk detector/validator/preprocessor |
| Eksekusi Teknis & UI | 20% | Tailwind + shadcn/ui, responsive, error states lengkap |
| Kejelasan Arsitektur | 20% | ARCHITECTURE.md dengan diagram, README runnable dengan 1 command |

#### C. Product Management Judge

| Kriteria | Bobot | Bagaimana Dipenuhi |
|---|---|---|
| Esensi "Augmenting" | 30% | Narasi: "membebaskan pegawai sipil dari ketakutan human error"; demo skenario e-KYC |
| Pengalaman Pengguna | 25% | Onboarding singkat, feedback visual instan, error messaging dalam Bahasa Indonesia |
| Storytelling & Pitching | 25% | Pitch deck terstruktur (Crisis → Save → Sovereignty → Adaptation) |
| Viabilitas Solusi | 20% | Roadmap 12 bulan dari proposal, model bisnis B2G+B2B+B2C, analisis kompetitor |

---

## 4. Ruang Lingkup (Scope)

### 4.1 Yang Termasuk dalam Scope (In Scope)

**4.1.1 Fungsionalitas Inti**
- Live camera detection dengan WebRTC + WebSocket
- Upload single dan batch image/video
- Redaksi visual: blur, pixelate, black-box
- Enkripsi data asli AES-256-GCM
- Penyimpanan dual pipeline (redacted + encrypted vault)
- Audit logging end-to-end dengan trace_id
- Privacy Risk Score real-time
- Dynamic configuration via YAML

**4.1.2 Antarmuka Pengguna**
- 5 halaman utama (Beranda, Pemindai, Kamera Live, Brankas, Dasbor Audit)
- Dual mode kamera (Privacy + Inspector)
- Responsive design untuk laptop demo

**4.1.3 Integrasi dan Ekstensi**
- Virtual camera bridge (pyvirtualcam)
- Hot-reload configuration endpoint
- Plugin folders untuk extension points
- Export audit log ke CSV/JSON

**4.1.4 Dokumentasi**
- README.md (quick start)
- ARCHITECTURE.md (diagram + decisions)
- INJECTION_POINTS.md (untuk juri SE)
- API documentation (auto-generated FastAPI `/docs`)
- FAQ document untuk Q&A

### 4.2 Yang Tidak Termasuk dalam Scope (Out of Scope)

Penting untuk membatasi diri agar tidak terjebak dalam *scope creep* selama 24 jam:

- **Production-grade HSM integration** — disimulasikan dengan AES key di env (jelaskan di pitch)
- **HashiCorp Vault, Keycloak, Prometheus, Grafana** — disimulasikan di MVP, dijelaskan di roadmap
- **Mobile native app** — hanya browser-based responsive
- **Multi-tenant authentication** — single user untuk demo
- **Cloud deployment** — eksplisit dilarang panitia (localhost only)
- **Model retraining** — eksplisit dilarang panitia (model dari Tahap 2)
- **Real OCR engine** — sesuai proposal, deteksi murni visual (no Tesseract)
- **PDF export laporan** — opsional jika waktu sisa
- **Integrasi dengan platform spesifik (Zoom SDK, Meet API)** — hanya via virtual camera

---

## 5. Stakeholder dan Pengguna

### 5.1 Stakeholder Internal

| Peran | Tanggung Jawab | Anggota |
|---|---|---|
| AI Integration Engineer | Wrap YOLO model, inference optimization, benchmarking | TBD |
| Backend Engineer | FastAPI, middleware, dynamic injection adapter | TBD |
| Frontend Engineer | React UI, WebRTC, WebSocket, responsiveness | TBD |
| DevOps/Demo Engineer | Docker, virtual camera, demo stability | TBD |
| Product/Pitch Lead | Pitch deck, narasi, Q&A preparation | TBD |

### 5.2 Persona Pengguna Akhir

**Persona 1: Officer Loket Dukcapil (B2G)**
- Nama: Bapak Yusuf, 42 tahun
- Konteks: Melayani verifikasi e-KYC via video call
- Pain point: Khawatir tak sengaja menyaksikan/merekam data sensitif warga
- Goal: Verifikasi cepat tanpa risiko hukum

**Persona 2: Customer Service Bank (B2B)**
- Nama: Ibu Rina, 28 tahun
- Konteks: Verifikasi nasabah via video call untuk pembukaan rekening
- Pain point: Tekanan target + harus capture screenshot KTP secara aman
- Goal: Compliance OJK terjaga, produktivitas tetap tinggi

**Persona 3: Individu Privacy-Conscious (B2C)**
- Nama: Raymond, 21 tahun, mahasiswa
- Konteks: Sering konferensi online dan upload dokumen ke aplikasi
- Pain point: Sadar risiko oversharing tapi tidak punya tools
- Goal: Lapisan perlindungan otomatis tanpa effort ekstra

### 5.3 Juri Sebagai "Pengguna Pertama"

Saat demo, juri adalah *user* utama. Pengalaman mereka harus:
- Dalam **30 detik pertama**: paham masalah yang dipecahkan
- Dalam **2 menit pertama**: lihat demo end-to-end berjalan
- Dalam **5 menit pertama**: yakin teknologi-nya nyata, bukan smoke and mirrors
- Dalam **10 menit pertama**: bisa membayangkan adopsi skala nasional

---

## 6. Arsitektur Sistem

### 6.1 Diagram Arsitektur Tingkat Tinggi

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER DEVICE (LOCAL ONLY)                    │
│                                                                  │
│  ┌──────────────┐         ┌─────────────────────────────────┐  │
│  │   FRONTEND   │  HTTP/  │           BACKEND                │  │
│  │  (React+Vite)│ WebSock │      (FastAPI + Uvicorn)         │  │
│  │   :5173      ├────────►│           :8000                  │  │
│  └──────┬───────┘         │                                   │  │
│         │                 │  ┌─────────────────────────────┐ │  │
│         │                 │  │      AI Service Layer       │ │  │
│         │ WebRTC          │  │  - YOLO11n loader           │ │  │
│         │ (camera)        │  │  - Inference engine         │ │  │
│         │                 │  │  - Detection pipeline       │ │  │
│         │                 │  └──────────────┬──────────────┘ │  │
│         │                 │                 │                 │  │
│         │                 │  ┌──────────────▼──────────────┐ │  │
│         │                 │  │   Redaction Pipeline        │ │  │
│         │                 │  │  - Strategy selector        │ │  │
│         │                 │  │  - OpenCV operations        │ │  │
│         │                 │  └──────────────┬──────────────┘ │  │
│         │                 │                 │                 │  │
│         │                 │     ┌───────────┴───────────┐    │  │
│         │                 │     │                       │    │  │
│         │                 │  ┌──▼──────────┐  ┌────────▼─┐ │  │
│         │                 │  │  Public     │  │ Encryption│ │  │
│         │                 │  │  Output     │  │  Service  │ │  │
│         │                 │  │  (redacted) │  │ (AES-GCM) │ │  │
│         │                 │  └──┬──────────┘  └──────┬────┘ │  │
│         │                 │     │                    │      │  │
│         │                 │  ┌──▼────────────────────▼────┐ │  │
│         │                 │  │     Storage Layer          │ │  │
│         │                 │  │  - SQLite (metadata)       │ │  │
│         │                 │  │  - Filesystem (vault)      │ │  │
│         │                 │  │  - MinIO (optional)        │ │  │
│         │                 │  └────────────────────────────┘ │  │
│         │                 │                                   │  │
│         │                 │  ┌────────────────────────────┐  │  │
│         │                 │  │     Audit Service          │  │  │
│         │                 │  │  - Trace ID generator      │  │  │
│         │                 │  │  - Event chain logger      │  │  │
│         │                 │  └────────────────────────────┘  │  │
│         │                 └───────────────────────────────────┘  │
│         │                                                         │
│  ┌──────▼─────────────────────────────────────────────────────┐ │
│  │  Virtual Camera Bridge (Optional, pyvirtualcam)            │ │
│  │  - Exposes "PrivAI Camera" to OS                           │ │
│  │  - Routes safe stream to Zoom/Meet/etc.                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

           ↑ ZERO outbound network traffic for sensitive data ↑
```

### 6.2 Lapisan Arsitektur (Layered Architecture)

**Layer 1 — Presentation Layer (Frontend)**
- React + Vite + TypeScript
- Komunikasi dengan backend via REST (sync) + WebSocket (live stream)
- Komponen reusable dengan shadcn/ui
- State management: React Context + Zustand untuk global state

**Layer 2 — Application Layer (Backend Core)**
- FastAPI untuk routing dan validation
- Pydantic models untuk request/response
- Dependency injection untuk testability
- Middleware chain untuk authentication, logging, audit

**Layer 3 — Domain Services Layer**
- Detector Service (YOLO inference)
- Redactor Service (OpenCV operations)
- Encryptor Service (AES-256-GCM)
- Vault Service (storage abstraction)
- Audit Service (event chain)
- Risk Analyzer Service (scoring logic)
- Config Manager (YAML + hot reload)

**Layer 4 — Infrastructure Layer**
- SQLite (default) / MySQL (optional) for metadata
- Local filesystem (default) / MinIO (optional) for files
- File-based YAML configuration

**Layer 5 — Cross-cutting Concerns**
- Logging (structured JSON via `structlog`)
- Error handling (global exception handler)
- Configuration management (Pydantic Settings)
- Security (CORS, CSP headers)

### 6.3 Prinsip Desain (Design Principles)

**P1. Zero-Trust Local Processing**
Tidak ada satu byte pun data sensitif yang keluar dari mesin lokal. Inferensi, enkripsi, dan penyimpanan semuanya *on-device*.

**P2. Config-Driven Behavior**
Setiap perilaku yang berpotensi diubah oleh Dynamic Injection di-eksternalisasi ke YAML. Kode hanya berisi logic, bukan parameter.

**P3. Plugin-Based Extension**
Detector, validator, preprocessor, dan postprocessor menggunakan plugin pattern. Drop file baru ke folder yang ditentukan = ekstensi otomatis aktif.

**P4. Graceful Degradation**
Setiap komponen punya fallback. MinIO mati? Pakai filesystem. MySQL mati? Pakai SQLite. WebSocket gagal? Fallback ke REST polling.

**P5. Observable by Default**
Setiap operasi penting terlogging dengan structured logs + audit trail + metrics. Tidak ada "magic black box".

**P6. Demo-First Engineering**
Setiap fitur harus memikirkan: bagaimana ini ditunjukkan ke juri? Jika tidak ada answer, deprioritize.

---

## 7. Kebutuhan Fungsional

### 7.1 Prioritas Fitur

Klasifikasi menggunakan **MoSCoW**:
- **P0 (Must Have)** — wajib untuk MVP, tanpa ini demo gagal
- **P1 (Should Have)** — sangat meningkatkan demo, kerjakan jika P0 selesai
- **P2 (Could Have)** — polish, kerjakan jika ada sisa waktu
- **P3 (Won't Have This Time)** — dijelaskan di pitch sebagai roadmap

### 7.2 P0 — Must Have Features

#### F1. Live Camera Detection
**Deskripsi:** Pengguna mengaktifkan webcam, sistem mendeteksi objek sensitif *real-time* dan menampilkan dual-view (raw vs redacted).

**Kebutuhan:**
- Akses webcam via WebRTC `getUserMedia()`
- Streaming frame ke backend via WebSocket (target: 15-30 FPS)
- Backend mengembalikan: bounding boxes + redacted frame (base64) + latency
- UI menampilkan kedua view secara berdampingan
- Toggle kelas yang aktif (KTP/SIM/Paspor/NIK/Wajah/Plat)
- Toggle jenis redaksi (blur/pixelate/black-box)

**Acceptance Criteria:**
- ✓ Deteksi terlihat di kedua mode (Privacy & Inspector)
- ✓ FPS counter menunjukkan ≥ 15 FPS
- ✓ Latency end-to-end ≤ 400 ms (dari capture ke render)
- ✓ Toggle berfungsi tanpa restart stream

#### F2. Upload & Scan
**Deskripsi:** Pengguna upload gambar/video (single atau batch), sistem memprosesnya dan mengembalikan hasil.

**Kebutuhan:**
- Drag-drop atau click-to-upload
- Validasi format (JPG/PNG/MP4) dan ukuran (max 50 MB)
- Progress indicator
- Preview hasil dengan bounding box
- Download hasil redacted
- Simpan ke vault terenkripsi

**Acceptance Criteria:**
- ✓ Single upload: hasil < 2 detik
- ✓ Batch 10 file: hasil < 10 detik
- ✓ Hasil tersimpan dengan trace_id
- ✓ Audit log tercatat

#### F3. Dual Pipeline Storage
**Deskripsi:** Setiap dokumen menghasilkan dua artifact: versi redacted (public) dan versi terenkripsi (sovereign vault).

**Kebutuhan:**
- Penyimpanan terpisah secara logis (folder atau bucket terpisah)
- Versi redacted dapat diakses tanpa key
- Versi original hanya dapat dibuka dengan AES-256-GCM key
- Metadata tersimpan di SQLite

**Acceptance Criteria:**
- ✓ File ada di kedua lokasi setelah scan
- ✓ Original tidak bisa dibuka tanpa decrypt
- ✓ Verifikasi via test decrypt script

#### F4. Audit Logging
**Deskripsi:** Setiap aksi penting tercatat dengan trace_id, timestamp, actor, dan metadata.

**Kebutuhan:**
- Action types: UPLOAD, DETECT, REDACT, ENCRYPT, STORE, ACCESS_REQUEST, ACCESS_GRANTED, CONFIG_RELOAD
- Setiap document scan menghasilkan chain audit log (5-7 entries)
- Filterable di UI (by action, date, document)
- Exportable ke CSV/JSON

**Acceptance Criteria:**
- ✓ 1 scan = ≥ 5 audit entries dengan trace_id sama
- ✓ Audit page menampilkan log terbaru real-time
- ✓ Export CSV berfungsi

#### F5. Dynamic Configuration Engine
**Deskripsi:** Seluruh perilaku kritis dikontrol via YAML config. Endpoint hot-reload tanpa restart server.

**Kebutuhan:**
- File `config/runtime.yaml` sebagai source of truth
- Pydantic schema untuk validasi config
- Endpoint `POST /api/admin/reload-config` untuk hot reload
- UI panel untuk view config aktif
- Versioning config (simpan history di DB)

**Acceptance Criteria:**
- ✓ Edit YAML → reload → behavior berubah tanpa restart
- ✓ Config invalid → error message jelas, config lama tetap aktif
- ✓ Endpoint `GET /api/config` menampilkan config aktif

#### F6. Privacy Risk Score
**Deskripsi:** Skor 0-100 yang merangkum tingkat risiko privasi berdasarkan deteksi.

**Kebutuhan:**
- Algoritma: bobot per kelas × confidence × jumlah deteksi
- Update real-time saat live mode
- Breakdown alasan (kelas apa saja yang berkontribusi)
- Skala visual: 0-25 Aman, 26-50 Waspada, 51-75 Berisiko, 76-100 Kritis

**Acceptance Criteria:**
- ✓ Score 0 saat tidak ada deteksi sensitif
- ✓ Score 90+ saat KTP+wajah utama tertangkap
- ✓ Breakdown menunjukkan minimal 2 alasan

### 7.3 P1 — Should Have Features

#### F7. Virtual Camera Bridge
**Deskripsi:** PrivAI mendaftarkan diri sebagai sistem kamera virtual yang bisa dipilih di Zoom/Meet/OBS.

**Kebutuhan:**
- Integrasi library `pyvirtualcam`
- Mode: "Use as virtual camera" toggle di UI
- Output redacted stream ke virtual device
- Indikator status di system tray (jika feasible)

**Acceptance Criteria:**
- ✓ "PrivAI Camera" muncul di list kamera Google Meet
- ✓ Demo end-to-end: join meeting → KTP terdeteksi → blur sampai ke peserta lain

#### F8. Demo Storytelling Presets
**Deskripsi:** 3 skenario demo otomatis yang bisa dijalankan tanpa setup manual.

**Kebutuhan:**
- Preset 1: "Skenario e-KYC Dukcapil" — auto-play video pre-recorded
- Preset 2: "Batch Pelayanan Loket" — auto-load 8 sample documents
- Preset 3: "Live Webcam Demo" — switch ke kamera asli
- Tombol "Mulai Skenario" di Beranda

**Acceptance Criteria:**
- ✓ Setiap preset jalan dalam 1 klik
- ✓ Preset video terstandarisasi (durasi, isi, hasil)
- ✓ Backup demo jika webcam venue gagal

#### F9. Model Integrity Verification
**Deskripsi:** Endpoint dan UI footer yang membuktikan model sama dengan Tahap 2.

**Kebutuhan:**
- Endpoint `GET /api/health/model` return: SHA256, params count, file size, last modified
- Footer aplikasi menampilkan info ini
- Bisa di-screenshot oleh juri untuk verifikasi

**Acceptance Criteria:**
- ✓ Hash sesuai dengan model yang submitted Tahap 2
- ✓ Footer terlihat di semua halaman

#### F10. Performance Monitoring Panel
**Deskripsi:** Panel diagnostik yang menampilkan metrics sistem real-time.

**Kebutuhan:**
- CPU usage, RAM usage
- Inference FPS, average latency, peak latency
- Audit log throughput
- Endpoint `GET /api/metrics` dalam format Prometheus-compatible (untuk demo skalabilitas)

**Acceptance Criteria:**
- ✓ Panel terlihat di Inspector mode
- ✓ Metrics update setiap 1 detik
- ✓ Tidak menambah latency > 5%

### 7.4 P2 — Could Have Features

- **F11. Edge Case Gallery** — folder `demo/edge-cases/` dengan 7 gambar challenging untuk live Q&A
- **F12. Audit Log Enrichment** — IP address, User-Agent, geo-info (dummy)
- **F13. Bulk Export Report** — generate PDF audit report
- **F14. Configuration UI Editor** — edit YAML via UI dengan validation
- **F15. Trust & Security Page** — halaman publik menjelaskan arsitektur keamanan

### 7.5 P3 — Won't Have This Time (Jelaskan di Roadmap)

- Real HSM integration (Thales/NitroKey)
- HashiCorp Vault production
- Keycloak SSO
- Real Prometheus/Grafana cluster
- Mobile native app
- Kernel-level virtual camera driver
- Real-time facial recognition for identity verification

---

## 8. Kebutuhan Non-Fungsional

### 8.1 Performance Requirements

| Metrik | Target | Bagaimana Diukur |
|---|---|---|
| Inference latency (single image, CPU) | ≤ 300 ms | Backend log per request |
| End-to-end live latency | ≤ 400 ms | Frame timestamp diff |
| Live stream FPS | ≥ 15 FPS | Frontend FPS counter |
| API response time (non-AI endpoints) | ≤ 100 ms | FastAPI middleware |
| Frontend initial load | ≤ 2 seconds | Lighthouse |
| Batch processing (10 images) | ≤ 10 seconds | Wall clock |

### 8.2 Security Requirements

| Requirement | Implementasi |
|---|---|
| Data sensitif tidak meninggalkan device | No outbound HTTP calls (verified via netstat during demo) |
| Encryption at rest | AES-256-GCM untuk semua file di vault |
| Key separation | DEK per file, KEK terpisah di env var (simulating HSM) |
| Audit immutability | Audit log append-only, no UPDATE/DELETE |
| Input validation | Pydantic untuk semua endpoint |
| File upload security | Validate magic bytes, max size, scan extensions |
| CORS | Hanya allow `localhost:5173` |

### 8.3 Usability Requirements

- Bahasa: Bahasa Indonesia dengan istilah teknis asing dalam *italic*
- Aksesibilitas dasar: kontras warna sesuai WCAG AA
- Responsive: laptop demo (1920x1080) sebagai target utama, fungsional di tablet
- Error messaging: setiap error punya pesan ramah + saran tindakan
- Onboarding: home page menjelaskan dalam 30 detik

### 8.4 Reliability Requirements

- Sistem harus berjalan stabil selama minimal 4 jam tanpa restart
- Recovery dari kegagalan: jika model crash, sistem otomatis reload
- Tidak ada data loss saat hot reload config
- WebSocket auto-reconnect dengan exponential backoff

### 8.5 Maintainability Requirements

- Code coverage testing: target ≥ 60% untuk core services
- Linting: Black + Ruff untuk Python, ESLint + Prettier untuk TypeScript
- Documentation: setiap public function punya docstring
- Modular: setiap file ≤ 300 baris

### 8.6 Portability Requirements

- Berjalan di Linux (Ubuntu 22.04+), macOS (M1+), Windows (WSL2)
- Single command bootstrap: `docker compose up` atau `make run`
- Tidak boleh tergantung pada GPU (CPU-only inference wajib)

---

## 9. Spesifikasi Teknis Detail

### 9.1 Technology Stack

**Backend**
| Komponen | Pilihan | Justifikasi |
|---|---|---|
| Bahasa | Python 3.11+ | Ecosystem ML matang, FastAPI native |
| Framework | FastAPI | Async, auto OpenAPI docs, Pydantic |
| ASGI Server | Uvicorn | Default FastAPI, production-ready |
| ORM | SQLAlchemy 2.x | Mature, type-safe dengan Pydantic |
| Validation | Pydantic v2 | Strict typing, fast |
| AI Framework | PyTorch + Ultralytics | Model dari Tahap 2 |
| Image Processing | OpenCV (cv2) | Standard untuk redaction ops |
| Encryption | `cryptography` library | AES-GCM bawaan, well-audited |
| WebSocket | FastAPI WebSocket | Built-in, no extra dep |
| Logging | `structlog` | Structured JSON logs |
| Config | PyYAML + Pydantic Settings | YAML parsing + validation |
| Testing | pytest + httpx | Standard Python testing |

**Frontend**
| Komponen | Pilihan | Justifikasi |
|---|---|---|
| Framework | React 18 | Mature, well-known |
| Build Tool | Vite | Fast HMR, modern |
| Language | TypeScript | Type safety penting di hackathon |
| Styling | Tailwind CSS | Cepat untuk prototype |
| Components | shadcn/ui | Production-quality, copy-paste |
| Routing | React Router v6 | Standard |
| State | Zustand | Simpler dari Redux |
| HTTP Client | Axios | Familiar API |
| WebSocket | Native WebSocket API | No extra deps |
| Charts | Recharts | Untuk dashboard |
| Icons | Lucide React | Konsisten dengan shadcn |

**Infrastructure**
| Komponen | Pilihan | Justifikasi |
|---|---|---|
| Database (Primary) | SQLite | Zero-config, file-based |
| Database (Optional) | MySQL 8 | Untuk simulasi production |
| Object Storage (Primary) | Local Filesystem | Reliable, simple |
| Object Storage (Optional) | MinIO | Untuk simulasi S3-compatible |
| Container | Docker + Docker Compose | Reproducibility |
| Virtual Camera | pyvirtualcam | Cross-platform |

### 9.2 Folder Convention

```
privai-guard/
├── README.md                    # Quick start guide
├── ARCHITECTURE.md              # System architecture & decisions
├── INJECTION_POINTS.md          # Extension points untuk juri SE
├── FAQ.md                       # Q&A preparation
├── docker-compose.yml           # Optional MySQL+MinIO setup
├── Makefile                     # Common commands
├── .env.example                 # Environment template
├── config/
│   ├── runtime.yaml             # Main configuration (HOT RELOADABLE)
│   ├── runtime.schema.yaml      # JSON Schema for validation
│   └── presets/                 # Demo storytelling presets
│       ├── ekyc-scenario.yaml
│       ├── batch-scenario.yaml
│       └── live-scenario.yaml
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── config.py            # Settings loader
│   │   ├── dependencies.py      # DI setup
│   │   ├── api/                 # Route handlers
│   │   │   ├── scan.py
│   │   │   ├── documents.py
│   │   │   ├── dashboard.py
│   │   │   ├── audit.py
│   │   │   ├── health.py
│   │   │   ├── admin.py         # Config management
│   │   │   └── websocket.py     # Live stream handler
│   │   ├── services/            # Domain services
│   │   │   ├── detector.py
│   │   │   ├── redactor.py
│   │   │   ├── encryptor.py
│   │   │   ├── vault.py
│   │   │   ├── audit_service.py
│   │   │   ├── risk_analyzer.py
│   │   │   └── config_manager.py
│   │   ├── plugins/             # EXTENSION POINTS
│   │   │   ├── detectors/       # Drop new detector here
│   │   │   ├── validators/      # Drop new validator here
│   │   │   ├── preprocessors/   # Drop new preprocessor here
│   │   │   └── postprocessors/  # Drop new postprocessor here
│   │   ├── models/              # SQLAlchemy + Pydantic
│   │   │   ├── db_models.py
│   │   │   └── schemas.py
│   │   ├── middlewares/         # Cross-cutting
│   │   │   ├── audit_middleware.py
│   │   │   ├── cors.py
│   │   │   └── error_handler.py
│   │   └── utils/
│   │       ├── logger.py
│   │       └── crypto.py
│   ├── models/                  # AI model files
│   │   └── model_deteksi.pt     # FROM TAHAP 2 (do not retrain!)
│   ├── data/                    # Runtime data (gitignored)
│   │   ├── privai.db
│   │   ├── public-redacted/
│   │   └── sovereign-vault/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── PrivacyScanner.tsx
│   │   │   ├── LiveCamera.tsx
│   │   │   ├── GovernmentVault.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── components/
│   │   │   ├── ui/              # shadcn components
│   │   │   ├── ScannedImage.tsx
│   │   │   ├── DetectionBreakdown.tsx
│   │   │   ├── PrivacyScore.tsx
│   │   │   ├── RiskBadge.tsx
│   │   │   ├── UploadBox.tsx
│   │   │   ├── AuditLogList.tsx
│   │   │   ├── PerformancePanel.tsx
│   │   │   └── ConfigViewer.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useCamera.ts
│   │   │   └── usePrivacyScore.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   └── store/
│   │       └── globalStore.ts
│   ├── public/
│   │   └── demo-presets/        # Pre-recorded demo videos
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── demo/
│   ├── edge-cases/              # 7 challenging images
│   ├── presentation/
│   │   ├── pitch-deck.pdf
│   │   └── architecture-diagram.png
│   └── scripts/
│       ├── benchmark.py         # Performance benchmark
│       └── verify-model.py      # Model integrity check
└── scripts/
    ├── setup.sh                 # One-shot setup
    └── reset-db.sh
```

### 9.3 Environment Variables

```bash
# .env (loaded via Pydantic Settings)

# Application
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000

# AI
AI_MODE=real                    # 'real' or 'mock' — DEFAULT real, mock for emergency only
MODEL_PATH=./models/model_deteksi.pt
DEVICE=cpu                      # cpu or cuda
INFERENCE_THREADS=4

# Database
DB_BACKEND=sqlite               # sqlite or mysql
DB_PATH=./data/privai.db        # for sqlite
DB_URL=mysql+pymysql://...      # for mysql (optional)

# Storage
STORAGE_BACKEND=filesystem      # filesystem or minio
VAULT_PATH=./data/sovereign-vault
PUBLIC_PATH=./data/public-redacted
MINIO_ENDPOINT=localhost:9000   # optional
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...

# Encryption
KEK_BASE64=...                  # Master key — in production: from HSM

# Features
FEATURE_VIRTUAL_CAMERA=true
FEATURE_PRIVACY_SCORE=true
FEATURE_RECORDING=true

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Audit
AUDIT_RETENTION_DAYS=90
AUDIT_ENABLE_IP_LOGGING=true
```

---

## 10. Data Models dan Skema Basis Data

### 10.1 Entity Relationship Diagram (Logical)

```
┌─────────────────┐         ┌─────────────────┐
│    Document     │ 1     N │   Detection     │
│─────────────────│◄────────│─────────────────│
│ id (PK)         │         │ id (PK)         │
│ filename        │         │ document_id(FK) │
│ file_type       │         │ class_name      │
│ overall_risk    │         │ confidence      │
│ privacy_score   │         │ bbox (JSON)     │
│ inference_time  │         │ risk_level      │
│ status          │         │ created_at      │
│ trace_id        │         └─────────────────┘
│ created_at      │
└────────┬────────┘
         │
         │ 1
         │
         │ N
┌────────▼────────┐
│   AuditLog      │
│─────────────────│
│ id (PK)         │
│ trace_id        │
│ action          │
│ actor           │
│ resource_id(FK) │
│ metadata (JSON) │
│ ip_address      │
│ user_agent      │
│ timestamp       │
└─────────────────┘

┌─────────────────────────┐
│   ConfigVersion         │
│─────────────────────────│
│ id (PK)                 │
│ version (int)           │
│ config_yaml (text)      │
│ schema_version          │
│ activated_at            │
│ deactivated_at (null)   │
│ activated_by            │
└─────────────────────────┘

┌─────────────────────────┐
│   AccessRequest         │
│─────────────────────────│
│ id (PK)                 │
│ document_id (FK)        │
│ requester               │
│ reason                  │
│ status                  │ ('pending'/'approved'/'denied')
│ requested_at            │
│ resolved_at (null)      │
└─────────────────────────┘
```

### 10.2 SQLAlchemy Models (Python)

```python
# backend/app/models/db_models.py

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text, Index
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)  # 'image', 'video'
    file_size_bytes = Column(Integer, nullable=False)

    # Risk assessment
    overall_risk = Column(String(20), nullable=False)  # low/medium/high/critical
    privacy_score = Column(Integer, nullable=False)    # 0-100

    # Performance
    inference_time_ms = Column(Float, nullable=False)

    # Paths
    original_encrypted_path = Column(String(500))
    redacted_path = Column(String(500))

    # Metadata
    status = Column(String(20), nullable=False, default='processed')
    trace_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    detections = relationship("Detection", back_populates="document", cascade="all, delete-orphan")

class Detection(Base):
    __tablename__ = "detections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False)

    class_name = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    bbox = Column(JSON, nullable=False)  # [x1, y1, x2, y2]
    risk_level = Column(String(20), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="detections")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id = Column(String(36), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)
    actor = Column(String(100), nullable=False, default='system')
    resource_id = Column(String(36))
    metadata_json = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('idx_trace_action', 'trace_id', 'action'),
        Index('idx_timestamp_desc', 'timestamp'),
    )

class ConfigVersion(Base):
    __tablename__ = "config_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(Integer, nullable=False, unique=True)
    config_yaml = Column(Text, nullable=False)
    schema_version = Column(String(20), nullable=False)
    activated_at = Column(DateTime, default=datetime.utcnow)
    deactivated_at = Column(DateTime, nullable=True)
    activated_by = Column(String(100), default='admin')

class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False)
    requester = Column(String(100), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default='pending')
    requested_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
```

### 10.3 Action Types untuk Audit Log

| Action | Trigger | Metadata |
|---|---|---|
| `UPLOAD` | User upload file | `{filename, size, type}` |
| `DETECT` | AI inference complete | `{classes_found, total_count, inference_ms}` |
| `REDACT` | Redaction applied | `{redaction_type, regions_count}` |
| `ENCRYPT` | File encrypted | `{algorithm, key_id}` |
| `STORE_PUBLIC` | Saved to public DMZ | `{path, size}` |
| `STORE_VAULT` | Saved to sovereign vault | `{path, size, encrypted: true}` |
| `ACCESS_REQUEST` | Access to original requested | `{requester, reason}` |
| `ACCESS_GRANT` | Access approved | `{granted_by, granted_at}` |
| `ACCESS_DENY` | Access denied | `{denied_by, denial_reason}` |
| `CONFIG_RELOAD` | Configuration hot-reloaded | `{old_version, new_version}` |
| `CONFIG_INVALID` | Invalid config rejected | `{error_message}` |
| `LIVE_STREAM_START` | WebSocket connected | `{session_id}` |
| `LIVE_STREAM_END` | WebSocket disconnected | `{session_id, duration_s, total_frames}` |

---

## 11. API Specification

### 11.1 REST Endpoints

#### 11.1.1 Scanning Endpoints

**`POST /api/scan`**
Upload dan scan single image/video.

```
Request:
  multipart/form-data:
    - file: binary
    - apply_redaction: bool = true
    - redaction_type: enum (blur|pixelate|blackbox) = blur

Response (200):
{
  "document_id": "uuid",
  "trace_id": "uuid",
  "filename": "ktp.jpg",
  "overall_risk": "critical",
  "privacy_score": 87,
  "inference_time_ms": 245.3,
  "detections": [
    {
      "class_name": "KTP",
      "confidence": 0.96,
      "bbox": [120, 80, 580, 360],
      "risk_level": "critical"
    },
    ...
  ],
  "redacted_url": "/api/documents/{id}/redacted",
  "stored_in_vault": true
}
```

**`POST /api/scan/live`** (stateless, untuk live stream)
```
Request:
  application/json:
  {
    "frame_base64": "...",
    "frame_id": "frame-001",
    "redact_classes": ["KTP", "Wajah"],
    "redaction_type": "blur"
  }

Response (200):
{
  "frame_id": "frame-001",
  "redacted_frame_base64": "...",
  "detections": [...],
  "privacy_score": 65,
  "inference_time_ms": 187.4
}
```

#### 11.1.2 Document Management

**`GET /api/documents`** — List dokumen dengan paginasi
```
Query params: page, limit, risk_filter, date_from, date_to
Response: { items: [...], total, page, limit }
```

**`GET /api/documents/{id}`** — Detail dokumen + deteksi
**`GET /api/documents/{id}/redacted`** — Stream file redacted
**`POST /api/documents/{id}/request-original-access`** — Buat access request

#### 11.1.3 Dashboard

**`GET /api/dashboard/summary`**
```
Response:
{
  "total_documents": 142,
  "critical_documents": 23,
  "encrypted_originals": 142,
  "average_inference_time_ms": 234.5,
  "privacy_saved_count": 487,
  "class_counts": {
    "KTP": 45,
    "Wajah": 89,
    ...
  },
  "recent_audit_logs": [...]
}
```

#### 11.1.4 Audit

**`GET /api/audit-logs`** — Paginasi audit log
**`GET /api/audit-logs/export`** — Export ke CSV/JSON

#### 11.1.5 Health & Integrity

**`GET /api/health`**
```
Response:
{
  "status": "ok",
  "ai_mode": "real",
  "uptime_seconds": 3245,
  "version": "1.0.0"
}
```

**`GET /api/health/model`** ⭐ untuk integrity verification
```
Response:
{
  "model_path": "./models/model_deteksi.pt",
  "sha256": "abc123def456...",
  "file_size_bytes": 5552640,
  "parameters_count": 2624000,
  "classes": ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"],
  "framework": "ultralytics",
  "torch_version": "2.1.0",
  "last_modified": "2026-04-12T14:23:00Z"
}
```

**`GET /api/metrics`** — Prometheus-compatible metrics

#### 11.1.6 Configuration Management

**`GET /api/config`** — Current active config
**`GET /api/config/history`** — Version history
**`POST /api/admin/reload-config`** — Hot reload from `config/runtime.yaml`
**`POST /api/admin/inject`** ⭐ untuk Dynamic Injection
```
Request:
{
  "injection_type": "add_class",
  "payload": {
    "class_name": "Tanda_Tangan",
    "risk_level": "high",
    "redact": true
  }
}

Response:
{
  "success": true,
  "config_version": 5,
  "applied_at": "2026-05-14T10:15:23Z",
  "changes": ["Added class 'Tanda_Tangan' to detection list"]
}
```

### 11.2 WebSocket Endpoints

**`WS /ws/stream`** — Bidirectional live stream
```
Client → Server: { type: "frame", frame_base64: "...", config: {...} }
Server → Client: { type: "result", detections: [...], redacted_frame: "...", metrics: {...} }
Server → Client: { type: "error", message: "..." }
Server → Client: { type: "config_changed", new_version: 5 }
```

---

## 12. Dynamic Injection Strategy

### 12.1 Filosofi

**Asumsi panitia akan inject sesuatu yang TIDAK kita prediksi.** Strategi kita bukan menebak, tapi membuat arsitektur fleksibel di setiap layer sehingga *apapun* injection-nya, kita bisa respond cepat.

### 12.2 Extension Points (Titik Suntik)

#### EP1. Detection Classes
**Skenario kemungkinan:** "Tambahkan deteksi untuk Tanda Tangan / Stempel / QR Code"
**Lokasi config:** `detection.classes` di `runtime.yaml`
**Cara respond:**
1. Edit YAML, tambah entry baru
2. POST `/api/admin/reload-config`
3. Sistem otomatis pakai daftar baru
4. **Catatan:** model harus sudah dilatih untuk kelas ini, atau kelas akan diabaikan (acceptable trade-off)

#### EP2. Redaction Policy
**Skenario kemungkinan:** "Setiap NIK harus di-redact pakai pattern checkerboard, bukan blur"
**Lokasi config:** `redaction.per_class_override` di `runtime.yaml`
**Cara respond:**
1. Tambah handler baru di `app/plugins/postprocessors/checkerboard.py`
2. Register di config: `redaction.types.checkerboard: ./plugins/postprocessors/checkerboard.py`
3. Set `per_class_override.NIK_Teks: checkerboard`
4. Hot reload

#### EP3. Risk Calculation
**Skenario kemungkinan:** "Risk harus mempertimbangkan jumlah deteksi yang overlap"
**Lokasi:** `app/services/risk_analyzer.py` dengan plugin support
**Cara respond:**
- Drop file `app/plugins/validators/overlap_risk.py` yang implement `BaseRiskRule`
- Config: `risk.rules: [class_weight, count_multiplier, overlap_penalty]`

#### EP4. Audit Format
**Skenario kemungkinan:** "Audit log harus include field X dan format khusus Y"
**Lokasi config:** `audit.fields` dan `audit.format`
**Cara respond:**
1. Update field list di YAML
2. Hot reload — sistem akan mulai catat field baru untuk event setelahnya
3. Untuk field yang requires computation, tambah handler di `plugins/audit/`

#### EP5. Input Source
**Skenario kemungkinan:** "Harus terima input dari RTSP stream / specific format"
**Lokasi:** `app/plugins/preprocessors/`
**Cara respond:**
- Implement `BasePreprocessor` interface
- Register di config: `input.sources: [webcam, rtsp:custom_handler]`

#### EP6. Output Format
**Skenario kemungkinan:** "Output harus generate audit report dalam format JSON-LD khusus"
**Lokasi:** `app/plugins/postprocessors/`
**Cara respond:**
- Drop file baru implement `BasePostprocessor`
- Register via config

### 12.3 Config Schema (runtime.yaml)

```yaml
# config/runtime.yaml
version: 1
schema_version: "1.0"

detection:
  model_path: "./models/model_deteksi.pt"
  device: "cpu"
  confidence_threshold: 0.5
  iou_threshold: 0.45
  classes:
    - name: KTP
      risk_level: critical
      redact: true
      weight: 25
    - name: SIM
      risk_level: critical
      redact: true
      weight: 25
    - name: Paspor
      risk_level: critical
      redact: true
      weight: 25
    - name: NIK_Teks
      risk_level: critical
      redact: true
      weight: 30
    - name: Wajah
      risk_level: high
      redact: true
      weight: 15
    - name: Plat_Nomor
      risk_level: medium
      redact: true
      weight: 10
  # INJECTION POINT: tambah kelas di sini

redaction:
  default_type: blur
  types:
    blur:
      kernel_size: 35
      sigma: 15
    pixelate:
      block_size: 20
    blackbox:
      color: [0, 0, 0]
  per_class_override:
    # INJECTION POINT: override per kelas
    # Wajah: pixelate
  padding_pixels: 5

risk:
  algorithm: "weighted_sum"  # alternatives: max_class, count_based
  thresholds:
    safe: 25
    waspada: 50
    berisiko: 75
    kritis: 100
  rules:
    - name: class_weight
      enabled: true
    - name: count_multiplier
      enabled: true
      multiplier: 1.2
    # INJECTION POINT: tambah rule baru

audit:
  enabled: true
  fields:
    - timestamp
    - trace_id
    - action
    - actor
    - resource_id
    - metadata
    # INJECTION POINT: tambah field
  format: json  # alternatives: json-ld, csv
  retention_days: 90

storage:
  metadata_backend: sqlite
  metadata_path: "./data/privai.db"
  vault_backend: filesystem
  vault_path: "./data/sovereign-vault"
  public_backend: filesystem
  public_path: "./data/public-redacted"

features:
  virtual_camera: true
  privacy_score: true
  recording: true
  demo_presets: true
  websocket_streaming: true

plugins:
  detectors_dir: "./app/plugins/detectors"
  validators_dir: "./app/plugins/validators"
  preprocessors_dir: "./app/plugins/preprocessors"
  postprocessors_dir: "./app/plugins/postprocessors"
  autoload: true
```

### 12.4 Plugin Interface (Strategy Pattern)

```python
# backend/app/plugins/base.py

from abc import ABC, abstractmethod
from typing import Any, Dict

class BasePreprocessor(ABC):
    @abstractmethod
    def process(self, raw_input: Any, context: Dict) -> Any:
        """Transform raw input before detection."""
        pass

class BaseDetector(ABC):
    @abstractmethod
    def detect(self, image: Any, config: Dict) -> list:
        """Run detection, return list of detections."""
        pass

class BaseValidator(ABC):
    @abstractmethod
    def validate(self, detections: list, context: Dict) -> Dict:
        """Validate or annotate detections."""
        pass

class BasePostprocessor(ABC):
    @abstractmethod
    def process(self, image: Any, detections: list, config: Dict) -> Any:
        """Apply redaction or transformation."""
        pass

class BaseRiskRule(ABC):
    @abstractmethod
    def calculate(self, detections: list, context: Dict) -> int:
        """Return contribution to risk score (0-100)."""
        pass
```

### 12.5 Hot Reload Flow

```
1. User edit config/runtime.yaml (atau panitia inject via API)
2. POST /api/admin/reload-config dipanggil
3. Backend:
   a. Read YAML
   b. Validate dengan Pydantic schema
   c. Jika invalid: return error, config lama tetap aktif
   d. Jika valid: increment version, simpan ke DB
   e. Replace in-memory config object atomically
   f. Emit event "config_reloaded" via WebSocket
   g. Log audit entry CONFIG_RELOAD
4. Frontend menerima event, refresh state, tampilkan toast
5. Inference berikutnya pakai config baru
```

---

## 13. MVP Component Breakdown

Setiap komponen di-breakdown dengan: tujuan, input, output, dependensi, estimasi effort, dan acceptance criteria.

### 13.1 Backend Components

#### C1. Detector Service
**File:** `backend/app/services/detector.py`
**Tujuan:** Wrap YOLO11n model untuk inferensi.
**Input:** Image (numpy array / PIL Image), config dict
**Output:** List of detections `[{class_name, confidence, bbox, risk_level}]`
**Dependensi:** Ultralytics, PyTorch, OpenCV
**Effort:** 4 jam (sudah ada di practice run, perlu refactor untuk config-driven)
**Acceptance:**
- ✓ Load model dari path yang dispesifikasi config
- ✓ Filter kelas berdasarkan `detection.classes` aktif di config
- ✓ Filter berdasarkan `confidence_threshold` dinamis
- ✓ Return latency per inference
- ✓ Support batch processing
- ✓ Thread-safe untuk concurrent requests

#### C2. Redactor Service
**File:** `backend/app/services/redactor.py`
**Tujuan:** Aplikasikan redaksi visual berdasarkan deteksi.
**Input:** Image, list of bbox + redaction_type
**Output:** Redacted image
**Dependensi:** OpenCV
**Effort:** 3 jam
**Acceptance:**
- ✓ Support 3 jenis redaksi (blur, pixelate, blackbox)
- ✓ Padding configurable
- ✓ Per-class override berfungsi
- ✓ Plugin loader untuk redaksi custom

#### C3. Encryptor Service
**File:** `backend/app/services/encryptor.py`
**Tujuan:** Enkripsi AES-256-GCM untuk file asli.
**Input:** File bytes, key (or generate DEK)
**Output:** Ciphertext + IV + tag
**Dependensi:** `cryptography` library
**Effort:** 2 jam
**Acceptance:**
- ✓ Setiap file punya DEK unik
- ✓ DEK di-wrap dengan KEK (master)
- ✓ Decrypt test lulus
- ✓ Tidak ada key dalam plaintext di disk

#### C4. Vault Service
**File:** `backend/app/services/vault.py`
**Tujuan:** Abstraksi storage (filesystem atau MinIO).
**Input:** Bytes + key, metadata
**Output:** Storage path/object key
**Dependensi:** boto3 (minio), pathlib (fs)
**Effort:** 3 jam
**Acceptance:**
- ✓ Bisa swap backend via config tanpa code change
- ✓ Public dan Vault terpisah lokasinya
- ✓ Retrieval berfungsi
- ✓ Error handling (disk full, network error)

#### C5. Audit Service
**File:** `backend/app/services/audit_service.py`
**Tujuan:** Tulis audit log dengan trace chain.
**Input:** action, actor, resource_id, metadata
**Output:** AuditLog entry
**Dependensi:** SQLAlchemy
**Effort:** 2 jam
**Acceptance:**
- ✓ Setiap action ter-record
- ✓ Trace ID konsisten dalam 1 scan
- ✓ Append-only (no UPDATE/DELETE)
- ✓ Index untuk query cepat

#### C6. Risk Analyzer
**File:** `backend/app/services/risk_analyzer.py`
**Tujuan:** Hitung Privacy Score 0-100 dan overall risk level.
**Input:** List of detections + config
**Output:** `{ score: int, level: str, breakdown: [...] }`
**Dependensi:** -
**Effort:** 3 jam
**Acceptance:**
- ✓ Score 0 untuk no detection
- ✓ Score 90+ untuk KTP+wajah
- ✓ Breakdown menjelaskan kontribusi
- ✓ Plugin rule support

#### C7. Config Manager
**File:** `backend/app/services/config_manager.py`
**Tujuan:** Load, validate, hot-reload config.
**Input:** YAML file
**Output:** Validated config object
**Dependensi:** PyYAML, Pydantic
**Effort:** 4 jam
**Acceptance:**
- ✓ Validate dengan Pydantic schema
- ✓ Hot reload tanpa restart
- ✓ Versioning di DB
- ✓ Emit event ke WebSocket

#### C8. WebSocket Stream Handler
**File:** `backend/app/api/websocket.py`
**Tujuan:** Handle live camera frames.
**Input:** Frame base64 dari client
**Output:** Detections + redacted frame
**Dependensi:** FastAPI WebSocket
**Effort:** 4 jam
**Acceptance:**
- ✓ ≥ 15 FPS sustained
- ✓ Auto reconnect on disconnect
- ✓ Backpressure handling (drop frames if backlog)
- ✓ Audit log per session

### 13.2 Frontend Components

#### C9. Home Page
**File:** `frontend/src/pages/Home.tsx`
**Tujuan:** Landing page dengan pitch + CTA + demo preset.
**Effort:** 3 jam
**Acceptance:**
- ✓ Hero dengan tagline + 3 CTA
- ✓ 3 demo preset buttons functional
- ✓ Mobile responsive

#### C10. Privacy Scanner Page
**File:** `frontend/src/pages/PrivacyScanner.tsx`
**Tujuan:** Upload single image, lihat hasil scan dengan visualisasi.
**Effort:** 4 jam
**Acceptance:**
- ✓ Drag-drop functional
- ✓ Bounding box overlay accurate
- ✓ Risk explanation muncul
- ✓ Download redacted bekerja

#### C11. Live Camera Page
**File:** `frontend/src/pages/LiveCamera.tsx`
**Tujuan:** Dual-mode live demo (Privacy/Inspector).
**Effort:** 6 jam (komponen tersulit)
**Acceptance:**
- ✓ WebRTC camera access
- ✓ WebSocket streaming ≥ 15 FPS
- ✓ Mode toggle preserve stream
- ✓ Recording .webm bekerja
- ✓ Per-class filter live
- ✓ Privacy Score real-time

#### C12. Government Vault Page
**File:** `frontend/src/pages/GovernmentVault.tsx`
**Tujuan:** Tabel registri dokumen + detail view.
**Effort:** 3 jam
**Acceptance:**
- ✓ Pagination berfungsi
- ✓ Filter risk + date
- ✓ Detail expand
- ✓ Access request form

#### C13. Dashboard Page
**File:** `frontend/src/pages/Dashboard.tsx`
**Tujuan:** Stat cards + charts + audit log.
**Effort:** 3 jam
**Acceptance:**
- ✓ 4 stat cards akurat
- ✓ Bar chart class distribution
- ✓ Audit log list paginated

#### C14. PrivacyScore Component
**File:** `frontend/src/components/PrivacyScore.tsx`
**Tujuan:** Ring chart + breakdown explanation.
**Effort:** 2 jam
**Acceptance:**
- ✓ Animasi smooth saat update
- ✓ Color-coded berdasarkan level
- ✓ Breakdown clickable untuk detail

#### C15. Performance Panel Component
**File:** `frontend/src/components/PerformancePanel.tsx`
**Tujuan:** Display FPS, latency, CPU, memory live.
**Effort:** 2 jam
**Acceptance:**
- ✓ Update setiap 1 detik
- ✓ Sparkline untuk trend
- ✓ Tidak menambah latency

### 13.3 Infrastructure Components

#### C16. Docker Compose Setup
**File:** `docker-compose.yml`, `Dockerfile`
**Tujuan:** One-command bootstrap.
**Effort:** 2 jam
**Acceptance:**
- ✓ `docker compose up` jalankan semua
- ✓ Fallback ke native mode tersedia
- ✓ Volume mount untuk model & data

#### C17. Database Migration
**File:** `backend/alembic/`
**Tujuan:** Schema management.
**Effort:** 1 jam
**Acceptance:**
- ✓ Initial migration berfungsi
- ✓ SQLite dan MySQL keduanya didukung

#### C18. Documentation
**Files:** `README.md`, `ARCHITECTURE.md`, `INJECTION_POINTS.md`, `FAQ.md`
**Effort:** 3 jam (paralel dengan dev)
**Acceptance:**
- ✓ README runnable steps
- ✓ Architecture diagram embedded
- ✓ Injection points didokumentasikan
- ✓ FAQ minimal 15 Q&A

### 13.4 Total Effort Estimate

| Kategori | Jam |
|---|---|
| Backend Services | 25 |
| Frontend Components | 23 |
| Infrastructure | 3 |
| Documentation | 3 |
| Testing & QA | 6 |
| Buffer (15%) | 9 |
| **Total** | **69 jam** |

**Catatan:** Dengan tim 4-5 orang yang bekerja paralel, ini bisa selesai dalam 18-20 jam efektif (dari 24 jam total, dikurangi tidur dan buffer).

---

## 14. User Journey dan Demo Scenarios

### 14.1 Persona Journey: Officer Loket Dukcapil

```
START
  │
  ├─► Buka laptop pagi hari
  │
  ├─► Klik shortcut "PrivAI Guard" di desktop
  │
  ├─► Aplikasi terbuka, status "Aktif"
  │
  ├─► Klik "Virtual Camera Mode: ON"
  │
  ├─► Buka Google Meet, ada appointment verifikasi
  │
  ├─► Di Meet, pilih kamera "PrivAI Camera"
  │
  ├─► Mulai meeting dengan warga
  │
  ├─► Warga tunjukkan KTP ke kamera
  │   ├─► Officer lihat di Meet: KTP otomatis ter-blur (kecuali wajah utama)
  │   └─► Audit log di PrivAI: 5 events tercatat
  │
  ├─► Officer butuh akses NIK untuk verifikasi
  │   ├─► Klik "Request Original Access" di PrivAI
  │   ├─► Isi alasan: "Verifikasi NIK appointment #12345"
  │   ├─► Supervisor approve (simulasi)
  │   └─► NIK ditampilkan, audit log update
  │
  ├─► Meeting selesai
  │
  └─► End of day: Officer review dashboard
         - 8 dokumen diproses
         - 0 kebocoran data
         - 12 access requests, semua tercatat
END
```

### 14.2 Demo Scenarios untuk Hari-H

#### Scenario A: "The Crisis & The Save" (5 menit)

**Setup (1 menit):**
- Laptop terhubung ke proyektor
- PrivAI sudah jalan (`localhost:5173`)
- Virtual Camera Mode aktif
- Google Meet terbuka di tab lain dengan 2 peserta (anggota tim)

**Demo (4 menit):**

```
[Pitch Lead]: "Bayangkan Pak Yusuf, officer Dukcapil. Pagi ini ia verifikasi
warga via Google Meet. Mari kita simulasikan."

[Anggota Tim 1 join Meet sebagai 'warga']
[Anggota Tim 2 sebagai 'officer']

[Officer]: "Selamat pagi, Pak. Silakan tunjukkan KTP-nya."
[Warga mengangkat KTP ke kamera]

→ DI LAYAR MEET: KTP otomatis ter-blur dalam <300ms
→ Wajah warga tetap terlihat (untuk verifikasi)
→ Latency badge di pojok PrivAI: "234ms · 28 FPS"

[Pitch Lead]: "Lihat — data sensitif sudah dicoret SEBELUM sampai ke server
Google Meet. Latensi hanya 234 milidetik, 10x lebih cepat dari batas toleransi."

[Klik tab PrivAI]
[Buka Audit Log tab]

[Pitch Lead]: "Setiap aksi tercatat. Lihat: UPLOAD → DETECT → REDACT →
ENCRYPT → STORE_VAULT. Semua dengan trace ID sama. Inilah kepatuhan UU PDP."

[Klik 'Sovereign Vault' tab]

[Pitch Lead]: "Data asli? Tidak hilang — tapi dienkripsi AES-256.
Bahkan kalau server jebol seperti insiden PDN, hasilnya cuma ciphertext."

[Klik 1 dokumen]
[Tampilkan: file binary terenkripsi vs preview redacted]
```

#### Scenario B: "Batch Processing for Public Service" (2 menit)

```
[Pitch Lead]: "Skenario kedua: layanan loket terima 50 dokumen sehari."

[Buka Privacy Scanner page]
[Drag-drop folder dengan 10 dokumen demo]

→ Progress bar muncul
→ Dalam <8 detik: 10 dokumen selesai diproses
→ Tampil grid hasil dengan bounding box

[Pitch Lead]: "10 dokumen dalam 8 detik di CPU laptop biasa. 
Tidak butuh GPU. Tidak butuh cloud. Tidak butuh internet."

[Klik salah satu untuk detail]
[Tampilkan: original encrypted, redacted public, audit chain]
```

#### Scenario C: "Dynamic Injection Response" (3 menit) ⭐

```
[Pitch Lead]: "Tadi pagi jam 10, panitia menyuntikkan requirement
baru: 'Sistem harus mendeteksi tanda tangan juga.'"

[Buka Configuration Viewer di UI]
[Tunjukkan: detection.classes saat ini punya 6 entries]

[Pitch Lead]: "Banyak tim akan refactor kode. Kami cukup edit YAML."

[Switch ke terminal]
[Edit config/runtime.yaml, tambah 1 entry untuk Tanda_Tangan]
[Save]
[Run: curl -X POST localhost:8000/api/admin/reload-config]

→ Notification muncul di UI: "Config v2 active. 7 classes loaded."
→ Audit log: CONFIG_RELOAD entry baru

[Demo: scan dokumen yang ada tanda tangan]

→ Tanda tangan terdeteksi (jika model support) atau gracefully ignored

[Pitch Lead]: "Arsitektur config-driven kami menjamin adaptasi tanpa
downtime. Inilah Adaptive Intelligence yang dimaksud tema kompetisi ini."
```

#### Scenario D: Q&A Backup Scenarios

Siapkan jawaban + demo cepat untuk:

1. **"Kalau pencahayaan buruk bagaimana?"** → Buka edge-case gallery, scan gambar low-light
2. **"Bagaimana kalau ada wajah orang banyak?"** → Scan gambar dengan 10+ wajah
3. **"Berapa CPU usage saat 30 FPS?"** → Buka Performance Panel, tampilkan grafik
4. **"Apa bedanya dengan Google Vision?"** → Klik Trust & Security page, tabel perbandingan

### 14.3 Screen Flow

```
Home (Beranda)
  ├─► CTA 1: "Coba Pindai" → Privacy Scanner
  ├─► CTA 2: "Aktifkan Kamera" → Live Camera
  ├─► CTA 3: "Lihat Dashboard" → Dashboard
  └─► Demo Presets:
        ├─► Preset e-KYC → Live Camera (auto-play)
        ├─► Preset Batch → Privacy Scanner (auto-load files)
        └─► Preset Live → Live Camera (use real webcam)

Privacy Scanner
  ├─► Upload area
  ├─► Hasil scan (image + bbox + breakdown)
  └─► CTA: "Buka di Vault" → Government Vault (filtered to this doc)

Live Camera
  ├─► Mode toggle (Privacy / Inspector)
  ├─► Stream area
  ├─► Sidebar:
  │    ├─► Privacy Score
  │    ├─► Filter chips
  │    └─► Settings
  └─► Footer: Performance metrics

Government Vault
  ├─► Document list (paginated)
  ├─► Filter (risk, date, class)
  ├─► Detail panel (expand)
  └─► Access request modal

Dashboard
  ├─► Stat cards
  ├─► Charts (class distribution, timeline)
  └─► Recent audit log (link to full)

(global) Footer
  ├─► Model integrity info (SHA256, params)
  └─► Trust badges
```

---

## 15. Implementation Plan

### 15.1 Pre-Hackathon Preparation (H-14 sampai H-1)

**Minggu -2 (H-14 sampai H-7):**
- [ ] Finalisasi tech stack dan setup boilerplate repo
- [ ] Implementasi skeleton dengan extension points kosong
- [ ] Setup Docker Compose dengan fallback native
- [ ] Tulis schema Pydantic untuk config
- [ ] Setup CI minimal (lint + format check)
- [ ] Siapkan 7 edge-case images
- [ ] Record 3 demo preset videos (durasi 10-15 detik masing-masing)

**Minggu -1 (H-7 sampai H-1):**
- [ ] Implementasi core P0 services di skeleton
- [ ] Integrasi YOLO model dengan plugin loader
- [ ] Test inference di laptop yang akan dipakai demo
- [ ] Latihan demo end-to-end dengan mock injection (5 kali)
- [ ] Tulis README + ARCHITECTURE.md awal
- [ ] Persiapan FAQ document (minimal 10 Q&A)
- [ ] Backup laptop kedua dengan setup identik

**H-1 (sehari sebelum):**
- [ ] Final pull request review
- [ ] Tag baseline `v0.1-prehackathon`
- [ ] Tidur cukup (8 jam minimal)
- [ ] Bawa: laptop (2x), charger, mouse, HDMI cable, USB hub, snack, obat, dokumen

### 15.2 24-Hour Timeline (14-15 Mei 2026)

#### Hari Pertama — 14 Mei 2026

**10:00 — Release Dynamic Injection**
Panitia umumkan injection. Tim **tidak boleh langsung koding**.

**10:00–10:30: Decode Injection**
- [ ] Baca injection bersama semua anggota
- [ ] Identifikasi: kelas baru? policy baru? format baru?
- [ ] Mapping ke extension point yang sudah ada
- [ ] Plan response strategy

**10:30–12:00: Architecture Lock**
- [ ] Update `config/runtime.yaml` untuk injection
- [ ] Update API contract jika perlu
- [ ] Buat task list di Trello/Notion
- [ ] Assign tasks ke 5 anggota
- [ ] **Code freeze contract — setelah jam 12:00 tidak ada perubahan struktur**

**12:00–13:00: Lunch + Initial Coding**
- [ ] Semua mulai parallel coding sesuai task
- [ ] Standup mini: blocker?

**13:00–18:00: Sprint 1 — Core Build**
- AI Engineer: integrate injection ke detector
- Backend: API endpoints + WebSocket + config manager
- Frontend: Wire up UI dengan API mock
- DevOps: Docker setup + virtual camera
- Pitch Lead: Start pitch deck outline + record demo backup

**18:00–19:00: Dinner + Integration Checkpoint**
- [ ] Demo internal end-to-end (meskipun jelek)
- [ ] Identifikasi bug & gap
- [ ] Re-prioritize remaining tasks

**19:00–02:00 (Hari Kedua): Sprint 2 — Polish & Edges**
- [ ] Handle error cases
- [ ] UX polish (loading states, error messages)
- [ ] Audit log enrichment
- [ ] Edge case testing
- [ ] Demo storytelling presets

#### Hari Kedua — 15 Mei 2026

**02:00–05:00: Sleep Rotation (WAJIB)**
- 3 anggota tidur 3 jam
- 2 anggota stay (bug fixing ringan, dokumentasi)
- 05:00: rotate

**05:00–08:00: Stabilization**
- [ ] STOP fitur baru
- [ ] Bug fixing only
- [ ] Latihan demo 3 kali end-to-end
- [ ] Update README, ARCHITECTURE.md, FAQ

**08:00–10:00: Final Polish**
- [ ] Performance tuning
- [ ] UI consistency check
- [ ] Verify model integrity endpoint
- [ ] Test pada laptop demo final

**10:00–11:00: Final Lockdown**
- [ ] Final commit
- [ ] Tag release `v1.0`
- [ ] Push ke GitHub repo
- [ ] Verifikasi repo clone & run

**11:00: CODE FREEZE — TIDAK ADA TOLERANSI**

**11:00–18:00: Pitch Deck Finalization**
- [ ] Slide-by-slide review
- [ ] Latihan presentasi minimal 5 kali
- [ ] Anticipate Q&A
- [ ] Submit pitch deck sebelum deadline 15 Mei

#### Hari Ketiga — 16 Mei 2026

**09:00: Final Pitching & Live Demo**
- [ ] Setup proyektor 15 menit sebelumnya
- [ ] Test virtual camera + Google Meet
- [ ] Test webcam venue
- [ ] Pitch + demo (10 menit) + Q&A (5 menit)

### 15.3 Communication Plan

**Daily Standup (saat 24 jam):**
- Setiap 4 jam: 15 menit mini standup
  - Apa yang sudah selesai
  - Apa yang sedang dikerjakan
  - Blocker apa
- Time check: 14:00, 18:00, 22:00, 02:00, 06:00, 10:00

**Tools:**
- Komunikasi: Discord voice channel selalu aktif
- Task tracking: Trello atau Linear
- Code: GitHub dengan PR-based workflow
- Decisions log: shared Notion page

### 15.4 Definition of Done (DoD)

Sebuah komponen dianggap "selesai" jika:
- ✓ Kode di-commit ke main branch
- ✓ Manual test sukses pada minimal 1 anggota lain
- ✓ Tidak ada console error
- ✓ Audit log tercatat untuk action terkait
- ✓ Berfungsi pada laptop demo
- ✓ Tidak break fitur lain

---

## 16. Repository Structure

Struktur folder sudah dirinci di [Section 9.2](#92-folder-convention). Berikut konvensi tambahan:

### 16.1 Git Workflow

```
main (protected)
  ├─► feat/backend-detector-service
  ├─► feat/frontend-live-camera
  ├─► feat/virtual-camera-bridge
  ├─► fix/audit-log-trace-id
  └─► docs/architecture-update
```

**Convention commit messages:**
```
feat: tambah hot reload endpoint
fix: perbaiki bug FPS counter di Inspector mode
docs: update FAQ dengan Q tentang HSM
refactor: ekstrak detector ke plugin
test: tambah test untuk risk analyzer
chore: update dependencies
```

### 16.2 Branch Protection

- `main` requires 1 PR review
- No direct push
- Tag `v1.0` saat code freeze

### 16.3 Documentation Files

**README.md** harus berisi:
1. Project description (1 paragraph)
2. Quick start (3 commands max)
3. Features overview (bullet list)
4. Tech stack
5. Project structure (tree)
6. License
7. Team & contact

**ARCHITECTURE.md** harus berisi:
1. System diagram (high-level)
2. Component breakdown
3. Data flow diagram
4. Design decisions (with rationale)
5. Trade-offs
6. Future improvements (link ke roadmap)

**INJECTION_POINTS.md** harus berisi:
1. Penjelasan filosofi config-driven
2. List semua extension points dengan contoh
3. Cara menambah plugin baru
4. Cara hot reload
5. Example dari Dynamic Injection response

**FAQ.md** harus berisi minimal 15 Q&A meliputi:
1. Kenapa YOLO11n, bukan v8/v10?
2. Bagaimana handling false negative?
3. Kenapa tidak pakai OCR?
4. Bagaimana keamanan KEK?
5. Bagaimana scaling ke nasional?
6. Apa beda dengan Google Vision?
7. Kenapa local, bukan cloud?
8. Bagaimana handle multi-language?
9. Apa dampak ke latency video call?
10. Bagaimana audit jika data corrupt?
11. Apa rencana monetisasi?
12. Bagaimana onboarding officer?
13. Apa partnership opportunity?
14. Bagaimana respond ke false positive?
15. Apa fallback jika model crash?

---

## 17. Risk Register dan Mitigation

### 17.1 Risk Matrix

| ID | Risk | Probability | Impact | Severity | Mitigation |
|---|---|---|---|---|---|
| R1 | Webcam venue tidak berfungsi | Medium | High | High | Backup video preset auto-play |
| R2 | Wifi venue down | High | Medium | Medium | Semua localhost, ada hotspot mobile |
| R3 | Laptop demo crash | Low | Critical | High | Laptop kedua dengan setup identik |
| R4 | Dynamic Injection di luar prediksi | High | High | High | Config-driven architecture, plugin folders ready |
| R5 | Model integrity dipertanyakan juri | Medium | High | Medium | `/api/health/model` endpoint + footer info |
| R6 | Anggota tim sakit/tidak hadir | Low | High | Medium | Cross-training, dokumentasi internal jelas |
| R7 | Burnout di jam ke-20 | High | High | High | Sleep rotation enforced 02:00-05:00 |
| R8 | Bug fatal jam ke-22 | Medium | Critical | High | Code freeze fitur baru di jam 16:00 (sprint 2 done) |
| R9 | MinIO/MySQL gagal start | Medium | Medium | Medium | Fallback ke SQLite + filesystem |
| R10 | Virtual camera tidak terdeteksi OS | Medium | Medium | Medium | Mock window demo sebagai fallback |
| R11 | Performance di bawah klaim Tahap 2 | Low | High | Medium | Benchmark script jalan setiap commit |
| R12 | Pitch deck belum siap saat presentasi | Medium | Critical | High | Outline sudah ada H-7, finalisasi sehari sebelum |
| R13 | Repo di-clone juri tapi tidak jalan | Medium | High | High | `make run` one-command, tested di laptop bersih |
| R14 | Live demo crash di tengah | Medium | Critical | High | Demo preset video sebagai backup, latih recovery |
| R15 | Battery laptop habis | Low | High | Medium | Power adapter selalu colok, backup powerbank |

### 17.2 Contingency Plans

**Plan B untuk Live Demo:**
- Jika webcam gagal → demo preset video 1
- Jika WebSocket lag → switch ke upload mode dengan sample images
- Jika model gagal load → mock mode (subtle, jangan kelihatan) + tegaskan ke juri "model tersedia di repo, sedang reload"

**Plan B untuk Dynamic Injection:**
- Jika tidak bisa di-handle via config → emergency plugin (file Python baru di folder plugins)
- Jika benar-benar tidak bisa → terbuka ke juri: "Kami implementasi sebagian, dokumentasi rencana lengkap di INJECTION_POINTS.md"

**Plan B untuk Pitch Deck:**
- Selalu punya versi PDF (immutable) selain PPT
- Backup di Google Drive + USB

---

## 18. Testing Strategy

### 18.1 Unit Tests

**Coverage Target:** 60% untuk core services

**Priority files to test:**
- `detector.py` — mock model output, test filtering
- `redactor.py` — visual diff test
- `encryptor.py` — encrypt/decrypt roundtrip
- `risk_analyzer.py` — boundary cases (0 detections, max detections)
- `config_manager.py` — invalid YAML, schema validation

**Tools:** pytest, pytest-asyncio, httpx

### 18.2 Integration Tests

**Skenario:**
1. End-to-end scan: upload → detect → redact → encrypt → store → audit
2. Hot reload: edit config → reload → verify behavior change
3. WebSocket: connect → send 100 frames → verify response time
4. Failure recovery: kill MinIO → verify fallback ke filesystem

### 18.3 Manual QA Checklist

**Pre-demo checklist (run 5x sebelum hari-H):**
- [ ] Open home page, klik semua CTA
- [ ] Privacy Scanner: upload 1 image, verify result
- [ ] Live Camera: switch mode, toggle filter, change redaction type
- [ ] Government Vault: filter by risk, click detail
- [ ] Dashboard: verify stats correct
- [ ] Virtual Camera: open Meet, verify available
- [ ] Hot reload: edit YAML, verify UI updates
- [ ] Audit Log: verify entries muncul real-time
- [ ] Mobile responsive: test di tablet view
- [ ] Footer info: SHA256 model muncul

### 18.4 Performance Benchmarking

**Script:** `demo/scripts/benchmark.py`

```python
# Pseudo
def benchmark():
    # Single image inference: 100 iterations
    # Live stream: 30 seconds capture
    # Batch processing: 50 files
    # Report: avg, p95, p99 latency + FPS
```

Run sebelum hari-H dan saat code freeze.

### 18.5 Demo Rehearsal Plan

| Hari | Aktivitas | Tujuan |
|---|---|---|
| H-7 | Demo rehearsal 1 (full team) | Identify rough spots |
| H-3 | Demo rehearsal 2 (with judges friends sebagai test audience) | Get feedback |
| H-1 | Demo rehearsal 3 (final dress rehearsal) | Smooth execution |
| H-Day | Run-through 30 menit sebelum jadwal | Confidence boost |

---

## 19. Deliverables dan Acceptance Criteria

### 19.1 Final Deliverables (Tahap 3)

Sesuai guidebook:
1. **Aplikasi MVP** — produk berfungsi penuh di laptop peserta
2. **GitHub Repository Final** — source code lengkap (backend + frontend)
3. **Pitch Deck** — slide untuk final pitching (PPT/PDF)

### 19.2 Acceptance Criteria untuk MVP

**Aplikasi dianggap "MVP siap demo" jika:**

- ✓ Berjalan stabil minimal 30 menit tanpa crash
- ✓ Live camera demo berjalan ≥ 15 FPS dengan latensi ≤ 400ms
- ✓ Upload single + batch berfungsi
- ✓ Dual pipeline (redacted + encrypted) terverifikasi
- ✓ Audit log lengkap dengan trace_id
- ✓ Privacy Score akurat real-time
- ✓ Hot reload config tanpa restart
- ✓ Dynamic Injection ter-handle (sesuai apa yang panitia kasih)
- ✓ Model integrity dapat diverifikasi
- ✓ Virtual camera (jika diimplementasi) terdeteksi di Meet/Zoom
- ✓ Demo storytelling preset berfungsi
- ✓ README cukup jelas untuk juri clone & run
- ✓ ARCHITECTURE.md dengan diagram lengkap
- ✓ INJECTION_POINTS.md menjelaskan extension strategy
- ✓ FAQ siap dengan 15+ Q&A

### 19.3 Definition of "Done" untuk Repository

- ✓ Tag `v1.0` di GitHub
- ✓ README dengan 3-step quick start
- ✓ `make run` atau `docker compose up` works on fresh clone
- ✓ Tidak ada secret di-commit (gunakan `.env.example`)
- ✓ `.gitignore` lengkap (data/, models/, .env)
- ✓ LICENSE file (MIT atau Apache 2.0)
- ✓ CONTRIBUTING.md (optional but nice)

### 19.4 Definition of "Done" untuk Pitch Deck

- ✓ 12-15 slides
- ✓ Mengikuti struktur: Crisis → Save → Sovereignty → Adaptation → Roadmap
- ✓ Setiap slide ≤ 30 detik bicara
- ✓ Demo video embedded sebagai backup (kalau live gagal)
- ✓ Slide compliance dengan constraint A1-A5
- ✓ Slide tentang Dynamic Injection handling
- ✓ Roadmap 12 bulan visual
- ✓ Slide tim dan kontak

---

## 20. Appendix

### 20.1 Glossary

| Istilah | Definisi |
|---|---|
| DEK | Data Encryption Key — kunci unik per file untuk enkripsi data |
| KEK | Key Encryption Key — master key untuk wrap DEK |
| HSM | Hardware Security Module — chip fisik untuk simpan KEK |
| AES-256-GCM | Standar enkripsi dengan authenticated mode |
| Sovereign Vault | Tempat penyimpanan data asli terenkripsi (lokal, terisolasi) |
| Public DMZ | Demilitarized Zone — tempat menyimpan data yang sudah aman (redacted) |
| Edge Computing | Komputasi di perangkat lokal, bukan cloud |
| Dynamic Injection | Skenario hackathon: panitia inject requirement runtime |
| Visual Firewall | Konsep PrivAI: filter cerdas antara kamera dan platform |
| YOLO | You Only Look Once — arsitektur model object detection |
| FPS | Frames Per Second |
| Trace ID | UUID yang mengikat semua audit log dari 1 transaksi |
| Hot Reload | Apply perubahan config tanpa restart server |
| MVP | Minimum Viable Product |
| OCR | Optical Character Recognition (tidak digunakan PrivAI) |
| NER | Named Entity Recognition (tidak digunakan PrivAI) |

### 20.2 Reference Materials

**Internal:**
- Proposal Tahap 2: `Proposal_TIMOREX_Tahap2_FindIT2026.pdf`
- Guidebook: `Hackathon-Guidebook-2026.pdf`
- Notebook training: `training.ipynb` (Tahap 2)
- Notebook inference: `inference.ipynb` (Tahap 2)
- Model file: `model_deteksi.pt`

**External:**
- Ultralytics YOLO docs: https://docs.ultralytics.com
- FastAPI docs: https://fastapi.tiangolo.com
- React + Vite: https://vitejs.dev
- shadcn/ui: https://ui.shadcn.com
- pyvirtualcam: https://pypi.org/project/pyvirtualcam
- UU PDP No. 27/2022

### 20.3 Contact dan Support

**Tim TIMOREX:**
- Lead: Raymond (ITB Informatics)
- Anggota lainnya: TBD

**Komunikasi internal:**
- Discord: TBD
- Trello: TBD
- GitHub repo: TBD

**Panitia FindIT:**
- WhatsApp: Arifa +6283820170157
- Email: competitions@find-it.id
- Instagram: @ugm.findit

### 20.4 Changelog Dokumen Ini

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | Mei 2026 | Initial specification |

---

**Catatan Penutup**

Dokumen ini adalah *living document*. Selama pre-hackathon, update sesuai feedback dari latihan demo. Saat 24 jam berlangsung, jangan update dokumen ini — fokus pada eksekusi. Update lagi setelah Tahap 3 selesai untuk dokumentasi pasca-lomba.

**"The best architecture is one that survives requirements you didn't anticipate."**

— Filosofi Dynamic Injection PrivAI Guard
