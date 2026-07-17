# Push Plan Migrasi Repo Spectre (2 Orang)

## Tujuan

Memindahkan repo saat ini ke repo Spectre baru tanpa kehilangan riwayat, tag, struktur folder, perubahan PDF/live-stream, dan rebranding terbaru.

> Git melakukan push terhadap commit/branch, bukan file individual. Daftar file di bawah adalah isi commit yang perlu disiapkan sebelum branch dipush.

## Pembagian Peran

| Peran | Tanggung jawab |
|---|---|
| Orang 1 - Maintainer | Membuat repo tujuan kosong, mendorong `main` dan tag, melindungi branch, serta me-review PR akhir. |
| Orang 2 - Integrator | Menyiapkan commit rebranding dan dokumen migrasi pada `fix`, mendorong branch tersebut, lalu membuka PR ke `main`. |

## Aturan Sebelum Mulai

1. Buat repo tujuan dalam keadaan benar-benar kosong: jangan otomatis membuat README, `.gitignore`, atau license.
2. Jangan commit `.env`, database runtime, hasil upload, `node_modules`, `dist`, `.venv`, sertifikat, atau secret Azure.
3. Jangan mengubah remote `origin` lama. Tambahkan remote baru bernama `spectre` agar rollback mudah.
4. Orang 2 baru push setelah Orang 1 selesai mendorong `main`.
5. Model terbesar saat ini sekitar 5,5 MB, sehingga belum memerlukan Git LFS.

## Tahap 0 - Commit Kondisi Terbaru (Orang 2)

Kerjakan dari branch `fix` yang sudah memuat commit:

```text
d70a349 feat: add PDF upload and stabilize live detection
```

### Commit A - Rebranding

Pesan commit:

```text
chore(brand): rebrand PrivAI as Spectre

- replace public-facing PrivAI branding with Spectre
- add the temporary responsive Spectre logo
- update frontend metadata, backend identity, and documentation
- preserve legacy deployment and storage identifiers for compatibility
```

File yang dimasukkan:

```text
README.md
backend/.env.example
backend/app/ai/detector.py
backend/app/core/config.py
backend/app/main.py
backend/app/services/authenticity_service.py
backend/app/services/live_turbo_service.py
docker-compose.yml
frontend/index.html
frontend/src/assets/Spectre_logo.svg
frontend/src/components/user/HeroIdentityProtection.tsx
frontend/src/components/user/HowItWorksTimeline.tsx
frontend/src/layouts/GovernmentShell.tsx
frontend/src/layouts/UserShell.tsx
frontend/src/lib/api.ts
frontend/src/lib/constants.ts
frontend/src/lib/navigation.ts
frontend/src/views/government/AuditLogView.tsx
frontend/src/views/government/DynamicInjectionView.tsx
frontend/src/views/government/GovernmentAccessView.tsx
frontend/src/views/government/GovernmentOverviewView.tsx
frontend/src/views/user/UserDocumentUploadView.tsx
frontend/src/views/user/UserHomeView.tsx
frontend/src/views/user/UserHowItWorksView.tsx
frontend/src/views/user/UserLiveFilterView.tsx
frontend/src/views/user/UserPrivacyView.tsx
```

Perintah:

```powershell
git switch fix
git add -- README.md backend/.env.example `
  backend/app/ai/detector.py backend/app/core/config.py backend/app/main.py `
  backend/app/services/authenticity_service.py backend/app/services/live_turbo_service.py `
  docker-compose.yml frontend/index.html frontend/src/assets/Spectre_logo.svg `
  frontend/src/components/user/HeroIdentityProtection.tsx `
  frontend/src/components/user/HowItWorksTimeline.tsx `
  frontend/src/layouts/GovernmentShell.tsx frontend/src/layouts/UserShell.tsx `
  frontend/src/lib/api.ts frontend/src/lib/constants.ts frontend/src/lib/navigation.ts `
  frontend/src/views/government/AuditLogView.tsx `
  frontend/src/views/government/DynamicInjectionView.tsx `
  frontend/src/views/government/GovernmentAccessView.tsx `
  frontend/src/views/government/GovernmentOverviewView.tsx `
  frontend/src/views/user/UserDocumentUploadView.tsx `
  frontend/src/views/user/UserHomeView.tsx frontend/src/views/user/UserHowItWorksView.tsx `
  frontend/src/views/user/UserLiveFilterView.tsx frontend/src/views/user/UserPrivacyView.tsx
git commit -m "chore(brand): rebrand PrivAI as Spectre"
```

Sebelum commit, pastikan `git diff --cached --name-only` hanya menampilkan file pada daftar Commit A.

### Commit B - Push Plan

```powershell
git add push-plan.md
git commit -m "docs: add two-person repository migration plan"
```

Jangan push dahulu; tunggu Tahap 1 selesai.

## Tahap 1 - Inisiasi Repo Tujuan (Orang 1)

Tambahkan remote baru dan push baseline stabil dari `main`:

```powershell
git switch main
git status --short
git remote add spectre <URL_REPO_SPECTRE_BARU>
git push -u spectre main
git push spectre v1.0.0
```

Initial push `main` membentuk baseline berikut:

```text
/
|-- .dockerignore, .env.example, .gitignore
|-- README.md, PrivAI_LOGO.png, docker-compose.yml
|-- backend/       API FastAPI, model, service, test, dan Dockerfile
|-- config/        runtime.yaml
|-- doc/           proposal dan pitch deck
|-- frontend/      React/Vite UI, asset, test, nginx, dan Dockerfile
`-- research/      notebook dan artefak model
```

Catatan: nama/logo lama pada baseline ini normal; rebranding masuk melalui PR Orang 2 agar riwayat perubahannya jelas.

Setelah push:

1. Jadikan `main` default branch.
2. Aktifkan branch protection: PR wajib, minimal satu approval, dan larang force-push.
3. Beri Orang 2 akses write pada repo baru.

## Tahap 2 - Push Perubahan Terkini (Orang 2)

Tambahkan remote baru pada clone lokal yang sudah memiliki branch `fix`:

```powershell
git switch fix
git remote add spectre <URL_REPO_SPECTRE_BARU>
git fetch spectre main
git merge-base --is-ancestor spectre/main fix
git push -u spectre fix
```

Perintah `merge-base` harus selesai dengan exit code `0`. Jika bukan `0`, jangan force-push; sinkronkan branch terlebih dahulu.

Branch `fix` membawa dua kelompok perubahan di atas baseline:

1. Commit `d70a349`: dukungan PDF dan stabilisasi live detection.
2. Commit rebranding Spectre dan `push-plan.md`.

Buka PR:

```text
fix -> main
Judul: feat: migrate current PrivAI implementation to Spectre
```

Isi ringkas PR:

```text
- add PDF upload support
- stabilize live detection and model readiness
- rebrand public product identity to Spectre
- preserve legacy runtime identifiers for compatibility
```

## Tahap 3 - Review dan Merge (Orang 1)

Orang 1 me-review daftar perubahan dan menjalankan:

```powershell
cd backend
.\.venv\Scripts\python.exe -m compileall -q app tests
cd ..\frontend
npm.cmd ci
npm.cmd run test:live
npm.cmd run build
```

Jika semua lulus, merge PR dengan **merge commit** agar commit fitur, rebranding, dan dokumentasi tetap terpisah. Setelah itu:

```powershell
git switch main
git pull spectre main
```

## Tahap 4 - Migrasi Branch Historis (Orang 1, Opsional tetapi Disarankan)

Branch yang masih relevan dapat dipertahankan setelah `main` aman:

```powershell
git push spectre backend deploy dev frontend
git push spectre origin/hacking-day:refs/heads/hacking-day
git push spectre origin/v1.0:refs/heads/v1.0
```

Jangan merge branch historis tersebut ke `main`; simpan hanya sebagai arsip. Branch `fix` boleh dihapus setelah PR selesai.

## Struktur Akhir yang Diharapkan

```text
Spectre/
|-- .dockerignore
|-- .env.example
|-- .gitignore
|-- README.md
|-- PrivAI_LOGO.png                 # aset legacy, tidak lagi dipakai UI
|-- push-plan.md
|-- docker-compose.yml
|-- backend/
|   |-- app/{ai,api,core,db,services,utils}/
|   |-- certs/
|   |-- datasets/hard_negatives/
|   |-- models/model_deteksi.pt
|   |-- storage/
|   |-- tests/
|   |-- .env.example
|   |-- Dockerfile
|   `-- requirements.txt
|-- config/runtime.yaml
|-- doc/
|   |-- Pitch Deck_TIMOREX_FindIT2026.pdf
|   `-- Proposal_TIMOREX_Tahap2_FindIT2026.pdf
|-- frontend/
|   |-- src/{assets,components,layouts,lib,views}/
|   |-- tests/
|   |-- Dockerfile
|   |-- nginx.conf
|   |-- package.json
|   |-- package-lock.json
|   `-- vite.config.ts
`-- research/notebooks/
```

## Verifikasi Akhir Bersama

```powershell
git status --short
git log --oneline --decorate -8
git ls-tree -r --name-only main
```

Checklist:

- [ ] `main` pada repo baru berisi commit PDF/live-stream dan rebranding Spectre.
- [ ] Tag `v1.0.0` tersedia.
- [ ] `frontend/src/assets/Spectre_logo.svg` tersedia dan digunakan kedua layout.
- [ ] Build frontend dan compile backend lulus.
- [ ] Tidak ada `.env`, database, upload pengguna, private key, atau token produksi yang ikut ter-push.
- [ ] URL Azure `privai-*` dan identifier storage lama tetap dipertahankan sampai migrasi infrastructure terpisah dilakukan.
