-- SIMTA Production Initialization Script
-- Purposes: 
-- 1. Purge transactional logs (bimbingan, berkas, audits, etc.)
-- 2. Initialize the current active semester
-- 3. Setup the academic calendar (events)
-- Note: Lecturer and Student profiles are RETAINED.

-- Clean up transactional tables
TRUNCATE TABLE bimbingan CASCADE;
TRUNCATE TABLE berkas CASCADE;
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE rekomendasi_sidang CASCADE;
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE semesters CASCADE;

-- Initialize Semester Genap 2025/2026
INSERT INTO semesters (id, name, academic_year, term, status) 
VALUES ('s2526genap', 'Semester Genap 2025/2026', '2025/2026', 'Genap', 'active');

-- Setup Academic Calendar (Events)
INSERT INTO events (id, title, start_date, end_date, type, is_mandatory, category) VALUES
('e1', 'Awal Bimbingan Proyek Akhir', '2026-02-01', '2026-02-07', 'normal', 1, 'akademik'),
('e2', 'Batas Akhir Bimbingan Reguler', '2026-06-25', NULL, 'warning', 1, 'akademik'),
('e3', 'Pendaftaran Sidang Tugas Akhir', '2026-06-26', '2026-06-30', 'primary', 1, 'akademik'),
('e4', 'Pelaksanaan Sidang TA (Gelombang 1)', '2026-07-01', '2026-07-10', 'holiday', 1, 'akademik'),
('e5', 'Batas Akhir Penyerahan Laporan Final', '2026-07-25', NULL, 'danger', 1, 'akademik'),
('e6', 'Yudisium & Penutupan Semester', '2026-07-31', NULL, 'success', 1, 'akademik');

-- Reset all students' sidang permissions (must be re-obtained this semester)
UPDATE mahasiswa SET ijinkan_sidang = 0, setuju_pembimbing1 = 0, setuju_pembimbing2 = 0;

-- Optional: Ensure global configuration is ready
INSERT INTO config (key, value) VALUES ('academic_year', '2025/2026') ON CONFLICT (key) DO UPDATE SET value = '2025/2026';
INSERT INTO config (key, value) VALUES ('term', 'Genap') ON CONFLICT (key) DO UPDATE SET value = 'Genap';

-- Seed Koordinator Prodi (admin:admin123)
-- Role 'prodi' grants overarching monitoring and configuration access.
INSERT INTO dosen (id, nidn, nama, role, password, must_change_password)
VALUES ('adm-prodi', 'admin', 'Koordinator Prodi', 'prodi', '$2a$10$OVy2SQjucfh/ToHRWhgmFe7XpiVbANaLred3jzeg/zlTUPMFBxxsK', 0)
ON CONFLICT (nidn) DO UPDATE SET role = 'prodi', nama = 'Koordinator Prodi';
