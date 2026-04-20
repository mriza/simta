import { useState, useEffect } from 'react'
import type { DashboardStats, Event, Bimbingan, UserRole, Mahasiswa } from '../types'
import { api } from '../api'
import { fmtDate } from '../utils'

interface Props {
  stats: DashboardStats | null
  role: UserRole
  onTabChange: (tab: string) => void
  onPrintSidang?: (mhs: Mahasiswa, token: string) => void
}

function getEventIcon(cat?: string) {
  switch (cat) {
    case 'sidang': return '🎤'
    case 'bimbingan': return '📝'
    case 'yudisium': return '🎓'
    case 'update': return '🔄'
    case 'proposal': return '📄'
    default: return '📁'
  }
}

export default function Dashboard({ stats, role, onTabChange }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [ajuanBimbingan, setAjuanBimbingan] = useState<Bimbingan[]>([])
  useEffect(() => {
    api.events.list().then(setEvents).catch(() => setEvents([]))
    if (role === 'dosen') {
      api.bimbingan.list().then(list => {
        setAjuanBimbingan(list.filter(b => b.status === 'Proposed'))
      })
    }
    if (role === 'mhs') {
      api.mahasiswa.list().then(() => {
        // ping only
      })
    }
  }, [role])


  if (!stats) return <div className="loading">Memuat dasbor…</div>

  const babOrder = ['Bab 1', 'Bab 2', 'Bab 3', 'Bab 4', 'Bab 5']
  const maxBab = Math.max(1, ...Object.values(stats.distribusi_bab))
  const statusEntries = Object.entries(stats.distribusi_status).sort((a, b) => b[1] - a[1])
  const maxStatus = Math.max(1, ...statusEntries.map(e => e[1]))
  const rutinOrder = ['Ya (1 kali /Minggu)', 'Ya (Tidak Rutin)', 'Tidak']
  const maxRutin = Math.max(1, ...rutinOrder.map(k => stats.distribusi_rutin[k] || 0))

  function barFillClass(k: string, type: 'bab' | 'status' | 'rutin'): string {
    if (type === 'bab') {
      if (k === 'Bab 4') return 'green'
      if (k === 'Bab 5') return 'blue'
      if (k === 'Bab 3') return 'gold'
      return ''
    }
    if (type === 'status') {
      if (k.startsWith('Pengujian')) return 'green'
      if (k.startsWith('Pengembangan')) return 'blue'
      return 'gold'
    }
    if (type === 'rutin') {
      if (k === 'Ya (1 kali /Minggu)') return 'green'
      if (k === 'Tidak') return 'danger'
      return ''
    }
    return ''
  }

  const totalMhs = stats.total_mahasiswa
  const pct = (n: number) => totalMhs ? Math.round(n / totalMhs * 100) : 0

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Dasbor Ringkasan</h2>
          <p>Pantauan agregat progres tugas akhir mahasiswa</p>
        </div>
        {role === 'mhs' && (
          <button className="btn btn-primary" onClick={() => onTabChange('bimbingan')}>
            🚀 Memulai Bimbingan TA
          </button>
        )}
      </div>
      

      {role === 'dosen' && ajuanBimbingan.length > 0 && (
        <div className="summary-card bg-orange border-orange mt-20 p-20 cursor-pointer hover-shadow" onClick={() => onTabChange('bimbingan')}>
          <h3 className="m-0 text-white">{ajuanBimbingan.length} Ajuan Bimbingan Baru</h3>
          <p className="fs-13 text-white mb-0 mt-4">Mahasiswa telah mengunggah berkas dan menunggu review Anda.</p>
          <button className="btn mt-12 bg-white text-orange fw-700">Lihat Semua</button>
        </div>
      )}

      <div className="dash-grid">
          <div className="stat-card">
            <div className="label">Total Mahasiswa</div>
            <div className="value">{stats.total_mahasiswa}</div>
            <div className="sub">peserta TA aktif</div>
          </div>
          <div className="stat-card green">
            <div className="label">Progres Bab 4–5</div>
            <div className="value">{stats.bab4_plus}</div>
            <div className="sub">{pct(stats.bab4_plus)}% dari total</div>
          </div>
          <div className="stat-card blue">
            <div className="label">Bimbingan Rutin</div>
            <div className="value">{stats.bimbingan_rutin}</div>
            <div className="sub">minimal 1×/minggu</div>
          </div>
          <div className="stat-card gold">
            <div className="label">Perlu Intervensi</div>
            <div className="value">{stats.perlu_intervensi}</div>
          </div>
        </div>

      <div className="dash-two-col">
          <div className="chart-block">
            <div className="block-title">Distribusi Progres Penulisan</div>
            <div className="block-sub">Per Bab · Snapshot Terkini</div>
            {babOrder.map(k => {
              const v = stats.distribusi_bab[k] || 0
              return (
                <div className="bar-row" key={k}>
                  <span>{k}</span>
                  <div className="bar-track">
                    <div className={`bar-fill ${barFillClass(k, 'bab')}`} style={{ width: `${(v / maxBab) * 100}%` }} />
                  </div>
                  <span className="bar-count">{v}</span>
                </div>
              )
            })}
          </div>
          <div className="chart-block">
            <div className="block-title">Status Pengembangan Aplikasi/Alat</div>
            <div className="block-sub">Tahapan Pengerjaan</div>
            {statusEntries.map(([k, v]) => (
              <div className="bar-row" key={k}>
                <span className="small-text">{k.length > 28 ? k.slice(0, 28) + '…' : k}</span>
                <div className="bar-track">
                  <div className={`bar-fill ${barFillClass(k, 'status')}`} style={{ width: `${(v / maxStatus) * 100}%` }} />
                </div>
                <span className="bar-count">{v}</span>
              </div>
            ))}
          </div>
        </div>

      <div className="spacer" />

      {(role === 'prodi' || role === 'dosen') && (
        <div className="dash-two-col">
          <div className="list-block">
            <div className="block-title">Perlu Perhatian</div>
            <div className="block-sub">Mahasiswa dengan indikator risiko</div>
            {stats.alerts.length === 0 ? (
              <div className="empty p-20-0">
                <em className="fs-italic">Tidak ada mahasiswa dengan indikator risiko.</em>
              </div>
            ) : (
              <>
                {stats.alerts.slice(0, 8).map((a, i) => (
                  <div className="alert-item" key={i}>
                    <div className={`alert-dot${a.level === 'warn' ? ' warn' : ''}`} />
                    <div className="alert-info">
                      <strong>{a.nama}</strong>
                      <span>{a.reason}</span>
                    </div>
                  </div>
                ))}
                {stats.alerts.length > 8 && (
                  <div className="fs-11 text-ink-3 font-mono py-10">
                    + {stats.alerts.length - 8} lainnya…
                  </div>
                )}
              </>
            )}
          </div>
          <div className="chart-block">
            <div className="block-title">Rutinitas Bimbingan</div>
            <div className="block-sub">Tingkat keteraturan pertemuan</div>
            {rutinOrder.map(k => {
              const v = stats.distribusi_rutin[k] || 0
              return (
                <div className="bar-row" key={k}>
                  <span className="small-text">{k}</span>
                  <div className="bar-track">
                    <div className={`bar-fill ${barFillClass(k, 'rutin')}`} style={{ width: `${(v / maxRutin) * 100}%` }} />
                  </div>
                  <span className="bar-count">{v}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="spacer" />

      <div className="dash-two-col">
        <div className="chart-block">
          <div className="block-title">Kalender Akademik</div>
          <div className="block-sub">Rencana kegiatan penting semester ini</div>
          <div className="timeline">
            {events.length === 0 ? (
              <div className="empty p-20-0">Tidak ada kegiatan terdekat.</div>
            ) : events.map(ev => (
              <div className="timeline-item" key={ev.id}>
                <div className="timeline-icon-box">
                  {getEventIcon(ev.category)}
                  <div className={`timeline-indicator ${ev.type}`} />
                </div>
                <div className="timeline-content">
                  <div className="timeline-title">{ev.title}</div>
                  <div className="timeline-date">
                    {fmtDate(ev.start_date)} {ev.end_date ? `— ${fmtDate(ev.end_date)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="list-block list-block-transparent">
           <div className="p-40 text-center text-ink-3">
             <p className="text-fraunces fs-18"><em className="fs-italic">Ruang Iklan / Informasi<br/> Tambahan Mendatang</em></p>
           </div>
        </div>
      </div>

    </>
  )
}

