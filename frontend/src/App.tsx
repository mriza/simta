import { useState, useEffect, useCallback } from 'react'
import type { Mahasiswa, Dosen, Bimbingan, DashboardStats, Tab, AppConfig, UserRole } from './types'
import { api } from './api'
import Dashboard from './components/Dashboard'
import MahasiswaTab from './components/Mahasiswa'
import DosenTab from './components/Dosen'
import BimbinganTab from './components/Bimbingan'
import ReportTab from './components/Report'
import SettingsTab from './components/Settings'
import SidangLetter from './components/SidangLetter'
import PublicVerification from './components/PublicVerification'
import PersiapanSidang from './components/PersiapanSidang'
import NilaiTab from './components/NilaiTab'
import TATitleLedger from './components/TATitleLedger'
import { getErrorMessage } from './utils'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa[]>([])
  const [dosen, setDosen] = useState<Dosen[]>([])
  const [role, setRole] = useState<UserRole>('umum')
  const [userId, setUserId] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [bimbingan, setBimbingan] = useState<Bimbingan[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidangLetterData, setSidangLetterData] = useState<{ mhs: Mahasiswa; token: string } | null>(null)
  const [verifyToken, setVerifyToken] = useState<string | null>(null)

  // URL parameter detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const vToken = params.get('verify')
    if (vToken) {
      setVerifyToken(vToken)
    }
  }, [])

  const handleLogin = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await api.login(loginId, loginPassword)
      api.setToken(res.token, res.role, res.user_id, res.name)
      setRole(res.role as UserRole)
      setUserId(res.user_id)
      setUserName(res.name)
      setIsLoggedIn(true)
      setShowLoginModal(false)
      setLoginId('')
      setLoginPassword('')
      // Reload data with new role
      loadData(res.role as UserRole, res.user_id)
    } catch (error) {
      setLoginError(getErrorMessage(error, 'Login gagal'))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    api.setToken('', 'umum', '', '')
    api.setSimInfo('umum', '')
    setRole('umum')
    setUserId('')
    setUserName('')
    setIsLoggedIn(false)
    setTab('dashboard')
    loadData('umum', '')
  }

  const loadData = useCallback(async (currentRole: UserRole, currentUserId: string) => {
    try {
      api.setSimInfo(currentRole, currentUserId)
      const [mhs, dsn, bmb, dash, conf] = await Promise.all([
        currentRole !== 'umum' ? api.mahasiswa.list() : Promise.resolve([] as Mahasiswa[]),
        currentRole !== 'umum' ? api.dosen.list() : Promise.resolve([] as Dosen[]),
        currentRole !== 'umum' ? api.bimbingan.list() : Promise.resolve([] as Bimbingan[]),
        api.dashboard(),
        api.config.get(),
      ])
      setMahasiswa(mhs)
      setDosen(dsn)
      setBimbingan(bmb)
      setStats(dash)
      setConfig(conf)
      setError('')
    } catch (error) {
      setError('Gagal menghubungi server: ' + getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load: try to restore session or act as guest
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken')
    const savedRole = localStorage.getItem('userRole')
    const savedId = localStorage.getItem('userId')
    const savedName = localStorage.getItem('userName')

    const roleOk = savedRole && savedRole !== 'undefined' && savedRole !== 'null'
    const idOk = savedId && savedId !== 'undefined' && savedId !== 'null'
    const nameOk = savedName && savedName !== 'undefined' && savedName !== 'null'

    if (savedToken && roleOk && idOk) {
      setRole(savedRole as UserRole)
      setUserId(savedId)
      setUserName(nameOk ? savedName : '')
      setIsLoggedIn(true)
      loadData(savedRole as UserRole, savedId)
    } else {
      api.setSimInfo('umum', '')
      loadData('umum', '')
    }
  }, [loadData])

  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const bab4 = mahasiswa.filter(m => m.bab === 'Bab 4' || m.bab === 'Bab 5').length

  // Role-based tab visibility
  const allTabs: { id: Tab; label: string; count?: number; minRole?: UserRole[] }[] = [
    { id: 'dashboard', label: 'Dasbor' },
    { id: 'persiapan_sidang', label: 'Persiapan Sidang', minRole: ['mhs'] },
    { id: 'nilai', label: 'Nilai', minRole: ['mhs'] },
    { id: 'mahasiswa', label: 'Mahasiswa', count: mahasiswa.length, minRole: ['prodi', 'dosen'] },
    { id: 'dosen', label: 'Dosen', count: dosen.length, minRole: ['prodi'] },
    { id: 'bimbingan', label: 'Log Bimbingan', minRole: ['dosen', 'mhs', 'prodi'] },
    { id: 'report', label: 'Statistik', minRole: ['prodi', 'dosen'] },
    { id: 'ta_titles', label: 'Buku Besar Judul TA', minRole: ['prodi', 'dosen'] },
    { id: 'settings', label: 'Pengaturan', minRole: ['prodi'] },
  ]

  const tabs = allTabs.filter(t => !t.minRole || t.minRole.includes(role))

  function switchTab(id: Tab) {
    setTab(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const roleLabel: Record<UserRole, string> = {
    prodi: 'Koordinator Prodi',
    dosen: 'Dosen',
    mhs: 'Mahasiswa',
    umum: 'Pengunjung',
  }

  if (verifyToken) {
    return <PublicVerification token={verifyToken} />
  }

  if (sidangLetterData) {
    return (
      <div className="sidang-letter-view">
        <div className="sidang-letter-controls no-print">
           <button className="btn" onClick={() => setSidangLetterData(null)}>Kembali</button>
           <button className="btn btn-primary" onClick={() => window.print()}>Cetak / Simpan PDF</button>
        </div>
        <SidangLetter mhs={sidangLetterData.mhs} config={config} token={sidangLetterData.token} />
      </div>
    )
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand-block cursor-pointer" onClick={() => switchTab('dashboard')}>
            {config?.inst_logo && (
              <img src="/api/logo" alt="Logo Institusi" className="brand-logo" />
            )}
            <div>
              <h1><span className="acronym">SIMTA</span> — Sistem Monitoring Tugas Akhir</h1>
              <div className="tagline">
                {config ? `${config.inst_name} · ${config.dept_name} · ${config.prog_name}` : 'Politeknik · Jurusan · Program Studi'}
                {config ? ` · T.A. ${config.academic_year}` : ''}
              </div>
            </div>
          </div>
          <div className="masthead-meta">
            <span className="volume">Ed. {config?.semester || 'Genap'} · {today}</span>
            {(role === 'prodi' || role === 'dosen') && (
              <span>{mahasiswa.length} Mahasiswa · {bab4} di Bab 4–5</span>
            )}
            <div className="auth-block">
              {isLoggedIn ? (
                <>
                  <span className="auth-user">
                    <span className="auth-role-badge">{roleLabel[role]}</span>
                    {userName && userName !== 'undefined' && <span className="auth-name">{userName}</span>}
                  </span>
                  <button className="btn btn-ghost" onClick={handleLogout}>Keluar</button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowLoginModal(true)}>
                  Masuk
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <div className="tabs-inner">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="count">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main>
        {error && <div className="error-banner">{error}</div>}
        {!isLoggedIn && tab !== 'dashboard' && tab !== 'project' && tab !== 'report' && (
          <div className="guest-notice">
            <span>Anda masuk sebagai pengunjung umum.</span>
            <button className="btn btn-primary" onClick={() => setShowLoginModal(true)}>Masuk</button>
          </div>
        )}
        {loading ? (
          <div className="loading">Memuat data…</div>
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard stats={stats} role={role} onTabChange={(t) => setTab(t as Tab)} onPrintSidang={(mhs, token) => setSidangLetterData({ mhs, token })} />}
            {tab === 'persiapan_sidang' && <PersiapanSidang me={mahasiswa[0] || null} onPrintSidang={(mhs, token) => setSidangLetterData({ mhs, token })} onRefresh={() => loadData(role, userId)} />}
            {tab === 'nilai' && <NilaiTab me={mahasiswa[0] || null} />}
            {tab === 'mahasiswa' && <MahasiswaTab mahasiswa={mahasiswa} dosen={dosen} bimbingan={bimbingan} onRefresh={() => loadData(role, userId)} role={role} userId={userId} onPrintSidang={(mhs, token) => setSidangLetterData({ mhs, token })} />}
            {tab === 'dosen' && <DosenTab dosen={dosen} mahasiswa={mahasiswa} onRefresh={() => loadData(role, userId)} />}
            {tab === 'bimbingan' && <BimbinganTab bimbingan={bimbingan} mahasiswa={mahasiswa} onRefresh={() => loadData(role, userId)} role={role} userId={userId} />}
            {tab === 'report' && <ReportTab mahasiswa={mahasiswa} dosen={dosen} role={role} onTabChange={(t) => setTab(t as Tab)} />}
            {tab === 'ta_titles' && <TATitleLedger role={role} />}
            {tab === 'settings' && <SettingsTab role={role} onRefresh={() => loadData(role, userId)} />}
          </>
        )}
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={e => e.stopPropagation()}>
            <div className="login-modal-header">
              <h2><span className="acronym">SIMTA</span></h2>
              <p>Sistem Monitoring Tugas Akhir</p>
            </div>
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="login-id">NIDN / NIM</label>
                <input
                  id="login-id"
                  type="text"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  placeholder="Masukkan NIDN atau NIM"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-pass">Password</label>
                <input
                  id="login-pass"
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  required
                />
              </div>
              {loginError && <div className="login-error">{loginError}</div>}
              <button type="submit" className="btn btn-primary login-submit" disabled={loginLoading}>
                {loginLoading ? 'Memproses…' : 'Masuk'}
              </button>
              <div className="login-hints">
                <span>Dosen: NIDN + password</span>
                <span>Mahasiswa: NIM + NIM</span>
                <span>Koordinator: sesuai konfigurasi server</span>
              </div>
            </form>
            <button className="login-guest-btn" onClick={() => setShowLoginModal(false)}>
              Lanjut sebagai Pengunjung
            </button>
          </div>
        </div>
      )}
    </>
  )
}
