# SIMTA - Sistem Informasi Manajemen Tugas Akhir

SIMTA adalah sistem informasi untuk mengelola proses bimbingan tugas akhir mahasiswa di Politeknik. Sistem ini terdiri dari backend API berbasis Go dan frontend web berbasis React + TypeScript.

## Fitur Utama

- **Manajemen Mahasiswa**: CRUD mahasiswa dengan pembimbing
- **Dual-Supervisor Approval**: Persetujuan wajib dari kedua pembimbing (PB1 & PB2) sebelum pendaftaran sidang diizinkan.
- **Bimbingan & Berkas**: Alur bimbingan terintegrasi dengan feedback dosen dan dukungan berbagai format file (docx, pptx, image, youtube).
- **Review Lifecycle**: Status bimbingan dari `Draft` -> `Proposed` -> `In Review` -> `Selesai` atau `Offline`.
- **Verifikasi Digital**: Surat rekomendasi sidang dengan QR Code dan token acak yang aman.
- **Dasbor Mahasiswa Terpadu**: Navigasi khusus untuk "Persiapan Sidang" dan "Nilai" untuk memisahkan alur administrasi dan capaian akademik.

## ⚠️ Strict Network Requirements (LOCKED)

This project is configured strictly to use the following ports for production (required for Cloudflare Tunnel and existing domain mappings):
- **Frontend**: Port `3535`
- **Backend (API)**: Port `3536`

**WARNING**: Do not change these port assignments in `.env` or `docker-compose.yml`. Changing them will break external reachability via established tunnels.

## Getting Started

- **Backend**: Go dengan SQLite database (development) / PostgreSQL (production)
- **Frontend**: React + TypeScript + Vite
- **Database**: SQLite (development) / PostgreSQL (production via Podman container)

## Prerequisites

- Go 1.19+
- Node.js 18+
- npm atau yarn
- Podman (opsional, untuk PostgreSQL di production)

## Database Setup

Untuk development, sistem menggunakan SQLite yang otomatis dibuat.

Untuk production, gunakan PostgreSQL:

1. Jalankan PostgreSQL container menggunakan Podman:
   ```bash
   podman run -d --name simta-postgres \
     -e POSTGRES_DB=simta \
     -e POSTGRES_USER=simta_user \
     -e POSTGRES_PASSWORD=simta_pass \
     -p 5433:5432 \
     -v simta_pgdata:/var/lib/postgresql/data \
     docker.io/postgres:15
   ```

2. Container akan berjalan di port 5433 (untuk menghindari konflik dengan container lain).

## Environment Variables

Backend menggunakan environment variables untuk koneksi database dan konfigurasi keamanan (dengan default values):

- `DB_HOST`: localhost
- `DB_PORT`: 5433
- `DB_USER`: simta_user
- `DB_PASSWORD`: simta_pass
- `DB_NAME`: simta
- `JWT_SECRET`: (harus diatur untuk production)
- `ADMIN_PASSWORD`: (harus diatur untuk production)

Anda bisa mengatur variables ini jika menggunakan konfigurasi berbeda.

1. Clone repository ini:
   ```bash
   git clone <repository-url>
   cd simta
   ```

2. Setup backend:
   ```bash
   cd backend
   go mod tidy
   ```

3. Setup frontend:
   ```bash
   cd ../frontend
   npm install
   ```

## Menjalankan Aplikasi

### Development Mode

1. Jalankan backend:
   ```bash
   cd backend
   go run main.go
   ```
   Backend akan berjalan di `http://localhost:3536`

2. Jalankan frontend (di terminal baru):
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend akan berjalan di `http://localhost:3535`

3. Buka browser dan akses `http://localhost:3535`

### Production Mode

1. Build dan jalankan backend:
   ```bash
   cd backend
   go build -o simta-backend
   ./simta-backend
   ```
   Backend akan berjalan di `http://localhost:3536`

2. Build frontend:
   ```bash
   cd frontend
   npm run build
   ```

3. Serve frontend (gunakan web server seperti nginx atau serve):
   ```bash
   npx serve dist
   ```
### Akun Contoh (Demodata)
Daftar akun berikut dapat digunakan untuk pengujian di lingkungan pengembangan:

| Peran | Username (ID) | Password | Contoh Nyata |
| :--- | :--- | :--- | :--- |
| **Koordinator Prodi** | `admin` | `admin123` | - |
| **Dosen** | *NIDN* | `password` | `1115098207` (Ahmad Fauzi) |
| **Mahasiswa** | *NIM* | *NIM* (default) | `22254321013` (Wahyu Suhendri) |

### Alur Kerja (Workflow)
1. **Koordinator Prodi** membuka semester baru dan memigrasikan mahasiswa.
2. **Dosen** melakukan bimbingan rutin dan memberikan izin sidang.
3. **Koordinator Prodi** menginput jadwal dan nilai sidang.
4. **Mahasiswa** mengunggah laporan akhir (PDF) yang sudah disahkan.
5. **Koordinator Prodi** melakukan penutupan (Arsip) semester.

## API Endpoints

- `/api/login` - Login dosen/mahasiswa
- `/api/dosen` - CRUD dosen
- `/api/mahasiswa` - CRUD mahasiswa
- `/api/bimbingan` - Manajemen bimbingan & lifecycle (Submit, Accept, Complete, Offline)
- `/api/berkas` - Upload dan manajemen berkas terikat sesi bimbingan
- `/api/events` - Manajemen events
- `/api/semesters` - Manajemen semester

## Database

Database PostgreSQL berjalan di container Podman. Data akan dipersist di volume `simta_pgdata`.

Untuk menghentikan container:
```bash
podman stop simta-postgres
```

Untuk memulai ulang:
```bash
podman start simta-postgres
```

Untuk melihat logs:
```bash
podman logs simta-postgres
```

## Upload Files

File berkas disimpan di folder `backend/uploads/`.

## Contributing

1. Fork repository
2. Buat branch fitur baru
3. Commit perubahan
4. Push ke branch
5. Buat Pull Request

## License

[MIT License](LICENSE)</content>
<parameter name="filePath">/home/mriza/Projects/simta/README.md