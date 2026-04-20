import { describe, it, expect, vi } from 'vitest'
import {
  fmtDate,
  daysSince,
  babProgress,
  babBadgeClass,
  rutinBadgeClass,
  statusBadgeClass,
  truncate,
  todayISO,
  getErrorMessage,
  getGrade,
} from './utils'

describe('Date Utilities', () => {
  describe('fmtDate', () => {
    it('should format valid date string', () => {
      const result = fmtDate('2024-01-15')
      expect(result).toMatch(/\d{2} Jan \d{4}/)
    })

    it('should return original string for invalid date', () => {
      expect(fmtDate('invalid')).toBe('invalid')
      expect(fmtDate('')).toBe('—')
    })

    it('should handle null/undefined', () => {
      expect(fmtDate('')).toBe('—')
    })
  })

  describe('daysSince', () => {
    it('should calculate days since date', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      const result = daysSince(pastDate.toISOString())
      expect(result).toBe(5)
    })

    it('should return null for invalid date', () => {
      expect(daysSince('invalid')).toBeNull()
      expect(daysSince('')).toBeNull()
    })
  })

  describe('todayISO', () => {
    it('should return current date in ISO format', () => {
      const result = todayISO()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})

describe('Progress Utilities', () => {
  describe('babProgress', () => {
    it('should return correct progress percentages', () => {
      expect(babProgress('Bab 1')).toBe(20)
      expect(babProgress('Bab 2')).toBe(40)
      expect(babProgress('Bab 3')).toBe(60)
      expect(babProgress('Bab 4')).toBe(80)
      expect(babProgress('Bab 5')).toBe(95)
    })

    it('should return 0 for unknown bab', () => {
      expect(babProgress('Bab 6')).toBe(0)
      expect(babProgress('')).toBe(0)
    })
  })

  describe('babBadgeClass', () => {
    it('should return correct badge classes', () => {
      expect(babBadgeClass('Bab 3')).toBe('badge-bab3')
      expect(babBadgeClass('Bab 4')).toBe('badge-bab4')
      expect(babBadgeClass('Bab 5')).toBe('badge-bab5')
      expect(babBadgeClass('Bab 1')).toBe('badge-bab12')
      expect(babBadgeClass('Bab 2')).toBe('badge-bab12')
    })
  })

  describe('rutinBadgeClass', () => {
    it('should return correct rutin badge classes', () => {
      expect(rutinBadgeClass('Ya (1 kali /Minggu)')).toBe('badge-rutin')
      expect(rutinBadgeClass('Ya (Tidak Rutin)')).toBe('badge-tidakrutin')
      expect(rutinBadgeClass('Tidak')).toBe('badge-tidak')
      expect(rutinBadgeClass('Unknown')).toBe('badge-tidak')
    })
  })

  describe('statusBadgeClass', () => {
    it('should return correct status badge classes', () => {
      expect(statusBadgeClass('Perancangan Sistem')).toBe('badge-design')
      expect(statusBadgeClass('Pengembangan Aplikasi')).toBe('badge-dev')
      expect(statusBadgeClass('Pengujian Fungsional')).toBe('badge-test')
      expect(statusBadgeClass('Selesai')).toBe('badge-selesai')
      expect(statusBadgeClass('')).toBe('badge-design')
      expect(statusBadgeClass('Unknown Status')).toBe('badge-design')
    })
  })
})

describe('String Utilities', () => {
  describe('truncate', () => {
    it('should truncate long strings', () => {
      const longString = 'A'.repeat(100)
      const result = truncate(longString, 10)
      expect(result).toBe('A'.repeat(10) + '…')
      expect(result.length).toBe(11)
    })

    it('should not truncate short strings', () => {
      const shortString = 'Hello World'
      const result = truncate(shortString, 20)
      expect(result).toBe(shortString)
    })

    it('should handle null/undefined', () => {
      expect(truncate('')).toBe('')
      expect(truncate(null as any)).toBe('')
      expect(truncate(undefined as any)).toBe('')
    })
  })
})

describe('Error Handling', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message')
      expect(getErrorMessage(error)).toBe('Test error message')
    })

    it('should return fallback for non-Error objects', () => {
      expect(getErrorMessage('string error')).toBe('Terjadi kesalahan')
      expect(getErrorMessage(null)).toBe('Terjadi kesalahan')
      expect(getErrorMessage({})).toBe('Terjadi kesalahan')
    })

    it('should use custom fallback', () => {
      expect(getErrorMessage('error', 'Custom fallback')).toBe('Custom fallback')
    })
  })
})

describe('Grade Calculation', () => {
  describe('getGrade', () => {
    it('should return correct grades for numeric scores', () => {
      expect(getGrade(85)).toBe('A')
      expect(getGrade('85')).toBe('A')
      expect(getGrade(80)).toBe('A')
      expect(getGrade(79)).toBe('B+')
      expect(getGrade(75)).toBe('B+')
      expect(getGrade(74)).toBe('B')
      expect(getGrade(70)).toBe('B')
      expect(getGrade(69)).toBe('C+')
      expect(getGrade(65)).toBe('C+')
      expect(getGrade(64)).toBe('C')
      expect(getGrade(60)).toBe('C')
      expect(getGrade(59)).toBe('D')
      expect(getGrade(50)).toBe('D')
      expect(getGrade(49)).toBe('E')
    })

    it('should handle invalid inputs', () => {
      expect(getGrade('invalid')).toBe('—')
      expect(getGrade(null as any)).toBe('—')
      expect(getGrade(undefined as any)).toBe('—')
    })
  })
})

// Mock Date for consistent testing
describe('Date Mocking', () => {
  it('should work with mocked date', () => {
    const mockDate = new Date('2024-01-15T10:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)

    expect(todayISO()).toBe('2024-01-15')
    expect(fmtDate('2024-01-15')).toBe('15 Jan 2024')

    vi.useRealTimers()
  })
})