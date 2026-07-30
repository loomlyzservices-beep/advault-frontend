import { api } from './api.js'
import { state, fmt, logout } from './store.js'

// app.js attaches these to window to avoid a circular import
const toast = (...args) => window.__advaultToast(...args)
const askConfirm = (...args) => window.__advaultAskConfirm(...args)
const lockScroll = (...args) => window.__advaultLockScroll(...args)
const renderAll = () => window.__advaultRenderAll()

let activeTab = 'overview'

export function openAdminPanel(){
  document.getElementById('adminPanel').classList.remove('hidden')
  lockScroll(true)
  setupAdminChrome()
  switchTab('overview')
}
function closeAdminPanel(){
  document.getElementById('adminPanel').classList.add('hidden')
  lockScroll(false)
}

function setupAdminChrome(){
  document.getElementById('exitAdminBtn').onclick = () => {
    // Just close the panel — stay logged in as admin so re-opening it
    // (via the logo) doesn't force another login.
    closeAdminPanel()
    document.querySelector('.admin-sidebar')?.classList.remove('open')
    renderAll()
  }
  document.getElementById('adminLogoutBtn').onclick = async () => {
    closeAdminPanel()
    await logout()
    renderAll()
    toast('Logged out.')
  }
  document.getElementById('adminRefreshBtn').onclick = () => switchTab(activeTab)
  document.getElementById('adminMenuBtn').onclick = () => {
    document.querySelector('.admin-sidebar').classList.toggle('open')
  }
  document.getElementById('deleteEverythingBtn').onclick = async () => {
    const ok = await askConfirm('This permanently deletes ALL users, ads, transactions, and withdrawals. This cannot be undone. Continue?')
    if(!ok) return
    await api.admin.resetEverything()
    toast('Platform reset.')
    switchTab(activeTab)
  }
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.onclick = () => {
      switchTab(btn.dataset.tab)
      document.querySelector('.admin-sidebar')?.classList.remove('open')
    }
  })
}

const TAB_META = {
  overview: ['Overview', "Here's today's report and performance"],
  users: ['Users', 'Manage accounts, pause access, or remove users'],
  ads: ['Ads', 'Upload and manage the ads shown to users'],
  transactions: ['Transactions', 'Every ad reward and tier purchase on the platform'],
  analytics: ['Ads Analytics', 'Aggregate ad performance across all users'],
  withdrawals: ['Withdrawals', 'Payout history sent to mobile money'],
  controls: ['Controls', 'Tier pricing and platform-wide settings'],
}

function switchTab(tab){
  activeTab = tab
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`))
  const [title, sub] = TAB_META[tab] || ['Admin', '']
  document.getElementById('adminPageTitle').textContent = title
  document.getElementById('adminPageSub').textContent = sub
  const renderers = {
    overview: renderOverview,
    users: renderUsers,
    ads: renderAds,
    transactions: renderTransactions,
    analytics: renderAnalytics,
    withdrawals: renderWithdrawals,
    controls: renderControls,
  }
  renderers[tab] && renderers[tab]()
}

function esc(s){ const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML }

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
async function renderOverview(){
  const el = document.getElementById('tab-overview')
  el.innerHTML = '<div class="spinner"></div>'
  const stats = await api.admin.overview()
  el.innerHTML = `
    <div class="admin-stat-grid">
      <div class="stat-card"><div class="num">${stats.totalUsers}</div><div class="lbl">Total users</div></div>
      <div class="stat-card"><div class="num">${stats.totalAdsWatched}</div><div class="lbl">Total ads watched</div></div>
      <div class="stat-card"><div class="num">${fmt(stats.totalPaidOut)}</div><div class="lbl">Total paid out</div></div>
      <div class="stat-card"><div class="num">${stats.activeAds}</div><div class="lbl">Active ads</div></div>
      <div class="stat-card"><div class="num">${fmt(stats.totalWithdrawn)}</div><div class="lbl">Total withdrawn</div></div>
    </div>
  `
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
async function renderUsers(){
  const el = document.getElementById('tab-users')
  el.innerHTML = '<div class="spinner"></div>'
  const { users } = await api.admin.users()
  el.innerHTML = `
    <div class="btn-row">
      <button class="btn-danger" id="deleteAllUsersBtn">Delete all users</button>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Username</th><th>Email</th><th>Phone</th><th>Balance</th><th>Tier</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u => `
          <tr data-id="${u.id}">
            <td>${esc(u.username)}</td>
            <td>${esc(u.email || '—')}</td>
            <td>${esc(u.phone || '—')}</td>
            <td>${fmt(u.balance)}</td>
            <td>${u.tier || '—'}</td>
            <td><span class="badge ${u.status === 'active' ? 'green' : 'gray'}">${u.status}</span></td>
            <td>
              <button class="row-btn" data-act="toggle">${u.status === 'active' ? 'Pause' : 'Unpause'}</button>
              <button class="row-btn" data-act="logout">Force logout</button>
              <button class="row-btn danger" data-act="delete">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `
  el.querySelector('#deleteAllUsersBtn').onclick = async () => {
    if(!(await askConfirm('Delete all users and their transactions/withdrawals? Ads and settings are kept.'))) return
    await api.admin.deleteAllUsers()
    toast('All users deleted.')
    renderUsers()
  }
  el.querySelectorAll('tr[data-id]').forEach(row => {
    const id = row.dataset.id
    row.querySelector('[data-act="toggle"]').onclick = async () => {
      const isActive = row.querySelector('.badge').textContent === 'active'
      await (isActive ? api.admin.pauseUser(id) : api.admin.unpauseUser(id))
      renderUsers()
    }
    row.querySelector('[data-act="logout"]').onclick = async () => {
      await api.admin.forceLogout(id)
      toast('User sessions revoked.')
    }
    row.querySelector('[data-act="delete"]').onclick = async () => {
      if(!(await askConfirm(`Delete this user permanently?`))) return
      await api.admin.deleteUser(id)
      renderUsers()
    }
  })
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------
async function renderAds(){
  const el = document.getElementById('tab-ads')
  el.innerHTML = '<div class="spinner"></div>'
  const { ads } = await api.admin.ads()
  el.innerHTML = `
    <h4 style="margin:0 0 12px;">Upload a new ad</h4>
    <div class="admin-form-grid" style="margin-bottom:10px;">
      <div class="field" style="margin:0;"><label>Title (admin only)</label><input id="newAdTitle" class="mini-inline-input"></div>
      <div class="field" style="margin:0;"><label>Media URL</label><input id="newAdUrl" class="mini-inline-input" placeholder="https:// or YouTube/Vimeo link"></div>
      <div class="field" style="margin:0;"><label>Or upload file</label><input id="newAdFile" type="file" accept="video/*,image/*" class="mini-inline-input"></div>
      <div class="field" style="margin:0;"><label>Duration (seconds)</label><input id="newAdDuration" type="number" class="mini-inline-input" placeholder="15"></div>
      <div class="field" style="margin:0;"><label>Fixed reward (optional)</label><input id="newAdReward" type="number" step="0.01" class="mini-inline-input" placeholder="leave blank for random range"></div>
      <div class="field" style="margin:0;"><label>Max shows (0 = unlimited)</label><input id="newAdMaxShows" type="number" class="mini-inline-input" placeholder="0"></div>
    </div>
    <div class="upload-note">File uploads are stored inline — keep them under ~15MB.</div>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn-primary" id="addAdBtn" style="padding:10px 20px;">Add ad</button>
      <button class="btn-danger" id="deleteAllAdsBtn">Delete all ads</button>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Title</th><th>Duration</th><th>Reward</th><th>Max shows</th><th>Shown</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>${ads.map(a => `
          <tr data-id="${a.id}">
            <td><input class="mini-inline-input edit-title" value="${esc(a.title)}"></td>
            <td><input class="mini-inline-input edit-duration" type="number" value="${a.duration_seconds}" style="width:70px;"></td>
            <td><input class="mini-inline-input edit-reward" type="number" step="0.01" value="${a.reward ?? ''}" style="width:80px;"></td>
            <td><input class="mini-inline-input edit-maxshows" type="number" value="${a.max_shows}" style="width:70px;"></td>
            <td>${a.shows_count}</td>
            <td><span class="badge ${a.active ? 'green' : 'gray'}">${a.active ? 'active' : 'off'}</span></td>
            <td>
              <button class="row-btn" data-act="save">Save</button>
              <button class="row-btn" data-act="toggle">${a.active ? 'Deactivate' : 'Activate'}</button>
              <button class="row-btn danger" data-act="delete">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `

  el.querySelector('#addAdBtn').onclick = async () => {
    const title = el.querySelector('#newAdTitle').value.trim()
    let mediaUrl = el.querySelector('#newAdUrl').value.trim()
    const fileInput = el.querySelector('#newAdFile')
    const duration = el.querySelector('#newAdDuration').value
    const reward = el.querySelector('#newAdReward').value
    const maxShows = el.querySelector('#newAdMaxShows').value

    if(fileInput.files[0]){
      const file = fileInput.files[0]
      if(file.size > 18 * 1024 * 1024){
        toast('That file is too large — keep uploads under ~18MB.')
        return
      }
      mediaUrl = await fileToDataUrl(file)
    }
    if(!title || !mediaUrl){
      toast('Title and a media URL or file are required.')
      return
    }
    await api.admin.createAd({ title, mediaUrl, durationSeconds: duration, reward, maxShows })
    toast('Ad added.')
    renderAds()
  }
  el.querySelector('#deleteAllAdsBtn').onclick = async () => {
    if(!(await askConfirm('Delete all ads? This cannot be undone.'))) return
    await api.admin.deleteAllAds()
    renderAds()
  }
  el.querySelectorAll('tr[data-id]').forEach(row => {
    const id = row.dataset.id
    row.querySelector('[data-act="save"]').onclick = async () => {
      await api.admin.updateAd(id, {
        title: row.querySelector('.edit-title').value,
        mediaUrl: ads.find(a => String(a.id) === id).media_url,
        durationSeconds: row.querySelector('.edit-duration').value,
        reward: row.querySelector('.edit-reward').value,
        maxShows: row.querySelector('.edit-maxshows').value,
        active: row.querySelector('.badge').textContent === 'active',
      })
      toast('Ad saved.')
    }
    row.querySelector('[data-act="toggle"]').onclick = async () => {
      await api.admin.toggleAd(id)
      renderAds()
    }
    row.querySelector('[data-act="delete"]').onclick = async () => {
      if(!(await askConfirm('Delete this ad?'))) return
      await api.admin.deleteAd(id)
      renderAds()
    }
  })
}
function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
async function renderTransactions(){
  const el = document.getElementById('tab-transactions')
  el.innerHTML = '<div class="spinner"></div>'
  const { transactions } = await api.admin.transactions()
  el.innerHTML = `
    <div class="btn-row"><button class="btn-danger" id="deleteTxBtn">Delete transaction history</button></div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${transactions.map(t => `
          <tr>
            <td>${esc(t.username)}</td>
            <td>${esc(t.type)}</td>
            <td>${fmt(t.amount)}</td>
            <td><span class="badge green">${esc(t.status)}</span></td>
            <td>${esc(t.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `
  el.querySelector('#deleteTxBtn').onclick = async () => {
    if(!(await askConfirm('Delete all transaction history?'))) return
    await api.admin.deleteTransactions()
    renderTransactions()
  }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
async function renderAnalytics(){
  const el = document.getElementById('tab-analytics')
  const stats = await api.admin.overview()
  el.innerHTML = `
    <div class="btn-row"><button class="btn-danger" id="resetAnalyticsBtn">Reset ad analytics</button></div>
    <div class="admin-stat-grid">
      <div class="stat-card"><div class="num">${stats.totalAdsWatched}</div><div class="lbl">Total ads watched</div></div>
      <div class="stat-card"><div class="num">${fmt(stats.totalPaidOut)}</div><div class="lbl">Total paid out</div></div>
    </div>
  `
  el.querySelector('#resetAnalyticsBtn').onclick = async () => {
    if(!(await askConfirm('Reset all ad analytics counters to zero?'))) return
    await api.admin.resetAnalytics()
    toast('Analytics reset.')
    renderAnalytics()
  }
}

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------
async function renderWithdrawals(){
  const el = document.getElementById('tab-withdrawals')
  el.innerHTML = '<div class="spinner"></div>'
  const { withdrawals } = await api.admin.withdrawals()
  el.innerHTML = `
    <div class="btn-row"><button class="btn-danger" id="deleteWithdrawalsBtn">Delete withdrawal history</button></div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>User</th><th>Amount</th><th>Phone</th><th>Date</th><th></th></tr></thead>
        <tbody>${withdrawals.map(w => `
          <tr data-id="${w.id}">
            <td>${esc(w.username)}</td>
            <td>${fmt(w.amount)}</td>
            <td>${esc(w.phone || '—')}</td>
            <td>${esc(w.created_at)}</td>
            <td><button class="row-btn danger" data-act="delete">Delete</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `
  el.querySelector('#deleteWithdrawalsBtn').onclick = async () => {
    if(!(await askConfirm('Delete all withdrawal history?'))) return
    await api.admin.deleteAllWithdrawals()
    renderWithdrawals()
  }
  el.querySelectorAll('tr[data-id]').forEach(row => {
    row.querySelector('[data-act="delete"]').onclick = async () => {
      if(!(await askConfirm('Delete this withdrawal record?'))) return
      await api.admin.deleteWithdrawal(row.dataset.id)
      renderWithdrawals()
    }
  })
}

// ---------------------------------------------------------------------------
// Controls (tiers + settings)
// ---------------------------------------------------------------------------
async function renderControls(){
  const el = document.getElementById('tab-controls')
  el.innerHTML = '<div class="spinner"></div>'
  const [{ tiers }, { settings }] = await Promise.all([api.tiers(), api.settings()])
  el.innerHTML = `
    <h4 style="margin:0 0 12px;">Tiers</h4>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Level</th><th>Price (GHS)</th><th>Ads/day</th><th></th></tr></thead>
        <tbody>${tiers.map(t => `
          <tr data-level="${t.level}">
            <td>${t.level}</td>
            <td><input class="mini-inline-input edit-price" type="number" step="0.01" value="${t.price}"></td>
            <td><input class="mini-inline-input edit-ads" type="number" value="${t.ads_per_day}"></td>
            <td><button class="row-btn" data-act="save">Save</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <h4 style="margin:26px 0 12px;">Platform settings</h4>
    <div class="admin-form-grid">
      <div class="field" style="margin:0;"><label>Default daily ad allowance</label><input id="settingAllowance" type="number" class="mini-inline-input" value="${settings.defaultAdsAllowance}"></div>
      <div class="field" style="margin:0;"><label>Ad reward min (GHS)</label><input id="settingMin" type="number" step="0.01" class="mini-inline-input" value="${settings.adRewardMin}"></div>
      <div class="field" style="margin:0;"><label>Ad reward max (GHS)</label><input id="settingMax" type="number" step="0.01" class="mini-inline-input" value="${settings.adRewardMax}"></div>
    </div>
    <div class="btn-row" style="margin-top:14px;"><button class="btn-primary" id="saveSettingsBtn" style="padding:10px 20px;">Save settings</button></div>
  `
  el.querySelectorAll('tr[data-level]').forEach(row => {
    row.querySelector('[data-act="save"]').onclick = async () => {
      await api.admin.saveTier(row.dataset.level, {
        price: row.querySelector('.edit-price').value,
        adsPerDay: row.querySelector('.edit-ads').value,
      })
      toast(`Tier ${row.dataset.level} saved.`)
    }
  })
  el.querySelector('#saveSettingsBtn').onclick = async () => {
    await api.admin.saveSettings({
      defaultAdsAllowance: el.querySelector('#settingAllowance').value,
      adRewardMin: el.querySelector('#settingMin').value,
      adRewardMax: el.querySelector('#settingMax').value,
    })
    toast('Settings saved.')
  }
}
