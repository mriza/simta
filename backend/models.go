package main

type Dosen struct {
	ID                 string `json:"id"`
	NIDN               string `json:"nidn"`
	Nama               string `json:"nama"`
	Bidang             string `json:"bidang"`
	Email              string `json:"email"`
	HP                 string `json:"hp"`
	Password           string `json:"password,omitempty"`
	Role               string `json:"role"`
	MustChangePassword int    `json:"must_change_password,omitempty"`
}

type Mahasiswa struct {
	ID                 string `json:"id"`
	NIM                string `json:"nim"`
	Nama               string `json:"nama"`
	Bab                string `json:"bab"`
	Rutin              string `json:"rutin"`
	JmlBimbingan1      int    `json:"jml_bimbingan1"`
	JmlBimbingan2      int    `json:"jml_bimbingan2"`
	Terakhir           string `json:"terakhir"`
	StatusAlat         string `json:"status_alat"`
	Fitur              string `json:"fitur"`
	KendalaSkripsi     string `json:"kendala_skripsi"`
	KendalaAlat        string `json:"kendala_alat"`
	HP                 string `json:"hp"`
	HPOrtu             string `json:"hp_ortu"`
	Alamat             string `json:"alamat"`
	Pembimbing1ID      string `json:"pembimbing1_id"`
	Pembimbing2ID      string `json:"pembimbing2_id"`
	NamaPembimbing1    string `json:"nama_pembimbing1"`
	NamaPembimbing2    string `json:"nama_pembimbing2"`
	SemesterID         string `json:"semester_id"`
	MasterID           string `json:"master_id"`
	StatusProses       string `json:"status_proses"`
	IjinkanSidang      int    `json:"ijinkan_sidang"`
	StatusSidang       string `json:"status_sidang"`
	TanggalSidang      string `json:"tanggal_sidang"`
	HasilSidang        string `json:"hasil_sidang"`
	NilaiBimbingan     string `json:"nilai_bimbingan"`
	NilaiLaporan       string `json:"nilai_laporan"`
	NilaiSidang        string `json:"nilai_sidang"`
	NilaiAkhir         string `json:"nilai_akhir"`
	FileFinal          string `json:"file_laporan_final"`
	SetujuPembimbing1  int    `json:"setuju_pembimbing1"`
	SetujuPembimbing2  int    `json:"setuju_pembimbing2"`
	MustChangePassword int    `json:"must_change_password,omitempty"`
}

type Bimbingan struct {
	ID            string `json:"id"`
	MhsID         string `json:"mhs_id"`
	Tanggal       string `json:"tanggal"`
	Peran         string `json:"peran"`
	Topik         string `json:"topik"`
	Bab           string `json:"bab"`
	KendalaMhs    string `json:"kendala_mhs"`
	FeedbackDosen string `json:"feedback_dosen"`
	StatusAlat    string `json:"status_alat"`
	Status        string `json:"status"`         // Draft, Proposed, InReview, Completed, OfflineScheduled
	OfflineStatus string `json:"offline_status"` // Scheduled, Finished, Cancelled
	OfflineDate   string `json:"offline_date,omitempty"`
	OfflinePlace  string `json:"offline_place,omitempty"`
	CompletedAt   string `json:"completed_at,omitempty"`
	// Joined fields
	NamaMhs   string `json:"nama_mhs,omitempty"`
	NimMhs    string `json:"nim_mhs,omitempty"`
	NamaDosen string `json:"nama_dosen,omitempty"`
}

type DashboardStats struct {
	TotalMahasiswa   int            `json:"total_mahasiswa"`
	Bab4Plus         int            `json:"bab4_plus"`
	BimbinganRutin   int            `json:"bimbingan_rutin"`
	PerluIntervensi  int            `json:"perlu_intervensi"`
	DistribusiBab    map[string]int `json:"distribusi_bab"`
	DistribusiStatus map[string]int `json:"distribusi_status"`
	DistribusiRutin  map[string]int `json:"distribusi_rutin"`
	Alerts           []Alert        `json:"alerts"`
}

type Alert struct {
	Level  string `json:"level"`
	Nama   string `json:"nama"`
	Reason string `json:"reason"`
}

type Event struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	Type      string `json:"type"` // critical, important, normal
	Mandatory int    `json:"is_mandatory"`
	Category  string `json:"category"` // sidang, bimbingan, yudisium, lainnya
}

type Semester struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	AcademicYear string `json:"academic_year"`
	Term         string `json:"term"`
	Status       string `json:"status"`
}

type Berkas struct {
	ID                   string `json:"id"`
	MhsID                string `json:"mhs_id"`
	SemesterID           string `json:"semester_id"`
	BimbinganID          string `json:"bimbingan_id,omitempty"`
	FilePath             string `json:"file_path"`
	FileName             string `json:"file_name"`
	FileType             string `json:"file_type"`
	Bab                  string `json:"bab"`
	StorageMode          string `json:"storage_mode"`
	ExternalURL          string `json:"external_url"`
	Kendala              string `json:"kendala"`
	UploadedAt           string `json:"uploaded_at"`
	DosenID              string `json:"dosen_id"`
	Feedback             string `json:"feedback,omitempty"`
	FeedbackFirstSavedAt string `json:"feedback_first_saved_at,omitempty"`
}

type AppConfig struct {
	InstName     string `json:"inst_name"`
	DeptName     string `json:"dept_name"`
	ProgName     string `json:"prog_name"`
	AcademicYear string `json:"academic_year"`
	Semester     string `json:"semester"`
	InstLogo     string `json:"inst_logo"`
}

type SidangVerificationToken struct {
	ID        string `json:"id"`
	MhsID     string `json:"mhs_id"`
	Token     string `json:"token"`
	CreatedAt string `json:"created_at"`
}

type SidangVerificationResponse struct {
	Mahasiswa Mahasiswa `json:"mahasiswa"`
	Config    AppConfig `json:"config"`
	Token     string    `json:"token"`
	URL       string    `json:"url"`
}

type TATitle struct {
	ID             string  `json:"id"`
	Title          string  `json:"title"`
	StudentName    string  `json:"student_name"`
	StudentNIM     string  `json:"student_nim"`
	SubmittedAt    string  `json:"submitted_at"`
	Status         string  `json:"status"`
	RelevanceScore float64 `json:"relevance_score,omitempty"`
	MatchLevel     string  `json:"match_level,omitempty"`
}

type TATitleSearchResponse struct {
	Data []TATitle `json:"data"`
	Meta struct {
		Page     int    `json:"page"`
		PageSize int    `json:"page_size"`
		Total    int    `json:"total"`
		Query    string `json:"query,omitempty"`
	} `json:"meta"`
}
