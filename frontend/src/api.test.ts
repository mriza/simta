import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from './api'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock fetch globally
const fetchMock = vi.fn()
global.fetch = fetchMock

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockClear()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
    localStorageMock.clear.mockClear()
    // Clear localStorage
    localStorage.clear()
    // Reset currentToken
    api.setToken('', 'umum', '', '')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Token Management', () => {
    it('should set and store token correctly', () => {
      const token = 'test-token'
      const role = 'dosen'
      const userId = 'user123'
      const name = 'John Doe'

      api.setToken(token, role, userId, name)

      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', token)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('userRole', role)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('userId', userId)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('userName', name)
    })

    it('should handle undefined/null values', () => {
      api.setToken('token', undefined as any, null as any, undefined as any)

      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('userRole', 'umum')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('userId', '')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('userName', '')
    })

    it('should logout and clear storage', () => {
      // Set some data first
      api.setToken('token', 'dosen', 'user123', 'John')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'token')

      api.logout()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('userRole')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('userId')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('userName')
    })
  })

  describe('Login', () => {
    it('should make login request with correct parameters', async () => {
      const mockResponse = {
        token: 'jwt-token',
        role: 'dosen',
        user_id: 'user123',
        name: 'John Doe'
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.login('123456789', 'password123')

      expect(fetchMock).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nidn: '123456789',
          password: 'password123'
        })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle login errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Invalid credentials' })
      })

      await expect(api.login('wrong', 'wrong')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('TA Titles Search', () => {
    it('should make search request with query parameters', async () => {
      const mockResponse = {
        data: [],
        meta: { page: 1, page_size: 20, total: 0 }
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.taTitles.search({
        q: 'sistem informasi',
        page: 2,
        page_size: 10
      })

      expect(fetchMock).toHaveBeenCalledWith('/api/ta-titles?q=sistem%20informasi&page=2&page_size=10', {
        method: 'GET',
        headers: {}
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle search without parameters', async () => {
      const mockResponse = {
        data: [],
        meta: { page: 1, page_size: 20, total: 0 }
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      await api.taTitles.search({})

      expect(fetchMock).toHaveBeenCalledWith('/api/ta-titles', {
        method: 'GET',
        headers: {}
      })
    })
  })

  describe('Dashboard', () => {
    it('should fetch dashboard stats', async () => {
      const mockStats = {
        total_mahasiswa: 150,
        bab4_plus: 45,
        bimbingan_rutin: 120,
        perlu_intervensi: 15,
        distribusi_bab: { 'Bab 1': 30, 'Bab 2': 40 },
        distribusi_status: {},
        distribusi_rutin: {},
        alerts: []
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })

      const result = await api.dashboard()

      expect(fetchMock).toHaveBeenCalledWith('/api/dashboard', {
        method: 'GET',
        headers: {}
      })
      expect(result).toEqual(mockStats)
    })
  })

  describe('Config', () => {
    it('should fetch config', async () => {
      const mockConfig = {
        inst_name: 'Universitas ABC',
        dept_name: 'Teknik Informatika',
        prog_name: 'Sistem Informasi',
        academic_year: '2023/2024',
        semester: 'Genap',
        inst_logo: '/api/logo'
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      })

      const result = await api.config.get()

      expect(fetchMock).toHaveBeenCalledWith('/api/config', {
        method: 'GET',
        headers: {}
      })
      expect(result).toEqual(mockConfig)
    })

    it('should update config', async () => {
      const configData = {
        inst_name: 'Universitas XYZ',
        dept_name: 'Teknik Informatika',
        prog_name: 'Sistem Informasi',
        academic_year: '2023/2024',
        semester: 'Genap',
        inst_logo: '/api/logo'
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(configData)
      })

      const result = await api.config.update(configData)

      expect(fetchMock).toHaveBeenCalledWith('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      })
      expect(result).toEqual(configData)
    })
  })

  describe('Dosen API', () => {
    it('should list dosen', async () => {
      const mockDosen = [
        { id: 'd1', nidn: '123456789', nama: 'Dr. John Doe' }
      ]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDosen)
      })

      const result = await api.dosen.list()

      expect(fetchMock).toHaveBeenCalledWith('/api/dosen', {
        method: 'GET',
        headers: {}
      })
      expect(result).toEqual(mockDosen)
    })

    it('should create dosen', async () => {
      const dosenData = {
        nidn: '123456789',
        nama: 'Dr. John Doe',
        bidang: 'Computer Science',
        email: 'john@example.com',
        hp: '08123456789'
      }
      const mockResponse = { id: 'd1', ...dosenData }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.dosen.create(dosenData)

      expect(fetchMock).toHaveBeenCalledWith('/api/dosen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dosenData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should update dosen', async () => {
      const dosenData = {
        nidn: '123456789',
        nama: 'Dr. Jane Doe',
        bidang: 'Computer Science',
        email: 'jane@example.com',
        hp: '08123456789'
      }
      const mockResponse = { id: 'd1', ...dosenData }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.dosen.update('d1', dosenData)

      expect(fetchMock).toHaveBeenCalledWith('/api/dosen/d1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dosenData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should delete dosen', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true })
      })

      const result = await api.dosen.delete('d1')

      expect(fetchMock).toHaveBeenCalledWith('/api/dosen/d1', {
        method: 'DELETE',
        headers: {}
      })
      expect(result).toEqual({ ok: true })
    })
  })

  describe('Mahasiswa API', () => {
    it('should list mahasiswa', async () => {
      const mockMahasiswa = [
        { id: 'm1', nim: '123456789', nama: 'Jane Smith' }
      ]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMahasiswa)
      })

      const result = await api.mahasiswa.list()

      expect(fetchMock).toHaveBeenCalledWith('/api/mahasiswa', {
        method: 'GET',
        headers: {}
      })
      expect(result).toEqual(mockMahasiswa)
    })

    it('should update batch status', async () => {
      const ids = ['m1', 'm2']
      const status = 'Lulus'
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true })
      })

      const result = await api.mahasiswa.updateBatchStatus(ids, status)

      expect(fetchMock).toHaveBeenCalledWith('/api/mahasiswa/batch-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids, status })
      })
      expect(result).toEqual({ ok: true })
    })
  })

  describe('Bimbingan API', () => {
    it('should create bimbingan', async () => {
      const bimbinganData = {
        mhs_id: 'm1',
        tanggal: '2024-01-15',
        peran: 'Pembimbing 1',
        topik: 'Sistem Informasi Akademik',
        bab: 'Bab 1',
        kendala_mhs: 'Kesulitan perancangan database'
      }
      const mockResponse = { id: 'b1', ...bimbinganData, status: 'Draft' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.bimbingan.create(bimbinganData)

      expect(fetchMock).toHaveBeenCalledWith('/api/bimbingan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bimbinganData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should submit bimbingan', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true })
      })

      const result = await api.bimbingan.submit('b1')

      expect(fetchMock).toHaveBeenCalledWith('/api/bimbingan/b1/submit', {
        method: 'POST',
        headers: {}
      })
      expect(result).toEqual({ ok: true })
    })
  })

  describe('Events API', () => {
    it('should list events', async () => {
      const mockEvents = [
        {
          id: 'e1',
          title: 'Sidang Tugas Akhir',
          start_date: '2024-01-15',
          type: 'critical'
        }
      ]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents)
      })

      const result = await api.events.list()

      expect(fetchMock).toHaveBeenCalledWith('/api/events', {
        method: 'GET',
        headers: {}
      })
      expect(result).toEqual(mockEvents)
    })

    it('should create event', async () => {
      const eventData = {
        title: 'Workshop Metodologi Penelitian',
        start_date: '2024-02-01',
        end_date: '2024-02-01',
        type: 'important',
        mandatory: 0,
        category: 'bimbingan'
      }
      const mockResponse = { id: 'e1', ...eventData }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.events.create(eventData)

      expect(fetchMock).toHaveBeenCalledWith('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      await expect(api.dashboard()).rejects.toThrow('Network error')
    })

    it('should handle HTTP errors with JSON response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Validation failed' })
      })

      await expect(api.login('test', 'test')).rejects.toThrow('Validation failed')
    })

    it('should handle HTTP errors without JSON response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      await expect(api.dashboard()).rejects.toThrow('Internal Server Error')
    })
  })

  describe('File Uploads', () => {
    it('should handle FormData uploads', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test content']), 'test.pdf')

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'ber1', file_path: '/uploads/test.pdf' })
      })

      const result = await api.berkas.upload(formData)

      expect(fetchMock).toHaveBeenCalledWith('/api/berkas', {
        method: 'POST',
        headers: {}, // No Content-Type for FormData
        body: formData
      })
      expect(result).toEqual({ id: 'ber1', file_path: '/uploads/test.pdf' })
    })
  })
})