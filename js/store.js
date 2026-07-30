import { api, setToken } from './api.js'

// Plain mutable state object. No framework — UI code re-renders the bits
// it cares about after each mutation (see app.js / admin.js).
export const state = {
  user: null,            // logged-in account, or null if browsing as a guest
  guest: null,            // anonymous session (balance/progress before signup)
  tiers: [],
  settings: { defaultAdsAllowance: 5, adRewardMin: 8, adRewardMax: 16 },
  winners: [],
  currentAd: null,       // { mediaUrl, durationSeconds }
  currentNonce: null,
  watchingAd: false,
  adCountdown: 0,
  lastReward: null,
}

export function fmt(n){
  return 'GHS ' + Number(n || 0).toFixed(2)
}

// The identity actually earning right now — the logged-in account if there
// is one, otherwise the anonymous guest session. Used everywhere the UI
// needs a balance/allowance/progress number, regardless of login state.
export function identity(){
  return state.user || state.guest
}

export async function bootstrap(){
  const [tiersRes, settingsRes] = await Promise.all([api.tiers(), api.settings()])
  state.tiers = tiersRes.tiers
  state.settings = settingsRes.settings
  try{ const w = await api.winners(); state.winners = w.winners }catch(_){}

  const token = localStorage.getItem('advault_token')
  if(token){
    try{
      const me = await api.me()
      state.user = me.user
      return
    }catch(_){
      setToken(null)
      state.user = null
    }
  }
  // No logged-in session — load (or create) the anonymous guest session so
  // ad-watching progress/balance can be shown before signing up.
  try{
    const s = await api.session()
    state.guest = s.user
  }catch(_){}
}

export async function refreshMe(){
  if(state.user){
    try{
      const me = await api.me()
      state.user = me.user
    }catch(_){
      setToken(null)
      state.user = null
    }
  }else{
    try{
      const s = await api.session()
      state.guest = s.user
    }catch(_){}
  }
}

export async function login(username, password){
  const res = await api.login({ username, password })
  setToken(res.token)
  state.user = res.user
  state.guest = null
}

export async function signup(payload){
  const res = await api.signup(payload)
  setToken(res.token)
  state.user = res.user
  state.guest = null
}

export async function logout(){
  try{ await api.logout() }catch(_){}
  setToken(null)
  state.user = null
  try{ const s = await api.session(); state.guest = s.user }catch(_){}
}

export async function watchAd(){
  const res = await api.nextAd()
  state.currentAd = res.ad
  state.currentNonce = res.nonce
  state.watchingAd = true
  state.adCountdown = res.ad.durationSeconds
}

export async function finishAd(){
  const res = await api.completeAd(state.currentNonce)
  state.watchingAd = false
  state.currentAd = null
  state.currentNonce = null
  state.lastReward = res.reward
  if(state.user) state.user = res.user
  else state.guest = res.user
  return res.reward
}

export function adsAllowance(){
  const who = identity()
  return who ? who.adsAllowance : state.settings.defaultAdsAllowance
}
export function adsRemaining(){
  const who = identity()
  if(!who) return adsAllowance()
  return Math.max(0, adsAllowance() - who.ads_watched_today)
}
