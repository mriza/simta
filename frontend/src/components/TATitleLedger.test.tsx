import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TATitleLedger from './TATitleLedger'
import type { UserRole } from '../types'

// Mock the API
vi.mock('./api', () => ({
  api: {
    taTitles: {
      search: vi.fn()
    }
  }
}))

describe('TATitleLedger Component', () => {
  const { api } = require('./api')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultProps = {
    role: 'dosen' as UserRole
  }

  const mockSearchResponse = {
    data: [
      {
        id: 't1',
        title: 'Sistem Informasi Manajemen Perpustakaan Berbasis Web',
        student_name: 'John Doe',
        student_nim: '123456789',
        submitted_at: '2024-01-15',
        status: 'Lulus',
        relevance_score: 0.85,
        match_level: 'aman'
      },
      {
        id: 't2',
        title: 'Aplikasi Mobile untuk Monitoring Kesehatan',
        student_name: 'Jane Smith',
        student_nim: '987654321',
        submitted_at: '2024-01-20',
        status: 'Sedang Dikerjakan',
        relevance_score: 0.72,
        match_level: 'perlu_review'
      }
    ],
    meta: {
      page: 1,
      page_size: 20,
      total: 2,
      query: 'sistem informasi'
    }
  }

  it('should render loading state initially', () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    expect(screen.getByText('Memuat daftar judul TA…')).toBeInTheDocument()
  })

  it('should render title and description', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Buku Besar Judul TA')).toBeInTheDocument()
      expect(screen.getByText('Cari dan kelola judul Tugas Akhir yang telah diajukan')).toBeInTheDocument()
    })
  })

  it('should render search input', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Cari judul TA atau cek kemiripan judul usulan...')
      expect(searchInput).toBeInTheDocument()
    })
  })

  it('should render table headers', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Judul TA')).toBeInTheDocument()
      expect(screen.getByText('Mahasiswa')).toBeInTheDocument()
      expect(screen.getByText('NIM')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Diajukan')).toBeInTheDocument()
      expect(screen.getByText('Relevansi')).toBeInTheDocument()
    })
  })

  it('should render TA titles data', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Sistem Informasi Manajemen Perpustakaan Berbasis Web')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('123456789')).toBeInTheDocument()
      expect(screen.getByText('Lulus')).toBeInTheDocument()
    })
  })

  it('should render match levels correctly', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Aman')).toBeInTheDocument()
      expect(screen.getByText('Perlu Review')).toBeInTheDocument()
      expect(screen.getByText('85.0%')).toBeInTheDocument()
      expect(screen.getByText('72.0%')).toBeInTheDocument()
    })
  })

  it('should show search results info', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Menampilkan 2 dari 2 hasil untuk "sistem informasi"')).toBeInTheDocument()
    })
  })

  it('should show total count when no search query', async () => {
    const responseWithoutQuery = {
      ...mockSearchResponse,
      meta: { ...mockSearchResponse.meta, query: undefined }
    }
    api.taTitles.search.mockResolvedValueOnce(responseWithoutQuery)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Menampilkan 2 dari 2 judul TA')).toBeInTheDocument()
    })
  })

  it('should handle search input changes', async () => {
    const user = userEvent.setup()
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cari judul TA atau cek kemiripan judul usulan...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cari judul TA atau cek kemiripan judul usulan...')
    await user.type(searchInput, 'sistem')

    // Wait for debounced search
    await waitFor(() => {
      expect(api.taTitles.search).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
        q: 'sistem'
      })
    }, { timeout: 400 })
  })

  it('should show loading state during search', async () => {
    const user = userEvent.setup()
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cari judul TA atau cek kemiripan judul usulan...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cari judul TA atau cek kemiripan judul usulan...')
    await user.type(searchInput, 'test')

    expect(screen.getByText('Mencari...')).toBeInTheDocument()
  })

  it('should handle pagination', async () => {
    const paginatedResponse = {
      ...mockSearchResponse,
      meta: { ...mockSearchResponse.meta, total: 45, page: 1 }
    }
    api.taTitles.search.mockResolvedValueOnce(paginatedResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Halaman 1 dari 3')).toBeInTheDocument()
    })

    const nextButton = screen.getByText('Selanjutnya ›')
    expect(nextButton).toBeInTheDocument()
    expect(nextButton).not.toBeDisabled()
  })

  it('should disable pagination buttons appropriately', async () => {
    const firstPageResponse = {
      ...mockSearchResponse,
      meta: { ...mockSearchResponse.meta, page: 1, total: 45 }
    }
    api.taTitles.search.mockResolvedValueOnce(firstPageResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      const prevButton = screen.getByText('‹ Sebelumnya')
      const nextButton = screen.getByText('Selanjutnya ›')

      expect(prevButton).toBeDisabled()
      expect(nextButton).not.toBeDisabled()
    })
  })

  it('should handle API errors', async () => {
    api.taTitles.search.mockRejectedValueOnce(new Error('API Error'))

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument()
    })
  })

  it('should show empty state when no results', async () => {
    const emptyResponse = {
      data: [],
      meta: { page: 1, page_size: 20, total: 0, query: 'nonexistent' }
    }
    api.taTitles.search.mockResolvedValueOnce(emptyResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Tidak ada judul TA yang cocok dengan "nonexistent"')).toBeInTheDocument()
    })
  })

  it('should show empty state when no data and no query', async () => {
    const emptyResponse = {
      data: [],
      meta: { page: 1, page_size: 20, total: 0 }
    }
    api.taTitles.search.mockResolvedValueOnce(emptyResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Belum ada judul TA yang diajukan')).toBeInTheDocument()
    })
  })

  it('should format dates correctly', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      // Should show formatted dates
      expect(screen.getByText('15 Jan 2024')).toBeInTheDocument()
      expect(screen.getByText('20 Jan 2024')).toBeInTheDocument()
    })
  })

  it('should render status badges correctly', async () => {
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      const lulusBadge = screen.getByText('Lulus')
      const sedangBadge = screen.getByText('Sedang Dikerjakan')

      expect(lulusBadge).toBeInTheDocument()
      expect(sedangBadge).toBeInTheDocument()
    })
  })

  it('should not show relevance column when no search query', async () => {
    const responseWithoutQuery = {
      ...mockSearchResponse,
      meta: { ...mockSearchResponse.meta, query: undefined }
    }
    api.taTitles.search.mockResolvedValueOnce(responseWithoutQuery)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.queryByText('Relevansi')).not.toBeInTheDocument()
    })
  })

  it('should reset to page 1 when search query changes', async () => {
    const user = userEvent.setup()
    api.taTitles.search.mockResolvedValueOnce(mockSearchResponse)

    render(<TATitleLedger {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cari judul TA atau cek kemiripan judul usulan...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cari judul TA atau cek kemiripan judul usulan...')
    await user.clear(searchInput)
    await user.type(searchInput, 'new search')

    await waitFor(() => {
      expect(api.taTitles.search).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
        q: 'new search'
      })
    })
  })
})