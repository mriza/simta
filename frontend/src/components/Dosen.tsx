import { useState, useEffect } from 'react'
import type { Dosen as DosenType, Mahasiswa } from '../types'
import { api } from '../api'
import { getErrorMessage } from '../utils'

interface Props {
  dosen: DosenType[]
  mahasiswa: Mahasiswa[]
  onRefresh: () => void
}

const EMPTY: Omit<DosenType, 'id'> = { nidn: '', nama: '', bidang: '', email: '', hp: '', password: '', role: 'dosen' }

export default function Dosen({ dosen, mahasiswa, onRefresh }: Props) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<DosenType | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sortBy, setSortBy] = useState<keyof DosenType | 'nama'>('nama')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (editItem) setForm({ nidn: editItem.nidn, nama: editItem.nama, bidang: editItem.bidang, email: editItem.email, hp: editItem.hp, role: editItem.role, password: '' })
    else setForm({ ...EMPTY })
    setError('')
  }, [editItem, modalOpen])

  const filtered = dosen
    .filter(d => {
      const q = search.toLowerCase()
      return !q || d.nidn.toLowerCase().includes(q) || d.nama.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const fieldA = a[sortBy] || ''
      const fieldB = b[sortBy] || ''
      let comp = 0
      if (typeof fieldA === 'string' && typeof fieldB === 'string') comp = fieldA.localeCompare(fieldB)
      else if (typeof fieldA === 'number' && typeof fieldB === 'number') comp = fieldA - fieldB
      else comp = String(fieldA).localeCompare(String(fieldB))
      return sortOrder === 'asc' ? comp : -comp
    })

  function toggleSort(field: keyof DosenType) {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
  }

  const sortIcon = (field: keyof DosenType) => {
    if (sortBy !== field) return <span className="sort-icon">⇅</span>
    return sortOrder === 'asc' ? <span className="sort-icon">↑</span> : <span className="sort-icon">↓</span>
  }

  function set(key: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [key]: v }))
  }

  function openAdd() { setEditItem(null); setModalOpen(true) }
  function openEdit(d: DosenType) { setEditItem(d); setModalOpen(true) }

  async function handleDelete(d: DosenType) {
    const used = mahasiswa.filter(m => m.pembimbing1_id === d.id || m.pembimbing2_id === d.id).length
    if (used > 0) {
      setError(`Tidak bisa menghapus: ${d.nama} masih menjadi pembimbing untuk ${used} mahasiswa.`)
      return
    }
    if (!confirm(`Hapus dosen "${d.nama}"?`)) return
    await api.dosen.delete(d.id)
    onRefresh()
  }

  async function handleSave() {
    if (!form.nidn.trim() || !form.nama.trim()) { setError('NIDN dan Nama wajib diisi.'); return }
    setSaving(true)
    try {
      if (editItem) await api.dosen.update(editItem.id, form)
      else await api.dosen.create(form)
      setModalOpen(false)
      onRefresh()
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {error && !modalOpen && <div className="error-banner" onClick={() => setError('')}>{error}</div>}
      <div className="section-head">
        <div>
          <h2>Dosen Pembimbing</h2>
          <p>Daftar dosen pembimbing tugas akhir</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Tambah Dosen</button>
        </div>
      </div>

      <div className="dash-grid mb-24">
        <div className="stat-card">
          <div className="label">Total Dosen</div>
          <div className="value">{dosen.length}</div>
          <div className="sub">terdaftar di sistem</div>
        </div>
        <div className="stat-card blue">
          <div className="label">Beban Rata-rata</div>
          <div className="value">{dosen.length ? (mahasiswa.length / dosen.length).toFixed(1) : 0}</div>
          <div className="sub">mahasiswa/dosen</div>
        </div>
        <div className="stat-card gold">
          <div className="label">Kapasitas Tersedia</div>
          <div className="value">{dosen.length * 8 - mahasiswa.length}</div>
          <div className="sub">asumsi maks 8 mhs/dosen</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-controls">
          <input
            className="search-input"
            placeholder="Cari NIDN atau nama…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort('nidn')} className="cursor-pointer">NIDN {sortIcon('nidn')}</th>
                <th onClick={() => toggleSort('nama')} className="cursor-pointer">Nama {sortIcon('nama')}</th>
                <th onClick={() => toggleSort('bidang')} className="cursor-pointer">Bidang Keahlian {sortIcon('bidang')}</th>
                <th>Email</th>
                <th className="text-center">Bimbingan 1</th>
                <th className="text-center">Bimbingan 2</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty"><div className="empty-ico">ø</div>Tidak ada data</div></td></tr>
              ) : filtered.map(d => {
                const c1 = mahasiswa.filter(m => m.pembimbing1_id === d.id).length
                const c2 = mahasiswa.filter(m => m.pembimbing2_id === d.id).length
                return (
                  <tr key={d.id}>
                    <td className="nim-cell">{d.nidn}</td>
                    <td className="name-cell">{d.nama}</td>
                    <td>{d.bidang || '—'}</td>
                    <td className="nim-cell">{d.email || '—'}</td>
                    <td className="text-center text-fraunces fs-18">{c1}</td>
                    <td className="text-center text-fraunces fs-18">{c2}</td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => openEdit(d)}>Edit</button>
                        <button className="del" onClick={() => handleDelete(d)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="modal">
            <div className="modal-head">
              <h3>{editItem ? 'Edit Dosen' : 'Tambah Dosen'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {error && <div className="error-banner">{error}</div>}
              <div className="form-grid">
                <div className="field">
                  <label>NIDN</label>
                  <input value={form.nidn} onChange={e => set('nidn', e.target.value)} />
                </div>
                <div className="field">
                  <label>Nama Lengkap (dengan gelar)</label>
                  <input value={form.nama} onChange={e => set('nama', e.target.value)} />
                </div>
                <div className="field full">
                  <label>Bidang Keahlian</label>
                  <input value={form.bidang} onChange={e => set('bidang', e.target.value)} placeholder="misal: IoT, Computer Vision, Jaringan" />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div className="field">
                  <label>No. HP</label>
                  <input value={form.hp} onChange={e => set('hp', e.target.value)} />
                </div>
                 <div className="field">
                  <label>{editItem ? 'Password Baru (opsional)' : 'Password Awal'}</label>
                  <input type="password" value={form.password || ''} onChange={e => set('password', e.target.value)} />
                </div>
                <div className="field">
                  <label>Role</label>
                  <select value={form.role} onChange={e => set('role', e.target.value)}>
                    <option value="dosen">Dosen Pembimbing</option>
                    <option value="prodi">Koordinator Prodi (Admin)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
