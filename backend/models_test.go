package main

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Test struct JSON marshaling/unmarshaling
func TestDosenJSON(t *testing.T) {
	dosen := Dosen{
		ID:                 "d1",
		NIDN:               "123456789",
		Nama:               "Dr. John Doe",
		Bidang:             "Computer Science",
		Email:              "john@example.com",
		HP:                 "08123456789",
		Password:           "secret",
		Role:               "dosen",
		MustChangePassword: 0,
	}

	// Test marshaling
	data, err := json.Marshal(dosen)
	assert.NoError(t, err)
	assert.Contains(t, string(data), `"nama":"Dr. John Doe"`)
	assert.Contains(t, string(data), `"role":"dosen"`)

	// Test unmarshaling
	var decoded Dosen
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, dosen.ID, decoded.ID)
	assert.Equal(t, dosen.Nama, decoded.Nama)
	assert.Equal(t, dosen.Role, decoded.Role)
}

func TestMahasiswaJSON(t *testing.T) {
	mhs := Mahasiswa{
		ID:            "m1",
		NIM:           "123456789",
		Nama:          "Jane Smith",
		Bab:           "Bab 1",
		Rutin:         "Ya (1 kali /Minggu)",
		JmlBimbingan1: 5,
		JmlBimbingan2: 3,
		Terakhir:      "2024-01-15",
		StatusAlat:    "Pengembangan",
		Pembimbing1ID: "d1",
		Pembimbing2ID: "d2",
		SemesterID:    "s1",
		StatusProses:  "Perencanaan",
	}

	data, err := json.Marshal(mhs)
	assert.NoError(t, err)

	var decoded Mahasiswa
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, mhs.NIM, decoded.NIM)
	assert.Equal(t, mhs.Bab, decoded.Bab)
	assert.Equal(t, mhs.JmlBimbingan1, decoded.JmlBimbingan1)
}

func TestBimbinganJSON(t *testing.T) {
	bimbingan := Bimbingan{
		ID:            "b1",
		MhsID:         "m1",
		Tanggal:       "2024-01-15",
		Peran:         "Pembimbing 1",
		Topik:         "Sistem Informasi Akademik",
		Bab:           "Bab 2",
		KendalaMhs:    "Kesulitan dalam perancangan database",
		FeedbackDosen: "Perbaiki relasi tabel",
		StatusAlat:    "Pengembangan",
		Status:        "Completed",
		NamaMhs:       "Jane Smith",
		NimMhs:        "123456789",
		NamaDosen:     "Dr. John Doe",
	}

	data, err := json.Marshal(bimbingan)
	assert.NoError(t, err)

	var decoded Bimbingan
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, bimbingan.Topik, decoded.Topik)
	assert.Equal(t, bimbingan.Status, decoded.Status)
	assert.Equal(t, bimbingan.NamaMhs, decoded.NamaMhs)
}

func TestDashboardStatsJSON(t *testing.T) {
	stats := DashboardStats{
		TotalMahasiswa:  150,
		Bab4Plus:        45,
		BimbinganRutin:  120,
		PerluIntervensi: 15,
		DistribusiBab: map[string]int{
			"Bab 1": 30,
			"Bab 2": 40,
			"Bab 3": 35,
			"Bab 4": 25,
			"Bab 5": 20,
		},
		DistribusiStatus: map[string]int{
			"Perencanaan":  50,
			"Pengembangan": 60,
			"Pengujian":    40,
		},
		DistribusiRutin: map[string]int{
			"Ya (1 kali /Minggu)": 100,
			"Ya (Tidak Rutin)":    30,
			"Tidak":               20,
		},
		Alerts: []Alert{
			{Level: "warn", Nama: "John Doe", Reason: "Tidak bimbingan > 30 hari"},
		},
	}

	data, err := json.Marshal(stats)
	assert.NoError(t, err)

	var decoded DashboardStats
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, stats.TotalMahasiswa, decoded.TotalMahasiswa)
	assert.Equal(t, stats.Bab4Plus, decoded.Bab4Plus)
	assert.Equal(t, len(stats.Alerts), len(decoded.Alerts))
	assert.Equal(t, stats.Alerts[0].Level, decoded.Alerts[0].Level)
}

func TestEventJSON(t *testing.T) {
	event := Event{
		ID:        "e1",
		Title:     "Sidang Tugas Akhir Periode Januari 2024",
		StartDate: "2024-01-15",
		EndDate:   "2024-01-20",
		Type:      "critical",
		Mandatory: 1,
		Category:  "sidang",
	}

	data, err := json.Marshal(event)
	assert.NoError(t, err)

	var decoded Event
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, event.Title, decoded.Title)
	assert.Equal(t, event.Type, decoded.Type)
	assert.Equal(t, event.Mandatory, decoded.Mandatory)
}

func TestSemesterJSON(t *testing.T) {
	semester := Semester{
		ID:           "s1",
		Name:         "Semester Genap 2023/2024",
		AcademicYear: "2023/2024",
		Term:         "Genap",
		Status:       "active",
	}

	data, err := json.Marshal(semester)
	assert.NoError(t, err)

	var decoded Semester
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, semester.Name, decoded.Name)
	assert.Equal(t, semester.Status, decoded.Status)
}

func TestBerkasJSON(t *testing.T) {
	berkas := Berkas{
		ID:          "ber1",
		MhsID:       "m1",
		SemesterID:  "s1",
		FilePath:    "/uploads/berkas1.pdf",
		FileName:    "proposal.pdf",
		FileType:    "application/pdf",
		Bab:         "Bab 1",
		StorageMode: "local",
		UploadedAt:  "2024-01-15T10:30:00Z",
		DosenID:     "d1",
		Feedback:    "Proposal sudah bagus, silakan lanjut ke Bab 2",
	}

	data, err := json.Marshal(berkas)
	assert.NoError(t, err)

	var decoded Berkas
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, berkas.FileName, decoded.FileName)
	assert.Equal(t, berkas.Feedback, decoded.Feedback)
}

func TestAppConfigJSON(t *testing.T) {
	config := AppConfig{
		InstName:     "Universitas ABC",
		DeptName:     "Teknik Informatika",
		ProgName:     "Sistem Informasi",
		AcademicYear: "2023/2024",
		Semester:     "Genap",
		InstLogo:     "/api/logo",
	}

	data, err := json.Marshal(config)
	assert.NoError(t, err)

	var decoded AppConfig
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, config.InstName, decoded.InstName)
	assert.Equal(t, config.ProgName, decoded.ProgName)
}

func TestTATitleJSON(t *testing.T) {
	title := TATitle{
		ID:             "t1",
		Title:          "Sistem Informasi Manajemen Perpustakaan Berbasis Web",
		StudentName:    "Jane Smith",
		StudentNIM:     "123456789",
		SubmittedAt:    "2024-01-15",
		Status:         "Lulus",
		RelevanceScore: 0.85,
		MatchLevel:     "aman",
	}

	data, err := json.Marshal(title)
	assert.NoError(t, err)

	var decoded TATitle
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, title.Title, decoded.Title)
	assert.Equal(t, title.RelevanceScore, decoded.RelevanceScore)
	assert.Equal(t, title.MatchLevel, decoded.MatchLevel)
}

func TestTATitleSearchResponseJSON(t *testing.T) {
	response := TATitleSearchResponse{
		Data: []TATitle{
			{
				ID:          "t1",
				Title:       "Sistem Informasi Akademik",
				StudentName: "John Doe",
				StudentNIM:  "123456789",
				SubmittedAt: "2024-01-15",
				Status:      "Lulus",
			},
		},
		Meta: struct {
			Page     int    `json:"page"`
			PageSize int    `json:"page_size"`
			Total    int    `json:"total"`
			Query    string `json:"query,omitempty"`
		}{
			Page:     1,
			PageSize: 20,
			Total:    150,
			Query:    "sistem informasi",
		},
	}

	data, err := json.Marshal(response)
	assert.NoError(t, err)

	var decoded TATitleSearchResponse
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(decoded.Data))
	assert.Equal(t, 1, decoded.Meta.Page)
	assert.Equal(t, 150, decoded.Meta.Total)
	assert.Equal(t, "sistem informasi", decoded.Meta.Query)
}

// Test struct validation logic
func TestMahasiswaValidation(t *testing.T) {
	tests := []struct {
		name      string
		mahasiswa Mahasiswa
		isValid   bool
	}{
		{
			name: "valid mahasiswa",
			mahasiswa: Mahasiswa{
				NIM:           "123456789",
				Nama:          "John Doe",
				Bab:           "Bab 1",
				Rutin:         "Ya (1 kali /Minggu)",
				StatusProses:  "Perencanaan",
				Pembimbing1ID: "d1",
			},
			isValid: true,
		},
		{
			name: "invalid bab",
			mahasiswa: Mahasiswa{
				NIM:  "123456789",
				Nama: "John Doe",
				Bab:  "Bab 6", // Invalid
			},
			isValid: false,
		},
		{
			name: "invalid rutin",
			mahasiswa: Mahasiswa{
				NIM:   "123456789",
				Nama:  "John Doe",
				Rutin: "Invalid", // Invalid
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Basic validation - check required fields
			hasRequiredFields := tt.mahasiswa.NIM != "" && tt.mahasiswa.Nama != ""

			// Check bab validity
			validBab := tt.mahasiswa.Bab == "" || (tt.mahasiswa.Bab == "Bab 1" ||
				tt.mahasiswa.Bab == "Bab 2" || tt.mahasiswa.Bab == "Bab 3" ||
				tt.mahasiswa.Bab == "Bab 4" || tt.mahasiswa.Bab == "Bab 5")

			// Check status proses validity
			validStatus := tt.mahasiswa.StatusProses == "" || validStatusProses(tt.mahasiswa.StatusProses)

			isValid := hasRequiredFields && validBab && validStatus
			assert.Equal(t, tt.isValid, isValid)
		})
	}
}

func TestBimbinganValidation(t *testing.T) {
	tests := []struct {
		name      string
		bimbingan Bimbingan
		isValid   bool
	}{
		{
			name: "valid bimbingan",
			bimbingan: Bimbingan{
				MhsID:   "m1",
				Tanggal: "2024-01-15",
				Peran:   "Pembimbing 1",
				Topik:   "Sistem Informasi",
				Bab:     "Bab 1",
				Status:  "Completed",
			},
			isValid: true,
		},
		{
			name: "invalid status",
			bimbingan: Bimbingan{
				MhsID:   "m1",
				Tanggal: "2024-01-15",
				Status:  "Invalid", // Invalid status
			},
			isValid: false,
		},
		{
			name: "missing required fields",
			bimbingan: Bimbingan{
				// Missing MhsID and Tanggal
				Topik: "Test",
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasRequiredFields := tt.bimbingan.MhsID != "" && tt.bimbingan.Tanggal != ""

			validStatus := tt.bimbingan.Status == "" ||
				(tt.bimbingan.Status == "Draft" || tt.bimbingan.Status == "Proposed" ||
					tt.bimbingan.Status == "InReview" || tt.bimbingan.Status == "Completed" ||
					tt.bimbingan.Status == "OfflineScheduled")

			validBab := tt.bimbingan.Bab == "" || (tt.bimbingan.Bab == "Bab 1" ||
				tt.bimbingan.Bab == "Bab 2" || tt.bimbingan.Bab == "Bab 3" ||
				tt.bimbingan.Bab == "Bab 4" || tt.bimbingan.Bab == "Bab 5")

			isValid := hasRequiredFields && validStatus && validBab
			assert.Equal(t, tt.isValid, isValid)
		})
	}
}
