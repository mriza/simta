import { useState, useEffect } from 'react'
import type { Mahasiswa, Dosen, UserRole } from '../types'
import { getErrorMessage } from '../utils'

interface Props {
  initial: Partial<Mahasiswa> | null
  dosen: Dosen[]
  role: UserRole
  onSave: (data: Omit<Mahasiswa, 'id' | 'nama_pembimbing1' | 'nama_pembimbing2'>) => Promise<void>
  onClose: () => void
}

const EMPTY: Omit<Mahasiswa, 'id' | 'nama_pembimbing1' | 'nama_pembimbing2'> = {
  nim: '', nama: '', hp: '', hp_ortu: '', alamat: '',
  pembimbing1_id: '', pembimbing2_id: '', fitur: '', jml_bimbingan1: 0, jml_bimbingan2: 0, terakhir: '',
  bab: 'Bab 1', rutin: 'Tidak', status_alat: 'Perancangan (Design)',
  kendala_skripsi: '', kendala_alat: '',
  semester_id: '', master_id: '', status_proses: 'Bimbingan',
  ijinkan_sidang: 0, status_sidang: 'Belum Sidang', tanggal_sidang: '', hasil_sidang: '',
  nilai_bimbingan: '', nilai_laporan: '', nilai_sidang: '', nilai_akhir: '',
  file_laporan_final: '',
  setuju_pembimbing1: 0, setuju_pembimbing2: 0
}

export default function MahasiswaModal({ initial, dosen, role, onSave, onClose }: Props) {
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isSelfService = role === 'mhs'

  useEffect(() => {
    setForm({ ...EMPTY, ...(initial || {}) })
    setError('')
  }, [initial])

  function set(key: keyof typeof form, value: string | number) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.nim.trim() || !form.nama.trim()) {
      setError('NIM dan Nama wajib diisi.')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function handleCalculate() {
    const nb = parseFloat(form.nilai_bimbingan) || 0
    const nl = parseFloat(form.nilai_laporan) || 0
    const ns = parseFloat(form.nilai_sidang) || 0
    
    // Formula: (Proses * 0.25) + (Laporan * 0.25) + (Sidang * 0.5)
    const total = (nb * 0.25) + (nl * 0.25) + (ns * 0.5)
    
    let grade = 'E'
    if (total >= 80) grade = 'A'
    else if (total >= 75) grade = 'AB'
    else if (total >= 70) grade = 'B'
    else if (total >= 65) grade = 'BC'
    else if (total >= 60) grade = 'C'
    else if (total >= 50) grade = 'D'
    
    set('nilai_akhir', grade)
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{initial?.id ? 'Edit Mahasiswa' : 'Tambah Mahasiswa'}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-banner">{error}</div>}
          <div className="form-grid">
            <div className="field">
              <label>NIM</label>
              <input value={form.nim} onChange={e => set('nim', e.target.value)} />
            </div>
            <div className="field">
              <label>Nama Lengkap</label>
              <input value={form.nama} onChange={e => set('nama', e.target.value)} />
            </div>
            <div className="field full">
              <label>Alamat Lengkap</label>
              <textarea rows={2} value={form.alamat} onChange={e => set('alamat', e.target.value)} />
            </div>
            <div className="field full">
              <label>Judul Proposal / Fitur Utama TA</label>
              <textarea value={form.fitur} onChange={e => set('fitur', e.target.value)} />
            </div>
            {!isSelfService && (
              <>
                <div className="field">
                  <label>Pembimbing 1</label>
                  <select value={form.pembimbing1_id} onChange={e => set('pembimbing1_id', e.target.value)}>
                    <option value="">— pilih —</option>
                    {dosen.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Pembimbing 2</label>
                  <select value={form.pembimbing2_id} onChange={e => set('pembimbing2_id', e.target.value)}>
                    <option value="">— pilih —</option>
                    {dosen.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}
                  </select>
                </div>
                
                <div className="field-section full">Sidang & Kelulusan</div>
                <div className="field">
                  <label>Status Sidang</label>
                  <select value={form.status_sidang} onChange={e => set('status_sidang', e.target.value)}>
                    <option value="Belum Sidang">Belum Sidang</option>
                    <option value="Terjadwal">Terjadwal</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
                <div className="field">
                  <label>Tanggal Sidang</label>
                  <input type="date" value={form.tanggal_sidang} onChange={e => set('tanggal_sidang', e.target.value)} />
                </div>
                <div className="field">
                  <label>Hasil Sidang</label>
                  <select value={form.hasil_sidang} onChange={e => set('hasil_sidang', e.target.value)}>
                    <option value="">— pilih —</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Mengulang">Mengulang</option>
                  </select>
                </div>
                <div className="field">
                  <label>Diizinkan Sidang</label>
                  <select value={form.ijinkan_sidang} onChange={e => set('ijinkan_sidang', parseInt(e.target.value))}>
                    <option value={0}>Tidak</option>
                    <option value={1}>Ya</option>
                  </select>
                </div>
                
                <div className="field-section full">Penilaian TA (Skala 0-100)</div>
                <div className="form-grid-4 full">
                  <div className="field">
                    <label>Nilai Proses (25%)</label>
                    <input type="number" min="0" max="100" value={form.nilai_bimbingan} onChange={e => set('nilai_bimbingan', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Nilai Laporan (25%)</label>
                    <input type="number" min="0" max="100" value={form.nilai_laporan} onChange={e => set('nilai_laporan', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Nilai Sidang (50%)</label>
                    <input type="number" min="0" max="100" value={form.nilai_sidang} onChange={e => set('nilai_sidang', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Nilai Akhir (Huruf)</label>
                    <div className="flex flex-gap-4">
                      <GradeSelect value={form.nilai_akhir} onChange={v => set('nilai_akhir', v)} />
                      <button className="btn btn-sm p-0-8" onClick={handleCalculate} title="Hitung dari komponen">∑</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
function GradeSelect({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
       <option value="">—</option>
       {['A', 'AB', 'B', 'BC', 'C', 'D', 'E'].map(g => <option key={g} value={g}>{g}</option>)}
    </select>
  )
}
