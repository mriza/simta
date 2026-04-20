package main

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func loadDotEnv(path string) {
	searchPaths := []string{path}
	if path == ".env" {
		searchPaths = append(searchPaths, filepath.Join("backend", ".env"), filepath.Join("..", ".env"))
	}

	var data []byte
	for _, p := range searchPaths {
		var err error
		data, err = os.ReadFile(p)
		if err == nil {
			break
		}
	}
	if data == nil {
		return
	}

	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])
		if _, exists := os.LookupEnv(key); !exists {
			value = strings.Trim(value, "\"'")
			os.Setenv(key, value)
		}
	}
}

func parseCommaSeparated(raw string) []string {
	parts := strings.Split(raw, ",")
	var result []string
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}

// rebind converts ? placeholders to PostgreSQL $1, $2, ... style.
func rebind(q string) string {
	n := 0
	var buf strings.Builder
	for i := 0; i < len(q); i++ {
		if q[i] == '?' {
			n++
			buf.WriteByte('$')
			buf.WriteString(strconv.Itoa(n))
		} else {
			buf.WriteByte(q[i])
		}
	}
	return buf.String()
}

// dbExec, dbQuery, dbQueryRow are wrappers that auto-rebind ? → $N for PostgreSQL.
func dbExec(query string, args ...any) (sql.Result, error) {
	return db.Exec(rebind(query), args...)
}

func dbQuery(query string, args ...any) (*sql.Rows, error) {
	return db.Query(rebind(query), args...)
}

func dbQueryRow(query string, args ...any) *sql.Row {
	return db.QueryRow(rebind(query), args...)
}

func initDB(dsn string) error {
	if dsn == "" {
		host := getEnv("DB_HOST", "localhost")
		port := getEnv("DB_PORT", "5433")
		user := getEnv("DB_USER", "simta_user")
		pass := getEnv("DB_PASSWORD", "simta_pass")
		name := getEnv("DB_NAME", "simta")
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			host, port, user, pass, name)
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	if err := db.Ping(); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}
	if err := migrate(); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	if err := seedIfEmpty(); err != nil {
		log.Printf("seed: %v", err)
	}
	ensurePasswords()
	return nil
}

func migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS dosen (
			id       TEXT PRIMARY KEY,
			nidn     TEXT NOT NULL UNIQUE,
			nama     TEXT NOT NULL,
			bidang   TEXT,
			email    TEXT,
			hp       TEXT,
			password TEXT,
			role     TEXT NOT NULL DEFAULT 'dosen',
			must_change_password INTEGER DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS mahasiswa (
			id               TEXT PRIMARY KEY,
			nim              TEXT NOT NULL UNIQUE,
			nama             TEXT NOT NULL,
			bab              TEXT NOT NULL DEFAULT 'Bab 1',
			rutin            TEXT NOT NULL DEFAULT 'Ya (Tidak Rutin)',
			bimb1            INTEGER NOT NULL DEFAULT 0,
			bimb2            INTEGER NOT NULL DEFAULT 0,
			terakhir         TEXT,
			status_alat      TEXT,
			fitur            TEXT,
			kendala_skripsi  TEXT,
			kendala_alat     TEXT,
			hp               TEXT,
			hp_ortu          TEXT,
			alamat           TEXT,
			pb1              TEXT REFERENCES dosen(id),
			pb2              TEXT REFERENCES dosen(id),
			ijinkan_sidang   INTEGER DEFAULT 0,
			status_sidang    TEXT DEFAULT 'Belum Sidang',
			tanggal_sidang   TEXT,
			hasil_sidang     TEXT,
			nilai_bimbingan  TEXT,
			nilai_laporan    TEXT,
			nilai_sidang     TEXT,
			nilai_akhir      TEXT,
			file_laporan_final TEXT,
			setuju_pembimbing1 INTEGER DEFAULT 0,
			setuju_pembimbing2 INTEGER DEFAULT 0,
			must_change_password INTEGER DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS bimbingan (
			id            TEXT PRIMARY KEY,
			mhs_id        TEXT NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
			tanggal       TEXT NOT NULL,
			peran         TEXT NOT NULL DEFAULT '1',
			topik         TEXT,
			bab           TEXT,
			kendala_mhs   TEXT,
			kendala_dosen TEXT,
			feedback_dosen TEXT,
			status_alat   TEXT,
			status        TEXT DEFAULT 'Draft',
			offline_status TEXT,
			offline_date TEXT,
			offline_place TEXT,
			completed_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS config (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS events (
			id         TEXT PRIMARY KEY,
			title      TEXT NOT NULL,
			start_date TEXT NOT NULL,
			end_date   TEXT,
			type       TEXT NOT NULL DEFAULT 'normal',
			is_mandatory INTEGER DEFAULT 0,
			category     TEXT NOT NULL DEFAULT 'lainnya'
		)`,
		`CREATE TABLE IF NOT EXISTS semesters (
			id            TEXT PRIMARY KEY,
			name          TEXT NOT NULL,
			academic_year TEXT NOT NULL,
			term          TEXT NOT NULL,
			status        TEXT NOT NULL DEFAULT 'active'
		)`,
		`CREATE TABLE IF NOT EXISTS berkas (
			id              TEXT PRIMARY KEY,
			mhs_id          TEXT NOT NULL REFERENCES mahasiswa(id),
			semester_id     TEXT NOT NULL,
			bimbingan_id    TEXT,
			file_path       TEXT NOT NULL,
			file_name       TEXT NOT NULL,
			file_type       TEXT,
			bab             TEXT,
			storage_mode    TEXT NOT NULL DEFAULT 'file',
			external_url    TEXT,
			kendala         TEXT,
			uploaded_at     TEXT NOT NULL,
			dosen_id        TEXT REFERENCES dosen(id),
			feedback        TEXT,
			feedback_first_saved_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS audit_log (
			id          TEXT PRIMARY KEY,
			user_id     TEXT NOT NULL,
			user_role   TEXT NOT NULL,
			action      TEXT NOT NULL,
			table_name  TEXT NOT NULL,
			record_id   TEXT NOT NULL,
			old_values  TEXT,
			new_values  TEXT,
			ip_address  TEXT,
			user_agent  TEXT,
			created_at  TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS rekomendasi_sidang (
			id          TEXT PRIMARY KEY,
			mhs_id      TEXT NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
			token       TEXT NOT NULL UNIQUE,
			created_at  TEXT NOT NULL
		)`,
		`DO $$ 
		BEGIN 
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mahasiswa' AND column_name='setuju_pembimbing1') THEN
				ALTER TABLE mahasiswa ADD COLUMN setuju_pembimbing1 INTEGER DEFAULT 0;
			END IF;
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mahasiswa' AND column_name='setuju_pembimbing2') THEN
				ALTER TABLE mahasiswa ADD COLUMN setuju_pembimbing2 INTEGER DEFAULT 0;
			END IF;
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dosen' AND column_name='role') THEN
				ALTER TABLE dosen ADD COLUMN role TEXT NOT NULL DEFAULT 'dosen';
			END IF;
		END $$;`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("exec %q: %w", s[:min(40, len(s))], err)
		}
	}

	// Manual Migrations (Adding columns if they don't exist)
	migrations := []string{
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS feedback_dosen TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft'",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS status_alat TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS offline_status TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS completed_at TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS file_laporan_final TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS status_proses TEXT DEFAULT 'Bimbingan'",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS semester_id TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS master_id TEXT",
		"ALTER TABLE mahasiswa RENAME COLUMN bimb1 TO jml_bimbingan1",
		"ALTER TABLE mahasiswa RENAME COLUMN bimb2 TO jml_bimbingan2",
		"ALTER TABLE mahasiswa RENAME COLUMN pb1 TO pembimbing1_id",
		"ALTER TABLE mahasiswa RENAME COLUMN pb2 TO pembimbing2_id",
		// Add CHECK constraints for enum values
		"ALTER TABLE mahasiswa ADD CONSTRAINT IF NOT EXISTS check_status_proses CHECK (status_proses IN ('Bimbingan', 'Lulus', 'Lanjut', 'Berhenti'))",
		"ALTER TABLE bimbingan ADD CONSTRAINT IF NOT EXISTS check_peran CHECK (peran IN ('1', '2'))",
		"ALTER TABLE bimbingan ADD CONSTRAINT IF NOT EXISTS check_status CHECK (status IN ('Draft', 'Proposed', 'InReview', 'OfflineScheduled', 'Completed'))",
		"ALTER TABLE semesters ADD CONSTRAINT IF NOT EXISTS check_term CHECK (term IN ('Ganjil', 'Genap'))",
		"ALTER TABLE semesters ADD CONSTRAINT IF NOT EXISTS check_status CHECK (status IN ('active', 'archived'))",
		"ALTER TABLE events ADD CONSTRAINT IF NOT EXISTS check_type CHECK (type IN ('critical', 'important', 'normal'))",
		"ALTER TABLE events ADD CONSTRAINT IF NOT EXISTS check_category CHECK (category IN ('sidang', 'bimbingan', 'yudisium', 'update', 'proposal', 'lainnya'))",
		// Add foreign key constraint for semester_id
		"ALTER TABLE mahasiswa ADD CONSTRAINT IF NOT EXISTS fk_mahasiswa_semester FOREIGN KEY (semester_id) REFERENCES semesters(id)",
		// Enable pg_trgm extension for text similarity search
		"CREATE EXTENSION IF NOT EXISTS pg_trgm",
		// Create indexes for TA title search
		"CREATE INDEX IF NOT EXISTS idx_bimbingan_topik_gin ON bimbingan USING gin(to_tsvector('indonesian', topik))",
		"CREATE INDEX IF NOT EXISTS idx_bimbingan_topik_trgm ON bimbingan USING gin(topik gin_trgm_ops)",
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			log.Printf("Migration failed (likely already applied): %v", err)
		}
	}

	// Schema updates for existing tables — use IF NOT EXISTS (PostgreSQL 9.6+)
	alterStmts := []string{
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS hp TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS hp_ortu TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS alamat TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS semester_id TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS master_id TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS status_proses TEXT DEFAULT 'Bimbingan'",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS password TEXT",
		"ALTER TABLE dosen ADD COLUMN IF NOT EXISTS password TEXT",
		"ALTER TABLE dosen ADD COLUMN IF NOT EXISTS must_change_password INTEGER DEFAULT 1",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS must_change_password INTEGER DEFAULT 1",
		"ALTER TABLE events ADD COLUMN IF NOT EXISTS is_mandatory INTEGER DEFAULT 0",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS bab TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS kendala_mhs TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS kendala_dosen TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed'",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS offline_status TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS offline_date TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS offline_place TEXT",
		"ALTER TABLE bimbingan ADD COLUMN IF NOT EXISTS completed_at TEXT",
		"ALTER TABLE berkas ADD COLUMN IF NOT EXISTS storage_mode TEXT DEFAULT 'file'",
		"ALTER TABLE berkas ADD COLUMN IF NOT EXISTS external_url TEXT",
		"ALTER TABLE berkas ADD COLUMN IF NOT EXISTS bimbingan_id TEXT",
		"ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'lainnya'",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS ijinkan_sidang INTEGER DEFAULT 0",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS status_sidang TEXT DEFAULT 'Belum Sidang'",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS tanggal_sidang TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS hasil_sidang TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS nilai_bimbingan TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS nilai_laporan TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS nilai_sidang TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS nilai_akhir TEXT",
		"ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS file_laporan_final TEXT",
	}
	// Post-migration table rename if needed
	db.Exec("ALTER TABLE artefak RENAME TO berkas")
	for _, s := range alterStmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("alter (ignored): %v", err)
		}
	}

	return nil
}

// ensurePasswords sets a default hashed password for any user that has none.
// Dosen default: "defaultpassword". Mahasiswa default: their NIM.
func ensurePasswords() {
	defaultHash, _ := bcrypt.GenerateFromPassword([]byte("defaultpassword"), bcrypt.DefaultCost)

	var dosenIDs []string
	if rows, err := dbQuery("SELECT id FROM dosen WHERE password IS NULL OR password = ''"); err == nil {
		for rows.Next() {
			var id string
			rows.Scan(&id)
			dosenIDs = append(dosenIDs, id)
		}
		rows.Close()
	}
	for _, id := range dosenIDs {
		dbExec("UPDATE dosen SET password=? WHERE id=?", string(defaultHash), id)
	}

	type mhsRow struct{ id, nim string }
	var mhsList []mhsRow
	if rows, err := dbQuery("SELECT id, nim FROM mahasiswa WHERE password IS NULL OR password = ''"); err == nil {
		for rows.Next() {
			var r mhsRow
			rows.Scan(&r.id, &r.nim)
			mhsList = append(mhsList, r)
		}
		rows.Close()
	}
	for _, m := range mhsList {
		nimHash, _ := bcrypt.GenerateFromPassword([]byte(m.nim), bcrypt.DefaultCost)
		dbExec("UPDATE mahasiswa SET password=? WHERE id=?", string(nimHash), m.id)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func uid(prefix string) string {
	return fmt.Sprintf("%s-%x%x", prefix, time.Now().UnixNano(), rand.Int63())
}

func seedIfEmpty() error {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM dosen").Scan(&count)
	if count == 0 {
		if err := seedDosen(); err != nil {
			return err
		}
	}

	db.QueryRow("SELECT COUNT(*) FROM config").Scan(&count)
	if count == 0 {
		if err := seedConfig(); err != nil {
			return err
		}
	}

	db.QueryRow("SELECT COUNT(*) FROM events").Scan(&count)
	if count == 0 {
		if err := seedEvents(); err != nil {
			return err
		}
	}

	var semCount int
	db.QueryRow("SELECT COUNT(*) FROM semesters").Scan(&semCount)
	if semCount == 0 {
		dbExec("INSERT INTO semesters(id, name, academic_year, term, status) VALUES(?,?,?,?,?)",
			"s-initial", "Semester Genap 2025/2026", "2025/2026", "Genap", "active")
	}
	return nil
}

func seedDosen() error {
	log.Println("Seeding dosen & mahasiswa...")

	hashed, _ := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)

	dosenData := []Dosen{
		{ID: "d1", NIDN: "1012078901", Nama: "Dr. Agus Pratama, M.T.", Bidang: "IoT, Embedded Systems", Email: "agus.pratama@politeknik.ac.id", HP: "081234567890", Password: string(hashed)},
		{ID: "d2", NIDN: "1023058502", Nama: "Rina Wulandari, M.Kom.", Bidang: "Machine Learning, Computer Vision", Email: "rina.w@politeknik.ac.id", HP: "081234567891", Password: string(hashed)},
		{ID: "d3", NIDN: "1105098303", Nama: "Budi Santoso, M.T.", Bidang: "Jaringan Komputer, LoRa", Email: "budi.s@politeknik.ac.id", HP: "081234567892", Password: string(hashed)},
		{ID: "d4", NIDN: "1018127804", Nama: "Dewi Anggraini, M.Kom.", Bidang: "Rekayasa Perangkat Lunak, Web", Email: "dewi.a@politeknik.ac.id", HP: "081234567893", Password: string(hashed)},
		{ID: "d5", NIDN: "1130068005", Nama: "Hendra Wijaya, M.T.", Bidang: "Sensor, Instrumentasi", Email: "hendra.w@politeknik.ac.id", HP: "081234567894", Password: string(hashed)},
		{ID: "d6", NIDN: "1201037906", Nama: "Siti Rahayu, M.Kom.", Bidang: "Basis Data, Sistem Informasi", Email: "siti.r@politeknik.ac.id", HP: "081234567895", Password: string(hashed)},
		{ID: "d7", NIDN: "1115098207", Nama: "Ahmad Fauzi, M.T.", Bidang: "Kecerdasan Buatan, Data Mining", Email: "ahmad.f@politeknik.ac.id", HP: "081234567896", Password: string(hashed)},
		{ID: "d8", NIDN: "1028068408", Nama: "Nur Hidayah, M.Kom.", Bidang: "Computer Vision, Image Processing", Email: "nur.h@politeknik.ac.id", HP: "081234567897", Password: string(hashed)},
		{ID: "d9", NIDN: "1020097509", Nama: "Rizky Firmansyah, M.T.", Bidang: "Wireless Sensor Network, Arduino", Email: "rizky.f@politeknik.ac.id", HP: "081234567898", Password: string(hashed)},
	}

	for _, d := range dosenData {
		dbExec("INSERT INTO dosen(id,nidn,nama,bidang,email,hp,password) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
			d.ID, d.NIDN, d.Nama, d.Bidang, d.Email, d.HP, d.Password)
	}

	mhsData := []struct {
		NIM            string
		Nama           string
		Bab            string
		Rutin          string
		Bimb1          int
		Bimb2          int
		Terakhir       string
		StatusAlat     string
		Fitur          string
		KendalaSkripsi string
		KendalaAlat    string
		PB1Idx         int
		PB2Idx         int
	}{
		{"22254321013", "Wahyu Suhendri", "Bab 4", "Tidak", 2, 2, "2026-01-09", "Pengembangan (Coding/Pembuatan)", "untuk fitur utama belum sepenuhnya jadi, baru sampai tahap melatih model untuk memprediksi jenis penyakit padi", "bab 4 masih bingung apa yang harus dibuat, karena aplikasi/alat belum sepenuhnya jadi", "sering error kodingan, laptop tidak sanggup multitasking, sering 'Not Responding'", 0, 2},
		{"22254321001", "Ariefqi Hidayatul Amdev", "Bab 3", "Ya (Tidak Rutin)", 1, 1, "2026-04-13", "Perancangan (Design)", "Sistem klasifikasi gas berbahaya menggunakan sensor MQ-2, MQ-7, MQ-135", "Pada bab 3 dan bab 4 karena alat belum selesai dibuat dan belum mendapatkan data sensor", "Pada pemrograman alatnya", 0, 2},
		{"21254323023", "Anafis Al Ghani", "Bab 3", "Ya (Tidak Rutin)", 7, 3, "2026-04-15", "Pengembangan (Coding/Pembuatan)", "Komponen lengkap: esp32, flow sensor, turbidity sensor, pompa air; monitoring web (Netlify), data Supabase, HTML/CSS/JS", "Bab 4 menyesuaikan penelitian terdahulu terkait akurasi, rumus berbeda antar penelitian", "Desain/tampilan masih berserakan, butuh penyesuaian front-end", 6, 0},
	}

	dosenIDs := []string{"d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9"}

	for _, m := range mhsData {
		id := uid("m")
		pb1 := dosenIDs[m.PB1Idx%len(dosenIDs)]
		pb2 := dosenIDs[m.PB2Idx%len(dosenIDs)]
		nimHash, _ := bcrypt.GenerateFromPassword([]byte(m.NIM), bcrypt.DefaultCost)
		dbExec(`INSERT INTO mahasiswa
			(id,nim,nama,bab,rutin,jml_bimbingan1,jml_bimbingan2,terakhir,status_alat,fitur,kendala_skripsi,kendala_alat,pembimbing1_id,pembimbing2_id,semester_id,status_proses,password)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
			id, m.NIM, m.Nama, m.Bab, m.Rutin, m.Bimb1, m.Bimb2,
			m.Terakhir, m.StatusAlat, m.Fitur, m.KendalaSkripsi, m.KendalaAlat,
			pb1, pb2, "s-initial", "Bimbingan", string(nimHash),
		)
	}
	return nil
}

func seedConfig() error {
	log.Println("Seeding config...")
	configs := map[string]string{
		"inst_name":     "Politeknik Negeri",
		"dept_name":     "Jurusan Teknik Elektro",
		"prog_name":     "Teknologi Rekayasa Komputer",
		"academic_year": "2025/2026",
		"semester":      "Genap",
	}
	for k, v := range configs {
		dbExec("INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT DO NOTHING", k, v)
	}
	var semCount int
	db.QueryRow("SELECT COUNT(*) FROM semesters").Scan(&semCount)
	if semCount == 0 {
		dbExec("INSERT INTO semesters(id, name, academic_year, term, status) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING",
			"s-initial", "Semester Genap 2025/2026", "2025/2026", "Genap", "active")
	}
	return nil
}

func seedEvents() error {
	log.Println("Seeding events...")
	events := []struct {
		title, start, end, ttype string
		is_mandatory             int
	}{
		{"Pengajuan Judul TA", "2026-02-01", "2026-02-15", "critical", 0},
		{"Proses Bimbingan", "2026-02-16", "2026-06-30", "normal", 0},
		{"Seminar Proposal", "2026-04-01", "2026-04-15", "important", 0},
		{"Sidang Akhir", "2026-07-06", "2026-07-20", "critical", 0},
		{"Update Data Pribadi Mahasiswa", "2026-02-01", "2026-02-28", "important", 1},
	}
	for _, e := range events {
		dbExec("INSERT INTO events(id, title, start_date, end_date, type, is_mandatory) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING",
			uid("ev"), e.title, e.start, e.end, e.ttype, e.is_mandatory)
	}
	return nil
}

func syncMahasiswaStats(mhsID string) error {
	var b1, b2 int
	dbQueryRow("SELECT COUNT(*) FROM bimbingan WHERE mhs_id=? AND peran='1'", mhsID).Scan(&b1)
	dbQueryRow("SELECT COUNT(*) FROM bimbingan WHERE mhs_id=? AND peran='2'", mhsID).Scan(&b2)

	var tgl, bab, status, kMhs sql.NullString
	err := dbQueryRow(`
		SELECT tanggal, bab, status_alat, kendala_mhs
		FROM bimbingan
		WHERE mhs_id=?
		ORDER BY tanggal DESC, id DESC LIMIT 1`, mhsID).Scan(&tgl, &bab, &status, &kMhs)

	if err != nil && err != sql.ErrNoRows {
		return err
	}

	_, err = dbExec(`
		UPDATE mahasiswa SET
			jml_bimbingan1=?,
			jml_bimbingan2=?,
			terakhir=?,
			bab=COALESCE(?, 'Bab 1'),
			status_alat=COALESCE(?, 'Perancangan (Design)'),
			kendala_skripsi=COALESCE(?, '')
		WHERE id=?`,
		b1, b2, tgl.String, bab.String, status.String, kMhs.String, mhsID)

	return err
}
