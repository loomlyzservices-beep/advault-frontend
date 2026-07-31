import { API_BASE } from './config.js'

function getToken(){ return localStorage.getItem('advault_token') }
export function setToken(token){
  if(token) localStorage.setItem('advault_token', token)
  else localStorage.removeItem('advault_token')
}

// Admin uses a completely separate token/storage key from regular users —
// on purpose, so an admin session can never be restored as, mixed with, or
// mistaken for a logged-in user session (or vice versa).
function getAdminToken(){ return localStorage.getItem('advault_admin_token') }
export function setAdminToken(token){
  if(token) localStorage.setItem('advault_admin_token', token)
  else localStorage.removeItem('advault_admin_token')
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

// Separate from request() on purpose: always sends the admin token (never
// the user token), so admin calls can't accidentally ride on or leak into a
// regular user's session, and vice versa.
async function adminRequest(method, path, body){
  const headers = { 'Content-Type': 'application/json' }
  const token = getAdminToken()
  if(token) headers.Authorization = `Bearer ${token}`

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

  // admin auth — fully separate from user auth
  adminLogin: (payload) => request('POST', '/api/admin/login', payload),
  adminLogout: () => adminRequest('POST', '/api/admin/logout'),
  adminSession: () => adminRequest('GET', '/api/admin/session'),

  // admin
  admin: {
    overview: () => adminRequest('GET', '/api/admin/overview'),
    users: () => adminRequest('GET', '/api/admin/users'),
    pauseUser: (id) => adminRequest('POST', `/api/admin/users/${id}/pause`),
    unpauseUser: (id) => adminRequest('POST', `/api/admin/users/${id}/unpause`),
    forceLogout: (id) => adminRequest('POST', `/api/admin/users/${id}/force-logout`),
    deleteUser: (id) => adminRequest('DELETE', `/api/admin/users/${id}`),
    deleteAllUsers: () => adminRequest('DELETE', '/api/admin/users'),

    ads: () => adminRequest('GET', '/api/admin/ads'),
    createAd: (payload) => adminRequest('POST', '/api/admin/ads', payload),
    updateAd: (id, payload) => adminRequest('PUT', `/api/admin/ads/${id}`, payload),
    toggleAd: (id) => adminRequest('POST', `/api/admin/ads/${id}/toggle`),
    deleteAd: (id) => adminRequest('DELETE', `/api/admin/ads/${id}`),
    deleteAllAds: () => adminRequest('DELETE', '/api/admin/ads'),

    transactions: () => adminRequest('GET', '/api/admin/transactions'),
    deleteTransactions: () => adminRequest('DELETE', '/api/admin/transactions'),

    resetAnalytics: () => adminRequest('POST', '/api/admin/analytics/reset'),

    withdrawals: () => adminRequest('GET', '/api/admin/withdrawals'),
    deleteWithdrawal: (id) => adminRequest('DELETE', `/api/admin/withdrawals/${id}`),
    deleteAllWithdrawals: () => adminRequest('DELETE', '/api/admin/withdrawals'),

    saveTier: (level, payload) => adminRequest('PUT', `/api/admin/tiers/${level}`, payload),
    saveSettings: (payload) => adminRequest('PUT', '/api/admin/settings', payload),

    resetEverything: () => adminRequest('POST', '/api/admin/reset-everything'),
  },
}
