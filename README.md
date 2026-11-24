# Wedding Photo App — Pencocokan Foto Tamu Pernikahan

Aplikasi web untuk mencocokkan wajah tamu dengan foto-foto acara pernikahan.
Tamu mengunggah selfie, sistem membandingkannya dengan foto yang diunggah
fotografer, lalu tamu melihat hasilnya di galeri pribadi lewat token — tanpa
perlu akun.

Tampilan bertema anime (sakuga-vfx) dengan palet gelap `--sk-*`.

## Fitur

**Pemilik Acara** (`/pemilik`)
- Membuat acara, mendapatkan **kode tamu** & **kode fotografer**
- Melihat statistik: jumlah tamu, jumlah foto, foto yang belum terpencocokan
- Melihat daftar foto hasil unggahan fotografer

**Fotografer** (`/fotografer`)
- Bergabung ke acara memakai kode fotografer
- Mengunggah hingga 50 foto sekaligus (diproses ke face-service)

**Tamu** (tanpa akun)
- Registrasi di `/tamu/:kodeTamu` — isi nama, unggah selfie, setuju pemrosesan wajah (FR-21/22)
- Galeri pribadi di `/gallery?token=...` — hanya foto yang cocok dengan wajahnya
- Bisa **menghapus data wajahnya** sendiri (FR-22)

**Lainnya**
- Login / registrasi akun pemilik & fotografer (`/`)
- **Lupa password lengkap** sesuai Dokumen v1.1: `/lupa-password` (W-07, FR-32–35, 40) dan `/reset-password` (W-08, FR-36–39)

## Arsitektur

```
Browser (React + Vite :5173)
   │
   ├─ query data langsung ──► Supabase (Postgres + Auth + Storage)  [RLS aktif]
   │
   └─ upload foto/selfie ──► Backend Node.js (Express :5000)
                                  │
                                  └─► face-service (FastAPI :8000)
                                        DeepFace / FaceNet — encode & match
```

Supabase dipakai langsung dari frontend untuk membaca/menulis data
(dengan RLS), sedangkan upload file & pemrosesan wajah lewat backend.

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, Supabase JS |
| Backend | Node.js, Express 5, Multer, Supabase JS (service role) |
| Face service | Python, FastAPI, DeepFace, OpenCV |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage, bucket `event-photos` |

## Struktur Folder

```
wedding-photo-app/
├── frontend/          # React app (src/pages: 8 halaman)
│   ├── public/sakuga-vfx/   # 7 komponen UI bertema anime
│   └── src/lib/supabase.js  # klien Supabase bersama
├── backend/           # Express: upload foto & registrasi tamu
│   ├── server.js
│   └── buat-akun-dummy.sh    # script buat akun uji
├── face-service/      # FastAPI: /encode, /detect-multiple, /health
├── note.txt           # catatan lokal (TIDAK di-push): server, akun dummy
└── README.md
```

## Cara Menjalankan

**Prasyarat:** Node.js 18+, Python 3.10+, akun Supabase.

### 1. Konfigurasi environment

Salin nilai ke file `.env` masing-masing folder (file ini di-ignore git):

`frontend/.env`
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:5000
```

`backend/.env`
```
PORT=5000
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # rahasia — jangan pernah di-push
FACE_SERVICE_URL=http://localhost:8000
MATCH_THRESHOLD=0.6
```

### 2. Jalankan tiga server di tiga terminal

```bash
# Terminal 1 — face-service (:8000)
cd face-service
source venv/bin/activate        # atau: python -m venv venv && pip install fastapi uvicorn deepface opencv-python
uvicorn app:app --host 0.0.0.0 --port 8000

# Terminal 2 — backend (:5000)
cd backend && npm install && npm run dev

# Terminal 3 — frontend (:5173)
cd frontend && npm install && npm run dev
```

Buka **http://localhost:5173**

## Rute Halaman

| Rute | Halaman | Keterangan |
|---|---|---|
| `/` | Login | tab pemilik / fotografer, link lupa password |
| `/lupa-password` | LupaPassword | kirim tautan reset (pesan generik) |
| `/reset-password` | ResetPassword | form sandi baru, 8+ karakter & harus sama |
| `/pemilik` | PemilikDashboard | dashboard pemilik acara |
| `/fotografer` | FotograferDashboard | gabung acara + unggah foto |
| `/tamu/:guestCode` | RegistrasiTamu | registrasi tamu + selfie |
| `/gallery?token=...` | GaleriTamu | galeri privat tamu |

## Endpoint

**Backend Node.js (`:5000`)**
| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/health` | cek status |
| POST | `/api/events` | buat acara |
| POST | `/api/guests/register` | registrasi tamu (multipart, field `selfie`) |
| POST | `/api/photos/upload` | unggah foto (multipart, maks. 50 file) |

**Face service (`:8000`)**
| Method | Path | Fungsi |
|---|---|---|
| GET | `/health` | cek status |
| POST | `/encode` | ubah 1 gambar → vektor wajah |
| POST | `/detect-multiple` | deteksi semua wajah dalam 1 gambar |

## Tabel Database

`profiles` · `events` · `guests` · `photos` · `photo_matches` · `event_photographers`

## Data Uji & Akun Dummy

Untuk pengujian manual tersedia akun dummy + event siap isi
(kode tamu, kode fotografer, token galeri, dll.).

> **Kredensialnya ada di `note.txt`** (folder root) — file itu di-ignore git
> dan tidak ikut ter-push karena berisi sandi.

Membuat akun dummy baru:

```bash
./backend/buat-akun-dummy.sh "email@uji.com" "Sandi1234!" "fotografer"
# peran: pemilik_acara | fotografer | admin
```

## Catatan Keamanan

- `backend/.env` (service role key) **tidak boleh** di-push — sudah masuk `.gitignore`.
- Policy RLS `USING (true)` dipakai pada `guests`, `photos`, `photo_matches`
  karena frontend membaca langsung dari browser; ini trade-off keamanan
  (dokumen 4.3.5 menyarankan akses lewat backend) — perlu diperketat sebelum produksi.
- Bucket `event-photos` memakai URL publik; unggahan belum dikompresi/divalidasi
  di backend.

## Status vs Dokumen (Skripsi v1.0 + v1.1)

Sudah: seluruh halaman, alur 3 peran, lupa password lengkap, RLS, akun uji.

Belum / disimulasikan: halaman Admin (W-06), pencocokan ulang saat tamu baru
daftar (FR-28), QR code asli (FR-08), endpoint `GET /public/events/:guestCode`,
guard peran (TC-04), kompresi & validasi file di backend.
