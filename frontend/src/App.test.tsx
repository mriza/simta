import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

// Mock all API calls
vi.mock('./api', () => ({
  api: {
    login: vi.fn(),
    setToken: vi.fn(),
    logout: vi.fn(),
    dashboard: vi.fn().mockResolvedValue({
      total_mahasiswa: 150,
      bab4_plus: 45,
      bimbingan_rutin: 120,
      perlu_intervensi: 15,
      distribusi_bab: {},
      distribusi_status: {},
      distribusi_rutin: {},
      alerts: []
    }),
    mahasiswa: {
      list: vi.fn().mockResolvedValue([])
    },
    dosen: {
      list: vi.fn().mockResolvedValue([])
    },
    bimbingan: {
      list: vi.fn().mockResolvedValue([])
    },
    config: {
      get: vi.fn().mockResolvedValue({
        inst_name: 'Universitas Test',
        dept_name: 'Teknik Informatika',
        prog_name: 'Sistem Informasi',
        academic_year: '2023/2024',
        semester: 'Genap',
        inst_logo: ''
      })
    }
  }
}))

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

// Mock URL search params for public verification
const mockSearchParams = new URLSearchParams()
vi.mock('url', () => ({
  URLSearchParams: vi.fn(() => mockSearchParams)
}))

describe('App Component', () => {
  const { api } = require('../api')

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage mocks
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
    localStorageMock.removeItem.mockImplementation(() => {})
    localStorageMock.clear.mockImplementation(() => {})

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true
    })
  })

  it('should render app title', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/SIMTA/)).toBeInTheDocument()
      expect(screen.getByText(/Sistem Monitoring Tugas Akhir/)).toBeInTheDocument()
    })
  })

  it('should show login button for guest users', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Masuk')).toBeInTheDocument()
    })
  })

  it('should show guest notice on non-dashboard tabs', async () => {
    render(<App />)

    await waitFor(() => {
      // Click on a tab that requires login
      const mahasiswaTab = screen.getByText('Mahasiswa')
      userEvent.click(mahasiswaTab)
    })

    await waitFor(() => {
      expect(screen.getByText('Anda masuk sebagai pengunjung umum.')).toBeInTheDocument()
    })
  })

  it('should render dashboard by default', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Dasbor Ringkasan')).toBeInTheDocument()
    })
  })

  it('should switch tabs when clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Dasbor Ringkasan')).toBeInTheDocument()
    })

    // Click on Report tab
    const reportTab = screen.getByText('Statistik')
    await user.click(reportTab)

    await waitFor(() => {
      expect(screen.getByText('Laporan Ketercapaian')).toBeInTheDocument()
    })
  })

  it('should show login modal when login button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      const loginButton = screen.getByText('Masuk')
      user.click(loginButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Sistem Monitoring Tugas Akhir')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Masukkan NIDN atau NIM')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    })
  })

  it('should handle login form submission', async () => {
    const user = userEvent.setup()
    api.login.mockResolvedValueOnce({
      token: 'test-token',
      role: 'dosen',
      user_id: 'user123',
      name: 'John Doe'
    })

    render(<App />)

    // Open login modal
    await waitFor(() => {
      const loginButton = screen.getByText('Masuk')
      user.click(loginButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Masuk')).toBeInTheDocument()
    })

    // Fill login form
    const nidnInput = screen.getByPlaceholderText('Masukkan NIDN atau NIM')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByText('Masuk')

    await user.type(nidnInput, '123456789')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('123456789', 'password123')
      expect(api.setToken).toHaveBeenCalledWith('test-token', 'dosen', 'user123', 'John Doe')
    })
  })

  it('should show login error on failed login', async () => {
    const user = userEvent.setup()
    api.login.mockRejectedValueOnce(new Error('Invalid credentials'))

    render(<App />)

    // Open login modal
    await waitFor(() => {
      const loginButton = screen.getByText('Masuk')
      user.click(loginButton)
    })

    await waitFor(() => {
      const nidnInput = screen.getByPlaceholderText('Masukkan NIDN atau NIM')
      const passwordInput = screen.getByPlaceholderText('Password')
      const submitButton = screen.getByText('Masuk')

      user.type(nidnInput, 'wrong')
      user.type(passwordInput, 'wrong')
      user.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Login gagal')).toBeInTheDocument()
    })
  })

  it('should restore session from localStorage', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      const mockData = {
        authToken: 'stored-token',
        userRole: 'dosen',
        userId: 'user123',
        userName: 'John Doe'
      }
      return mockData[key] || null
    })

    render(<App />)

    await waitFor(() => {
      expect(api.setToken).toHaveBeenCalledWith('stored-token', 'dosen', 'user123', 'John Doe')
    })
  })

  it('should handle logout', async () => {
    const user = userEvent.setup()

    // Mock logged in state
    localStorageMock.getItem.mockImplementation((key) => {
      const mockData = {
        authToken: 'stored-token',
        userRole: 'dosen',
        userId: 'user123',
        userName: 'John Doe'
      }
      return mockData[key] || null
    })

    render(<App />)

    await waitFor(() => {
      const logoutButton = screen.getByText('Keluar')
      user.click(logoutButton)
    })

    await waitFor(() => {
      expect(api.logout).toHaveBeenCalled()
      expect(screen.getByText('Masuk')).toBeInTheDocument()
    })
  })

  it('should show user info when logged in', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      const mockData = {
        authToken: 'stored-token',
        userRole: 'dosen',
        userId: 'user123',
        userName: 'Dr. John Doe'
      }
      return mockData[key] || null
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Koordinator Prodi')).toBeInTheDocument()
      expect(screen.getByText('Dr. John Doe')).toBeInTheDocument()
    })
  })

  it('should show correct tab counts', async () => {
    api.mahasiswa.list.mockResolvedValueOnce([
      { id: 'm1' }, { id: 'm2' }, { id: 'm3' }
    ])
    api.dosen.list.mockResolvedValueOnce([
      { id: 'd1' }, { id: 'd2' }
    ])

    localStorageMock.getItem.mockImplementation((key) => {
      const mockData = {
        authToken: 'stored-token',
        userRole: 'prodi',
        userId: 'user123',
        userName: 'Admin'
      }
      return mockData[key] || null
    })

    render(<App />)

    await waitFor(() => {
      const mahasiswaTab = screen.getByText('Mahasiswa')
      const dosenTab = screen.getByText('Dosen')

      // Check if count badges are shown
      expect(mahasiswaTab.parentElement).toHaveTextContent('3')
      expect(dosenTab.parentElement).toHaveTextContent('2')
    })
  })

  it('should show loading state initially', () => {
    render(<App />)

    expect(screen.getByText('Memuat data…')).toBeInTheDocument()
  })

  it('should handle API errors gracefully', async () => {
    api.dashboard.mockRejectedValueOnce(new Error('API Error'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Gagal menghubungi server: API Error')).toBeInTheDocument()
    })
  })

  it('should show TA Titles tab for dosen and prodi roles', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      const mockData = {
        authToken: 'stored-token',
        userRole: 'dosen',
        userId: 'user123',
        userName: 'Dr. John Doe'
      }
      return mockData[key] || null
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Buku Besar Judul TA')).toBeInTheDocument()
    })
  })

  it('should not show restricted tabs for mhs role', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      const mockData = {
        authToken: 'stored-token',
        userRole: 'mhs',
        userId: 'user123',
        userName: 'John Doe'
      }
      return mockData[key] || null
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.queryByText('Mahasiswa')).not.toBeInTheDocument()
      expect(screen.queryByText('Dosen')).not.toBeInTheDocument()
      expect(screen.queryByText('Pengaturan')).not.toBeInTheDocument()
    })
  })

  it('should show persiapan sidang and nilai tabs for mhs role', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      const mockData = {
        authToken: 'stored-token',
        userRole: 'mhs',
        userId: 'user123',
        userName: 'John Doe'
      }
      return mockData[key] || null
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Persiapan Sidang')).toBeInTheDocument()
      expect(screen.getByText('Nilai')).toBeInTheDocument()
    })
  })

  it('should scroll to top when switching tabs', async () => {
    const user = userEvent.setup()
    const mockScrollTo = vi.fn()
    window.scrollTo = mockScrollTo

    render(<App />)

    await waitFor(() => {
      const reportTab = screen.getByText('Statistik')
      user.click(reportTab)
    })

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    })
  })
})