import type {
  ClockResponse,
  FloorResponse,
  HodHeatmapResponse,
  HodTodayResponse,
  PresenceStatus,
  UserSummary,
} from './contracts'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    // Nest errors are { message, ... }: surface the human message ("Someone just took that desk…").
    const text = await res.text()
    let message = `${init?.method ?? 'GET'} ${path} failed: ${res.status}`
    try {
      const body = JSON.parse(text) as { message?: string | string[] }
      if (body.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message
    } catch {
      if (text) message += ` ${text}`
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export const api = {
  getFloor: (date?: string) => request<FloorResponse>(`/floor${date ? `?date=${date}` : ''}`),
  getUsers: () => request<UserSummary[]>('/users'),
  setPresence: (userId: string, status: PresenceStatus, date?: string) =>
    request('/presence', { method: 'POST', body: JSON.stringify({ userId, status, date }) }),
  getClock: () => request<ClockResponse>('/clock'),
  setClock: (now: string) => request<ClockResponse>('/clock', { method: 'PUT', body: JSON.stringify({ now }) }),
  resetClock: () => request<ClockResponse>('/clock', { method: 'DELETE' }),
  // userId comes from the persona for now; once cookie login lands the API takes it from the session.
  claimDesk: (deskId: string, userId: string) =>
    request('/bookings', { method: 'POST', body: JSON.stringify({ deskId, userId }) }),
  releaseDesk: (deskId: string, userId: string) =>
    request('/bookings/release', { method: 'POST', body: JSON.stringify({ deskId, userId }) }),
  // HOD dashboard (A's #9). Per-team counts may include reasons; the floor never does.
  getHodToday: () => request<HodTodayResponse>('/hod/today'),
  getHodHeatmap: () => request<HodHeatmapResponse>('/hod/heatmap'),
}
