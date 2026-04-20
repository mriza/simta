export function fmtDate(s: string): string {
  if (!s) return '—'
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return s }
}

export function daysSince(s: string): number | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export function babProgress(b: string): number {
  const map: Record<string, number> = { 'Bab 1': 20, 'Bab 2': 40, 'Bab 3': 60, 'Bab 4': 80, 'Bab 5': 95 }
  return map[b] || 0
}

export function babBadgeClass(b: string): string {
  if (b === 'Bab 3') return 'badge-bab3'
  if (b === 'Bab 4') return 'badge-bab4'
  if (b === 'Bab 5') return 'badge-bab5'
  return 'badge-bab12'
}

export function rutinBadgeClass(r: string): string {
  if (r === 'Ya (1 kali /Minggu)') return 'badge-rutin'
  if (r === 'Ya (Tidak Rutin)') return 'badge-tidakrutin'
  return 'badge-tidak'
}

export function statusBadgeClass(s: string): string {
  if (!s) return 'badge-design'
  if (s.startsWith('Perancangan')) return 'badge-design'
  if (s.startsWith('Pengembangan')) return 'badge-dev'
  if (s.startsWith('Pengujian')) return 'badge-test'
  if (s.startsWith('Selesai')) return 'badge-selesai'
  return 'badge-design'
}

export function truncate(s: string, n = 80): string {
  s = s || ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan'): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function getGrade(scoreStr: string | number): string {
  const score = typeof scoreStr === 'string' ? parseFloat(scoreStr) : scoreStr
  if (isNaN(score) || score == null) return '—'
  if (score >= 80) return 'A'
  if (score >= 75) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 65) return 'C+'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'E'
}
