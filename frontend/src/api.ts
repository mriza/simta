import type { Dosen, Mahasiswa, Bimbingan, DashboardStats, AppConfig, Event, Semester, Berkas, TATitleSearchResponse } from './types'

const BASE = import.meta.env.VITE_API_BASE || '/api'

let currentToken = localStorage.getItem('authToken') || ''

function buildHeaders(body?: unknown): Record<string, string> {
  const headers: Record<string, string> = {}
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`
  }
  if (body != null && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = buildHeaders(body)
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

function parseFilename(res: Response, fallbackName: string): string {
  const header = res.headers.get('Content-Disposition')
  if (!header) return fallbackName

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const plainMatch = header.match(/filename="?([^"]+)"?/i)
  return plainMatch?.[1] || fallbackName
}

async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(BASE + path, {
    headers: buildHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }

  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = parseFilename(res, fallbackName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

async function fetchBlobURL(path: string): Promise<string> {
  const res = await fetch(BASE + path, {
    headers: buildHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  const blob = await res.blob()
  return window.URL.createObjectURL(blob)
}

export const api = {
  setSimInfo: (...args: [string, string]) => {
    void args
    // Role/user tracking is no longer sent to the API without a bearer token.
  },
  setToken: (token: string, role: string, userId: string, name: string) => {
    currentToken = token
    localStorage.setItem('authToken', token)
    localStorage.setItem('userRole', (role && role !== 'undefined' && role !== 'null') ? role : 'umum')
    localStorage.setItem('userId', (userId && userId !== 'undefined' && userId !== 'null') ? userId : '')
    localStorage.setItem('userName', (name && name !== 'undefined' && name !== 'null') ? name : '')
  },
  logout: () => {
    currentToken = ''
    localStorage.removeItem('authToken')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userId')
    localStorage.removeItem('userName')
  },
  login: (nidn: string, password: string) => req<{ token: string; role: string; user_id: string; name: string }>('POST', '/login', { nidn, password }),
  dosen: {
    list: () => req<Dosen[]>('GET', '/dosen'),
    create: (d: Omit<Dosen, 'id'>) => req<Dosen>('POST', '/dosen', d),
    update: (id: string, d: Omit<Dosen, 'id'>) => req<Dosen>('PUT', `/dosen/${id}`, d),
    delete: (id: string) => req<{ ok: boolean }>('DELETE', `/dosen/${id}`),
  },
  mahasiswa: {
    list: () => req<Mahasiswa[]>('GET', '/mahasiswa'),
    create: (m: Omit<Mahasiswa, 'id' | 'nama_pembimbing1' | 'nama_pembimbing2'>) => req<Mahasiswa>('POST', '/mahasiswa', m),
    update: (id: string, m: Omit<Mahasiswa, 'id' | 'nama_pembimbing1' | 'nama_pembimbing2'>) => req<Mahasiswa>('PUT', `/mahasiswa/${id}`, m),
    delete: (id: string) => req<{ ok: boolean }>('DELETE', `/mahasiswa/${id}`),
    updateBatchStatus: (ids: string[], status: string) => req<{ ok: boolean }>('POST', '/mahasiswa/batch-status', { ids, status }),
    permitSidang: (id: string, permit: number) => req<{ ok: boolean }>('PUT', `/mahasiswa/${id}/permit-sidang`, { permit }),
    uploadFinal: async (formData: FormData) => {
      const res = await fetch(BASE + '/mahasiswa/upload-final', {
        method: 'POST',
        headers: buildHeaders(),
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    getSidangToken: () => req<{ id: string; mhs_id: string; token: string; created_at: string }>('GET', '/mahasiswa/sidang-token'),
    verifySidangToken: (token: string) => req<{ mahasiswa: Mahasiswa; config: AppConfig; token: string }>('GET', `/public/verify-sidang/${token}`),
  },
  bimbingan: {
    list: () => req<Bimbingan[]>('GET', '/bimbingan'),
    create: (b: Omit<Bimbingan, 'id' | 'status' | 'offline_status' | 'nama_mhs' | 'nim_mhs' | 'nama_dosen'>) => req<Bimbingan>('POST', '/bimbingan', b),
    update: (id: string, b: Omit<Bimbingan, 'id' | 'status' | 'offline_status' | 'nama_mhs' | 'nim_mhs' | 'nama_dosen'>) => req<Bimbingan>('PUT', `/bimbingan/${id}`, b),
    submit: (id: string) => req<{ ok: boolean }>('POST', `/bimbingan/${id}/submit`),
    accept: (id: string) => req<{ ok: boolean }>('POST', `/bimbingan/${id}/accept`),
    complete: (id: string) => req<{ ok: boolean }>('POST', `/bimbingan/${id}/complete`),
    scheduleOffline: (id: string, date: string, place: string) => req<{ ok: boolean }>('POST', `/bimbingan/${id}/offline`, { date, place }),
    updateOfflineStatus: (id: string, status: string) => req<{ ok: boolean }>('PUT', `/bimbingan/${id}/offline-status`, { status }),
    reopen: (id: string) => req<{ ok: boolean }>('POST', `/bimbingan/${id}/reopen`),
    delete: (id: string) => req<{ ok: boolean }>('DELETE', `/bimbingan/${id}`),
  },
  system: {
    resetSemester: () => req<{ ok: boolean }>('POST', '/reset-semester'),
  },
  semesters: {
    list: () => req<Semester[]>('GET', '/semesters'),
    start: (s: Omit<Semester, 'id' | 'status'> & { student_ids?: string[] }) => req<Semester>('POST', '/semesters/start', s),
    close: (id: string) => req<{ ok: boolean }>('POST', `/semesters/${id}/close`),
  },
  berkas: {
    list: () => req<Berkas[]>('GET', '/berkas'),
    upload: async (formData: FormData) => {
      const res = await fetch(BASE + '/berkas', {
        method: 'POST',
        headers: buildHeaders(),
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || res.statusText)
      }
      return res.json()
    },
    download: (id: string) => downloadFile(`/berkas/${id}`, `berkas-${id}`),
    viewBlobUrl: (id: string) => fetchBlobURL(`/berkas/${id}/view`),
    viewUrl: (id: string) => `${BASE}/berkas/${id}/view`,
    giveFeedback: (id: string, feedback: string) => req<{ ok: boolean }>('PUT', `/berkas/${id}/feedback`, { feedback }),
  },
  dashboard: () => req<DashboardStats>('GET', '/dashboard'),
  exportCSV: (type: 'mahasiswa' | 'project') => downloadFile(`/export/csv?type=${type}`, `${type}.csv`),
  config: {
    get: () => req<AppConfig>('GET', '/config'),
    update: (data: AppConfig) => req<AppConfig>('PUT', '/config', data),
    uploadLogo: async (formData: FormData) => {
      const res = await fetch(BASE + '/config/logo', {
        method: 'POST',
        headers: buildHeaders(),
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    }
  },
  events: {
    list: () => req<Event[]>('GET', '/events'),
    create: (data: Omit<Event, 'id'>) => req<Event>('POST', '/events', data),
    update: (id: string, data: Partial<Event>) => req<Event>('PUT', `/events/${id}`, data),
    delete: (id: string) => req<{ ok: boolean }>('DELETE', `/events/${id}`),
  },
  taTitles: {
    search: (params: { q?: string; page?: number; page_size?: number }) => {
      const searchParams = new URLSearchParams()
      if (params.q) searchParams.set('q', params.q)
      if (params.page) searchParams.set('page', params.page.toString())
      if (params.page_size) searchParams.set('page_size', params.page_size.toString())
      const query = searchParams.toString()
      return req<TATitleSearchResponse>('GET', '/ta-titles' + (query ? '?' + query : ''))
    },
  },
}
