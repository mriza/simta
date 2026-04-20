import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard'
import type { DashboardStats, UserRole } from '../types'

// Mock the API
vi.mock('./api', () => ({
  api: {
    events: {
      list: vi.fn().mockResolvedValue([])
    },
    bimbingan: {
      list: vi.fn().mockResolvedValue([])
    },
    mahasiswa: {
      list: vi.fn().mockResolvedValue([])
    }
  }
}))

describe('Dashboard Component', () => {
  const mockStats: DashboardStats = {
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
      },
      {
        level: 'danger',
        nama: 'Jane Smith',
        reason: 'Belum mulai Bab 1'
      }
    ]
  }

  const defaultProps = {
    stats: mockStats,
    role: 'dosen' as UserRole,
    onTabChange: vi.fn(),
    onPrintSidang: vi.fn()
  }

  it('should render dashboard with stats', () => {
    render(<Dashboard {...defaultProps} />)

    expect(screen.getByText('Dasbor Ringkasan')).toBeInTheDocument()
    expect(screen.getByText('Pantauan agregat progres tugas akhir mahasiswa')).toBeInTheDocument()
    expect(screen.getByText('Total Mahasiswa')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('should show correct stat cards', () => {
    render(<Dashboard {...defaultProps} />)

    expect(screen.getByText('Progres Bab 4–5')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('30% dari total')).toBeInTheDocument()

    expect(screen.getByText('Bimbingan Rutin')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('minimal 1×/minggu')).toBeInTheDocument()

    expect(screen.getByText('Perlu Intervensi')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('should render distribution charts', () => {
    render(<Dashboard {...defaultProps} />)

    expect(screen.getByText('Distribusi Progres Penulisan')).toBeInTheDocument()
    expect(screen.getByText('Status Pengembangan Aplikasi/Alat')).toBeInTheDocument()
    expect(screen.getByText('Rutinitas Bimbingan')).toBeInTheDocument()
  })

  it('should show alerts for dosen role', () => {
    render(<Dashboard {...defaultProps} />)

    expect(screen.getByText('Perlu Perhatian')).toBeInTheDocument()
    expect(screen.getByText('Mahasiswa dengan indikator risiko')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('should not show alerts for mhs role', () => {
    render(<Dashboard {...defaultProps} role="mhs" />)

    expect(screen.queryByText('Perlu Perhatian')).not.toBeInTheDocument()
  })

  it('should show start bimbingan button for mhs role', () => {
    render(<Dashboard {...defaultProps} role="mhs" />)

    expect(screen.getByText('🚀 Memulai Bimbingan TA')).toBeInTheDocument()
  })

  it('should call onTabChange when start bimbingan button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnTabChange = vi.fn()

    render(<Dashboard {...defaultProps} role="mhs" onTabChange={mockOnTabChange} />)

    const button = screen.getByText('🚀 Memulai Bimbingan TA')
    await user.click(button)

    expect(mockOnTabChange).toHaveBeenCalledWith('bimbingan')
  })

  it('should show ajuan bimbingan notification for dosen', () => {
    // Mock API to return pending bimbingan
    const { api } = require('../api')
    api.bimbingan.list.mockResolvedValueOnce([
      { id: 'b1', status: 'Proposed', mhs_id: 'm1' }
    ])

    render(<Dashboard {...defaultProps} />)

    expect(screen.getByText('1 Ajuan Bimbingan Baru')).toBeInTheDocument()
    expect(screen.getByText('Mahasiswa telah mengunggah berkas dan menunggu review Anda.')).toBeInTheDocument()
  })

  it('should render calendar section', () => {
    render(<Dashboard {...defaultProps} />)

    expect(screen.getByText('Kalender Akademik')).toBeInTheDocument()
    expect(screen.getByText('Rencana kegiatan penting semester ini')).toBeInTheDocument()
  })

  it('should show empty state when no events', () => {
    render(<Dashboard {...defaultProps} />)

    expect(screen.getByText('Tidak ada kegiatan terdekat.')).toBeInTheDocument()
  })

  it('should render loading state when stats is null', () => {
    render(<Dashboard {...defaultProps} stats={null} />)

    expect(screen.getByText('Memuat dasbor…')).toBeInTheDocument()
  })

  it('should calculate percentages correctly', () => {
    render(<Dashboard {...defaultProps} />)

    // Bab 4-5 percentage: 45/150 = 30%
    expect(screen.getByText('30% dari total')).toBeInTheDocument()
  })

  it('should handle empty alerts array', () => {
    const statsWithoutAlerts = { ...mockStats, alerts: [] }
    render(<Dashboard {...defaultProps} stats={statsWithoutAlerts} />)

    expect(screen.getByText('Tidak ada mahasiswa dengan indikator risiko.')).toBeInTheDocument()
  })

  it('should truncate long status names', () => {
    const statsWithLongStatus = {
      ...mockStats,
      distribusi_status: {
        'Pengembangan Aplikasi Web dengan Framework React dan Node.js': 50
      }
    }
    render(<Dashboard {...defaultProps} stats={statsWithLongStatus} />)

    // Should contain truncated text with ellipsis
    const statusElement = screen.getByText(/Pengembangan Aplikasi Web.*\.\.\./)
    expect(statusElement).toBeInTheDocument()
  })
})