import { API_BASE } from './config.js'

function getToken(){ return localStorage.getItem('advault_token') }
export function setToken(token){
  if(token) localStorage.setItem('advault_token', token)
  else localStorage.removeItem('advault_token')
}

// Anonymous browser id so people can watch ads and earn before creating an
// account. Sent as a header on every request; the backend only uses it when
// there's no logged-in session.
function getGuestId(){
  let id = localStorage.getItem('advault_guest_id')
  if(!id){
    id = 'guest_' + crypto.randomUUID()
    localStorage.setItem('advault_guest_id', id)
  }
  return id
}

async function request(method, path, body){
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if(token) headers.Authorization = `Bearer ${token}`
  else headers['X-Guest-Id'] = getGuestId()

  let res
  try{
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }catch(err){
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  let data = null
  try{ data = await res.json() }catch(_){ /* empty body is fine */ }

  if(!res.ok){
    throw new Error((data && data.error) || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  // auth
  signup: (payload) => request('POST', '/api/auth/signup', payload),
  login: (payload) => request('POST', '/api/auth/login', payload),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/me'),
  session: () => request('GET', '/api/session'),

  // public
  tiers: () => request('GET', '/api/tiers'),
  settings: () => request('GET', '/api/settings'),
  winners: () => request('GET', '/api/winners'),

  // ads
  nextAd: () => request('GET', '/api/ads/next'),
  completeAd: (nonce) => request('POST', '/api/ads/complete', { nonce }),

  // tiers & withdraw
  purchaseTier: (level, reference) => request('POST', '/api/tiers/purchase', { level, reference }),
  withdraw: (phone, network) => request('POST', '/api/withdraw', { phone, network }),

  // admin
  admin: {
    overview: () => request('GET', '/api/admin/overview'),
    users: () => request('GET', '/api/admin/users'),
    pauseUser: (id) => request('POST', `/api/admin/users/${id}/pause`),
    unpauseUser: (id) => request('POST', `/api/admin/users/${id}/unpause`),
    forceLogout: (id) => request('POST', `/api/admin/users/${id}/force-logout`),
    deleteUser: (id) => request('DELETE', `/api/admin/users/${id}`),
    deleteAllUsers: () => request('DELETE', '/api/admin/users'),

    ads: () => request('GET', '/api/admin/ads'),
    createAd: (payload) => request('POST', '/api/admin/ads', payload),
    updateAd: (id, payload) => request('PUT', `/api/admin/ads/${id}`, payload),
    toggleAd: (id) => request('POST', `/api/admin/ads/${id}/toggle`),
    deleteAd: (id) => request('DELETE', `/api/admin/ads/${id}`),
    deleteAllAds: () => request('DELETE', '/api/admin/ads'),

    transactions: () => request('GET', '/api/admin/transactions'),
    deleteTransactions: () => request('DELETE', '/api/admin/transactions'),

    resetAnalytics: () => request('POST', '/api/admin/analytics/reset'),

    withdrawals: () => request('GET', '/api/admin/withdrawals'),
    deleteWithdrawal: (id) => request('DELETE', `/api/admin/withdrawals/${id}`),
    deleteAllWithdrawals: () => request('DELETE', '/api/admin/withdrawals'),

    saveTier: (level, payload) => request('PUT', `/api/admin/tiers/${level}`, payload),
    saveSettings: (payload) => request('PUT', '/api/admin/settings', payload),

    resetEverything: () => request('POST', '/api/admin/reset-everything'),
  },
}
