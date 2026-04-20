import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { TATitleSearchResponse, UserRole } from '../types'
import { fmtDate, getErrorMessage } from '../utils'

interface Props {
  role: UserRole
}

function getMatchLevelColor(level?: string) {
  switch (level) {
    case 'mirip_tinggi': return 'badge-danger'
    case 'perlu_review': return 'badge-warn'
    case 'aman': return 'badge-success'
    default: return 'badge-neutral'
  }
}

function getMatchLevelText(level?: string) {
  switch (level) {
    case 'mirip_tinggi': return 'Mirip Tinggi'
    case 'perlu_review': return 'Perlu Review'
    case 'aman': return 'Aman'
    default: return '-'
  }
}

export default function TATitleLedger({}: Props) {
  const [data, setData] = useState<TATitleSearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1) // Reset to first page on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: { q?: string; page: number; page_size: number } = {
        page,
        page_size: pageSize,
      }
      if (debouncedQuery.trim()) {
        params.q = debouncedQuery.trim()
      }
      const result = await api.taTitles.search(params)
      setData(result)
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalPages = data ? Math.ceil(data.meta.total / data.meta.page_size) : 0

  if (loading && !data) return <div className="loading">Memuat daftar judul TA…</div>

  return (
    <div className="ta-title-ledger">
      <div className="section-head">
        <div>
          <h2>Buku Besar Judul TA</h2>
          <p>Cari dan kelola judul Tugas Akhir yang telah diajukan</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="search-section">
        <div className="search-input-group">
          <input
            type="search"
            placeholder="Cari judul TA atau cek kemiripan judul usulan..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
          />
          {loading && <div className="search-loading">Mencari...</div>}
        </div>
        {data?.meta.query && (
          <div className="search-info">
            Menampilkan {data.data.length} dari {data.meta.total} hasil untuk "{data.meta.query}"
          </div>
        )}
        {!data?.meta.query && data && (
          <div className="search-info">
            Menampilkan {data.data.length} dari {data.meta.total} judul TA
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Judul TA</th>
              <th>Mahasiswa</th>
              <th>NIM</th>
              <th>Status</th>
              <th>Diajukan</th>
              {data?.meta.query && <th>Relevansi</th>}
            </tr>
          </thead>
          <tbody>
            {data?.data.map(title => (
              <tr key={title.id}>
                <td>
                  <div className="title-cell">
                    {title.title}
                  </div>
                </td>
                <td>{title.student_name}</td>
                <td><span className="nim-cell">{title.student_nim}</span></td>
                <td>
                  <span className={`status-badge ${title.status === 'Lulus' ? 'badge-success' : 'badge-neutral'}`}>
                    {title.status}
                  </span>
                </td>
                <td><span className="date-cell">{fmtDate(title.submitted_at)}</span></td>
                {data.meta.query && (
                  <td>
                    <div className="relevance-cell">
                      <span className={`badge ${getMatchLevelColor(title.match_level)}`}>
                        {getMatchLevelText(title.match_level)}
                      </span>
                      {title.relevance_score !== undefined && (
                        <span className="score-text">
                          {(title.relevance_score * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            ‹ Sebelumnya
          </button>
          <span className="page-info">
            Halaman {page} dari {totalPages}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Selanjutnya ›
          </button>
        </div>
      )}

      {data && data.data.length === 0 && !loading && (
        <div className="empty-state">
          {data.meta.query
            ? `Tidak ada judul TA yang cocok dengan "${data.meta.query}"`
            : 'Belum ada judul TA yang diajukan'
          }
        </div>
      )}
    </div>
  )
}