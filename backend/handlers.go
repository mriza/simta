package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	NIDN     string `json:"nidn"`
	Password string `json:"password"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type Claims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type authContext struct {
	Role   string
	UserID string
}

type authContextKey struct{}

func getContext(r *http.Request) (string, string) {
	if auth, ok := r.Context().Value(authContextKey{}).(authContext); ok && auth.Role != "" {
		return auth.Role, auth.UserID
	}
	return "umum", ""
}

func respondJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// ---- AUTH ----

func parseTokenFromHeader(authHeader string) (*Claims, error) {
	if authHeader == "" {
		return nil, errors.New("missing token")
	}
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, errors.New("invalid token")
	}

	tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

func withAuthContext(r *http.Request, claims *Claims) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), authContextKey{}, authContext{
		Role:   claims.Role,
		UserID: claims.UserID,
	}))
}

func populateAuthContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			next.ServeHTTP(w, r)
			return
		}

		claims, err := parseTokenFromHeader(authHeader)
		if err != nil {
			respondError(w, 401, "invalid token")
			return
		}

		next.ServeHTTP(w, withAuthContext(r, claims))
	})
}

func makeToken(userID, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, 400, "invalid request")
		return
	}

	// 1. Admin prodi
	if req.NIDN == adminUsername && req.Password == adminPassword {
		tokenString, err := makeToken("admin", "prodi")
		if err != nil {
			respondError(w, 500, "failed to generate token")
			return
		}
		respondJSON(w, 200, map[string]string{"token": tokenString, "role": "prodi", "user_id": "admin", "name": "Koordinator Prodi"})
		return
	}

	// 2. Dosen (login via NIDN)
	var d Dosen
	var hashed sql.NullString
	var mustChange sql.NullInt64
	var role sql.NullString
	err := dbQueryRow(`SELECT id, nidn, nama, password, role, must_change_password FROM dosen WHERE nidn = ?`, req.NIDN).
		Scan(&d.ID, &d.NIDN, &d.Nama, &hashed, &role, &mustChange)

	if err == nil && hashed.Valid {
		if bcrypt.CompareHashAndPassword([]byte(hashed.String), []byte(req.Password)) == nil {
			userRole := "dosen"
			if role.Valid && role.String != "" {
				userRole = role.String
			}
			tokenString, err := makeToken(d.ID, userRole)
			if err != nil {
				respondError(w, 500, "failed to generate token")
				return
			}
			respondJSON(w, 200, map[string]string{
				"token":                tokenString,
				"role":                 userRole,
				"user_id":              d.ID,
				"name":                 d.Nama,
				"must_change_password": strconv.FormatInt(mustChange.Int64, 10),
			})
			return
		}
	}

	// 3. Mahasiswa (login via NIM)
	var m Mahasiswa
	var mhsPassword sql.NullString
	var mhsMustChange sql.NullInt64
	err = dbQueryRow("SELECT id,nim,nama,password,must_change_password FROM mahasiswa WHERE nim=?", req.NIDN).Scan(&m.ID, &m.NIM, &m.Nama, &mhsPassword, &mhsMustChange)
	if err == nil {
		if !mhsPassword.Valid || mhsPassword.String == "" {
			respondError(w, 401, "Akun belum memiliki password, hubungi admin")
			return
		}
		if bcrypt.CompareHashAndPassword([]byte(mhsPassword.String), []byte(req.Password)) != nil {
			respondError(w, 401, "NIM atau password salah")
			return
		}
		// Check if password change is required
		if mhsMustChange.Valid && mhsMustChange.Int64 == 1 {
			tokenString, err := makeToken(m.ID, "mhs")
			if err != nil {
				respondError(w, 500, "failed to generate token")
				return
			}
			response := map[string]interface{}{
				"token":                tokenString,
				"role":                 "mhs",
				"user_id":              m.ID,
				"name":                 m.Nama,
				"must_change_password": true,
				"message":              "Password default detected. Please change your password.",
			}
			respondJSON(w, 200, response)
			return
		}
		tokenString, err := makeToken(m.ID, "mhs")
		if err != nil {
			respondError(w, 500, "failed to generate token")
			return
		}
		respondJSON(w, 200, map[string]string{"token": tokenString, "role": "mhs", "user_id": m.ID, "name": m.Nama})
		return
	}

	respondError(w, 401, "Akun tidak ditemukan")
}

func changePassword(w http.ResponseWriter, r *http.Request) {
	role, userID := getContext(r)
	if role == "" {
		respondError(w, 401, "Unauthorized")
		return
	}

	var req ChangePasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if len(req.NewPassword) < 6 {
		respondError(w, 400, "Password baru minimal 6 karakter")
		return
	}

	// Get current password hash from database
	var currentHash string
	var tableName string
	if role == "dosen" {
		tableName = "dosen"
	} else if role == "mhs" {
		tableName = "mahasiswa"
	} else {
		respondError(w, 403, "Role tidak valid untuk mengubah password")
		return
	}

	err := dbQueryRow(fmt.Sprintf("SELECT password FROM %s WHERE id=?", tableName), userID).Scan(&currentHash)
	if err != nil {
		respondError(w, 500, "Gagal mengambil data password")
		return
	}

	// Verify current password
	if bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)) != nil {
		respondError(w, 401, "Password saat ini salah")
		return
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, 500, "Gagal mengenkripsi password baru")
		return
	}

	// Update password and reset must_change_password flag
	_, err = dbExec(fmt.Sprintf("UPDATE %s SET password=?, must_change_password=0 WHERE id=?", tableName), string(newHash), userID)
	if err != nil {
		respondError(w, 500, "Gagal menyimpan password baru")
		return
	}

	respondJSON(w, 200, map[string]string{"message": "Password berhasil diubah"})
}

func logAudit(action, tableName, recordID string, oldValues, newValues map[string]interface{}, r *http.Request) {
	role, userID := getContext(r)
	if role == "" || userID == "" {
		return // Skip logging if no authenticated user
	}

	// Convert maps to JSON strings
	var oldJSON, newJSON string
	if oldValues != nil {
		if data, err := json.Marshal(oldValues); err == nil {
			oldJSON = string(data)
		}
	}
	if newValues != nil {
		if data, err := json.Marshal(newValues); err == nil {
			newJSON = string(data)
		}
	}

	// Get client info
	ip := r.RemoteAddr
	userAgent := r.Header.Get("User-Agent")

	_, err := dbExec(`INSERT INTO audit_log(id, user_id, user_role, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
		uid("audit"), userID, role, action, tableName, recordID, nullStr(oldJSON), nullStr(newJSON), ip, userAgent, time.Now().Format(time.RFC3339))

	if err != nil {
		log.Printf("Failed to log audit: %v", err)
	}
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := parseTokenFromHeader(r.Header.Get("Authorization"))
		if err != nil {
			respondError(w, 401, "authentication required")
			return
		}

		next.ServeHTTP(w, withAuthContext(r, claims))
	})
}

func requireRole(w http.ResponseWriter, r *http.Request, allowed ...string) (string, string, bool) {
	role, uid := getContext(r)
	for _, candidate := range allowed {
		if role == candidate {
			return role, uid, true
		}
	}
	respondError(w, 403, "akses ditolak")
	return "", "", false
}

func dosenOwnsMahasiswa(dosenID, mhsID string) (bool, error) {
	var count int
	err := dbQueryRow("SELECT COUNT(*) FROM mahasiswa WHERE id=? AND (pembimbing1_id=? OR pembimbing2_id=?)", mhsID, dosenID, dosenID).Scan(&count)
	return count > 0, err
}

func getBimbinganMhsID(bimbinganID string) (string, error) {
	var mhsID string
	err := dbQueryRow("SELECT mhs_id FROM bimbingan WHERE id=?", bimbinganID).Scan(&mhsID)
	return mhsID, err
}

func ensureDosenOwnsBimbingan(dosenID, bimbinganID string) (bool, error) {
	mhsID, err := getBimbinganMhsID(bimbinganID)
	if err != nil {
		return false, err
	}
	return dosenOwnsMahasiswa(dosenID, mhsID)
}

func canAccessBerkas(berkasID, role, userID string) (bool, error) {
	var mhsID, pembimbing1, pembimbing2 string
	err := dbQueryRow(`
		SELECT a.mhs_id, COALESCE(m.pembimbing1_id,''), COALESCE(m.pembimbing2_id,'')
		FROM berkas a
		JOIN mahasiswa m ON m.id = a.mhs_id
		WHERE a.id=?`, berkasID).Scan(&mhsID, &pembimbing1, &pembimbing2)
	if err != nil {
		return false, err
	}

	switch role {
	case "prodi":
		return true, nil
	case "mhs":
		return mhsID == userID, nil
	case "dosen":
		return pembimbing1 == userID || pembimbing2 == userID, nil
	default:
		return false, nil
	}
}

// ---- DOSEN ----

func listDosen(w http.ResponseWriter, r *http.Request) {
	rows, err := dbQuery("SELECT id,nidn,nama,bidang,email,hp FROM dosen ORDER BY nama")
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	var result []Dosen
	for rows.Next() {
		var d Dosen
		rows.Scan(&d.ID, &d.NIDN, &d.Nama, &d.Bidang, &d.Email, &d.HP)
		result = append(result, d)
	}
	if result == nil {
		result = []Dosen{}
	}
	respondJSON(w, 200, result)
}

func createDosen(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	var d Dosen
	if err := decodeJSON(r, &d); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if d.NIDN == "" || d.Nama == "" {
		respondError(w, 400, "nidn dan nama wajib diisi")
		return
	}
	if d.Password == "" {
		respondError(w, 400, "password wajib diisi")
		return
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(d.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, 500, "failed to hash password")
		return
	}
	d.ID = uid("d")
	_, err = dbExec("INSERT INTO dosen(id,nidn,nama,bidang,email,hp,password) VALUES(?,?,?,?,?,?,?)",
		d.ID, d.NIDN, d.Nama, d.Bidang, d.Email, d.HP, string(hashed))
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	d.Password = "" // don't return password
	respondJSON(w, 201, d)
}

func updateDosen(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var d Dosen
	if err := decodeJSON(r, &d); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if d.NIDN == "" || d.Nama == "" {
		respondError(w, 400, "nidn dan nama wajib diisi")
		return
	}
	var err error
	if d.Password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(d.Password), bcrypt.DefaultCost)
		if err != nil {
			respondError(w, 500, "failed to hash password")
			return
		}
		_, err = dbExec("UPDATE dosen SET nidn=?,nama=?,bidang=?,email=?,hp=?,password=? WHERE id=?",
			d.NIDN, d.Nama, d.Bidang, d.Email, d.HP, string(hashed), id)
	} else {
		_, err = dbExec("UPDATE dosen SET nidn=?,nama=?,bidang=?,email=?,hp=? WHERE id=?",
			d.NIDN, d.Nama, d.Bidang, d.Email, d.HP, id)
	}
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	d.ID = id
	d.Password = ""
	respondJSON(w, 200, d)
}

func deleteDosen(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var count int
	dbQueryRow("SELECT COUNT(*) FROM mahasiswa WHERE pembimbing1_id=? OR pembimbing2_id=?", id, id).Scan(&count)
	if count > 0 {
		respondError(w, 409, fmt.Sprintf("Dosen masih menjadi pembimbing untuk %d mahasiswa", count))
		return
	}
	dbExec("DELETE FROM dosen WHERE id=?", id)
	respondJSON(w, 200, map[string]bool{"ok": true})
}

// ---- MAHASISWA ----

func listMahasiswa(w http.ResponseWriter, r *http.Request) {
	role, uid := getContext(r)

	if role == "umum" {
		respondError(w, 403, "akses ditolak")
		return
	}

	query := `
		SELECT m.id, m.nim, m.nama, m.bab, m.rutin, m.jml_bimbingan1, m.jml_bimbingan2,
		       COALESCE(m.terakhir,''), m.status_alat, m.fitur, m.kendala_skripsi, m.kendala_alat,
		       COALESCE(m.hp,''), COALESCE(m.hp_ortu,''), COALESCE(m.alamat,''),
		       COALESCE(m.pembimbing1_id,''), COALESCE(m.pembimbing2_id,''),
		       COALESCE(d1.nama,''), COALESCE(d2.nama,''),
		       COALESCE(m.semester_id,''), COALESCE(m.master_id,''), COALESCE(m.status_proses,'Bimbingan'),
		       m.ijinkan_sidang, COALESCE(m.status_sidang,''), COALESCE(m.tanggal_sidang,''), COALESCE(m.hasil_sidang,''),
		       COALESCE(m.nilai_bimbingan,''), COALESCE(m.nilai_laporan,''), COALESCE(m.nilai_sidang,''), COALESCE(m.nilai_akhir,''),
		       COALESCE(m.file_laporan_final,''), m.setuju_pembimbing1, m.setuju_pembimbing2
		FROM mahasiswa m
		LEFT JOIN dosen d1 ON m.pembimbing1_id = d1.id
		LEFT JOIN dosen d2 ON m.pembimbing2_id = d2.id`

	var args []any
	if role == "dosen" && uid != "" {
		query += " WHERE m.pembimbing1_id = ? OR m.pembimbing2_id = ?"
		args = append(args, uid, uid)
	} else if role == "mhs" && uid != "" {
		query += " WHERE m.id = ?"
		args = append(args, uid)
	}

	query += " ORDER BY m.nama"

	rows, err := dbQuery(query, args...)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	var result []Mahasiswa
	for rows.Next() {
		var m Mahasiswa
		rows.Scan(&m.ID, &m.NIM, &m.Nama, &m.Bab, &m.Rutin, &m.JmlBimbingan1, &m.JmlBimbingan2,
			&m.Terakhir, &m.StatusAlat, &m.Fitur, &m.KendalaSkripsi, &m.KendalaAlat,
			&m.HP, &m.HPOrtu, &m.Alamat,
			&m.Pembimbing1ID, &m.Pembimbing2ID, &m.NamaPembimbing1, &m.NamaPembimbing2, &m.SemesterID, &m.MasterID, &m.StatusProses,
			&m.IjinkanSidang, &m.StatusSidang, &m.TanggalSidang, &m.HasilSidang,
			&m.NilaiBimbingan, &m.NilaiLaporan, &m.NilaiSidang, &m.NilaiAkhir, &m.FileFinal,
			&m.SetujuPembimbing1, &m.SetujuPembimbing2)
		result = append(result, m)
	}

	// For Umum role, mask all personal and academic-sensitive data
	if role == "umum" {
		for i := range result {
			result[i].Nama = "Mahasiswa TA"
			result[i].NIM = "*******"
			result[i].HP = ""
			result[i].HPOrtu = ""
			result[i].Alamat = ""
			result[i].Pembimbing1ID = ""
			result[i].Pembimbing2ID = ""
			result[i].NamaPembimbing1 = "Pembimbing"
			result[i].NamaPembimbing2 = "Pembimbing"
			result[i].KendalaSkripsi = ""
			result[i].KendalaAlat = ""
			result[i].Fitur = ""
			result[i].IjinkanSidang = 0
			result[i].StatusSidang = ""
			result[i].TanggalSidang = ""
			result[i].HasilSidang = ""
			result[i].NilaiBimbingan = ""
			result[i].NilaiLaporan = ""
			result[i].NilaiSidang = ""
			result[i].NilaiAkhir = ""
			result[i].FileFinal = ""
		}
	}

	if result == nil {
		result = []Mahasiswa{}
	}
	respondJSON(w, 200, result)
}

func createMahasiswa(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	var m Mahasiswa
	if err := decodeJSON(r, &m); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if m.NIM == "" || m.Nama == "" {
		respondError(w, 400, "nim dan nama wajib diisi")
		return
	}
	if strings.TrimSpace(m.SemesterID) == "" {
		m.SemesterID = getActiveSemester()
	}
	m.StatusProses = emptyDefault(m.StatusProses, "Bimbingan")
	if !validStatusProses(m.StatusProses) {
		respondError(w, 400, "status_proses tidak valid")
		return
	}
	m.ID = uid("m")
	nimHash, err := bcrypt.GenerateFromPassword([]byte(m.NIM), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, 500, "failed to hash password")
		return
	}
	_, err = dbExec(`INSERT INTO mahasiswa(id,nim,nama,bab,rutin,jml_bimbingan1,jml_bimbingan2,terakhir,status_alat,fitur,kendala_skripsi,kendala_alat,hp,hp_ortu,alamat,pembimbing1_id,pembimbing2_id,semester_id,master_id,status_proses,password,
		ijinkan_sidang, status_sidang, tanggal_sidang, hasil_sidang, nilai_bimbingan, nilai_laporan, nilai_sidang, nilai_akhir)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		m.ID, m.NIM, m.Nama, m.Bab, m.Rutin, m.JmlBimbingan1, m.JmlBimbingan2,
		m.Terakhir, m.StatusAlat, m.Fitur, m.KendalaSkripsi, m.KendalaAlat,
		m.HP, m.HPOrtu, m.Alamat,
		nullStr(m.Pembimbing1ID), nullStr(m.Pembimbing2ID), nullStr(m.SemesterID), nullStr(m.MasterID), m.StatusProses, string(nimHash),
		m.IjinkanSidang, m.StatusSidang, m.TanggalSidang, m.HasilSidang, m.NilaiBimbingan, m.NilaiLaporan, m.NilaiSidang, m.NilaiAkhir)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 201, m)
}

func updateMahasiswa(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role != "prodi" && !(role == "mhs" && uid == id) {
		respondError(w, 403, "akses ditolak")
		return
	}
	var m Mahasiswa
	if err := decodeJSON(r, &m); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if m.NIM == "" || m.Nama == "" {
		respondError(w, 400, "nim dan nama wajib diisi")
		return
	}
	if role == "prodi" {
		m.StatusProses = emptyDefault(m.StatusProses, "Bimbingan")

		// Auto-calculate Nilai Akhir if all components are filled and result not yet set
		if m.NilaiBimbingan != "" && m.NilaiLaporan != "" && m.NilaiSidang != "" && m.NilaiAkhir == "" {
			m.NilaiAkhir = autoGrade(m.NilaiBimbingan, m.NilaiLaporan, m.NilaiSidang)
		}

		// Automation: If Hasil Sidang is Lulus and Nilai Akhir exists, force StatusProses to Lulus
		if m.HasilSidang == "Lulus" && m.NilaiAkhir != "" {
			m.StatusProses = "Lulus"
		}

		if !validStatusProses(m.StatusProses) {
			respondError(w, 400, "status_proses tidak valid")
			return
		}
	}
	var (
		res sql.Result
		err error
	)
	if role == "mhs" {
		res, err = dbExec(`UPDATE mahasiswa SET nama=?,fitur=?,kendala_skripsi=?,kendala_alat=?,hp=?,hp_ortu=?,alamat=? WHERE id=?`,
			m.Nama, m.Fitur, m.KendalaSkripsi, m.KendalaAlat, m.HP, m.HPOrtu, m.Alamat, id)
	} else {
		res, err = dbExec(`UPDATE mahasiswa SET nim=?,nama=?,bab=?,rutin=?,jml_bimbingan1=?,jml_bimbingan2=?,terakhir=?,
			status_alat=?,fitur=?,kendala_skripsi=?,kendala_alat=?,hp=?,hp_ortu=?,alamat=?,pembimbing1_id=?,pembimbing2_id=?,status_proses=?,
			ijinkan_sidang=?, status_sidang=?, tanggal_sidang=?, hasil_sidang=?, nilai_bimbingan=?, nilai_laporan=?, nilai_sidang=?, nilai_akhir=? WHERE id=?`,
			m.NIM, m.Nama, m.Bab, m.Rutin, m.JmlBimbingan1, m.JmlBimbingan2,
			m.Terakhir, m.StatusAlat, m.Fitur, m.KendalaSkripsi, m.KendalaAlat,
			m.HP, m.HPOrtu, m.Alamat, nullStr(m.Pembimbing1ID), nullStr(m.Pembimbing2ID), m.StatusProses,
			m.IjinkanSidang, m.StatusSidang, m.TanggalSidang, m.HasilSidang, m.NilaiBimbingan, m.NilaiLaporan, m.NilaiSidang, m.NilaiAkhir, id)
	}
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		respondError(w, 404, "mahasiswa tidak ditemukan")
		return
	}
	m.ID = id

	// Auto-close open bimbingan sessions when student graduates
	if role == "prodi" && m.StatusProses == "Lulus" {
		closeOpenBimbingan(id)
	}

	respondJSON(w, 200, m)
}

func deleteMahasiswa(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	id := chi.URLParam(r, "id")
	// TODO: Delete physical files (final reports, artifacts) to prevent orphaned files.
	result, err := dbExec("DELETE FROM mahasiswa WHERE id=?", id)
	if err != nil {
		respondError(w, 500, "failed to delete mahasiswa")
		return
	}
	rows, err := result.RowsAffected()
	if err != nil || rows == 0 {
		respondError(w, 404, "mahasiswa not found")
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

// ---- BIMBINGAN ----

func listBimbingan(w http.ResponseWriter, r *http.Request) {
	role, uid := getContext(r)

	if role == "umum" {
		respondError(w, 403, "akses ditolak")
		return
	}

	query := `
		SELECT b.id, b.mhs_id, b.tanggal, b.peran, COALESCE(b.topik,''),
		       COALESCE(b.bab,''), COALESCE(b.kendala_mhs,''), COALESCE(b.feedback_dosen,''), COALESCE(b.status_alat,''),
		       COALESCE(m.nama,''), COALESCE(m.nim,''),
		       CASE WHEN b.peran='1' THEN COALESCE(d1.nama,'') ELSE COALESCE(d2.nama,'') END,
		       COALESCE(b.status,'Completed'), COALESCE(b.offline_status,''), COALESCE(b.offline_date,''), COALESCE(b.offline_place,''), COALESCE(b.completed_at,'')
		FROM bimbingan b
		LEFT JOIN mahasiswa m ON b.mhs_id = m.id
		LEFT JOIN dosen d1 ON m.pembimbing1_id = d1.id
		LEFT JOIN dosen d2 ON m.pembimbing2_id = d2.id`

	var args []any
	if role == "dosen" && uid != "" {
		query += " WHERE (m.pembimbing1_id = ? OR m.pembimbing2_id = ?)"
		args = append(args, uid, uid)
	} else if role == "mhs" && uid != "" {
		query += " WHERE b.mhs_id = ?"
		args = append(args, uid)
	} else if role == "prodi" {
		// Prodi can see all, no WHERE clause
	} else if role == "umum" {
		respondJSON(w, 200, []Bimbingan{})
		return
	}

	query += " ORDER BY b.tanggal DESC, b.id DESC"

	rows, err := dbQuery(query, args...)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	var result []Bimbingan
	for rows.Next() {
		var b Bimbingan
		rows.Scan(&b.ID, &b.MhsID, &b.Tanggal, &b.Peran, &b.Topik,
			&b.Bab, &b.KendalaMhs, &b.FeedbackDosen, &b.StatusAlat,
			&b.NamaMhs, &b.NimMhs, &b.NamaDosen, &b.Status, &b.OfflineStatus, &b.OfflineDate, &b.OfflinePlace, &b.CompletedAt)
		result = append(result, b)
	}
	if result == nil {
		result = []Bimbingan{}
	}
	respondJSON(w, 200, result)
}

func createBimbingan(w http.ResponseWriter, r *http.Request) {
	role, userID := getContext(r)
	if userID == "" {
		respondError(w, 401, "unauthorized")
		return
	}
	var b Bimbingan
	if err := decodeJSON(r, &b); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}

	if role == "mhs" {
		b.MhsID = userID
		b.Status = "Draft"
	} else if role == "dosen" {
		if b.MhsID == "" {
			respondError(w, 400, "mhs_id wajib diisi")
			return
		}
	}

	// Check for existing active bimbingan
	var activeCount int
	err := dbQueryRow("SELECT COUNT(*) FROM bimbingan WHERE mhs_id = ? AND status != 'Completed'", b.MhsID).Scan(&activeCount)
	if err == nil && activeCount > 0 {
		respondError(w, 400, "Terdapat sesi bimbingan yang masih aktif/belum selesai")
		return
	}

	if role == "dosen" {
		owned, errOwn := dosenOwnsMahasiswa(userID, b.MhsID)
		if errOwn != nil {
			respondError(w, 500, errOwn.Error())
			return
		}
		if !owned {
			respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
			return
		}
		b.Status = "Proposed"
	} else if role == "mhs" {
		b.Status = "Draft" // Already checked MhsID and Status earlier
	} else {
		respondError(w, 403, "forbidden")
		return
	}

	// Lock: Check if student has graduated
	var statusProses string
	err = db.QueryRow(rebind("SELECT status_proses FROM mahasiswa WHERE id=?"), b.MhsID).Scan(&statusProses)
	if err == nil && statusProses == "Lulus" {
		respondError(w, 403, "Mahasiswa sudah lulus, tidak dapat menambah bimbingan baru.")
		return
	}

	if b.Tanggal == "" {
		b.Tanggal = time.Now().Format("2006-01-02")
	}
	if b.Peran != "1" && b.Peran != "2" {
		b.Peran = "1"
	}

	b.ID = uid("b")
	_, err = dbExec(`INSERT INTO bimbingan(id,mhs_id,tanggal,peran,topik,bab,kendala_mhs,feedback_dosen,status_alat,status) 
		VALUES(?,?,?,?,?,?,?,?,?,?)`,
		b.ID, b.MhsID, b.Tanggal, b.Peran, b.Topik, b.Bab, b.KendalaMhs, b.FeedbackDosen, b.StatusAlat, b.Status)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}

	syncMahasiswaStats(b.MhsID)
	respondJSON(w, 201, b)
}

func submitBimbingan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, userID, ok := requireRole(w, r, "mhs")
	if !ok {
		return
	}
	var mhsID string
	dbQueryRow("SELECT mhs_id FROM bimbingan WHERE id=?", id).Scan(&mhsID)
	if mhsID != userID {
		respondError(w, 403, "Bukan bimbingan Anda")
		return
	}
	_, err := dbExec("UPDATE bimbingan SET status='Proposed' WHERE id=? AND status='Draft'", id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func acceptBimbingan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role != "dosen" {
		respondError(w, 403, "akses ditolak")
		return
	}
	owned, err := ensureDosenOwnsBimbingan(uid, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	if !owned {
		respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
		return
	}
	_, err = dbExec("UPDATE bimbingan SET status='InReview' WHERE id=? AND status='Proposed'", id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func completeBimbingan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role != "dosen" {
		respondError(w, 403, "akses ditolak")
		return
	}
	owned, err := ensureDosenOwnsBimbingan(uid, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	if !owned {
		respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
		return
	}
	var offStatus sql.NullString
	dbQueryRow("SELECT offline_status FROM bimbingan WHERE id=?", id).Scan(&offStatus)
	if offStatus.Valid && offStatus.String == "Scheduled" {
		respondError(w, 400, "Bimbingan offline masih terjadwal. Harap tandai selesai/batal terlebih dahulu.")
		return
	}
	_, err = dbExec("UPDATE bimbingan SET status='Completed', completed_at=? WHERE id=?", time.Now().Format(time.RFC3339), id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func scheduleOffline(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role != "dosen" {
		respondError(w, 403, "akses ditolak")
		return
	}
	owned, err := ensureDosenOwnsBimbingan(uid, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	if !owned {
		respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
		return
	}
	var body struct {
		Date  string `json:"date"`
		Place string `json:"place"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respondError(w, 400, "invalid request")
		return
	}
	if body.Date == "" || body.Place == "" {
		respondError(w, 400, "tanggal dan tempat wajib diisi")
		return
	}
	_, err = dbExec("UPDATE bimbingan SET status='OfflineScheduled', offline_status='Scheduled', offline_date=?, offline_place=? WHERE id=?", body.Date, body.Place, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func updateOfflineStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role != "dosen" {
		respondError(w, 403, "akses ditolak")
		return
	}
	owned, err := ensureDosenOwnsBimbingan(uid, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	if !owned {
		respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respondError(w, 400, "invalid status")
		return
	}
	if body.Status != "Finished" && body.Status != "Cancelled" {
		respondError(w, 400, "invalid offline status")
		return
	}
	_, err = dbExec("UPDATE bimbingan SET offline_status=?, status='InReview' WHERE id=?", body.Status, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func reopenBimbingan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role != "dosen" {
		respondError(w, 403, "akses ditolak")
		return
	}
	owned, err := ensureDosenOwnsBimbingan(uid, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	if !owned {
		respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
		return
	}
	var completedAtStr sql.NullString
	err = dbQueryRow("SELECT completed_at FROM bimbingan WHERE id=?", id).Scan(&completedAtStr)
	if err != nil || !completedAtStr.Valid {
		respondError(w, 400, "Data penyelesaian tidak ditemukan")
		return
	}
	completedAt, err := time.Parse(time.RFC3339, completedAtStr.String)
	if err != nil {
		respondError(w, 500, "Format tanggal invalid")
		return
	}
	if time.Since(completedAt) > 7*24*time.Hour {
		respondError(w, 400, "Bimbingan sudah tidak bisa dibuka kembali (batas 7 hari terlampaui)")
		return
	}

	_, err = dbExec("UPDATE bimbingan SET status='InReview', completed_at=NULL WHERE id=? AND status='Completed'", id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func updateBimbingan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if uid == "" {
		respondError(w, 401, "authentication required")
		return
	}
	if role != "dosen" && role != "mhs" {
		respondError(w, 403, "akses ditolak")
		return
	}

	var b Bimbingan
	if err := decodeJSON(r, &b); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}

	var result sql.Result
	var err error

	if role == "mhs" {
		// Mahasiswa hanya boleh update bimbingan milik sendiri yang masih Draft
		result, err = dbExec(`UPDATE bimbingan SET tanggal=?, peran=?, topik=?, bab=?, kendala_mhs=?, status_alat=?
			WHERE id=? AND mhs_id=? AND status='Draft'`,
			b.Tanggal, b.Peran, b.Topik, b.Bab, b.KendalaMhs, b.StatusAlat, id, uid)
	} else {
		mhsID, err := getBimbinganMhsID(id)
		if err != nil {
			respondError(w, 500, err.Error())
			return
		}
		owned, err := dosenOwnsMahasiswa(uid, mhsID)
		if err != nil {
			respondError(w, 500, err.Error())
			return
		}
		if !owned {
			respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
			return
		}
		result, err = dbExec(`UPDATE bimbingan SET tanggal=?, peran=?, topik=?, bab=?, kendala_mhs=?, feedback_dosen=?, status_alat=?
			WHERE id=?`,
			b.Tanggal, b.Peran, b.Topik, b.Bab, b.KendalaMhs, b.FeedbackDosen, b.StatusAlat, id)
	}

	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	rows, err := result.RowsAffected()
	if err != nil || rows == 0 {
		respondError(w, 404, "bimbingan not found")
		return
	}
	syncMahasiswaStats(b.MhsID)
	respondJSON(w, 200, b)
}

func deleteBimbingan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid, ok := requireRole(w, r, "dosen", "mhs")
	if !ok {
		return
	}
	var mhsID string
	var status string
	err := dbQueryRow("SELECT mhs_id, status FROM bimbingan WHERE id=?", id).Scan(&mhsID, &status)
	if err != nil {
		respondError(w, 404, "Bimbingan tidak ditemukan")
		return
	}

	if role == "dosen" {
		owned, err := dosenOwnsMahasiswa(uid, mhsID)
		if err != nil {
			respondError(w, 500, err.Error())
			return
		}
		if !owned {
			respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
			return
		}
	} else if role == "mhs" {
		if uid != mhsID {
			respondError(w, 403, "Anda tidak memiliki akses")
			return
		}
		if status != "Draft" {
			respondError(w, 403, "Hanya bimbingan berstatus Draft yang dapat dihapus")
			return
		}
	}

	// Hapus file fisik rekam berkas untuk bimbingan ini
	rows, err := dbQuery("SELECT file_path FROM berkas WHERE bimbingan_id=?", id)
	if err == nil {
		for rows.Next() {
			var path string
			if err := rows.Scan(&path); err == nil && path != "" {
				os.Remove(path)
			}
		}
		rows.Close()
	}
	dbExec("DELETE FROM berkas WHERE bimbingan_id=?", id)

	dbExec("DELETE FROM bimbingan WHERE id=?", id)
	if mhsID != "" {
		syncMahasiswaStats(mhsID)
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func resetSemester(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	tx, err := db.Begin()
	if err != nil {
		respondError(w, 500, "failed to start transaction")
		return
	}
	defer tx.Rollback()

	// Delete bimbingan
	if _, err := tx.Exec("DELETE FROM bimbingan"); err != nil {
		respondError(w, 500, "failed to delete bimbingan")
		return
	}

	// Get berkas file paths to delete after the DB commit succeeds.
	rows, err := tx.Query("SELECT file_path FROM berkas")
	if err != nil {
		respondError(w, 500, "failed to query berkas")
		return
	}
	var files []string
	for rows.Next() {
		var filePath string
		if err := rows.Scan(&filePath); err != nil {
			rows.Close()
			respondError(w, 500, "failed to scan berkas")
			return
		}
		files = append(files, filePath)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		respondError(w, 500, "failed to read berkas rows")
		return
	}

	// Delete berkas
	if _, err := tx.Exec("DELETE FROM berkas"); err != nil {
		respondError(w, 500, "failed to delete berkas")
		return
	}

	// Delete mahasiswa
	if _, err := tx.Exec("DELETE FROM mahasiswa"); err != nil {
		respondError(w, 500, "failed to delete mahasiswa")
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		respondError(w, 500, "failed to commit transaction")
		return
	}

	// Clean up files
	for _, file := range files {
		if file == "" {
			continue
		}
		_ = os.Remove(filepath.Clean(file))
	}

	respondJSON(w, 200, map[string]bool{"ok": true})
}

// ---- DASHBOARD ----

func getDashboard(w http.ResponseWriter, r *http.Request) {
	stats := DashboardStats{
		DistribusiBab:    map[string]int{"Bab 1": 0, "Bab 2": 0, "Bab 3": 0, "Bab 4": 0, "Bab 5": 0},
		DistribusiStatus: map[string]int{},
		DistribusiRutin:  map[string]int{"Ya (1 kali /Minggu)": 0, "Ya (Tidak Rutin)": 0, "Tidak": 0},
		Alerts:           []Alert{},
	}

	type mhsRow struct {
		bab      string
		rutin    string
		status   string
		terakhir string
		nama     string
	}
	var mhsRows []mhsRow

	rows, err := dbQuery(`SELECT bab, rutin, COALESCE(status_alat,''), COALESCE(terakhir,''), nama FROM mahasiswa`)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		var mr mhsRow
		rows.Scan(&mr.bab, &mr.rutin, &mr.status, &mr.terakhir, &mr.nama)
		mhsRows = append(mhsRows, mr)
	}

	now := time.Now()
	for _, m := range mhsRows {
		stats.TotalMahasiswa++
		if m.bab == "Bab 4" || m.bab == "Bab 5" {
			stats.Bab4Plus++
		}
		if m.rutin == "Ya (1 kali /Minggu)" {
			stats.BimbinganRutin++
		}
		stats.DistribusiBab[m.bab]++
		stats.DistribusiStatus[m.status]++
		stats.DistribusiRutin[m.rutin]++

		// Calculate days since last bimbingan
		var daysSince *int
		if m.terakhir != "" {
			t, err := time.Parse("2006-01-02", m.terakhir)
			if err == nil {
				d := int(math.Floor(now.Sub(t).Hours() / 24))
				daysSince = &d
			}
		}

		if daysSince != nil && *daysSince > 30 {
			stats.PerluIntervensi++
		}

		// Alerts
		if m.rutin == "Tidak" {
			stats.Alerts = append(stats.Alerts, Alert{Level: "danger", Nama: m.nama, Reason: "Tidak melakukan bimbingan rutin"})
		} else if daysSince != nil && *daysSince > 60 {
			stats.Alerts = append(stats.Alerts, Alert{Level: "danger", Nama: m.nama, Reason: fmt.Sprintf("Tidak bimbingan %d hari", *daysSince)})
		} else if daysSince != nil && *daysSince > 30 {
			stats.Alerts = append(stats.Alerts, Alert{Level: "warn", Nama: m.nama, Reason: fmt.Sprintf("Tidak bimbingan %d hari", *daysSince)})
		}
		if m.bab == "Bab 4" && strings.HasPrefix(m.status, "Perancangan") {
			stats.Alerts = append(stats.Alerts, Alert{Level: "warn", Nama: m.nama, Reason: "Bab 4 tapi alat masih di tahap Perancangan"})
		}
	}

	respondJSON(w, 200, stats)
}

// ---- EXPORT CSV ----

func exportCSV(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi", "dosen"); !ok {
		return
	}
	kind := r.URL.Query().Get("type")
	var buf bytes.Buffer
	cw := csv.NewWriter(&buf)

	if kind == "project" {
		cw.Write([]string{"NIM", "Nama", "Bab", "Status Pengembangan", "Fitur Utama", "Kendala Pengembangan"})
		rows, err := dbQuery("SELECT nim,nama,bab,status_alat,fitur,kendala_alat FROM mahasiswa ORDER BY nama")
		if err != nil {
			respondError(w, 500, "failed to query mahasiswa")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var nim, nama, bab, status, fitur, kendala string
			rows.Scan(&nim, &nama, &bab, &status, &fitur, &kendala)
			cw.Write([]string{nim, nama, bab, status, fitur, kendala})
		}
		if err := rows.Err(); err != nil {
			respondError(w, 500, "error reading rows")
			return
		}
		w.Header().Set("Content-Disposition", "attachment; filename=project_ta.csv")
	} else {
		cw.Write([]string{"NIM", "Nama", "Bab", "Rutinitas", "PB1", "Bimb1", "PB2", "Bimb2", "Bimbingan Terakhir", "Status Alat", "Fitur Utama", "Kendala Skripsi", "Kendala Alat"})
		rows, err := dbQuery(`
			SELECT m.nim, m.nama, m.bab, m.rutin,
			       COALESCE(d1.nama,''), m.jml_bimbingan1, COALESCE(d2.nama,''), m.jml_bimbingan2,
			       COALESCE(m.terakhir,''), COALESCE(m.status_alat,''),
			       COALESCE(m.fitur,''), COALESCE(m.kendala_skripsi,''), COALESCE(m.kendala_alat,'')
			FROM mahasiswa m
			LEFT JOIN dosen d1 ON m.pembimbing1_id=d1.id
			LEFT JOIN dosen d2 ON m.pembimbing2_id=d2.id
			ORDER BY m.nama`)
		if err != nil {
			respondError(w, 500, "failed to query mahasiswa")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var nim, nama, bab, rutin, pemb1, pemb2, terakhir, status, fitur, ks, ka string
			var b1, b2 int
			rows.Scan(&nim, &nama, &bab, &rutin, &pemb1, &b1, &pemb2, &b2, &terakhir, &status, &fitur, &ks, &ka)
			cw.Write([]string{nim, nama, bab, rutin, pemb1, fmt.Sprint(b1), pemb2, fmt.Sprint(b2), terakhir, status, fitur, ks, ka})
		}
		if err := rows.Err(); err != nil {
			respondError(w, 500, "error reading rows")
			return
		}
		w.Header().Set("Content-Disposition", "attachment; filename=mahasiswa_ta.csv")
	}

	cw.Flush()
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Write(buf.Bytes())
}

// ---- CONFIG ----

func getConfig(w http.ResponseWriter, r *http.Request) {
	rows, err := dbQuery("SELECT key, value FROM config")
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	conf := AppConfig{}
	for rows.Next() {
		var k, v string
		rows.Scan(&k, &v)
		switch k {
		case "inst_name":
			conf.InstName = v
		case "dept_name":
			conf.DeptName = v
		case "prog_name":
			conf.ProgName = v
		case "academic_year":
			conf.AcademicYear = v
		case "semester":
			conf.Semester = v
		case "inst_logo":
			conf.InstLogo = v
		}
	}
	respondJSON(w, 200, conf)
}

func updateConfig(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	var conf AppConfig
	if err := decodeJSON(r, &conf); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}

	// Atomic updates for all keys
	updates := map[string]string{
		"inst_name": conf.InstName,
		"dept_name": conf.DeptName,
		"prog_name": conf.ProgName,
	}

	for k, v := range updates {
		_, err := dbExec("INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", k, v)
		if err != nil {
			respondError(w, 500, err.Error())
			return
		}
	}
	respondJSON(w, 200, conf)
}

func uploadLogo(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		respondError(w, 400, "Form invalid")
		return
	}
	file, header, err := r.FormFile("logo")
	if err != nil {
		respondError(w, 400, "Gambar wajib diunggah")
		return
	}
	defer file.Close()

	ext := filepath.Ext(header.Filename)
	ext = strings.ToLower(ext)
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".svg" {
		respondError(w, 400, "Harus berformat PNG, JPG, JPEG, atau SVG")
		return
	}

	fileName := "logo_" + fmt.Sprintf("%d", time.Now().Unix()) + ext
	savePath := filepath.Join("uploads", fileName)
	os.MkdirAll("uploads", 0755)

	out, err := os.Create(savePath)
	if err != nil {
		respondError(w, 500, "Gagal save gambar")
		return
	}
	defer out.Close()
	io.Copy(out, file)

	// Update config
	dbExec("INSERT INTO config(key, value) VALUES('inst_logo', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", savePath)
	respondJSON(w, 200, map[string]string{"inst_logo": savePath})
}

func getPublicLogo(w http.ResponseWriter, r *http.Request) {
	var path string
	err := dbQueryRow("SELECT value FROM config WHERE key='inst_logo'").Scan(&path)
	if err != nil || path == "" {
		respondError(w, 404, "Logo belum diset")
		return
	}
	http.ServeFile(w, r, path)
}

// ---- EVENTS ----

func listEvents(w http.ResponseWriter, r *http.Request) {
	rows, err := dbQuery("SELECT id, title, start_date, COALESCE(end_date,''), type, is_mandatory, COALESCE(category,'lainnya') FROM events ORDER BY start_date ASC")
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var result []Event
	for rows.Next() {
		var e Event
		rows.Scan(&e.ID, &e.Title, &e.StartDate, &e.EndDate, &e.Type, &e.Mandatory, &e.Category)
		result = append(result, e)
	}
	if result == nil {
		result = []Event{}
	}
	respondJSON(w, 200, result)
}

func createEvent(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	var e Event
	if err := decodeJSON(r, &e); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if e.Title == "" || e.StartDate == "" {
		respondError(w, 400, "Judul dan tanggal mulai wajib diisi")
		return
	}
	if e.EndDate != "" && e.EndDate < e.StartDate {
		respondError(w, 400, "Tanggal selesai tidak boleh sebelum tanggal mulai")
		return
	}
	if e.Category == "" {
		e.Category = "lainnya"
	}
	e.ID = uid("ev")
	_, err := dbExec("INSERT INTO events(id, title, start_date, end_date, type, is_mandatory, category) VALUES(?,?,?,?,?,?,?)",
		e.ID, e.Title, e.StartDate, e.EndDate, e.Type, e.Mandatory, e.Category)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	respondJSON(w, 201, e)
}

func updateEvent(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var e Event
	if err := decodeJSON(r, &e); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if e.EndDate != "" && e.EndDate < e.StartDate {
		respondError(w, 400, "Tanggal selesai tidak boleh sebelum tanggal mulai")
		return
	}
	_, err := dbExec("UPDATE events SET title=?, start_date=?, end_date=?, type=?, is_mandatory=?, category=? WHERE id=?",
		e.Title, e.StartDate, e.EndDate, e.Type, e.Mandatory, e.Category, id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	e.ID = id
	respondJSON(w, 200, e)
}

func deleteEvent(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	id := chi.URLParam(r, "id")

	var mandatory int
	dbQueryRow("SELECT is_mandatory FROM events WHERE id=?", id).Scan(&mandatory)
	if mandatory == 1 {
		respondError(w, 403, "Kegiatan wajib tidak boleh dihapus.")
		return
	}

	result, err := dbExec("DELETE FROM events WHERE id=?", id)
	if err != nil {
		respondError(w, 500, "failed to delete event")
		return
	}
	rows, err := result.RowsAffected()
	if err != nil || rows == 0 {
		respondError(w, 404, "event not found")
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func getActiveSemester() string {
	var id string
	dbQueryRow("SELECT id FROM semesters WHERE status='active' LIMIT 1").Scan(&id)
	return id
}

func validStatusProses(status string) bool {
	switch status {
	case "Bimbingan", "Lulus", "Lanjut", "Berhenti":
		return true
	default:
		return false
	}
}

func validTerm(term string) bool {
	return term == "Ganjil" || term == "Genap"
}

var (
	reportArtifactKinds = map[string]bool{
		"Front matter (cover luar, cover dalam, lembar pengesahan, kata pengantar, abstrak)": true,
		"BAB I":    true,
		"BAB II":   true,
		"BAB III":  true,
		"BAB IV":   true,
		"BAB V":    true,
		"Lampiran": true,
		"Laporan lengkap (sudah termasuk daftar isi)": true,
	}
	allowedArtifactKinds = map[string]bool{
		"Front matter (cover luar, cover dalam, lembar pengesahan, kata pengantar, abstrak)": true,
		"BAB I":    true,
		"BAB II":   true,
		"BAB III":  true,
		"BAB IV":   true,
		"BAB V":    true,
		"Lampiran": true,
		"Laporan lengkap (sudah termasuk daftar isi)": true,
		"Berkas presentasi":                           true,
		"Video YouTube":                               true,
		"Gambar":                                      true,
		"Project terarsip":                            true,
	}
	allowedDocExts     = map[string]bool{".docx": true}
	allowedPresExts    = map[string]bool{".pptx": true}
	allowedImageExts   = map[string]bool{".png": true, ".jpg": true, ".jpeg": true}
	allowedArchiveExts = map[string]bool{".zip": true, ".rar": true, ".7z": true, ".tar": true, ".tar.gz": true, ".gz": true, ".tgz": true, ".bz2": true, ".xz": true}
	blockedVideoExts   = map[string]bool{".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true, ".mpeg": true, ".mpg": true}
)

func validArtifactKind(kind string) bool {
	return allowedArtifactKinds[kind]
}

func normalizeArtifactExt(name string) string {
	lower := strings.ToLower(name)
	if strings.HasSuffix(lower, ".tar.gz") {
		return ".tar.gz"
	}
	return strings.ToLower(filepath.Ext(lower))
}

func validYouTubeURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return false
	}
	host := strings.ToLower(parsed.Host)
	return strings.Contains(host, "youtube.com") || strings.Contains(host, "youtu.be")
}

func artifactDisplayName(rawURL, fallback string) string {
	if fallback != "" {
		return fallback
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	base := filepath.Base(parsed.Path)
	if base == "." || base == "/" || base == "" {
		return rawURL
	}
	return base
}

// ---- ARTEFAK & REVIEW ----

func uploadBerkas(w http.ResponseWriter, r *http.Request) {
	role, uidMhs := getContext(r)
	if role != "mhs" {
		respondError(w, 403, "Hanya mahasiswa yang dapat mengunggah berkas")
		return
	}

	err := r.ParseMultipartForm(10 << 20) // 10MB per file
	if err != nil {
		respondError(w, 400, "File terlalu besar atau invalid")
		return
	}

	bimbID := r.FormValue("bimbingan_id")
	if bimbID == "" {
		respondError(w, 400, "Upload berkas wajib terikat pada sesi bimbingan")
		return
	}

	// Validate bimbingan belongs to student and is in Draft state
	var bStatus string
	err = dbQueryRow("SELECT status FROM bimbingan WHERE id=? AND mhs_id=?", bimbID, uidMhs).Scan(&bStatus)
	if err != nil {
		respondError(w, 400, "Sesi bimbingan tidak ditemukan atau bukan milik Anda")
		return
	}
	if bStatus != "Draft" {
		respondError(w, 400, "Hanya dapat mengunggah berkas pada sesi bimbingan berstatus Draft")
		return
	}

	kind := r.FormValue("kind")
	if kind == "" {
		kind = r.FormValue("bab")
	}
	storageMode := r.FormValue("storage_mode")
	if storageMode == "" {
		storageMode = "file"
	}
	externalURL := strings.TrimSpace(r.FormValue("external_url"))
	displayName := strings.TrimSpace(r.FormValue("display_name"))
	semID := getActiveSemester()
	if semID == "" {
		respondError(w, 400, "Belum ada semester aktif")
		return
	}
	if !validArtifactKind(kind) {
		respondError(w, 400, "Jenis file tidak valid")
		return
	}
	if storageMode != "file" && storageMode != "external" && storageMode != "youtube" {
		respondError(w, 400, "Mode penyimpanan tidak valid")
		return
	}

	fileID := uid("art")
	filePath := ""
	fileName := ""
	fileType := ""

	// Start transaction for atomic file upload + metadata save
	tx, err := db.Begin()
	if err != nil {
		respondError(w, 500, "Gagal memulai transaksi")
		return
	}
	defer tx.Rollback() // Will be ignored if committed

	if storageMode == "youtube" {
		if kind != "Video YouTube" {
			respondError(w, 400, "Mode YouTube hanya untuk jenis Video YouTube")
			return
		}
		if !validYouTubeURL(externalURL) {
			respondError(w, 400, "Link YouTube tidak valid")
			return
		}
		fileName = artifactDisplayName(externalURL, displayName)
		fileType = "text/uri-list"
	} else if storageMode == "external" {
		if externalURL == "" {
			respondError(w, 400, "Link eksternal wajib diisi")
			return
		}
		if _, err := url.ParseRequestURI(externalURL); err != nil {
			respondError(w, 400, "Link eksternal tidak valid")
			return
		}
		if kind == "Video YouTube" && !validYouTubeURL(externalURL) {
			respondError(w, 400, "Link YouTube tidak valid")
			return
		}
		fileName = artifactDisplayName(externalURL, displayName)
		fileType = "text/uri-list"
	} else {
		file, header, err := r.FormFile("file")
		if err != nil {
			respondError(w, 400, "File wajib diunggah")
			return
		}
		defer file.Close()

		ext := normalizeArtifactExt(header.Filename)
		if blockedVideoExts[ext] || strings.HasPrefix(strings.ToLower(header.Header.Get("Content-Type")), "video/") {
			respondError(w, 400, "Upload video tidak diterima. Gunakan link YouTube.")
			return
		}
		switch {
		case reportArtifactKinds[kind]:
			if !allowedDocExts[ext] {
				respondError(w, 400, "Laporan wajib berupa file .docx")
				return
			}
		case kind == "Berkas presentasi":
			if !allowedPresExts[ext] {
				respondError(w, 400, "Presentasi wajib berupa file .pptx")
				return
			}
		case kind == "Gambar":
			if !allowedImageExts[ext] {
				respondError(w, 400, "Gambar wajib berupa PNG atau JPG")
				return
			}
		case kind == "Project terarsip":
			if !allowedArchiveExts[ext] {
				respondError(w, 400, "File project lain wajib diarsipkan")
				return
			}
		case kind == "Video YouTube":
			respondError(w, 400, "Video harus diunggah sebagai link YouTube, bukan file")
			return
		}

		savePath := fmt.Sprintf("uploads/%s%s", fileID, ext)
		if err := os.MkdirAll("uploads", 0o755); err != nil {
			respondError(w, 500, "Gagal menyiapkan direktori upload: "+err.Error())
			return
		}
		out, err := os.Create(savePath)
		if err != nil {
			respondError(w, 500, "Gagal menyimpan file: "+err.Error())
			return
		}
		defer out.Close()
		if _, err := io.Copy(out, file); err != nil {
			respondError(w, 500, "Gagal menulis file")
			return
		}
		filePath = savePath
		fileName = header.Filename
		fileType = header.Header.Get("Content-Type")
	}

	// Insert metadata using transaction
	_, err = tx.Exec(rebind(`INSERT INTO berkas(id, mhs_id, semester_id, bimbingan_id, file_path, file_name, file_type, bab, storage_mode, external_url, kendala, uploaded_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`),
		fileID, uidMhs, semID, bimbID, filePath, fileName, fileType, kind, storageMode, nullStr(externalURL), "", time.Now().Format(time.RFC3339))

	if err != nil {
		respondError(w, 500, "Gagal menyimpan metadata berkas: "+err.Error())
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		respondError(w, 500, "Gagal menyelesaikan upload: "+err.Error())
		return
	}

	respondJSON(w, 201, map[string]string{"id": fileID, "path": filePath})
}

func listBerkas(w http.ResponseWriter, r *http.Request) {
	role, uid := getContext(r)

	query := `SELECT id, mhs_id, semester_id, COALESCE(bimbingan_id,''), COALESCE(file_path,''), COALESCE(file_name,''), COALESCE(file_type,''), COALESCE(bab,''), COALESCE(storage_mode,'file'), COALESCE(external_url,''), COALESCE(kendala,''), uploaded_at,
	          COALESCE(dosen_id,''), COALESCE(feedback,''), COALESCE(feedback_first_saved_at,'')
	          FROM berkas`
	var args []any

	if role == "mhs" {
		query += " WHERE mhs_id = ?"
		args = append(args, uid)
	} else if role == "dosen" {
		query += " WHERE mhs_id IN (SELECT id FROM mahasiswa WHERE pembimbing1_id = ? OR pembimbing2_id = ?)"
		args = append(args, uid, uid)
	} else if role == "prodi" {
		respondJSON(w, 200, []Berkas{}) // Restricted
		return
	}

	query += " ORDER BY uploaded_at DESC"
	rows, err := dbQuery(query, args...)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	result := []Berkas{}
	for rows.Next() {
		var a Berkas
		rows.Scan(&a.ID, &a.MhsID, &a.SemesterID, &a.BimbinganID, &a.FilePath, &a.FileName, &a.FileType, &a.Bab, &a.StorageMode, &a.ExternalURL, &a.Kendala, &a.UploadedAt,
			&a.DosenID, &a.Feedback, &a.FeedbackFirstSavedAt)
		result = append(result, a)
	}
	respondJSON(w, 200, result)
}

func updateBerkasFeedback(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uidDosen := getContext(r)
	if role != "dosen" && role != "prodi" {
		respondError(w, 403, "Hanya dosen/prodi yang dapat memberikan feedback")
		return
	}
	allowed, err := canAccessBerkas(id, role, uidDosen)
	if err == sql.ErrNoRows {
		respondError(w, 404, "Berkas tidak ditemukan")
		return
	}
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	if !allowed {
		respondError(w, 403, "Anda tidak berhak memberi feedback pada berkas ini")
		return
	}

	var req struct {
		Feedback string `json:"feedback"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}

	// Check 7-day rule
	var firstSave sql.NullString
	err = dbQueryRow("SELECT feedback_first_saved_at FROM berkas WHERE id=?", id).Scan(&firstSave)
	if err != nil && err != sql.ErrNoRows {
		respondError(w, 500, "failed to query berkas feedback")
		return
	}

	now := time.Now()
	if firstSave.Valid && firstSave.String != "" {
		fsTime, err := time.Parse(time.RFC3339, firstSave.String)
		if err != nil {
			// Corrupt timestamp should not block saving new feedback.
			firstSave.Valid = false
		} else if now.Sub(fsTime) > 7*24*time.Hour {
			respondError(w, 403, "Batas waktu revisi feedback (7 hari) telah berakhir")
			return
		}
	}

	updateQuery := "UPDATE berkas SET feedback = ?, dosen_id = ?"
	args := []any{req.Feedback, uidDosen}

	if !firstSave.Valid || firstSave.String == "" {
		updateQuery += ", feedback_first_saved_at = ?"
		args = append(args, now.Format(time.RFC3339))
	}
	updateQuery += " WHERE id = ?"
	args = append(args, id)

	_, err = dbExec(updateQuery, args...)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}

	respondJSON(w, 200, map[string]bool{"ok": true})
}

func downloadBerkas(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role == "prodi" {
		respondError(w, 403, "Akses berkas bimbingan dilarang untuk Koordinator Prodi")
		return
	}

	var mhsID string
	var filename string
	var path string
	err := dbQueryRow("SELECT mhs_id, file_name, file_path FROM berkas WHERE id=?", id).Scan(&mhsID, &filename, &path)
	if err != nil {
		respondError(w, 404, "Berkas tidak ditemukan")
		return
	}

	if role == "mhs" && mhsID != uid {
		respondError(w, 403, "Dilarang mengakses berkas orang lain")
		return
	}
	if role == "dosen" {
		var mentored bool
		dbQueryRow("SELECT EXISTS(SELECT 1 FROM mahasiswa WHERE id=? AND (pembimbing1_id=? OR pembimbing2_id=?))", mhsID, uid, uid).Scan(&mentored)
		if !mentored {
			respondError(w, 403, "Bukan bimbingan Anda")
			return
		}
	}

	var storageMode, externalURL string
	err = dbQueryRow("SELECT COALESCE(storage_mode,'file'), COALESCE(external_url,'') FROM berkas WHERE id=?", id).Scan(&storageMode, &externalURL)
	if err != nil {
		respondError(w, 404, "Berkas tidak ditemukan")
		return
	}
	if storageMode == "external" || storageMode == "youtube" {
		if externalURL == "" {
			respondError(w, 404, "Link berkas tidak tersedia")
			return
		}
		http.Redirect(w, r, externalURL, http.StatusFound)
		return
	}

	// Sanitize filename: strip quotes and backslashes to prevent header injection
	safeName := strings.NewReplacer(`"`, "", `\`, "").Replace(filename)
	w.Header().Set("Content-Disposition", `attachment; filename="`+safeName+`"`)
	http.ServeFile(w, r, path)
}

func viewBerkas(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)
	if role == "prodi" {
		respondError(w, 403, "Akses berkas bimbingan dilarang untuk Koordinator Prodi")
		return
	}

	var mhsID string
	var filename string
	var path string
	var fileType string
	err := dbQueryRow("SELECT mhs_id, file_name, file_path, COALESCE(file_type,'application/octet-stream') FROM berkas WHERE id=?", id).Scan(&mhsID, &filename, &path, &fileType)
	if err != nil {
		respondError(w, 404, "Berkas tidak ditemukan")
		return
	}

	if role == "mhs" && mhsID != uid {
		respondError(w, 403, "Dilarang mengakses berkas orang lain")
		return
	}
	if role == "dosen" {
		var mentored bool
		dbQueryRow("SELECT EXISTS(SELECT 1 FROM mahasiswa WHERE id=? AND (pembimbing1_id=? OR pembimbing2_id=?))", mhsID, uid, uid).Scan(&mentored)
		if !mentored {
			respondError(w, 403, "Bukan bimbingan Anda")
			return
		}
	}

	var storageMode, externalURL string
	err = dbQueryRow("SELECT COALESCE(storage_mode,'file'), COALESCE(external_url,'') FROM berkas WHERE id=?", id).Scan(&storageMode, &externalURL)
	if err != nil {
		respondError(w, 404, "Berkas tidak ditemukan")
		return
	}
	if storageMode == "external" || storageMode == "youtube" {
		if externalURL == "" {
			respondError(w, 404, "Link berkas tidak tersedia")
			return
		}
		http.Redirect(w, r, externalURL, http.StatusFound)
		return
	}

	w.Header().Set("Content-Type", fileType)
	http.ServeFile(w, r, path)
}

// ---- SEMESTER LIFESTYLE ----

func listSemesters(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	rows, err := dbQuery("SELECT id, name, academic_year, term, status FROM semesters ORDER BY id DESC")
	if err != nil {
		respondJSON(w, 200, []Semester{})
		return
	}
	defer rows.Close()
	result := []Semester{}
	for rows.Next() {
		var s Semester
		rows.Scan(&s.ID, &s.Name, &s.AcademicYear, &s.Term, &s.Status)
		result = append(result, s)
	}
	respondJSON(w, 200, result)
}

func closeSemester(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var status string
	err := dbQueryRow("SELECT status FROM semesters WHERE id=?", id).Scan(&status)
	if err == sql.ErrNoRows {
		respondError(w, 404, "semester tidak ditemukan")
		return
	}
	if err != nil {
		respondError(w, 500, "failed to query semester")
		return
	}
	if status != "active" {
		respondError(w, 400, "hanya semester aktif yang bisa diarsipkan")
		return
	}
	result, err := dbExec("UPDATE semesters SET status='archived' WHERE id=?", id)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	rows, err := result.RowsAffected()
	if err != nil || rows == 0 {
		respondError(w, 404, "semester tidak ditemukan")
		return
	}
	respondJSON(w, 200, map[string]bool{"ok": true})
}

func startSemester(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	var s Semester
	if err := decodeJSON(r, &s); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if s.Name == "" || s.AcademicYear == "" {
		respondError(w, 400, "name dan academic_year wajib diisi")
		return
	}
	if !validTerm(s.Term) {
		respondError(w, 400, "term harus Ganjil atau Genap")
		return
	}
	s.ID = uid("sem")
	s.Status = "active"

	tx, err := db.Begin()
	if err != nil {
		respondError(w, 500, "failed to start transaction")
		return
	}
	defer tx.Rollback()

	// 1. Find the active semester ID before archiving.
	var activeSemID string
	if err := tx.QueryRow("SELECT id FROM semesters WHERE status='active' LIMIT 1").Scan(&activeSemID); err != nil && err != sql.ErrNoRows {
		respondError(w, 500, "failed to query active semester")
		return
	}

	// 2. Mark existing active as archived
	if _, err := tx.Exec(rebind("UPDATE semesters SET status='archived' WHERE status='active'")); err != nil {
		respondError(w, 500, err.Error())
		return
	}

	// 3. Insert new semester
	if _, err := tx.Exec(rebind("INSERT INTO semesters(id, name, academic_year, term, status) VALUES(?,?,?,?,?)"),
		s.ID, s.Name, s.AcademicYear, s.Term, s.Status); err != nil {
		respondError(w, 500, err.Error())
		return
	}

	// 3a. Update global config to match the new semester details
	if _, err := tx.Exec(rebind("INSERT INTO config(key, value) VALUES('academic_year', ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value"), s.AcademicYear); err != nil {
		respondError(w, 500, err.Error())
		return
	}
	if _, err := tx.Exec(rebind("INSERT INTO config(key, value) VALUES('semester', ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value"), s.Term); err != nil {
		respondError(w, 500, err.Error())
		return
	}

	// 4. Migrate students.
	if activeSemID != "" {
		q := `SELECT id, nim, nama, bab, status_alat, fitur, hp, hp_ortu, alamat, pembimbing1_id, pembimbing2_id, password FROM mahasiswa WHERE semester_id=? `
		var args []any
		args = append(args, activeSemID)

		// Note: The frontend can be updated to send specific IDs. For now, we fallback to non-graduated.
		q += " AND (hasil_sidang IS NULL OR hasil_sidang != 'Lulus')"

		rows, err := tx.Query(rebind(q), args...)
		if err != nil {
			respondError(w, 500, "failed to query mahasiswa")
			return
		}
		type mhsMigrate struct {
			id, nim, nama, bab, statusAlat, fitur, hp, hpOrtu, alamat, p1, p2, password string
		}
		var toMigrate []mhsMigrate
		for rows.Next() {
			var m mhsMigrate
			var pw sql.NullString
			if err := rows.Scan(&m.id, &m.nim, &m.nama, &m.bab, &m.statusAlat, &m.fitur, &m.hp, &m.hpOrtu, &m.alamat, &m.p1, &m.p2, &pw); err != nil {
				rows.Close()
				respondError(w, 500, "failed to scan mahasiswa")
				return
			}
			if pw.Valid {
				m.password = pw.String
			}
			toMigrate = append(toMigrate, m)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			respondError(w, 500, "failed to read mahasiswa rows")
			return
		}

		for _, m := range toMigrate {
			// Preserve existing hashed password; fall back to NIM hash if missing.
			pwd := m.password
			if pwd == "" {
				h, _ := bcrypt.GenerateFromPassword([]byte(m.nim), bcrypt.DefaultCost)
				pwd = string(h)
			}
			newID := uid("m")
			if _, err := tx.Exec(rebind(`INSERT INTO mahasiswa(id, nim, nama, bab, status_alat, fitur, hp, hp_ortu, alamat, pembimbing1_id, pembimbing2_id, semester_id, master_id, status_proses, password)
				VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
				newID, m.nim, m.nama, m.bab, m.statusAlat, m.fitur, m.hp, m.hpOrtu, m.alamat,
				nullStr(m.p1), nullStr(m.p2), s.ID, m.id, "Bimbingan", pwd); err != nil {
				respondError(w, 500, "failed to migrate mahasiswa: "+err.Error())
				return
			}
		}
	}

	if err := tx.Commit(); err != nil {
		respondError(w, 500, "failed to commit transaction")
		return
	}

	respondJSON(w, 201, s)
}

func updateMahasiswaBatchStatus(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := requireRole(w, r, "prodi"); !ok {
		return
	}
	var req struct {
		IDs    []string `json:"ids"`
		Status string   `json:"status"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}
	if len(req.IDs) == 0 {
		respondError(w, 400, "ids wajib diisi")
		return
	}
	if !validStatusProses(req.Status) {
		respondError(w, 400, "status_proses tidak valid")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		respondError(w, 500, "failed to start transaction")
		return
	}
	defer tx.Rollback()

	updated := 0
	for _, id := range req.IDs {
		result, err := tx.Exec(rebind("UPDATE mahasiswa SET status_proses=? WHERE id=?"), req.Status, id)
		if err != nil {
			respondError(w, 500, "failed to update mahasiswa status")
			return
		}
		rows, err := result.RowsAffected()
		if err != nil {
			respondError(w, 500, "failed to verify mahasiswa update")
			return
		}
		updated += int(rows)
	}
	if updated == 0 {
		respondError(w, 404, "tidak ada mahasiswa yang diperbarui")
		return
	}
	if err := tx.Commit(); err != nil {
		respondError(w, 500, "failed to commit transaction")
		return
	}

	respondJSON(w, 200, map[string]any{"ok": true, "updated": updated})
}

// autoGrade computes the Nilai Akhir letter grade from three numeric component scores.
// Formula: (Proses * 0.25) + (Laporan * 0.25) + (Sidang * 0.5)
func autoGrade(nilaiBimbingan, nilaiLaporan, nilaiSidang string) string {
	nb, err1 := strconv.ParseFloat(strings.TrimSpace(nilaiBimbingan), 64)
	nl, err2 := strconv.ParseFloat(strings.TrimSpace(nilaiLaporan), 64)
	ns, err3 := strconv.ParseFloat(strings.TrimSpace(nilaiSidang), 64)
	if err1 != nil || err2 != nil || err3 != nil {
		return ""
	}
	total := (nb * 0.25) + (nl * 0.25) + (ns * 0.5)
	switch {
	case total >= 80:
		return "A"
	case total >= 75:
		return "AB"
	case total >= 70:
		return "B"
	case total >= 65:
		return "BC"
	case total >= 60:
		return "C"
	case total >= 50:
		return "D"
	default:
		return "E"
	}
}

// closeOpenBimbingan marks non-completed bimbingan sessions for a student as Completed.
// Called automatically when a student's status_proses becomes 'Lulus'.
func closeOpenBimbingan(mhsID string) {
	dbExec(`UPDATE bimbingan SET status='Completed', completed_at=?
		WHERE mhs_id=? AND status NOT IN ('Completed')`,
		time.Now().Format(time.RFC3339), mhsID)
}

// helper
func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func emptyDefault(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func permitSidang(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, userID, ok := requireRole(w, r, "dosen", "prodi")
	if !ok {
		return
	}

	var body struct {
		Permit int `json:"permit"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respondError(w, 400, "invalid JSON")
		return
	}

	// Fetch current student info
	var m Mahasiswa
	err := dbQueryRow("SELECT id, pembimbing1_id, pembimbing2_id, setuju_pembimbing1, setuju_pembimbing2 FROM mahasiswa WHERE id=?", id).
		Scan(&m.ID, &m.Pembimbing1ID, &m.Pembimbing2ID, &m.SetujuPembimbing1, &m.SetujuPembimbing2)
	if err != nil {
		respondError(w, 500, "Mahasiswa tidak ditemukan")
		return
	}

	if role == "prodi" {
		// Prodi can set the final permission directly
		_, err = dbExec("UPDATE mahasiswa SET ijinkan_sidang = ?, setuju_pembimbing1 = ?, setuju_pembimbing2 = ? WHERE id = ?",
			body.Permit, body.Permit, body.Permit, id)
	} else if role == "dosen" {
		col := ""
		if userID == m.Pembimbing1ID {
			col = "setuju_pembimbing1"
		} else if userID == m.Pembimbing2ID {
			col = "setuju_pembimbing2"
		}

		if col == "" {
			respondError(w, 403, "Anda bukan pembimbing mahasiswa ini")
			return
		}

		// Update specific supervisor approval
		_, err = dbExec("UPDATE mahasiswa SET "+col+" = ? WHERE id = ?", body.Permit, id)
		if err != nil {
			respondError(w, 500, "Gagal memperbarui persetujuan")
			return
		}

		// Atomically update ijinkan_sidang based on both supervisors' status
		_, err = dbExec(`UPDATE mahasiswa SET ijinkan_sidang = 
			CASE WHEN setuju_pembimbing1 = 1 AND setuju_pembimbing2 = 1 THEN 1 ELSE 0 END 
			WHERE id = ?`, id)
	}

	if err != nil {
		respondError(w, 500, err.Error())
		return
	}

	respondJSON(w, 200, map[string]bool{"ok": true})
}

func downloadFinalReport(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, uid := getContext(r)

	var mhs Mahasiswa
	err := db.QueryRow(rebind("SELECT id, nama, file_laporan_final FROM mahasiswa WHERE id=?"), id).Scan(&mhs.ID, &mhs.Nama, &mhs.FileFinal)
	if err != nil {
		respondError(w, 404, "Mahasiswa tidak ditemukan")
		return
	}

	if mhs.FileFinal == "" {
		respondError(w, 404, "Laporan final belum diunggah")
		return
	}

	// Authorization
	authorized := false
	if role == "prodi" {
		authorized = true
	} else if role == "mhs" && uid == id {
		authorized = true
	} else if role == "dosen" {
		db.QueryRow(rebind("SELECT EXISTS(SELECT 1 FROM mahasiswa WHERE id=? AND (pembimbing1_id=? OR pembimbing2_id=?))"), id, uid, uid).Scan(&authorized)
	}

	if !authorized {
		respondError(w, 403, "Akses ditolak")
		return
	}

	ext := filepath.Ext(mhs.FileFinal)
	downloadName := fmt.Sprintf("LaporanFinal_%s_%s%s", mhs.ID, mhs.Nama, ext)
	downloadName = strings.ReplaceAll(downloadName, " ", "_")

	w.Header().Set("Content-Disposition", `attachment; filename="`+downloadName+`"`)
	http.ServeFile(w, r, mhs.FileFinal)
}

func uploadFinalReport(w http.ResponseWriter, r *http.Request) {
	_, userID, ok := requireRole(w, r, "mhs")
	if !ok {
		return
	}

	// Double check if ijinkan_sidang is true
	var ijinkanSidang int
	err := dbQueryRow("SELECT ijinkan_sidang FROM mahasiswa WHERE id=?", userID).Scan(&ijinkanSidang)
	if err != nil || ijinkanSidang != 1 {
		respondError(w, 403, "Anda belum diizinkan mengunggah laporan akhir.")
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		respondError(w, 400, "Gagal memproses form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, 400, "File wajib diunggah")
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".pdf") {
		respondError(w, 400, "Laporan akhir harus dalam format PDF")
		return
	}

	// Validate PDF magic bytes (%PDF) to block renamed non-PDF files
	magic := make([]byte, 4)
	if _, err := io.ReadFull(file, magic); err != nil || string(magic) != "%PDF" {
		respondError(w, 400, "File bukan PDF yang valid")
		return
	}

	fileID := uid("rep")
	savePath := "uploads/" + fileID + ".pdf"
	_ = os.MkdirAll("uploads", 0755)

	out, err := os.Create(savePath)
	if err != nil {
		respondError(w, 500, "Gagal menyimpan file")
		return
	}
	defer out.Close()
	// Write the already-read magic bytes first, then copy the rest
	out.Write(magic)
	io.Copy(out, file)

	_, err = dbExec("UPDATE mahasiswa SET file_laporan_final=? WHERE id=?", savePath, userID)
	if err != nil {
		respondError(w, 500, "Gagal update database")
		return
	}

	respondJSON(w, 200, map[string]string{"file": savePath})
}

// ---- REKOMENDASI SIDANG ----

func getSidangToken(w http.ResponseWriter, r *http.Request) {
	_, mhsID, ok := requireRole(w, r, "mhs")
	if !ok {
		return
	}

	// Double check if student is allowed to sidang
	var allowed int
	err := dbQueryRow("SELECT ijinkan_sidang FROM mahasiswa WHERE id=?", mhsID).Scan(&allowed)
	if err != nil {
		respondError(w, 500, "Gagal mengambil status mahasiswa")
		return
	}
	if allowed != 1 {
		respondError(w, 403, "Anda belum diizinkan untuk mendaftar sidang")
		return
	}

	// Check if token already exists
	var st SidangVerificationToken
	err = dbQueryRow("SELECT id, mhs_id, token, created_at FROM rekomendasi_sidang WHERE mhs_id=?", mhsID).
		Scan(&st.ID, &st.MhsID, &st.Token, &st.CreatedAt)

	if err == sql.ErrNoRows {
		// Generate new token
		st.ID = uid("rs")
		st.MhsID = mhsID
		st.Token = fmt.Sprintf("%x%x", time.Now().UnixNano(), rand.Int63())
		st.CreatedAt = time.Now().Format(time.RFC3339)

		_, err = dbExec("INSERT INTO rekomendasi_sidang(id, mhs_id, token, created_at) VALUES(?,?,?,?)",
			st.ID, st.MhsID, st.Token, st.CreatedAt)
		if err != nil {
			respondError(w, 500, "Gagal menyimpan token verifikasi")
			return
		}
	} else if err != nil {
		respondError(w, 500, "Gagal mengambil data token")
		return
	}

	respondJSON(w, 200, st)
}

func verifySidangToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		respondError(w, 400, "Token tidak valid")
		return
	}

	var mhsID string
	err := dbQueryRow("SELECT mhs_id FROM rekomendasi_sidang WHERE token=?", token).Scan(&mhsID)
	if err == sql.ErrNoRows {
		respondError(w, 404, "Data verifikasi tidak ditemukan")
		return
	} else if err != nil {
		respondError(w, 500, "Gagal memproses verifikasi")
		return
	}

	// Get full mahasiswa data
	var m Mahasiswa
	err = dbQueryRow(`
		SELECT m.id, m.nim, m.nama, m.bab, m.pembimbing1_id, m.pembimbing2_id, 
		       d1.nama, d2.nama, m.fitur, m.ijinkan_sidang, m.status_sidang,
		       m.setuju_pembimbing1, m.setuju_pembimbing2
		FROM mahasiswa m
		LEFT JOIN dosen d1 ON m.pembimbing1_id = d1.id
		LEFT JOIN dosen d2 ON m.pembimbing2_id = d2.id
		WHERE m.id=?`, mhsID).Scan(
		&m.ID, &m.NIM, &m.Nama, &m.Bab, &m.Pembimbing1ID, &m.Pembimbing2ID,
		&m.NamaPembimbing1, &m.NamaPembimbing2, &m.Fitur, &m.IjinkanSidang, &m.StatusSidang,
		&m.SetujuPembimbing1, &m.SetujuPembimbing2)

	if err != nil {
		respondError(w, 500, "Gagal mengambil data mahasiswa")
		return
	}

	// Get config for institution info
	cfg := AppConfig{
		InstName: getCfg("inst_name"),
		DeptName: getCfg("dept_name"),
		ProgName: getCfg("prog_name"),
	}

	respondJSON(w, 200, SidangVerificationResponse{
		Mahasiswa: m,
		Config:    cfg,
		Token:     token,
	})
}

func getCfg(key string) string {
	var val string
	dbQueryRow("SELECT value FROM config WHERE key=?", key).Scan(&val)
	return val
}

// ---- TA TITLES ----

func listTATitles(w http.ResponseWriter, r *http.Request) {
	role, _ := getContext(r)
	if role == "umum" {
		respondError(w, 403, "akses ditolak")
		return
	}

	q := r.URL.Query().Get("q")
	pageStr := r.URL.Query().Get("page")
	pageSizeStr := r.URL.Query().Get("page_size")

	page := 1
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	pageSize := 20
	if pageSizeStr != "" {
		if ps, err := strconv.Atoi(pageSizeStr); err == nil && ps > 0 && ps <= 100 {
			pageSize = ps
		}
	}

	offset := (page - 1) * pageSize

	var whereClause string
	var args []interface{}

	if q != "" {
		// Use PostgreSQL full text search + trigram similarity
		whereClause = `
			WHERE b.topik IS NOT NULL AND b.topik != '' 
			AND (
				to_tsvector('indonesian', b.topik) @@ websearch_to_tsquery('indonesian', $1)
				OR similarity(b.topik, $1) > 0.1
			)`
		args = []interface{}{q}
	} else {
		whereClause = "WHERE b.topik IS NOT NULL AND b.topik != ''"
	}

	// Get total count
	var total int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT b.id)
		FROM bimbingan b
		JOIN mahasiswa m ON b.mhs_id = m.id
		%s`, whereClause)

	if err := dbQueryRow(countQuery, args...).Scan(&total); err != nil {
		respondError(w, 500, err.Error())
		return
	}

	// Get data with ranking if searching
	var query string
	if q != "" {
		query = fmt.Sprintf(`
			SELECT DISTINCT ON (b.id) 
				b.id, b.topik, m.nama, m.nim, b.tanggal, m.status_proses,
				(ts_rank(to_tsvector('indonesian', b.topik), websearch_to_tsquery('indonesian', $1)) * 0.6 + 
				 similarity(b.topik, $1) * 0.4) as relevance_score
			FROM bimbingan b
			JOIN mahasiswa m ON b.mhs_id = m.id
			%s
			ORDER BY b.id, relevance_score DESC
			LIMIT $%d OFFSET $%d`, whereClause, len(args)+1, len(args)+2)
		args = append(args, pageSize, offset)
	} else {
		query = fmt.Sprintf(`
			SELECT DISTINCT ON (b.id) 
				b.id, b.topik, m.nama, m.nim, b.tanggal, m.status_proses, 0.0 as relevance_score
			FROM bimbingan b
			JOIN mahasiswa m ON b.mhs_id = m.id
			%s
			ORDER BY b.id, b.tanggal DESC
			LIMIT $%d OFFSET $%d`, whereClause, len(args)+1, len(args)+2)
		args = append(args, pageSize, offset)
	}

	rows, err := dbQuery(query, args...)
	if err != nil {
		respondError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var titles []TATitle
	for rows.Next() {
		var t TATitle
		err := rows.Scan(&t.ID, &t.Title, &t.StudentName, &t.StudentNIM, &t.SubmittedAt, &t.Status, &t.RelevanceScore)
		if err != nil {
			continue
		}

		// Calculate match level for search results
		if q != "" {
			if t.RelevanceScore >= 0.8 {
				t.MatchLevel = "mirip_tinggi"
			} else if t.RelevanceScore >= 0.5 {
				t.MatchLevel = "perlu_review"
			} else {
				t.MatchLevel = "aman"
			}
		}

		titles = append(titles, t)
	}

	response := TATitleSearchResponse{
		Data: titles,
	}
	response.Meta.Page = page
	response.Meta.PageSize = pageSize
	response.Meta.Total = total
	response.Meta.Query = q

	respondJSON(w, 200, response)
}
