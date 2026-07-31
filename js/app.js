import { state, fmt, identity, bootstrap, refreshMe, login, signup, logout, watchAd, finishAd, adsAllowance, adsRemaining } from './store.js'
import { api, setAdminToken } from './api.js'
import { initialsFor, gradientFor } from './avatar.js'
import { detectMediaType, toEmbedUrl } from './embed.js'
import { loadPaystack, payWithPaystack, newReference } from './paystack.js'
import { openAdminPanel } from './admin.js'

// Whether this browser currently holds a valid-looking admin session token.
// Deliberately independent of state.user — admin is never a "logged in user".
function hasAdminToken(){
  return !!localStorage.getItem('advault_admin_token')
}

function displayName(user){
  return user ? user.username : ''
}

// ---------------------------------------------------------------------------
// Toast + Confirm (replace window.alert / window.confirm everywhere)
// ---------------------------------------------------------------------------
let toastTimer = null
export function toast(msg){
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200)
}

let confirmResolver = null
export function askConfirm(message){
  return new Promise((resolve) => {
    document.getElementById('confirmMessage').textContent = message
    document.getElementById('confirmModal').classList.remove('hidden')
    lockScroll(true)
    confirmResolver = resolve
  })
}
document.getElementById('confirmOkBtn').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.add('hidden')
  lockScroll(false)
  if(confirmResolver) confirmResolver(true)
})
document.getElementById('confirmCancelBtn').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.add('hidden')
  lockScroll(false)
  if(confirmResolver) confirmResolver(false)
})

let scrollLockCount = 0
function lockScroll(locked){
  scrollLockCount += locked ? 1 : -1
  document.body.style.overflow = scrollLockCount > 0 ? 'hidden' : ''
}
window.__advaultLockScroll = lockScroll // used by admin.js too

document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target)
    const showing = input.type === 'text'
    input.type = showing ? 'password' : 'text'
    btn.textContent = showing ? 'Show' : 'Hide'
  })
})

// ---------------------------------------------------------------------------
// Nav / scroll
// ---------------------------------------------------------------------------
document.querySelectorAll('[data-scroll]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.scroll
    if(id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' })
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  })
})

document.getElementById('logoTrigger').addEventListener('click', async (e) => {
  e.preventDefault()
  if(hasAdminToken()){
    try{
      await api.adminSession() // confirm the token is still valid, not just present
      openAdminPanel()
      return
    }catch(_){
      setAdminToken(null) // stale/expired — fall through to login
    }
  }
  openModal('adminLoginModal')
})

function renderNavAuth(){
  const area = document.getElementById('navAuthArea')
  area.innerHTML = ''
  if(!state.user){
    const btn = document.createElement('button')
    btn.className = 'nav-cta'
    btn.textContent = 'Login'
    btn.addEventListener('click', () => openModal('loginModal', 'login'))
    area.appendChild(btn)
    return
  }
  const wrap = document.createElement('div')
  wrap.style.position = 'relative'
  const [c1, c2] = gradientFor(state.user.username)
  wrap.innerHTML = `
    <button class="user-chip" id="userChipBtn">
      <span class="user-avatar" style="background:linear-gradient(135deg,${c1},${c2});">${initialsFor(displayName(state.user))}</span>
      <span class="uname">${escapeHtml(displayName(state.user))}</span>
    </button>
    <div class="user-menu hidden" id="userMenu">
      <button id="userMenuDashboard">Dashboard</button>
      <button id="userMenuLogout" style="color:#f87171;">Log out</button>
    </div>
  `
  area.appendChild(wrap)
  const menu = wrap.querySelector('#userMenu')
  wrap.querySelector('#userChipBtn').addEventListener('click', (e) => {
    e.stopPropagation()
    menu.classList.toggle('hidden')
  })
  document.addEventListener('click', () => menu.classList.add('hidden'), { once: true })
  wrap.querySelector('#userMenuDashboard').addEventListener('click', () => {
    menu.classList.add('hidden')
    document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' })
  })
  wrap.querySelector('#userMenuLogout').addEventListener('click', async () => {
    menu.classList.add('hidden')
    await logout()
    renderAll()
    toast('Logged out.')
  })
}

function escapeHtml(s){
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function renderHero(){
  const cta = document.getElementById('heroCta')
  const copy = document.getElementById('heroCopy')
  const visual = document.getElementById('heroVisual')
  if(state.user){
    cta.textContent = 'Watch ads now'
    cta.onclick = () => document.getElementById('ads').scrollIntoView({ behavior: 'smooth' })
    copy.textContent = `Welcome back, ${displayName(state.user)}. Your balance is ${fmt(state.user.balance)}.`
    visual.innerHTML = `<div class="nova-core"></div>`
  }else{
    cta.textContent = 'Watch ads now'
    cta.onclick = () => document.getElementById('ads').scrollIntoView({ behavior: 'smooth' })
    if(state.guest && state.guest.balance > 0){
      copy.textContent = `You're browsing as a guest — you've earned ${fmt(state.guest.balance)} so far. Sign up to unlock tiers and withdraw it.`
    }else{
      copy.textContent = 'Watch a short ad right now, no account needed. Sign up once you\'re ready to buy a tier or withdraw your balance to mobile money.'
    }
    visual.innerHTML = `<div class="nova-core"></div>`
  }
  document.getElementById('describeWatch').textContent =
    `Watch short ads and earn ${fmt(state.settings.adRewardMin)} to ${fmt(state.settings.adRewardMax)} per ad, credited instantly — no account needed to start.`
  const tierPrices = state.tiers.map(t => t.price)
  const lo = tierPrices.length ? Math.min(...tierPrices) : 65
  const hi = tierPrices.length ? Math.max(...tierPrices) : 250
  document.getElementById('describeTier').textContent =
    `Buy a tier from ${fmt(lo)} to ${fmt(hi)} to raise your daily ad limit and unlock withdrawals.`
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function renderDashboard(){
  const sub = document.getElementById('dashboardSub')
  const grid = document.getElementById('dashboardStats')
  const who = identity()
  if(!who){
    sub.textContent = 'Loading your session…'
    grid.innerHTML = ''
    return
  }
  sub.textContent = state.user
    ? `Watch up to ${adsAllowance()} short ads per session. Each one pays out a random amount between ${fmt(state.settings.adRewardMin)} and ${fmt(state.settings.adRewardMax)}.`
    : `You're browsing as a guest. Watch up to ${adsAllowance()} short ads before signing up — each pays between ${fmt(state.settings.adRewardMin)} and ${fmt(state.settings.adRewardMax)}.`
  grid.innerHTML = `
    <div class="stat-card"><div class="num">${fmt(who.balance)}</div><div class="lbl">Balance</div></div>
    <div class="stat-card"><div class="num">${who.tier ? 'Tier ' + who.tier : 'None'}</div><div class="lbl">Current tier</div></div>
    <div class="stat-card"><div class="num">${who.ads_watched_today}/${adsAllowance()}</div><div class="lbl">Ads watched today</div></div>
    <div class="stat-card"><div class="num">${fmt(who.total_paid_out)}</div><div class="lbl">Total earned</div></div>
  `
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------
function renderAdsSection(){
  document.getElementById('adsSub').textContent =
    `Watch up to ${adsAllowance()} short ads per session — no account needed. Each one pays out a random amount between ${fmt(state.settings.adRewardMin)} and ${fmt(state.settings.adRewardMax)}.`

  const dots = document.getElementById('progressDots')
  dots.innerHTML = ''
  const total = adsAllowance()
  const who = identity()
  const done = who ? who.ads_watched_today : 0
  for(let i = 0; i < total; i++){
    const d = document.createElement('div')
    d.className = 'pdot' + (i < done ? ' done' : '')
    dots.appendChild(d)
  }

  const list = document.getElementById('adStatsList')
  list.innerHTML = `
    <div class="ad-list-item"><span>Ads watched today</span><strong>${done}/${total}</strong></div>
    <div class="ad-list-item"><span>Ads remaining</span><strong>${adsRemaining()}</strong></div>
    <div class="ad-list-item"><span>Total ads watched</span><strong>${who ? who.total_ads_watched : 0}</strong></div>
    <div class="ad-list-item"><span>Total earned</span><strong>${fmt(who ? who.total_paid_out : 0)}</strong></div>
  `

  const btn = document.getElementById('watchAdBtn')
  btn.disabled = state.watchingAd
  if(adsRemaining() <= 0 && !state.watchingAd){
    btn.textContent = 'Daily limit reached'
    btn.disabled = true
  }else if(!state.watchingAd){
    btn.textContent = 'Watch an ad'
  }

  renderAdScreen()
}

let countdownTimer = null
function renderAdScreen(){
  const screen = document.getElementById('adScreen')
  const label = document.getElementById('adScreenLabel')
  const bar = document.getElementById('adProgressBar')

  // clear any previous embedded media
  Array.from(screen.querySelectorAll('.ad-media')).forEach(n => n.remove())

  if(!state.watchingAd || !state.currentAd){
    label.textContent = 'Ready to play'
    label.classList.remove('hidden')
    bar.style.width = '0%'
    return
  }

  label.textContent = `Playing… ${state.adCountdown}s`
  const url = state.currentAd.mediaUrl
  const type = detectMediaType(url)
  let mediaEl = null
  if(type === 'youtube' || type === 'vimeo'){
    mediaEl = document.createElement('iframe')
    mediaEl.src = toEmbedUrl(url)
    mediaEl.allow = 'autoplay'
    mediaEl.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:0;'
  }else if(type === 'video'){
    mediaEl = document.createElement('video')
    mediaEl.src = url
    mediaEl.autoplay = true
    mediaEl.muted = true
    mediaEl.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; object-fit:cover;'
  }else if(type === 'image'){
    mediaEl = document.createElement('img')
    mediaEl.src = url
    mediaEl.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; object-fit:cover;'
  }
  if(mediaEl){
    mediaEl.classList.add('ad-media')
    screen.insertBefore(mediaEl, label)
  }
}

document.getElementById('watchAdBtn').addEventListener('click', async () => {
  try{
    await watchAd()
    renderAdsSection()
    const total = state.currentAd.durationSeconds
    let elapsed = 0
    clearInterval(countdownTimer)
    countdownTimer = setInterval(async () => {
      elapsed++
      state.adCountdown = Math.max(0, total - elapsed)
      document.getElementById('adProgressBar').style.width = `${Math.min(100, (elapsed / total) * 100)}%`
      document.getElementById('adScreenLabel').textContent = `Playing… ${state.adCountdown}s`
      if(elapsed >= total){
        clearInterval(countdownTimer)
        try{
          const reward = await finishAd()
          toast(`You earned ${fmt(reward)}!`)
        }catch(err){
          toast(err.message)
          state.watchingAd = false
        }
        renderAll()
      }
    }, 1000)
  }catch(err){
    toast(err.message)
  }
})

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------
function renderTiers(){
  const grid = document.getElementById('tierGrid')
  grid.innerHTML = ''
  state.tiers.forEach(t => {
    const owned = state.user && state.user.tier >= t.level
    const card = document.createElement('div')
    card.className = 'tier-card' + (owned ? ' owned' : '')
    card.innerHTML = `
      <div class="tier-hexnum">${t.level}</div>
      <div class="tier-price">${fmt(t.price)}</div>
      <div class="tier-sub">${t.ads_per_day} ads/day</div>
      <button class="tier-buy${owned ? ' owned-tag' : ''}">${owned ? 'Owned' : 'Buy tier'}</button>
    `
    if(!owned){
      card.querySelector('.tier-buy').addEventListener('click', () => openPurchaseModal(t))
    }
    grid.appendChild(card)
  })
}

let pendingTier = null
function openPurchaseModal(tier){
  if(!state.user){ openModal('loginModal', 'login'); return }
  pendingTier = tier
  document.getElementById('purchaseSub').textContent =
    `Unlock Tier ${tier.level} for ${fmt(tier.price)} — raises your daily ad limit to ${tier.ads_per_day}.`
  openModal('purchaseModal')
}
document.getElementById('purchaseCancelBtn').addEventListener('click', () => closeModal('purchaseModal'))
document.getElementById('purchaseCloseBtn').addEventListener('click', () => closeModal('purchaseModal'))
document.getElementById('purchaseConfirmBtn').addEventListener('click', async () => {
  if(!pendingTier || !state.user) return
  const btn = document.getElementById('purchaseConfirmBtn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span>'
  try{
    await loadPaystack()
    const reference = newReference('tier')
    const response = await payWithPaystack({
      email: state.user.email || `${state.user.username}@advault.local`,
      amountGHS: pendingTier.price,
      reference,
    })
    const res = await api.purchaseTier(pendingTier.level, response.reference || reference)
    state.user = res.user
    closeModal('purchaseModal')
    toast(`Tier ${pendingTier.level} unlocked!`)
    renderAll()
  }catch(err){
    if(err.message !== 'closed') toast(err.message || 'Payment could not be completed.')
  }finally{
    btn.disabled = false
    btn.textContent = 'Pay with Paystack'
  }
})

// ---------------------------------------------------------------------------
// Winners
// ---------------------------------------------------------------------------
function renderWinners(){
  const track = document.getElementById('winnersTrack')
  if(!state.winners.length){
    track.innerHTML = '<div style="color:var(--text-faint); font-size:13px; padding:8px 0;">No activity yet.</div>'
    return
  }
  const list = [...state.winners, ...state.winners] // duplicate for seamless marquee
  track.innerHTML = list.map(w => {
    const [c1, c2] = gradientFor(w.username)
    return `
      <div class="winner-card">
        <span class="winner-avatar" style="background:linear-gradient(135deg,${c1},${c2});">${initialsFor(w.username)}</span>
        <div>
          <div class="winner-name">${escapeHtml(w.username)}</div>
          <div class="winner-sub">just watched an ad</div>
        </div>
        <span class="winner-amt">+${fmt(w.amount)}</span>
      </div>`
  }).join('')
}

// ---------------------------------------------------------------------------
// Withdraw
// ---------------------------------------------------------------------------
function renderWithdraw(){
  document.getElementById('withdrawBalance').textContent = fmt(state.user ? state.user.balance : 0)
  const btn = document.getElementById('withdrawBtn')
  btn.disabled = !state.user || !state.user.tier || state.user.balance <= 0
  document.getElementById('withdrawError').textContent = ''
}
document.getElementById('withdrawBtn').addEventListener('click', async () => {
  if(!state.user){ openModal('loginModal', 'login'); return }
  const phone = document.getElementById('withdrawPhone').value.trim()
  const network = document.getElementById('withdrawNetwork').value
  const errEl = document.getElementById('withdrawError')
  errEl.textContent = ''
  if(!network){ errEl.textContent = 'Select your mobile money network.'; return }
  try{
    const res = await api.withdraw(phone, network)
    state.user = res.user
    toast(res.message || `Withdrawal of ${fmt(res.amount)} sent to your mobile money.`)
    renderAll()
  }catch(err){
    errEl.textContent = err.message
  }
})

// ---------------------------------------------------------------------------
// Login / Signup modal
// ---------------------------------------------------------------------------
function showAuthTab(tab){
  document.getElementById('loginPane').classList.toggle('hidden', tab !== 'login')
  document.getElementById('signupPane').classList.toggle('hidden', tab !== 'signup')
  document.getElementById('loginTabBtn').style.opacity = tab === 'login' ? '1' : '0.55'
  document.getElementById('signupTabBtn').style.opacity = tab === 'signup' ? '1' : '0.55'
}
document.getElementById('loginTabBtn').addEventListener('click', () => showAuthTab('login'))
document.getElementById('signupTabBtn').addEventListener('click', () => showAuthTab('signup'))
document.getElementById('loginCloseBtn').addEventListener('click', () => closeModal('loginModal'))

document.getElementById('loginSubmitBtn').addEventListener('click', async () => {
  const username = document.getElementById('loginUsername').value.trim()
  const password = document.getElementById('loginPassword').value
  const errEl = document.getElementById('loginError')
  errEl.textContent = ''
  try{
    await login(username, password)
    closeModal('loginModal')
    clearAuthForms()
    renderAll()
    toast(`Welcome back, ${displayName(state.user)}.`)
  }catch(err){ errEl.textContent = err.message }
})

document.getElementById('signupSubmitBtn').addEventListener('click', async () => {
  const payload = {
    username: document.getElementById('signupUsername').value.trim(),
    password: document.getElementById('signupPassword').value,
    email: document.getElementById('signupEmail').value.trim(),
    phone: document.getElementById('signupPhone').value.trim(),
  }
  const errEl = document.getElementById('signupError')
  errEl.textContent = ''

  if(payload.password.length < 8){
    errEl.textContent = 'Password must be at least 8 characters.'
    return
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
  if(!emailOk){
    errEl.textContent = 'Enter a valid email address.'
    return
  }
  const phoneDigits = payload.phone.replace(/[^\d]/g, '')
  if(phoneDigits.length < 9 || phoneDigits.length > 13){
    errEl.textContent = 'Enter a valid mobile money phone number.'
    return
  }

  try{
    await signup(payload)
    closeModal('loginModal')
    clearAuthForms()
    renderAll()
    toast(`Welcome to Advault, ${state.user.username}.`)
  }catch(err){ errEl.textContent = err.message }
})
function clearAuthForms(){
  ['loginUsername','loginPassword','signupUsername','signupPassword','signupEmail','signupPhone'].forEach(id => {
    document.getElementById(id).value = ''
  })
}

// ---------------------------------------------------------------------------
// Admin login modal
// ---------------------------------------------------------------------------
document.getElementById('adminLoginCloseBtn').addEventListener('click', () => closeModal('adminLoginModal'))
document.getElementById('adminLoginSubmitBtn').addEventListener('click', async () => {
  const username = document.getElementById('adminUsername').value.trim()
  const password = document.getElementById('adminPassword').value
  const errEl = document.getElementById('adminLoginError')
  errEl.textContent = ''
  try{
    const res = await api.adminLogin({ username, password })
    setAdminToken(res.token)
    closeModal('adminLoginModal')
    document.getElementById('adminUsername').value = ''
    document.getElementById('adminPassword').value = ''
    openAdminPanel()
  }catch(err){ errEl.textContent = err.message }
})

// ---------------------------------------------------------------------------
// Generic modal helpers
// ---------------------------------------------------------------------------
function openModal(id, authTab){
  if(id === 'loginModal' && authTab) showAuthTab(authTab)
  document.getElementById(id).classList.remove('hidden')
  lockScroll(true)
}
function closeModal(id){
  document.getElementById(id).classList.add('hidden')
  lockScroll(false)
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay) closeModal(overlay.id)
  })
})

// ---------------------------------------------------------------------------
// Render everything
// ---------------------------------------------------------------------------
export function renderAll(){
  renderNavAuth()
  renderHero()
  renderDashboard()
  renderAdsSection()
  renderTiers()
  renderWinners()
  renderWithdraw()
}
window.__advaultRenderAll = renderAll
window.__advaultToast = toast
window.__advaultAskConfirm = askConfirm

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
;(async function init(){
  try{
    await bootstrap()
  }catch(err){
    toast('Could not reach the backend. Check js/config.js.')
  }
  renderAll()
  // Refresh winners + user periodically for a "live" feel
  setInterval(async () => {
    try{
      const w = await api.winners()
      state.winners = w.winners
      renderWinners()
    }catch(_){}
  }, 15000)
  setInterval(async () => {
    await refreshMe()
    renderDashboard()
    renderAdsSection()
    renderWithdraw()
  }, 20000)
})()
