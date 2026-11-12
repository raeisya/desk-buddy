import type {
  AvatarConfig,
  AdminUser,
  AdminUserPatch,
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
  /** Save your character look (null = back to the default). */
  setAvatar: (userId: string, avatar: AvatarConfig | null) =>
    request<{ avatar: AvatarConfig | null }>(`/users/${encodeURIComponent(userId)}/avatar`, {
      method: 'PUT',
      body: JSON.stringify(avatar ?? { reset: true }),
    }),
  /** Your own status today (Me page only: the reason is private). */
  getMyPresence: (userId: string) => request<{ status: PresenceStatus | null }>(`/presence/${encodeURIComponent(userId)}`),
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
  // Admin page + permanent seats (C). actorId = signed-in persona until real sessions exist.
  getAdminUsers: (actorId: string) => request<AdminUser[]>(`/admin/users?actorId=${encodeURIComponent(actorId)}`),
  updateUser: (actorId: string, userId: string, patch: AdminUserPatch) =>
    request<AdminUser>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify({ actorId, ...patch }) }),
  setDeskOwner: (actorId: string, deskId: string, userId: string | null) =>
    request(`/desks/${encodeURIComponent(deskId)}/owner`, { method: 'PUT', body: JSON.stringify({ actorId, userId }) }),
  // Slack status sync (C): has this person connected Slack so their status mirrors to it?
  getSlackStatusLink: (userId: string) =>
    request<{ available: boolean; connected: boolean }>(`/slack/status-link?userId=${encodeURIComponent(userId)}`),
  moveMyDesk: (userId: string, deskId: string) =>
    request<{ from: string; to: string }>(`/desks/${encodeURIComponent(deskId)}/move`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
}
