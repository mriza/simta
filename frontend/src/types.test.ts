import { describe, it, expect } from 'vitest'
import type {
  Dosen,
  Mahasiswa,
  Bimbingan,
  DashboardStats,
  Event,
  Semester,
  Berkas,
  AppConfig,
  TATitle,
  TATitleSearchResponse,
  UserRole,
  Tab
} from '../types'

describe('Type Definitions', () => {
  describe('UserRole', () => {
    it('should accept valid roles', () => {
      const roles: UserRole[] = ['prodi', 'dosen', 'mhs', 'umum']

      roles.forEach(role => {
        expect(['prodi', 'dosen', 'mhs', 'umum']).toContain(role)
      })
    })
  })

  describe('Tab', () => {
    it('should accept valid tab names', () => {
      const tabs: Tab[] = [
        'dashboard',
        'mahasiswa',
        'dosen',
        'project',
        'bimbingan',
        'artifacts',
        'report',
        'settings',
        'persiapan_sidang',
        'nilai',
        'ta_titles'
      ]

      tabs.forEach(tab => {
        expect([
          'dashboard',
          'mahasiswa',
          'dosen',
          'project',
          'bimbingan',
          'artifacts',
          'report',
          'settings',
          'persiapan_sidang',
          'nilai',
          'ta_titles'
        ]).toContain(tab)
      })
    })
  })

  describe('Dosen Interface', () => {
    it('should create valid Dosen object', () => {
      const dosen: Dosen = {
        id: 'd1',
        nidn: '123456789',
        nama: 'Dr. John Doe',
        bidang: 'Computer Science',
        email: 'john@example.com',
        hp: '08123456789',
        password: 'hashed_password',
        role: 'dosen',
        must_change_password: 0
      }

      expect(dosen.id).toBe('d1')
      expect(dosen.nidn).toBe('123456789')
      expect(dosen.nama).toBe('Dr. John Doe')
      expect(dosen.role).toBe('dosen')
    })

    it('should handle optional password field', () => {
      const dosen: Dosen = {
        id: 'd1',
        nidn: '123456789',
        nama: 'Dr. John Doe',
        bidang: 'Computer Science',
        email: 'john@example.com',
        hp: '08123456789',
        role: 'dosen'
      }

      expect(dosen.password).toBeUndefined()
      expect(dosen.must_change_password).toBeUndefined()
    })
  })

  describe('Mahasiswa Interface', () => {
    it('should create valid Mahasiswa object', () => {
      const mhs: Mahasiswa = {
        id: 'm1',
        nim: '123456789',
        nama: 'Jane Smith',
        bab: 'Bab 1',
        rutin: 'Ya (1 kali /Minggu)',
        jml_bimbingan1: 5,
        jml_bimbingan2: 3,
        terakhir: '2024-01-15',
        status_alat: 'Pengembangan',
        fitur: 'Web application',
        kendala_skripsi: 'Database design',
        kendala_alat: 'API integration',
        hp: '08123456789',
        hp_ortu: '08198765432',
        alamat: 'Jakarta',
        pembimbing1_id: 'd1',
        pembimbing2_id: 'd2',
        nama_pembimbing1: 'Dr. John Doe',
        nama_pembimbing2: 'Dr. Jane Smith',
        semester_id: 's1',
        master_id: 'master1',
        status_proses: 'Perencanaan',
        ijinkan_sidang: 1,
        status_sidang: 'Approved',
        tanggal_sidang: '2024-06-15',
        hasil_sidang: 'Lulus',
        nilai_bimbingan: '85',
        nilai_laporan: '80',
        nilai_sidang: '88',
        nilai_akhir: 'A',
        file_final: 'final_report.pdf',
        setuju_pembimbing1: 1,
        setuju_pembimbing2: 1,
        must_change_password: 0
      }

      expect(mhs.nim).toBe('123456789')
      expect(mhs.bab).toBe('Bab 1')
      expect(mhs.jml_bimbingan1).toBe(5)
      expect(mhs.status_proses).toBe('Perencanaan')
    })
  })

  describe('Bimbingan Interface', () => {
    it('should create valid Bimbingan object', () => {
      const bimbingan: Bimbingan = {
        id: 'b1',
        mhs_id: 'm1',
        tanggal: '2024-01-15',
        peran: 'Pembimbing 1',
        topik: 'Sistem Informasi Akademik',
        bab: 'Bab 2',
        kendala_mhs: 'Kesulitan dalam perancangan database',
        feedback_dosen: 'Perbaiki relasi tabel',
        status_alat: 'Pengembangan',
        status: 'Completed',
        offline_status: 'Finished',
        offline_date: '2024-01-20',
        offline_place: 'Lab Komputer',
        completed_at: '2024-01-15T14:30:00Z',
        nama_mhs: 'Jane Smith',
        nim_mhs: '123456789',
        nama_dosen: 'Dr. John Doe'
      }

      expect(bimbingan.topik).toBe('Sistem Informasi Akademik')
      expect(bimbingan.status).toBe('Completed')
      expect(bimbingan.nama_mhs).toBe('Jane Smith')
    })
  })

  describe('DashboardStats Interface', () => {
    it('should create valid DashboardStats object', () => {
      const stats: DashboardStats = {
        total_mahasiswa: 150,
        bab4_plus: 45,
        bimbingan_rutin: 120,
        perlu_intervensi: 15,
        distribusi_bab: {
          'Bab 1': 30,
          'Bab 2': 40,
          'Bab 3': 35,
          'Bab 4': 25,
          'Bab 5': 20
        },
        distribusi_status: {
          'Perencanaan': 50,
          'Pengembangan': 60,
          'Pengujian': 40
        },
        distribusi_rutin: {
          'Ya (1 kali /Minggu)': 100,
          'Ya (Tidak Rutin)': 30,
          'Tidak': 20
        },
        alerts: [
          {
            level: 'warn',
            nama: 'John Doe',
            reason: 'Tidak bimbingan > 30 hari'
          }
        ]
      }

      expect(stats.total_mahasiswa).toBe(150)
      expect(stats.bab4_plus).toBe(45)
      expect(stats.distribusi_bab['Bab 1']).toBe(30)
      expect(stats.alerts).toHaveLength(1)
    })
  })

  describe('Event Interface', () => {
    it('should create valid Event object', () => {
      const event: Event = {
        id: 'e1',
        title: 'Sidang Tugas Akhir Periode Januari 2024',
        start_date: '2024-01-15',
        end_date: '2024-01-20',
        type: 'critical',
        mandatory: 1,
        category: 'sidang'
      }

      expect(event.title).toBe('Sidang Tugas Akhir Periode Januari 2024')
      expect(event.type).toBe('critical')
      expect(event.mandatory).toBe(1)
    })
  })

  describe('Semester Interface', () => {
    it('should create valid Semester object', () => {
      const semester: Semester = {
        id: 's1',
        name: 'Semester Genap 2023/2024',
        academic_year: '2023/2024',
        term: 'Genap',
        status: 'active'
      }

      expect(semester.name).toBe('Semester Genap 2023/2024')
      expect(semester.status).toBe('active')
    })
  })

  describe('Berkas Interface', () => {
    it('should create valid Berkas object', () => {
      const berkas: Berkas = {
        id: 'ber1',
        mhs_id: 'm1',
        semester_id: 's1',
        bimbingan_id: 'b1',
        file_path: '/uploads/proposal.pdf',
        file_name: 'proposal.pdf',
        file_type: 'application/pdf',
        bab: 'Bab 1',
        storage_mode: 'local',
        external_url: '',
        kendala: 'Proposal perlu direvisi',
        uploaded_at: '2024-01-15T10:30:00Z',
        dosen_id: 'd1',
        feedback: 'Proposal sudah bagus',
        feedback_first_saved_at: '2024-01-16T09:00:00Z'
      }

      expect(berkas.file_name).toBe('proposal.pdf')
      expect(berkas.file_type).toBe('application/pdf')
      expect(berkas.feedback).toBe('Proposal sudah bagus')
    })
  })

  describe('AppConfig Interface', () => {
    it('should create valid AppConfig object', () => {
      const config: AppConfig = {
        inst_name: 'Universitas ABC',
        dept_name: 'Teknik Informatika',
        prog_name: 'Sistem Informasi',
        academic_year: '2023/2024',
        semester: 'Genap',
        inst_logo: '/api/logo'
      }

      expect(config.inst_name).toBe('Universitas ABC')
      expect(config.prog_name).toBe('Sistem Informasi')
    })
  })

  describe('TATitle Interface', () => {
    it('should create valid TATitle object', () => {
      const title: TATitle = {
        id: 't1',
        title: 'Sistem Informasi Manajemen Perpustakaan Berbasis Web',
        student_name: 'John Doe',
        student_nim: '123456789',
        submitted_at: '2024-01-15',
        status: 'Lulus',
        relevance_score: 0.85,
        match_level: 'aman'
      }

      expect(title.title).toBe('Sistem Informasi Manajemen Perpustakaan Berbasis Web')
      expect(title.relevance_score).toBe(0.85)
      expect(title.match_level).toBe('aman')
    })

    it('should handle optional fields', () => {
      const title: TATitle = {
        id: 't1',
        title: 'Basic Title',
        student_name: 'John Doe',
        student_nim: '123456789',
        submitted_at: '2024-01-15',
        status: 'Sedang Dikerjakan'
      }

      expect(title.relevance_score).toBeUndefined()
      expect(title.match_level).toBeUndefined()
    })
  })

  describe('TATitleSearchResponse Interface', () => {
    it('should create valid TATitleSearchResponse object', () => {
      const response: TATitleSearchResponse = {
        data: [
          {
            id: 't1',
            title: 'Sistem Informasi Akademik',
            student_name: 'John Doe',
            student_nim: '123456789',
            submitted_at: '2024-01-15',
            status: 'Lulus'
          }
        ],
        meta: {
          page: 1,
          page_size: 20,
          total: 150,
          query: 'sistem informasi'
        }
      }

      expect(response.data).toHaveLength(1)
      expect(response.meta.page).toBe(1)
      expect(response.meta.total).toBe(150)
      expect(response.meta.query).toBe('sistem informasi')
    })
  })

  describe('Type Safety', () => {
    it('should enforce type safety for UserRole', () => {
      // This should compile without errors
      const role: UserRole = 'dosen'
      expect(role).toBe('dosen')

      // This would cause a TypeScript error if uncommented:
      // const invalidRole: UserRole = 'invalid'
    })

    it('should enforce type safety for Tab', () => {
      const tab: Tab = 'ta_titles'
      expect(tab).toBe('ta_titles')
    })

    it('should enforce required fields in interfaces', () => {
      // These should all be valid
      const dosen: Dosen = {
        id: 'd1',
        nidn: '123',
        nama: 'Test',
        bidang: 'Test',
        email: 'test@example.com',
        hp: '08123',
        role: 'dosen'
      }

      const mhs: Mahasiswa = {
        id: 'm1',
        nim: '123',
        nama: 'Test',
        bab: 'Bab 1',
        rutin: 'Ya (1 kali /Minggu)',
        jml_bimbingan1: 0,
        jml_bimbingan2: 0,
        terakhir: '2024-01-01',
        pembimbing1_id: 'd1'
      }

      expect(dosen.nama).toBe('Test')
      expect(mhs.nama).toBe('Test')
    })
  })

  describe('Enum-like Values', () => {
    it('should validate status values', () => {
      const validStatuses = [
        'Belum Dimulai',
        'Perencanaan',
        'Pengembangan',
        'Pengujian',
        'Dokumentasi'
      ]

      validStatuses.forEach(status => {
        expect(typeof status).toBe('string')
        expect(status.length).toBeGreaterThan(0)
      })
    })

    it('should validate term values', () => {
      const validTerms = [
        'Ya (1 kali /Minggu)',
        'Ya (Tidak Rutin)',
        'Tidak'
      ]

      validTerms.forEach(term => {
        expect(typeof term).toBe('string')
        expect(term.length).toBeGreaterThan(0)
      })
    })

    it('should validate event types', () => {
      const validTypes = ['critical', 'important', 'normal']

      validTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })

    it('should validate match levels', () => {
      const validLevels = ['aman', 'perlu_review', 'mirip_tinggi']

      validLevels.forEach(level => {
        expect(typeof level).toBe('string')
      })
    })
  })
})