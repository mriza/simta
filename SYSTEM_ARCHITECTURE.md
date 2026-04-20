# Arsitektur Sistem SIMTA

## Overview
SIMTA (Sistem Monitoring Tugas Akhir) adalah aplikasi web untuk monitoring proses bimbingan tugas akhir mahasiswa. Sistem terdiri dari frontend React/TypeScript dan backend Go dengan database PostgreSQL.

## Komponen Sistem

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Port Development**: 3535
- **Port Production**: 3535 (Exposed via Cloudflare Tunnel)
- **Domain**: https://simta.cerdas.club
- **Build Output**: `frontend/dist/`

### Backend
- **Framework**: Go + Chi Router
- **Database**: PostgreSQL
- **Port Development**: 3536
- **Port Production**: 3536 (Exposed via Cloudflare Tunnel)
- **Domain**: https://api-simta.cerdas.club
- **API Base**: `/api`

### Database
- **Engine**: PostgreSQL
- **Default Port**: 5433 (Mapped to Host)
- **Tables**:
  - `mahasiswa` - Data mahasiswa
  - `dosen` - Data dosen pembimbing
  - `bimbingan` - Sesi bimbingan
  - `berkas` - File upload berkas
  - `semester` - Konfigurasi semester
  - `events` - Event/acara akademik

## Deployment & Networking (STRICT)

The system relies on a **locked port configuration** to maintain compatibility with Cloudflare Tunnels:

1. **Frontend (3535)**: Nginx (container) listens on 3535, mapped to host 3535.
2. **Backend (3536)**: Go binary (container) listens on 3536, mapped to host 3536.

### Production Environment
- **Frontend**: Deployed at https://simta.cerdas.club
- **Backend**: Deployed at https://api-simta.cerdas.club
- **Tunnel**: Cloudflare Tunnel points directly to port 3535 (frontend) and 3536 (backend).

### Cloudflare Tunnel Configuration
```yaml
# cloudflared config.yaml
tunnel: simta-tunnel
credentials-file: /path/to/credentials.json

ingress:
  - hostname: simta.cerdas.club
    service: http://localhost:3535
  - hostname: api-simta.cerdas.club
    service: http://localhost:3536
  - service: http_status:404
```

### Environment Variables

#### Backend (.env)
```env
PORT=3536
DB_HOST=host.docker.internal
DB_PORT=5433
DB_USER=simta_user
DB_PASSWORD=simta_pass
DB_NAME=simta
JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-admin-password
CORS_ALLOWED_ORIGINS=http://localhost:3535,http://localhost:3536,https://simta.cerdas.club:3535,https://api-simta.cerdas.club:3536
```

#### Frontend (.env)
```env
VITE_HOST=0.0.0.0
VITE_PORT=3535
VITE_API_PROXY=http://localhost:3536
VITE_API_BASE=/api
```

#### Frontend Production (.env.production)
```env
VITE_API_BASE=https://api-simta.cerdas.club/api
```

## Security Configuration

### CORS Policy
Backend mengizinkan request dari:
- `http://localhost:3535` (development frontend)
- `https://simta.cerdas.club` (production frontend)
- `https://api-simta.cerdas.club` (direct API access)

### Authentication
- JWT tokens dengan expiry 24 jam
- Role-based access control (umum, mhs, dosen, prodi)
- Password hashing menggunakan bcrypt

### File Upload Security
- Validasi MIME type untuk berkas
- File disimpan di `backend/uploads/`
- Access control berdasarkan ownership

## Database Schema

### Core Tables
- **mahasiswa**: NIM, nama, bab, pembimbing1/2, status_proses
- **dosen**: NIDN, nama, bidang, email, hp
- **bimbingan**: mhs_id, dosen_id, tanggal, status, feedback
- **berkas**: bimbingan_id, file_path, file_name, storage_mode

### Relationships
- Mahasiswa ↔ Dosen (pembimbing1_id, pembimbing2_id)
- Bimbingan ↔ Mahasiswa (mhs_id)
- Berkas ↔ Bimbingan (bimbingan_id)

## API Endpoints

### Public Endpoints
- `POST /api/login` - Authentication
- `GET /api/dosen` - List dosen
- `GET /api/dashboard` - Dashboard stats

### Protected Endpoints (Role-based)
- Mahasiswa: `/api/bimbingan`, `/api/mahasiswa/{id}`
- Dosen: `/api/mahasiswa`, `/api/bimbingan`, `/api/berkas`
- Prodi: All endpoints including CRUD operations

## Monitoring & Logging

### Application Logs
- Chi middleware logger untuk HTTP requests
- Database migration logs
- Error logging ke stdout

### Health Checks
- Database connectivity check
- API endpoint availability
- File system permissions

## Backup & Recovery

### Database Backup
```bash
pg_dump -h localhost -p 5433 -U simta_user simta > backup.sql
```

### File Backup
```bash
tar -czf uploads_backup.tar.gz backend/uploads/
```

### Recovery
```bash
psql -h localhost -p 5433 -U simta_user simta < backup.sql
tar -xzf uploads_backup.tar.gz -C backend/
```

## Troubleshooting

### Common Issues

#### Bad Gateway Error
- Pastikan backend berjalan di port 3536
- Periksa Cloudflare tunnel status
- Verify CORS configuration

#### Database Connection Failed
- Periksa PostgreSQL service status
- Verify connection string di `.env`
- Check database user permissions

#### File Upload Failed
- Periksa `backend/uploads/` permissions
- Verify file size limits
- Check disk space availability

### Logs Location
- Application logs: stdout/stderr
- Database logs: PostgreSQL log files
- Web server logs: Cloudflare dashboard

## Performance Optimization

### Database
- Indexes pada kolom pencarian umum (nim, nidn, status_proses)
- Connection pooling dengan sql.DB
- Query optimization dengan EXPLAIN ANALYZE

### Frontend
- Code splitting dengan Vite
- Lazy loading untuk routes
- Image optimization dan caching

### Backend
- Chi router untuk high-performance routing
- Efficient JSON marshaling
- File serving dengan proper headers

## Future Enhancements

### Planned Features
- Real-time notifications (WebSocket)
- Advanced reporting dengan charts
- Mobile app companion
- Integration dengan LMS (Learning Management System)

### Infrastructure Improvements
- Docker containerization
- Kubernetes deployment
- CDN untuk static assets
- Database read replicas

---

**Last Updated**: April 19, 2026
**Version**: 1.0.0