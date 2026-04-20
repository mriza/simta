export interface Dosen {
  id: string
  nidn: string
  nama: string
  bidang: string
  email: string
  hp: string
  password?: string
  role: string
}

export interface Mahasiswa {
  id: string
  nim: string
  nama: string
  bab: string
  rutin: string
  jml_bimbingan1: number
  jml_bimbingan2: number
  terakhir: string
  status_alat: string
  fitur: string
  kendala_skripsi: string
  kendala_alat: string
  hp: string
  hp_ortu: string
  alamat: string
  pembimbing1_id: string
  pembimbing2_id: string
  nama_pembimbing1?: string
  nama_pembimbing2?: string
  semester_id: string
  master_id: string
  status_proses: 'Bimbingan' | 'Lulus' | 'Lanjut' | 'Berhenti'
  ijinkan_sidang: number
  status_sidang: string
  tanggal_sidang: string
  hasil_sidang: string
  nilai_bimbingan: string
  nilai_laporan: string
  nilai_sidang: string
  nilai_akhir: string
  file_laporan_final: string
  setuju_pembimbing1: number
  setuju_pembimbing2: number
}

export interface Bimbingan {
  id: string
  mhs_id: string
  tanggal: string
  peran: string
  topik: string
  bab: string
  kendala_mhs: string
  feedback_dosen: string
  status_alat: string
  status: 'Draft' | 'Proposed' | 'InReview' | 'Completed' | 'OfflineScheduled'
  offline_status: 'Scheduled' | 'Finished' | 'Cancelled' | ''
  offline_date?: string
  offline_place?: string
  nama_mhs?: string
  nim_mhs?: string
  nama_dosen?: string
}

export interface Alert {
  level: 'danger' | 'warn'
  nama: string
  reason: string
}

export interface DashboardStats {
  total_mahasiswa: number
  bab4_plus: number
  bimbingan_rutin: number
  perlu_intervensi: number
  distribusi_bab: Record<string, number>
  distribusi_status: Record<string, number>
  distribusi_rutin: Record<string, number>
  alerts: Alert[]
}

export type Tab = 'dashboard' | 'mahasiswa' | 'dosen' | 'project' | 'bimbingan' | 'artifacts' | 'report' | 'settings' | 'persiapan_sidang' | 'nilai' | 'ta_titles'

export interface AppConfig {
  inst_name: string
  dept_name: string
  prog_name: string
  academic_year: string
  semester: string
  inst_logo?: string
}

export interface Event {
  id: string
  title: string
  start_date: string
  end_date: string
  type: 'critical' | 'important' | 'normal'
  is_mandatory: number
  category: 'sidang' | 'bimbingan' | 'yudisium' | 'update' | 'proposal' | 'lainnya'
}

export interface Semester {
  id: string
  name: string
  academic_year: string
  term: string
  status: 'active' | 'archived'
}

export interface Berkas {
  id: string
  mhs_id: string
  semester_id: string
  bimbingan_id?: string
  file_path: string
  file_name: string
  file_type: string
  bab: string
  storage_mode: 'file' | 'external' | 'youtube'
  external_url: string
  kendala: string
  uploaded_at: string
  dosen_id?: string
  feedback?: string
  feedback_first_saved_at?: string
}

export type UserRole = 'mhs' | 'dosen' | 'prodi' | 'umum'

export interface TATitle {
  id: string
  title: string
  student_name: string
  student_nim: string
  submitted_at: string
  status: string
  relevance_score?: number
  match_level?: 'aman' | 'perlu_review' | 'mirip_tinggi'
}

export interface TATitleSearchResponse {
  data: TATitle[]
  meta: {
    page: number
    page_size: number
    total: number
    query?: string
  }
}
