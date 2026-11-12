import type { ClockResponse, FloorResponse, PresenceStatus, UserSummary } from './contracts'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`)
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
}
