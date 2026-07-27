'use strict';

const API = '/api';

/* ─────────────────────────────────────────
   WEB AUDIO SOUNDS SYSTEM (PS5 UI STYLE)
───────────────────────────────────────── */
const Snd = {
  ctx: null,
  enabled: true,
  init() {
    this.enabled = localStorage.getItem('soundEffects') !== 'false';
  },
  getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('soundEffects', this.enabled);
    return this.enabled;
  },
  playTick() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.04);
      
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch(e) {}
  },
  playSelect() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      
      // Dual tone chime
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.03);
        
        gain.gain.setValueAtTime(0.07, now + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.3);
      });
    } catch(e) {}
  },
  playBack() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch(e) {}
  },
  playLaunch() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      
      // EXQUISITE CHORD CHIME: Swells of warm, luxurious sine waves (A major chord A3, E4, A4, C#5)
      const freqs = [220.00, 329.63, 440.00, 554.37];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05); // Elegant strumming delay!
        osc.frequency.exponentialRampToValueAtTime(freq * 1.04, now + 1.2);
        
        gain.gain.setValueAtTime(0.001, now + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.025, now + 0.35 + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + 1.8);
      });
    } catch(e) {}
  },
  playBoot() {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      const freqs = [130.81, 196.00, 329.63, 392.00, 523.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.5 + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.2);
      });
    } catch(e) {}
  }
};

// Initialize audio context resume on user gesture
document.addEventListener('click', () => { Snd.getCtx(); }, { once: true });
document.addEventListener('keydown', () => { Snd.getCtx(); }, { once: true });

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const S = {
  games:       [],
  media:       [],
  currentGame: null,
  activeTab:   'games',
  focus:       'gamebar',
  topIdx:      0, 
  gameBarIdx:  0,
  actionIdx:   0, 
  libraryOpen: false,
  libIdx:      0,
  searchOpen:      false,
  oskRow:          1,
  oskCol:          0,
  oskQuery:        '',
  searchResults:   [],
  searchResultIdx: 0,
  detailOpen: false,
  settingsOpen: false,
  settingsIdx: 1,
  profileOpen: false,
  profileIdx: 0,
  ctrlConnected: false,
  ctrlIndex:     null,
  ctrlType:      'unknown',
  prevBtns:      {},
  user:        null,
  isLaunching: false,
  
  // Gamepad calibration variables
  calibrating: false,
  calibStep: 0,
  calibMapping: {},
  calibSteps: ['CROSS', 'CIRCLE', 'SQUARE', 'TRIANGLE', 'L1', 'R1'],
  calibLabels: ['Confirm (A / ✕)', 'Back (B / ○)', 'Search (X / □)', 'Details (Y / △)', 'Left Bumper (LB / L1)', 'Right Bumper (RB / R1)']
};

async function boot() {
  const ring   = document.getElementById('boot-ring-active');
  const status = document.getElementById('boot-status');
  const percent = document.getElementById('boot-percent');
  
  async function step(pct, msg, fn) {
    if (status) status.textContent = msg + '_';
    if (percent) percent.textContent = String(pct).padStart(2, '0') + '%';
    if (ring) {
      const offset = 283 - (283 * pct / 100);
      ring.style.strokeDashoffset = offset;
    }
    if (fn) {
      try { const res = fn(); if (res instanceof Promise) await res; } 
      catch (e) {}
    }
    await sleep(250);
  }
  
  document.getElementById('app').classList.remove('invisible');
  await step(15,  'CONNECTING_TO_STEAM', checkSteam);
  await step(50,  'LOADING_LIBRARY',     loadGames);
  await step(70,  'LOADING_MEDIA',       loadMedia);
  await step(82,  'BUILDING_INTERFACE',  buildUI);
  await step(100, 'SYSTEM_READY',        null);
  await sleep(400);
  
  document.getElementById('boot-screen').classList.add('out');
  
  // Try booting chime (may require gesture but we try anyway)
  Snd.playBoot();
  
  await sleep(900);
  document.getElementById('boot-screen').style.display = 'none';

  startClock();
  initGamepad();
  initKeyboard();
  initUIEvents();
  updateHints();
  startHeartbeat();
}

function startHeartbeat() {
  fetch(API + '/heartbeat', { method: 'POST' }).catch(() => {});
  setInterval(() => {
    fetch(API + '/heartbeat', { method: 'POST' }).catch(() => {});
  }, 2500);
}

async function checkSteam() {
  Snd.init();
  const soundOn = localStorage.getItem('soundEffects') !== 'false';
  const soundToggle = document.getElementById('toggle-sound-effects');
  if (soundToggle) {
    soundToggle.classList.toggle('on', soundOn);
  }

  const val = localStorage.getItem('hideSteam') === 'true';
  const ts = document.getElementById('toggle-hide-steam');
  if (ts) {
    ts.classList.toggle('on', val);
  }
  // Sync the hide_steam setting with the python backend immediately on startup!
  fetch(API + '/settings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ hide_steam: val })
  }).catch(() => {});
  const ds3val = localStorage.getItem('ds3FixMode') || 'std';
  updateDs3Label(ds3val);

  const sortMode = localStorage.getItem('sortMode') || 'last_played';
  updateSortLabel(sortMode);

  const d = await fetchJSON(API + '/status');
  S.user  = d.user;
  
  if (d.user) {
    document.getElementById('user-avatar').title = d.user.name;
    document.getElementById('user-name').textContent = d.user.name;
    if (d.user.avatar) {
      const circ = document.querySelector('.avatar-circle');
      if (circ) circ.innerHTML = '<img src="' + d.user.avatar + '" alt="Avatar">';
    }
  } else {
    document.getElementById('user-name').textContent = "Local User";
  }
  if (!d.steam_running) notify('⚠', 'Steam not running', 'Library may be incomplete');
}

async function loadGames() {
  const d  = await fetchJSON(API + '/games');
  S.games  = d.games || [];
  const sortMode = localStorage.getItem('sortMode') || 'last_played';
  sortGames(sortMode);
}

async function loadMedia() {
  try {
    const d = await fetchJSON(API + '/media');
    S.media = d.images || [];
    renderMedia();
  } catch(e) {
    S.media = [];
  }
}

function renderMedia() {
  const cards = document.querySelectorAll('.media-app-card');
  cards.forEach((c, i) => {
    c.classList.toggle('ui-focused', i === mediaIdx);
  });
}

async function refreshLibrary() {
  Snd.playSelect();
  notify('⟳', 'Refreshing', 'Reloading your library…');
  await fetch(API + '/invalidate-cache', { method: 'POST' });
  await loadGames();
  buildUI();
  notify('✓', 'Done', S.games.length + ' games loaded');
}

async function toggleHideSteam() {
  const toggle = document.getElementById('toggle-hide-steam');
  if(!toggle) return;
  const isOn = !toggle.classList.contains('on');
  toggle.classList.toggle('on', isOn);
  localStorage.setItem('hideSteam', isOn);
  try {
    await fetch(API + '/settings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ hide_steam: isOn })
    });
  } catch(e) {}
}

function toggleDs3Fix() {
  let mode = localStorage.getItem('ds3FixMode') || 'std';
  if (mode === 'std') mode = 'type1';
  else if (mode === 'type1') mode = 'type2';
  else if (mode === 'type2') mode = 'nsw';
  else if (mode === 'nsw') mode = 'generic';
  else if (mode === 'generic') mode = 'ipega';
  else if (mode === 'ipega') {
    const saved = localStorage.getItem('customGamepadMapping');
    if (saved) mode = 'custom';
    else mode = 'std';
  } else mode = 'std';
  
  localStorage.setItem('ds3FixMode', mode);
  updateDs3Label(mode);
  Snd.playSelect();
}

function updateDs3Label(mode) {
  const label = document.getElementById('ds3-fix-label');
  if (!label) return;
  if (mode === 'type1') label.textContent = 'Type A (Cross=2)';
  else if (mode === 'type2') label.textContent = 'Type B (Cross=1)';
  else if (mode === 'nsw') label.textContent = 'Nintendo Switch';
  else if (mode === 'generic') label.textContent = 'Generic PC';
  else if (mode === 'ipega') label.textContent = 'iPega PG-9023';
  else if (mode === 'custom') label.textContent = 'Custom Mapping';
  else label.textContent = 'Standard';
}

function toggleSoundEffects() {
  const active = Snd.toggle();
  const toggle = document.getElementById('toggle-sound-effects');
  if (toggle) toggle.classList.toggle('on', active);
  if (active) {
    Snd.playSelect();
  }
}

function toggleSortMode() {
  let mode = localStorage.getItem('sortMode') || 'last_played';
  if (mode === 'last_played') mode = 'alphabetical';
  else if (mode === 'alphabetical') mode = 'size_on_disk';
  else mode = 'last_played';
  
  localStorage.setItem('sortMode', mode);
  updateSortLabel(mode);
  sortGames(mode);
  buildUI();
  Snd.playSelect();
  notify('⟳', 'Sorted Library', getSortLabelText(mode));
}

function updateSortLabel(mode) {
  const label = document.getElementById('sort-mode-label');
  if (label) {
    label.textContent = getSortLabelText(mode);
  }
  const libCountEl = document.getElementById('lib-count');
  if (libCountEl) {
    libCountEl.textContent = S.games.length + ' game' + (S.games.length !== 1 ? 's' : '') + ' • Sorted by ' + getSortLabelText(mode).toLowerCase();
  }
}

function getSortLabelText(mode) {
  if (mode === 'alphabetical') return 'Alphabetical';
  if (mode === 'size_on_disk') return 'Size on Disk';
  return 'Last Played';
}

function sortGames(mode) {
  if (mode === 'alphabetical') {
    S.games.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === 'size_on_disk') {
    S.games.sort((a, b) => b.size_on_disk - a.size_on_disk);
  } else {
    S.games.sort((a, b) => b.last_played - a.last_played);
  }
}

async function quitApp() {
  Snd.playBack();
  notify('⎋', 'Exiting', 'Shutting down MewStation...');
  await sleep(1000);
  try {
    await fetch(API + '/quit', { method: 'POST' });
  } catch(e) {}
  window.close();
}

function openSettings() {
  Snd.playSelect();
  S.settingsOpen = true; S.focus = 'settings'; S.settingsIdx = 1;
  document.getElementById('settings-panel').classList.remove('hidden');
  void document.getElementById('settings-panel').offsetWidth;
  document.getElementById('settings-panel').classList.add('open');
  updateSettingsFocus(); updateHints();
}

function closeSettings() {
  Snd.playBack();
  S.settingsOpen = false;
  document.getElementById('settings-panel').classList.remove('open');
  setTimeout(() => document.getElementById('settings-panel').classList.add('hidden'), 400);
  S.focus = 'topbar'; S.topIdx = 1;
  updateTopFocus(); updateHints();
}

function updateSettingsFocus() {
  const c = document.getElementById('settings-close');
  const snd = document.getElementById('setting-sound-effects');
  const h = document.getElementById('setting-hide-steam');
  const ds3 = document.getElementById('setting-ds3-fix');
  const calib = document.getElementById('setting-calibrate');
  const sort = document.getElementById('setting-sort-mode');
  const quit = document.getElementById('setting-quit');
  
  if(c) c.classList.toggle('ui-focused', S.settingsIdx === 0);
  if(snd) snd.classList.toggle('ui-focused', S.settingsIdx === 1);
  if(h) h.classList.toggle('ui-focused', S.settingsIdx === 2);
  if(ds3) ds3.classList.toggle('ui-focused', S.settingsIdx === 3);
  if(calib) calib.classList.toggle('ui-focused', S.settingsIdx === 4);
  if(sort) sort.classList.toggle('ui-focused', S.settingsIdx === 5);
  if(quit) quit.classList.toggle('ui-focused', S.settingsIdx === 6);
}

function openProfile() {
  Snd.playSelect();
  S.profileOpen = true; S.focus = 'profile'; S.profileIdx = 0;
  if (S.user) {
    document.getElementById('profile-name-large').textContent = S.user.name || 'User Name';
    document.getElementById('profile-id-text').textContent = 'Account ID: ' + (S.user.steam64 || '—');
    const img = document.getElementById('profile-avatar-img');
    if (S.user.avatar) {
      img.src = S.user.avatar;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
  }
  document.getElementById('profile-panel').classList.remove('hidden');
  void document.getElementById('profile-panel').offsetWidth;
  document.getElementById('profile-panel').classList.add('open');
  updateProfileFocus(); updateHints();
}

function closeProfile() {
  Snd.playBack();
  S.profileOpen = false;
  document.getElementById('profile-panel').classList.remove('open');
  setTimeout(() => document.getElementById('profile-panel').classList.add('hidden'), 400);
  S.focus = 'topbar'; S.topIdx = 2;
  updateTopFocus(); updateHints();
}

function updateProfileFocus() {
  const c = document.getElementById('profile-close');
  if(c) c.classList.toggle('ui-focused', S.profileIdx === 0);
}

function buildUI() {
  renderGameBar(); renderLibrary();
  if (S.games.length > 0) { S.gameBarIdx = 0; S.libIdx = 0; selectGameBar(0); }
}

function updateTopFocus() {
  const items = document.querySelectorAll('.top-item');
  items.forEach((el, i) => { el.classList.toggle('ui-focused', S.focus === 'topbar' && i === S.topIdx); });
}
function clearTopFocus() { document.querySelectorAll('.top-item').forEach(el => el.classList.remove('ui-focused')); }

function renderGameBar() {
  const bar = document.getElementById('game-bar');
  bar.innerHTML = '';
  S.games.slice(0, 24).forEach((g, i) => {
    const el = document.createElement('div'); el.className = 'game-icon-item'; el.dataset.idx = i;
    const inner = document.createElement('div'); inner.className = 'game-icon-inner';
    const img = document.createElement('img');
    img.src = g.artwork?.capsule_small || g.artwork?.capsule || ''; img.alt = g.name; img.draggable = false;
    img.onerror = () => { inner.innerHTML = '<div class="game-icon-placeholder">' + g.name[0].toUpperCase() + '</div>'; };
    inner.appendChild(img); el.appendChild(inner);
    el.addEventListener('click', () => {
      if (S.focus !== 'gamebar') { clearTopFocus(); undimGameBar(); stopPlayRunner(); S.focus = 'gamebar'; updateActionFocus(); updateHints(); }
      selectGameBar(i);
    });
    el.addEventListener('dblclick', () => launchGame(g));
    bar.appendChild(el);
  });
}

function selectGameBar(idx) {
  const max = Math.min(S.games.length, 24) - 1;
  S.gameBarIdx = Math.max(0, Math.min(max, idx));
  document.querySelectorAll('.game-icon-item').forEach((el, i) => {
    el.classList.toggle('selected', i === S.gameBarIdx);
    el.classList.toggle('ui-focused', i === S.gameBarIdx && S.focus === 'gamebar');
    if (S.focus === 'gamebar') el.classList.remove('dimmed');
  });
  const g = S.games[S.gameBarIdx];
  if (g) setCurrentGame(g);
  const items = document.querySelectorAll('.game-icon-item');
  if (items[S.gameBarIdx]) items[S.gameBarIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function dimGameBar() { document.querySelectorAll('.game-icon-item').forEach(el => { el.classList.remove('ui-focused'); el.classList.add('dimmed'); }); }
function undimGameBar() { document.querySelectorAll('.game-icon-item').forEach(el => el.classList.remove('dimmed')); }

function renderLibrary() {
  const scroll = document.getElementById('library-scroll');
  const countEl = document.getElementById('lib-count');
  if (!scroll) return;
  scroll.innerHTML = '';
  const sortMode = localStorage.getItem('sortMode') || 'last_played';
  if (countEl) countEl.textContent = S.games.length + ' game' + (S.games.length !== 1 ? 's' : '') + ' • Sorted by ' + getSortLabelText(sortMode).toLowerCase();
  S.games.forEach((g, i) => {
    const card = document.createElement('div'); card.className = 'lib-card'; card.dataset.idx = i;
    const inner = document.createElement('div'); inner.className = 'lib-card-inner';
    const img = document.createElement('img'); img.loading = 'lazy'; img.alt = g.name; img.draggable = false;
    img.src = g.artwork?.capsule || g.artwork?.capsule_small || '';
    img.onerror = () => { inner.innerHTML = '<div class="lib-card-fallback"><div class="fl">' + g.name[0].toUpperCase() + '</div><div class="fn">' + esc(g.name) + '</div></div>'; };
    inner.appendChild(img);
    const title = document.createElement('div'); title.className = 'lib-card-title'; title.textContent = g.name;
    card.appendChild(inner); card.appendChild(title);
    card.addEventListener('click', () => { S.libIdx = i; S.focus = 'library'; updateLibraryFocus(); setCurrentGame(g); });
    card.addEventListener('dblclick', () => { closeLibrary(); launchGame(g); });
    scroll.appendChild(card);
  });
}

function openLibrary() {
  Snd.playSelect();
  S.libraryOpen = true; S.focus = 'library';
  S.libIdx = S.currentGame ? Math.max(0, S.games.findIndex(g => g.appid === S.currentGame.appid)) : 0;
  document.getElementById('library-panel').classList.add('open');
  document.getElementById('library-backdrop').classList.add('show');
  updateLibraryFocus(); scrollLibTo(S.libIdx);
  const hint = document.getElementById('lib-close-hint');
  if (hint) hint.innerHTML = makeFaceBtn('circle', isPlayStation()) + ' Close';
  updateHints();
}

function closeLibrary() {
  Snd.playBack();
  S.libraryOpen = false;
  document.getElementById('library-panel').classList.remove('open');
  document.getElementById('library-backdrop').classList.remove('show');
  S.focus = 'hero-actions'; S.actionIdx = 0;
  updateLibraryFocus(); updateActionFocus(); updateHints();
}

function updateLibraryFocus() { document.querySelectorAll('.lib-card').forEach((c, i) => c.classList.toggle('ui-focused', i === S.libIdx && S.focus === 'library')); }
function scrollLibTo(idx) { const cards = document.querySelectorAll('.lib-card'); if (cards[idx]) cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }

function setCurrentGame(g) { S.currentGame = g; updateHero(g); }
function updateHero(g) {
  const bg = document.getElementById('hero-bg');
  bg.style.opacity = '0';
  setTimeout(() => {
    const url = g.artwork?.hero || g.artwork?.background || g.artwork?.capsule_small || '';
    bg.style.backgroundImage = url ? 'url("' + url + '")' : 'none';
    bg.style.transition = 'opacity .5s ease'; bg.style.opacity = '1';
  }, 130);
  const titleEl = document.getElementById('hero-title');
  titleEl.textContent = g.name; titleEl.style.animation = 'none'; titleEl.offsetHeight; titleEl.style.animation = 'heroFade .4s ease both';
  const logoEl = document.getElementById('hero-logo'); logoEl.innerHTML = '';
  if (g.artwork?.logo) { const li = new Image(); li.src = g.artwork.logo; li.alt = ''; li.onerror = () => { logoEl.innerHTML = ''; }; logoEl.appendChild(li); }
  const meta = document.getElementById('hero-meta'); meta.innerHTML = '';
  if (g.last_played > 0) addPill(meta, '🕒 ' + new Date(g.last_played * 1000).toLocaleDateString());
  if (g.playtime > 0) addPill(meta, '◷ ' + fmtPlaytime(g.playtime));
  if (g.size_on_disk > 0) addPill(meta, fmtSize(g.size_on_disk));
  addPill(meta, 'ID: ' + g.appid);
}

function addPill(el, text) { const sp = document.createElement('span'); sp.className = 'meta-pill'; sp.textContent = text; el.appendChild(sp); }
function updateActionFocus() {
  const inHA = S.focus === 'hero-actions';
  document.getElementById('btn-play').classList.toggle('ui-focused', inHA && S.actionIdx === 0);
  document.getElementById('btn-more').classList.toggle('ui-focused', inHA && S.actionIdx === 1);
}
function startPlayRunner() { document.getElementById('btn-play').classList.add('running'); }
function stopPlayRunner() { document.getElementById('btn-play').classList.remove('running'); }

/* ─────────────────────────────────────────
   GAME RUNNING MONITOR
───────────────────────────────────────── */
let runningCheckInterval = null;
function startRunningCheck(appid) {
  if (runningCheckInterval) clearInterval(runningCheckInterval);
  const btn = document.getElementById('btn-play');
  const dbtn = document.getElementById('detail-play');
  
  const updatePlayButtons = (running) => {
    if (running) {
      if (btn) {
        btn.classList.add('game-running');
        const content = btn.querySelector('.btn-play-content');
        if (content) content.innerHTML = '<span class="pulse-dot"></span> Running';
      }
      if (dbtn) {
        dbtn.classList.add('game-running');
        const content = dbtn.querySelector('.btn-play-content');
        if (content) content.innerHTML = '<span class="pulse-dot"></span> Running';
      }
    } else {
      if (btn) {
        btn.classList.remove('game-running');
        const content = btn.querySelector('.btn-play-content');
        if (content) {
          content.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Play
          `;
        }
      }
      if (dbtn) {
        dbtn.classList.remove('game-running');
        const content = dbtn.querySelector('.btn-play-content');
        if (content) {
          content.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Play
          `;
        }
      }
    }
  };

  updatePlayButtons(true);
  
  const startTime = Date.now();
  const MIN_OVERLAY_MS = 12000; // Guaranteed minimum loading overlay screen duration of 12 seconds
  let gameHasStarted = false;

  runningCheckInterval = setInterval(async () => {
    try {
      const res = await fetchJSON(API + '/running/' + appid);
      const elapsed = Date.now() - startTime;
      
      // State 1: Wait for game to be detected as actively RUNNING first
      if (!gameHasStarted) {
        if (res.running) {
          gameHasStarted = true;
        } else {
          // If 40 seconds have passed and we still haven't detected the game running,
          // assume it failed to launch or exited before we noticed.
          if (elapsed > 40000) {
            clearInterval(runningCheckInterval);
            runningCheckInterval = null;
            updatePlayButtons(false);
            hideLaunchOverlay();
            notify('⚠', 'Launch timed out', S.currentGame?.name || 'Game');
          }
          return; // Skip closing checks; we are still waiting for the game process to start!
        }
      }
      
      // State 2: Game has successfully started. Now monitor for when it CLOSES.
      if (!res.running) {
        // Calculate remaining delay to satisfy the 12-second cinematic minimum duration
        const remainingDelay = Math.max(0, MIN_OVERLAY_MS - elapsed);
        
        clearInterval(runningCheckInterval);
        runningCheckInterval = null;
        
        setTimeout(() => {
          updatePlayButtons(false);
          hideLaunchOverlay();
          notify('🕹', 'Game closed', S.currentGame?.name || '');
        }, remainingDelay);
      }
    } catch(e) {
      clearInterval(runningCheckInterval);
      runningCheckInterval = null;
      updatePlayButtons(false);
      hideLaunchOverlay();
    }
  }, 2500); // Check every 2.5 seconds
}

async function launchGame(g) {
  if (S.isLaunching || !g) return;
  Snd.playLaunch();
  S.isLaunching = true; stopPlayRunner(); showLaunchOverlay(g);
  try {
    const r = await fetch(API + '/launch/' + g.appid, { method: 'POST' });
    const d = await r.json();
    if (!d.success) { 
      hideLaunchOverlay(); 
      notify('✕', 'Launch failed', g.name); 
      S.isLaunching = false;
    } 
    else { 
      S.isLaunching = false;
      // Do NOT hide launch overlay here! Keep it active until the game closed.
      startRunningCheck(g.appid);
    }
  } catch { 
    hideLaunchOverlay(); 
    notify('✕', 'Error', 'Backend not reachable'); 
    S.isLaunching = false;
  }
}

function showLaunchOverlay(g) {
  const ov = document.getElementById('launch-overlay'); 
  const bg = document.getElementById('launch-bg'); 
  const logo = document.getElementById('launch-logo');
  const paw = document.querySelector('.launch-paw-container');
  
  if (bg) {
    const bgUrl = g.artwork?.hero || g.artwork?.background || g.artwork?.capsule_small || '';
    bg.style.backgroundImage = bgUrl ? 'url("' + bgUrl + '")' : 'none';
  }
  
  if (logo) {
    if (g.artwork?.logo) {
      logo.src = g.artwork.logo;
      logo.style.display = 'block';
      if (paw) paw.style.display = 'none';
    } else {
      logo.src = '';
      logo.style.display = 'none';
      if (paw) paw.style.display = 'block';
    }
  }
  
  if (ov) {
    ov.classList.add('show');
  }
}

function hideLaunchOverlay() { document.getElementById('launch-overlay').classList.remove('show'); }

function openSearch() {
  Snd.playSelect();
  S.searchOpen = true; S.focus = 'osk'; S.oskRow = 1; S.oskCol = 0; S.oskQuery = '';
  document.getElementById('search-overlay').classList.remove('hidden');
  const gb = document.querySelector('.game-bar-wrapper'); if(gb) gb.classList.add('hidden');
  const hc = document.querySelector('.hero-content'); if(hc) hc.classList.add('hidden');
  const mv = document.querySelector('.media-view'); if(mv) { mv.style.opacity = '0'; mv.style.pointerEvents = 'none'; }
  document.getElementById('search-input-wrap').classList.add('active');
  updateSearchDisplay(); highlightOsk(); updateHints();
}

function closeSearch() {
  Snd.playBack();
  S.searchOpen = false; S.searchResults = []; S.oskQuery = '';
  document.getElementById('search-overlay').classList.add('hidden');
  const gb = document.querySelector('.game-bar-wrapper'); if(gb) gb.classList.remove('hidden');
  const hc = document.querySelector('.hero-content'); if(hc) hc.classList.remove('hidden');
  const mv = document.querySelector('.media-view'); if(mv) { mv.style.opacity = '1'; mv.style.pointerEvents = 'auto'; }
  document.getElementById('search-input-wrap').classList.remove('active');
  document.getElementById('search-display-text').textContent = '';
  document.getElementById('search-clear').classList.add('hidden');
  document.getElementById('search-results').innerHTML = '<div class="search-empty"><div class="search-empty-icon monochrome-icon">🎮</div><p>Start typing to search your library</p></div>';
  if (S.libraryOpen) { S.focus = 'library'; updateLibraryFocus(); } else { S.focus = 'topbar'; S.topIdx = 0; updateTopFocus(); }
  updateHints();
}

function oskType(ch) { Snd.playTick(); S.oskQuery += ch; updateSearchDisplay(); runSearch(); flashDisplay(); }
function oskBackspace() { Snd.playTick(); if (!S.oskQuery.length) return; S.oskQuery = S.oskQuery.slice(0, -1); updateSearchDisplay(); runSearch(); }
function oskClear() { Snd.playTick(); S.oskQuery = ''; updateSearchDisplay(); runSearch(); }
function updateSearchDisplay() { document.getElementById('search-display-text').textContent = S.oskQuery; document.getElementById('search-clear').classList.toggle('hidden', S.oskQuery.length === 0); }
function flashDisplay() { const d = document.querySelector('.search-display'); if (!d) return; d.style.transform = 'scale(1.02)'; setTimeout(() => { d.style.transform = ''; }, 100); }

function runSearch() {
  const q = S.oskQuery.toLowerCase().trim(); const res = document.getElementById('search-results');
  if (!q) { S.searchResults = []; res.innerHTML = '<div class="search-empty"><div class="search-empty-icon monochrome-icon">🎮</div><p>Start typing to search your library</p></div>'; return; }
  S.searchResults = S.games.filter(g => g.name.toLowerCase().includes(q)).slice(0, 40);
  res.innerHTML = '';
  if (!S.searchResults.length) { res.innerHTML = '<div class="search-empty"><p>No results for "' + esc(q) + '"</p></div>'; return; }
  S.searchResults.forEach((g, i) => {
    const item = document.createElement('div'); item.className = 'search-result-item'; item.dataset.idx = i;
    const src = g.artwork?.capsule || g.artwork?.capsule_small || '';
    if (src) {
      const img = document.createElement('img'); img.src = src; img.alt = g.name;
      img.onerror = () => { item.innerHTML = '<div class="sr-fallback">' + g.name[0].toUpperCase() + '</div>'; const n = document.createElement('div'); n.className = 'search-result-name'; n.textContent = g.name; item.appendChild(n); };
      item.appendChild(img);
    } else {
      const fb = document.createElement('div'); fb.className = 'sr-fallback'; fb.textContent = g.name[0].toUpperCase(); item.appendChild(fb);
    }
    const nm = document.createElement('div'); nm.className = 'search-result-name'; nm.textContent = g.name; item.appendChild(nm);
    item.addEventListener('click', () => selectSearchResult(i));
    item.addEventListener('dblclick', () => { closeSearch(); launchGame(g); });
    res.appendChild(item);
  });
}

function selectSearchResult(i) {
  const g = S.searchResults[i]; if (!g) return; closeSearch();
  const idx = S.games.findIndex(x => x.appid === g.appid);
  if (idx >= 0) { clearTopFocus(); undimGameBar(); stopPlayRunner(); S.focus = 'gamebar'; S.gameBarIdx = idx % 24; updateActionFocus(); selectGameBar(S.gameBarIdx); }
}

function highlightOsk() {
  document.querySelectorAll('.osk-key').forEach(k => k.classList.remove('ui-focused'));
  if (S.focus !== 'osk') return;
  const rows = document.querySelectorAll('.osk-row'); if (!rows[S.oskRow]) return;
  const keys = rows[S.oskRow].querySelectorAll('.osk-key'); const col = Math.min(S.oskCol, keys.length - 1);
  if(keys[col]) keys[col].classList.add('ui-focused');
}

function pressOskKey() {
  const rows = document.querySelectorAll('.osk-row'); if (!rows[S.oskRow]) return;
  const keys = rows[S.oskRow].querySelectorAll('.osk-key'); const col = Math.min(S.oskCol, keys.length - 1);
  const key = keys[col]; if (!key) return;
  key.classList.add('pressed'); setTimeout(() => key.classList.remove('pressed'), 140);
  const ch = key.dataset.char; const act = key.dataset.action;
  if (ch !== undefined) oskType(ch);
  else if (act) {
    if (act === 'backspace') oskBackspace(); else if (act === 'clear') oskClear(); else if (idx === 'space') oskType(' '); else if (act === 'results') { if (S.searchResults.length) goToSearchResults(); } else if (act === 'close') closeSearch();
  }
}

function goToSearchResults() { Snd.playSelect(); S.focus = 'search-results'; S.searchResultIdx = 0; updateSearchResultFocus(); document.querySelectorAll('.osk-key').forEach(k => k.classList.remove('ui-focused')); updateHints(); }
function updateSearchResultFocus() { document.querySelectorAll('.search-result-item').forEach((el, i) => el.classList.toggle('ui-focused', i === S.searchResultIdx)); const items = document.querySelectorAll('.search-result-item'); if(items[S.searchResultIdx]) items[S.searchResultIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
function oskRowLen(row) { const rows = document.querySelectorAll('.osk-row'); return rows[row] ? rows[row].querySelectorAll('.osk-key').length : 0; }

function onNav(dir) {
  let changed = false;
  if (S.searchOpen) { navSearch(dir); changed = true; }
  else if (S.detailOpen) { /* No nav in detail panel */ }
  else if (S.libraryOpen) { navLibrary(dir); changed = true; }
  else { navMain(dir); changed = true; }
  
  if (changed) {
    Snd.playTick();
  }
}

function navMain(dir) {
  switch (S.focus) {
    case 'topbar':
      if (dir === 'left') { S.topIdx = Math.max(0, S.topIdx - 1); updateTopFocus(); }
      if (dir === 'right') { S.topIdx = Math.min(2, S.topIdx + 1); updateTopFocus(); }
      if (dir === 'down') { clearTopFocus(); S.focus = 'gamebar'; selectGameBar(S.gameBarIdx); updateHints(); }
      break;
    case 'gamebar':
      if (dir === 'left') selectGameBar(S.gameBarIdx - 1);
      if (dir === 'right') selectGameBar(S.gameBarIdx + 1);
      if (dir === 'up') { S.focus = 'topbar'; document.querySelectorAll('.game-icon-item').forEach(el => el.classList.remove('ui-focused')); updateTopFocus(); updateHints(); }
      if (dir === 'down') { dimGameBar(); S.focus = 'hero-actions'; S.actionIdx = 0; updateActionFocus(); startPlayRunner(); updateHints(); }
      break;
    case 'hero-actions':
      if (dir === 'left') { S.actionIdx = 0; updateActionFocus(); }
      if (dir === 'right') { S.actionIdx = 1; updateActionFocus(); }
      if (dir === 'up') { undimGameBar(); stopPlayRunner(); S.focus = 'gamebar'; updateActionFocus(); selectGameBar(S.gameBarIdx); updateHints(); }
      if (dir === 'down') openLibrary();
      break;
    case 'media': navMedia(dir); break;
    case 'settings':
      if (dir === 'up') S.settingsIdx = Math.max(0, S.settingsIdx - 1);
      if (dir === 'down') S.settingsIdx = Math.min(6, S.settingsIdx + 1);
      if (dir === 'right' && S.settingsIdx === 0) { closeSettings(); return; }
      updateSettingsFocus(); break;
    case 'profile':
      if (dir === 'right') { closeProfile(); return; }
      break;
  }
}

function navLibrary(dir) {
  if (dir === 'left') { S.libIdx = Math.max(0, S.libIdx - 1); updateLibraryFocus(); scrollLibTo(S.libIdx); setCurrentGame(S.games[S.libIdx]); }
  if (dir === 'right') { S.libIdx = Math.min(S.games.length - 1, S.libIdx + 1); updateLibraryFocus(); scrollLibTo(S.libIdx); setCurrentGame(S.games[S.libIdx]); }
  if (dir === 'up') closeLibrary();
}

function navSearch(dir) {
  if (S.focus === 'osk') {
    const ROWS = 4;
    if (dir === 'up') { S.oskRow = Math.max(0, S.oskRow - 1); S.oskCol = Math.min(S.oskCol, oskRowLen(S.oskRow) - 1); }
    if (dir === 'down') { S.oskRow = Math.min(ROWS - 1, S.oskRow + 1); S.oskCol = Math.min(S.oskCol, oskRowLen(S.oskRow) - 1); }
    if (dir === 'left') S.oskCol = Math.max(0, S.oskCol - 1);
    if (dir === 'right') S.oskCol = Math.min(oskRowLen(S.oskRow) - 1, S.oskCol + 1);
    highlightOsk();
  } else if (S.focus === 'search-results') {
    const n = S.searchResults.length; if (!n) return;
    if (dir === 'left') S.searchResultIdx = Math.max(0, S.searchResultIdx - 1);
    if (dir === 'right') S.searchResultIdx = Math.min(n - 1, S.searchResultIdx + 1);
    if (dir === 'up') S.searchResultIdx = Math.max(0, S.searchResultIdx - 6);
    if (dir === 'down') S.searchResultIdx = Math.min(n - 1, S.searchResultIdx + 6);
    updateSearchResultFocus();
  }
}

let mediaIdx = 0;
function navMedia(dir) {
  const cards = document.querySelectorAll('.media-app-card');
  if (!cards.length) return;
  if (dir === 'left') mediaIdx = Math.max(0, mediaIdx - 1);
  if (dir === 'right') mediaIdx = Math.min(cards.length - 1, mediaIdx + 1);
  cards.forEach((c, i) => c.classList.toggle('ui-focused', i === mediaIdx));
  if (cards[mediaIdx]) cards[mediaIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function onConfirm() {
  if (S.searchOpen) {
    if (S.focus === 'osk') pressOskKey();
    else if (S.focus === 'search-results') { const g = S.searchResults[S.searchResultIdx]; if (g) { closeSearch(); launchGame(g); } }
    return;
  }
  if (S.detailOpen) { launchGame(S.currentGame); return; }
  if (S.libraryOpen) { const g = S.games[S.libIdx]; if (g) { closeLibrary(); launchGame(g); } return; }
  switch (S.focus) {
    case 'topbar':
      if (S.topIdx === 0) openSearch(); else if (S.topIdx === 1) openSettings(); else if (S.topIdx === 2) openProfile(); break;
    case 'settings':
      if (S.settingsIdx === 0) closeSettings(); 
      else if (S.settingsIdx === 1) toggleSoundEffects();
      else if (S.settingsIdx === 2) toggleHideSteam(); 
      else if (S.settingsIdx === 3) toggleDs3Fix();
      else if (S.settingsIdx === 4) startCalibration();
      else if (S.settingsIdx === 5) toggleSortMode();
      else if (S.settingsIdx === 6) quitApp();
      break;
    case 'profile':
      if (S.profileIdx === 0) closeProfile(); break;
    case 'gamebar': if (S.currentGame) launchGame(S.currentGame); break;
    case 'hero-actions':
      if (S.actionIdx === 0) launchGame(S.currentGame); else openDetail(S.currentGame); break;
  }
}

function onBack() {
  if (S.searchOpen) {
    if (S.focus === 'search-results') { S.focus = 'osk'; document.querySelectorAll('.search-result-item').forEach(el => el.classList.remove('ui-focused')); highlightOsk(); updateHints(); } 
    else closeSearch();
    return;
  }
  if (S.detailOpen) { closeDetail(); return; }
  if (S.libraryOpen) { closeLibrary(); return; }
  if (S.settingsOpen) { closeSettings(); return; }
  if (S.profileOpen) { closeProfile(); return; }
  if (S.focus === 'hero-actions') { undimGameBar(); stopPlayRunner(); S.focus = 'gamebar'; updateActionFocus(); selectGameBar(S.gameBarIdx); updateHints(); } 
  else if (S.focus === 'topbar') { clearTopFocus(); S.focus = 'gamebar'; selectGameBar(S.gameBarIdx); updateHints(); }
}

/* ─────────────────────────────────────────
   GAMEPAD COMPATIBILITY MAPPINGS
───────────────────────────────────────── */
const STD_BTN = { CROSS:0, CIRCLE:1, SQUARE:2, TRIANGLE:3, L1:4, R1:5, L2:6, R2:7, SELECT:8, START:9, L3:10, R3:11, DUP:12, DDOWN:13, DLEFT:14, DRIGHT:15 };
const RAW_DS3_BTN = { CROSS:2, CIRCLE:1, SQUARE:3, TRIANGLE:0, L1:4, R1:5, L2:6, R2:7, SELECT:8, START:9, L3:10, R3:11, DUP:12, DDOWN:13, DLEFT:14, DRIGHT:15 };
const ALT_DS3_BTN = { CROSS:1, CIRCLE:2, SQUARE:0, TRIANGLE:3, L1:4, R1:5, L2:6, R2:7, SELECT:8, START:9, L3:10, R3:11, DUP:12, DDOWN:13, DLEFT:14, DRIGHT:15 };
const NSW_BTN = { CROSS:1, CIRCLE:0, SQUARE:3, TRIANGLE:2, L1:4, R1:5, L2:6, R2:7, SELECT:8, START:9, L3:10, R3:11, DUP:12, DDOWN:13, DLEFT:14, DRIGHT:15 };
const GENERIC_BTN = { CROSS:1, CIRCLE:2, SQUARE:0, TRIANGLE:3, L1:4, R1:5, L2:6, R2:7, SELECT:8, START:9, L3:10, R3:11, DUP:12, DDOWN:13, DLEFT:14, DRIGHT:15 };
const IPEGA_BTN = { CROSS:0, CIRCLE:1, SQUARE:3, TRIANGLE:4, L1:6, R1:7, L2:8, R2:9, SELECT:10, START:11, L3:13, R3:14, DUP:12, DDOWN:13, DLEFT:14, DRIGHT:15 };

function getBTN(gp) {
  const mode = localStorage.getItem('ds3FixMode') || 'std';
  if (mode === 'custom') {
    try {
      const saved = localStorage.getItem('customGamepadMapping');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
  }
  if (mode === 'type1') return RAW_DS3_BTN;
  if (mode === 'type2') return ALT_DS3_BTN;
  if (mode === 'nsw') return NSW_BTN;
  if (mode === 'generic') return GENERIC_BTN;
  if (mode === 'ipega') return IPEGA_BTN;
  
  // Auto-detection logic for standard brands
  if (gp) {
    const isStandard = gp.mapping === 'standard';
    
    // iPega PG-9023
    if (S.ctrlType === 'ipega') {
      return IPEGA_BTN;
    }

    // Switch Pro controller connected raw has flipped confirmation buttons
    if (S.ctrlType === 'nsw') {
      return NSW_BTN;
    }
    
    // PS3 / DualShock 3 raw (often no standard mapping)
    if (S.ctrlType === 'ds3' && !isStandard) {
      return ALT_DS3_BTN;
    }
    
    // Generic controllers with raw mappings (no standard mapping)
    if (!isStandard) {
      return GENERIC_BTN;
    }
  }
  
  return STD_BTN;
}

let lastAxisDir = null; let axisInterval = null; const AXIS_DEAD = 0.28; const AXIS_RPT = 155;

function initGamepad() {
  const applyDs3Auto = (gp) => { 
    if (!localStorage.getItem('ds3FixMode')) {
      if (S.ctrlType === 'ds3' && gp.mapping !== 'standard') { 
        localStorage.setItem('ds3FixMode', 'type2'); 
        updateDs3Label('type2'); 
      } else if (S.ctrlType === 'nsw') {
        localStorage.setItem('ds3FixMode', 'nsw'); 
        updateDs3Label('nsw');
      } else if (S.ctrlType === 'generic' && gp.mapping !== 'standard') {
        localStorage.setItem('ds3FixMode', 'generic'); 
        updateDs3Label('generic');
      } else if (S.ctrlType === 'ipega') {
        localStorage.setItem('ds3FixMode', 'ipega');
        updateDs3Label('ipega');
      }
    } 
  };
  
  window.addEventListener('gamepadconnected', e => { 
    S.ctrlConnected = true; 
    S.ctrlIndex = e.gamepad.index; 
    S.ctrlType = detectCtrlType(e.gamepad); 
    applyDs3Auto(e.gamepad); 
    notify('🕹', 'Controller Connected', ctrlName(S.ctrlType)); 
    
    if (S.ctrlType === 'generic') {
      setTimeout(() => {
        notify('⚙', 'Generic Gamepad Detected', 'Use Keyboard (Enter/Arrows) to set layout in Settings!');
      }, 3500);
    }
    
    updateHints(); 
    requestAnimationFrame(gpLoop); 
  });
  
  window.addEventListener('gamepaddisconnected', () => { 
    S.ctrlConnected = false; 
    S.ctrlIndex = null; 
    S.ctrlType = 'unknown'; 
    updateHints(); 
    notify('🕹', 'Controller Disconnected', ''); 
  });
  
  for (const gp of (navigator.getGamepads?.() || [])) { 
    if (gp) { 
      S.ctrlConnected = true; 
      S.ctrlIndex = gp.index; 
      S.ctrlType = detectCtrlType(gp); 
      applyDs3Auto(gp); 
      updateHints(); 
      requestAnimationFrame(gpLoop); 
      break; 
    } 
  }
}

function getGP() { return S.ctrlIndex !== null ? (navigator.getGamepads?.()[S.ctrlIndex] || null) : null; }

function gpLoop() {
  if (!S.ctrlConnected) return; // Exit loop only if physically disconnected
  
  try {
    const gp = getGP();
    if (gp) {
      // Ignore all controller navigation and button triggers when a game is launching or currently running!
      if (S.isLaunching || runningCheckInterval !== null) {
        if (axisInterval) {
          clearInterval(axisInterval);
          axisInterval = null;
          lastAxisDir = null;
        }
        // Save current button states so they aren't registered as new presses when the game exits
        gp.buttons.forEach((btn, i) => {
          S.prevBtns[i] = btn.pressed;
        });
        if (S.ctrlConnected) {
          requestAnimationFrame(gpLoop);
        }
        return;
      }

      const BTN = getBTN(gp);
      
      gp.buttons.forEach((btn, i) => { 
        const was = S.prevBtns[i] || false; 
        if (btn.pressed && !was) {
          if (S.calibrating) {
            handleCalibrationPress(i);
          } else {
            onBtn(i, BTN); 
          }
        } 
        S.prevBtns[i] = btn.pressed; 
      });

      if (!S.calibrating) {
        const ax = gp.axes[0] || 0; const ay = gp.axes[1] || 0; let dir = null;
        const dpadPressed = gp.buttons.slice(12, 16).some(b => b && b.pressed);
        if (!dpadPressed) {
          const pov = gp.axes.length > 9 ? gp.axes[9] : 3.3; 
          if (pov > -1.1 && pov <= 1.1) {
            if (pov < -0.7) dir = 'up'; else if (pov > -0.5 && pov < -0.1) dir = 'right'; else if (pov > 0.1 && pov < 0.5) dir = 'down'; else if (pov > 0.5 && pov < 1.0) dir = 'left';
          }
          if (!dir && Math.abs(ax) > Math.abs(ay)) { if (ax > AXIS_DEAD) dir = 'right'; if (ax < -AXIS_DEAD) dir = 'left'; } 
          else if (!dir) { if (ay > AXIS_DEAD) dir = 'down'; if (ay < -AXIS_DEAD) dir = 'up'; }
        }
        if (dir !== lastAxisDir) { 
          clearInterval(axisInterval); 
          lastAxisDir = dir; 
          if (dir) { 
            onNav(dir); 
            axisInterval = setInterval(() => onNav(dir), AXIS_RPT); 
          } 
        }
      }
    }
  } catch (error) {
    console.error("Error in gpLoop:", error);
  }
  
  // ALWAYS reschedule the loop as long as the controller is supposed to be connected
  if (S.ctrlConnected) {
    requestAnimationFrame(gpLoop);
  }
}

/* ─────────────────────────────────────────
   GAMEPAD CALIBRATION HANDLERS
───────────────────────────────────────── */
function startCalibration() {
  Snd.playSelect();
  S.calibrating = true;
  S.calibStep = 0;
  S.calibMapping = {
    CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L1: 4, R1: 5,
    L2: 6, R2: 7, SELECT: 8, START: 9, L3: 10, R3: 11, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15
  };
  document.getElementById('calibration-overlay').classList.remove('hidden');
  updateCalibrationUI();
}

function updateCalibrationUI() {
  const label = S.calibLabels[S.calibStep];
  document.getElementById('calibration-btn-name').textContent = label;
  document.getElementById('calibration-step-text').textContent = `Step ${S.calibStep + 1} of ${S.calibSteps.length}`;
}

function handleCalibrationPress(btnIdx) {
  Snd.playSelect();
  const btnKey = S.calibSteps[S.calibStep];
  S.calibMapping[btnKey] = btnIdx;
  
  S.calibStep++;
  if (S.calibStep >= S.calibSteps.length) {
    // Calibration completed successfully
    localStorage.setItem('customGamepadMapping', JSON.stringify(S.calibMapping));
    localStorage.setItem('ds3FixMode', 'custom');
    updateDs3Label('custom');
    
    S.calibrating = false;
    document.getElementById('calibration-overlay').classList.add('hidden');
    notify('✓', 'Calibration Saved', 'Your controller is now ready!');
  } else {
    updateCalibrationUI();
  }
}

function cancelCalibration() {
  Snd.playBack();
  S.calibrating = false;
  document.getElementById('calibration-overlay').classList.add('hidden');
  notify('✕', 'Calibration Cancelled', '');
}

function detectCtrlType(gp) {
  const id = (gp.id || '').toLowerCase();
  
  // 1. iPega pg-9023 Gamepad
  if (id.includes('9023') || id.includes('ipega') || id.includes('extending game controller') || id.includes('extending')) {
    return 'ipega';
  }

  // 2. Sony DualSense / PS5 Controllers
  if (id.includes('dualsense') || id.includes('054c:0ce6') || id.includes('ps5') || id.includes('edge')) {
    return 'ds5';
  }
  
  // 3. Sony DualShock 4 / PS4 Controllers
  if (id.includes('dualshock 4') || id.includes('054c:09cc') || id.includes('054c:05c4') || id.includes('ps4')) {
    return 'ds4';
  }
  
  // 4. Sony DualShock 3 / PS3 Controllers
  if (id.includes('dualshock 3') || id.includes('sixaxis') || id.includes('054c:0268') || id.includes('ps3')) {
    return 'ds3';
  }
  
  // 5. Nintendo Switch Controllers
  if (id.includes('nintendo') || id.includes('joy-con') || id.includes('057e') || id.includes('switch pro') || id.includes('lic-pro')) {
    return 'nsw';
  }
  
  // 6. Microsoft Xbox Controllers
  if (id.includes('xbox') || id.includes('xinput') || id.includes('045e:') || id.includes('microsoft')) {
    return 'xbox';
  }
  
  // 7. Generic / Other Gamepads
  if (id.includes('generic') || id.includes('gamepad') || id.includes('joystick') || id.includes('controller') || id.includes('wireless')) {
    return 'generic';
  }
  
  return 'unknown';
}

function ctrlName(type) { 
  return { 
    ds5: 'DualSense (PS5)', 
    ds4: 'DualShock 4 (PS4)', 
    ds3: 'DualShock 3 (PS3)', 
    nsw: 'Nintendo Switch', 
    xbox: 'Xbox Controller', 
    ipega: 'iPega PG-9023',
    generic: 'Generic Gamepad' 
  }[type] || 'Gamepad'; 
}

function isPlayStation() { return ['ds3', 'ds4', 'ds5'].includes(S.ctrlType); }

function updateHints() {
  const hr = document.getElementById('hints-right'); hr.innerHTML = ''; const ps = isPlayStation();
  if (S.searchOpen) {
    if (S.focus === 'osk') { addHint(hr, makeFaceBtn('cross', ps), 'Type'); addHint(hr, makeFaceBtn('square', ps), '⌫'); addHint(hr, makeFaceBtn('triangle', ps), 'Results'); addHint(hr, makeFaceBtn('circle', ps), 'Close'); } 
    else { addHint(hr, makeFaceBtn('cross', ps), 'Launch'); addHint(hr, makeFaceBtn('circle', ps), 'Keyboard'); } return;
  }
  if (S.detailOpen) { addHint(hr, makeFaceBtn('cross', ps), 'Play'); addHint(hr, makeFaceBtn('circle', ps), 'Back'); return; }
  if (S.libraryOpen) { 
    addHint(hr, makeFaceBtn('cross', ps), 'Play'); 
    addHint(hr, makeFaceBtn('triangle', ps), 'Details'); 
    addHint(hr, makeFaceBtn('square', ps), 'Search'); 
    addHint(hr, '<span class="shoulder-btn">SELECT</span>', 'Sort');
    addHint(hr, makeFaceBtn('circle', ps), 'Close'); 
    return; 
  }
  if (S.focus === 'topbar') addHint(hr, makeFaceBtn('cross', ps), 'Select'); else { addHint(hr, makeFaceBtn('cross', ps), 'Play'); addHint(hr, makeFaceBtn('triangle', ps), 'Details'); addHint(hr, makeFaceBtn('square', ps), 'Search'); }
  if (S.focus === 'hero-actions' || S.focus === 'topbar') addHint(hr, makeFaceBtn('circle', ps), 'Back');
}

function makeFaceBtn(type, isPS) {
  const map = { cross: { ps:'✕', psc:'face-cross', xb:'A', xbc:'xbox-a' }, circle: { ps:'○', psc:'face-circle', xb:'B', xbc:'xbox-b' }, square: { ps:'□', psc:'face-square', xb:'X', xbc:'xbox-x' }, triangle: { ps:'△', psc:'face-triangle', xb:'Y', xbc:'xbox-y' } };
  const m = map[type]; if (!m) return '';
  return isPS ? '<span class="face-btn ' + m.psc + '">' + m.ps + '</span>' : '<span class="xbox-btn ' + m.xbc + '">' + m.xb + '</span>';
}

function addHint(container, btnHtml, label) { const sp = document.createElement('span'); sp.className = 'hint-item'; sp.innerHTML = btnHtml + ' ' + label; container.appendChild(sp); }

function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Ignore all keyboard input when a game is launching or currently running!
    if (S.isLaunching || runningCheckInterval !== null) return;
    if (S.searchOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); oskBackspace(); return; }
      if (e.key === 'Enter') { e.preventDefault(); pressOskKey(); return; }
      if (e.key === 'Tab') { e.preventDefault(); S.focus = S.focus === 'osk' ? 'search-results' : 'osk'; if (S.focus === 'osk') highlightOsk(); else { S.searchResultIdx = 0; updateSearchResultFocus(); } updateHints(); return; }
      const nm = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}; if (nm[e.key]) { e.preventDefault(); navSearch(nm[e.key]); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { oskType(e.key.toLowerCase()); return; } return;
    }
    if (S.detailOpen) { if (e.key === 'Escape') closeDetail(); if (e.key === 'Enter') launchGame(S.currentGame); return; }
    if (S.libraryOpen) {
      const nm = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up'}; if (nm[e.key]) { e.preventDefault(); navLibrary(nm[e.key]); return; }
      if (e.key === 'Escape' || e.key === 'Backspace') { closeLibrary(); return; }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); toggleSortMode(); return; }
      if (e.key === 'Enter') { const g = S.games[S.libIdx]; if (g) { closeLibrary(); launchGame(g); } return; } return;
    }
    if (S.settingsOpen) {
      if (e.key === 'Escape' || e.key === 'Backspace') { closeSettings(); return; }
      if (e.key === 'Enter') { onConfirm(); return; }
      const nm = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
      if (nm[e.key]) { e.preventDefault(); onNav(nm[e.key]); return; }
      return;
    }
    if (S.profileOpen) {
      if (e.key === 'Escape' || e.key === 'Backspace') { closeProfile(); return; }
      if (e.key === 'Enter') { onConfirm(); return; }
      const nm = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
      if (nm[e.key]) { e.preventDefault(); onNav(nm[e.key]); return; }
      return;
    }
    const nm = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}; if (nm[e.key]) { e.preventDefault(); navMain(nm[e.key]); return; }
    switch (e.key) { case 'Enter': onConfirm(); break; case 'Escape': case 'Backspace': if (e.target === document.body) onBack(); break; case '/': case 'f': case 'F': if (!e.ctrlKey) openSearch(); break; case 'Tab': e.preventDefault(); switchTab(S.activeTab === 'games' ? 'media' : 'games'); break; case 'F5': e.preventDefault(); refreshLibrary(); break; }
  });
}

function onBtn(idx, BTN) {
  if (S.isLaunching || runningCheckInterval !== null) return;

  // 1. If search is open, restrict controls completely
  if (S.searchOpen) {
    if (idx === BTN.CROSS) { if (S.focus === 'osk') pressOskKey(); else if (S.focus === 'search-results') { const g = S.searchResults[S.searchResultIdx]; if (g) { closeSearch(); launchGame(g); } } }
    else if (idx === BTN.CIRCLE) onBack(); 
    else if (idx === BTN.SQUARE) oskBackspace(); 
    else if (idx === BTN.TRIANGLE) { if (S.focus === 'osk' && S.searchResults.length) goToSearchResults(); }
    else if (idx === BTN.L1) { switchTab('games'); closeSearch(); } 
    else if (idx === BTN.R1) { switchTab('media'); closeSearch(); }
    else if (idx === BTN.DUP) onNav('up'); 
    else if (idx === BTN.DDOWN) onNav('down'); 
    else if (idx === BTN.DLEFT) onNav('left'); 
    else if (idx === BTN.DRIGHT) onNav('right');
    return;
  }

  // 2. If detail panel is open, restrict controls
  if (S.detailOpen) { 
    if (idx === BTN.CROSS) launchGame(S.currentGame); 
    if (idx === BTN.CIRCLE) closeDetail(); 
    return; 
  }

  // 3. If library panel is open, restrict controls
  if (S.libraryOpen) {
    if (idx === BTN.CROSS) { const g = S.games[S.libIdx]; if (g) { closeLibrary(); launchGame(g); } }
    else if (idx === BTN.CIRCLE) closeLibrary(); 
    else if (idx === BTN.TRIANGLE) { if (S.currentGame) { closeLibrary(); openDetail(S.currentGame); } }
    else if (idx === BTN.SQUARE) openSearch(); 
    else if (idx === BTN.SELECT) toggleSortMode();
    else if (idx === BTN.L1) { S.libIdx = Math.max(0, S.libIdx - 6); updateLibraryFocus(); scrollLibTo(S.libIdx); setCurrentGame(S.games[S.libIdx]); Snd.playTick(); }
    else if (idx === BTN.R1) { S.libIdx = Math.min(S.games.length - 1, S.libIdx + 6); updateLibraryFocus(); scrollLibTo(S.libIdx); setCurrentGame(S.games[S.libIdx]); Snd.playTick(); }
    else if (idx === BTN.DUP) closeLibrary(); 
    else if (idx === BTN.DLEFT) navLibrary('left'); 
    else if (idx === BTN.DRIGHT) navLibrary('right');
    return;
  }

  // 4. If settings panel is open, restrict controls
  if (S.settingsOpen) {
    if (idx === BTN.CROSS) onConfirm();
    else if (idx === BTN.CIRCLE || idx === BTN.START) closeSettings();
    else if (idx === BTN.DUP) onNav('up');
    else if (idx === BTN.DDOWN) onNav('down');
    else if (idx === BTN.DLEFT) onNav('left');
    else if (idx === BTN.DRIGHT) onNav('right');
    return;
  }

  // 5. If profile panel is open, restrict controls
  if (S.profileOpen) {
    if (idx === BTN.CROSS) onConfirm();
    else if (idx === BTN.CIRCLE) closeProfile();
    else if (idx === BTN.DUP) onNav('up');
    else if (idx === BTN.DDOWN) onNav('down');
    else if (idx === BTN.DLEFT) onNav('left');
    else if (idx === BTN.DRIGHT) onNav('right');
    return;
  }

  // 6. Default main screen controls
  if (idx === BTN.CROSS) onConfirm(); 
  else if (idx === BTN.CIRCLE) onBack(); 
  else if (idx === BTN.SQUARE) openSearch(); 
  else if (idx === BTN.TRIANGLE) { if (S.currentGame) openDetail(S.currentGame); }
  else if (idx === BTN.L1) switchTab('games'); 
  else if (idx === BTN.R1) switchTab('media'); 
  else if (idx === BTN.START) openSettings();
  else if (idx === BTN.DUP) onNav('up'); 
  else if (idx === BTN.DDOWN) onNav('down'); 
  else if (idx === BTN.DLEFT) onNav('left'); 
  else if (idx === BTN.DRIGHT) onNav('right');
}

function initUIEvents() {
  document.getElementById('btn-play').addEventListener('click', () => { if (S.currentGame) launchGame(S.currentGame); });
  document.getElementById('btn-more').addEventListener('click', () => { if (S.currentGame) openDetail(S.currentGame); });
  document.querySelectorAll('.nav-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  document.getElementById('btn-search').addEventListener('click', openSearch);
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('setting-hide-steam').addEventListener('click', toggleHideSteam);
  document.getElementById('setting-ds3-fix').addEventListener('click', toggleDs3Fix);
  
  const s_calib = document.getElementById('setting-calibrate');
  if (s_calib) s_calib.addEventListener('click', startCalibration);
  const c_calib = document.getElementById('btn-cancel-calibration');
  if (c_calib) c_calib.addEventListener('click', cancelCalibration);

  const snd_eff = document.getElementById('setting-sound-effects');
  if (snd_eff) snd_eff.addEventListener('click', toggleSoundEffects);
  const s_mode = document.getElementById('setting-sort-mode');
  if (s_mode) s_mode.addEventListener('click', toggleSortMode);
  const s_quit = document.getElementById('setting-quit');
  if (s_quit) s_quit.addEventListener('click', quitApp);

  document.getElementById('btn-profile').addEventListener('click', openProfile);
  document.getElementById('profile-close').addEventListener('click', closeProfile);
  document.getElementById('search-close').addEventListener('click', closeSearch);
  document.getElementById('search-clear').addEventListener('click', oskClear);
  document.querySelectorAll('.osk-key').forEach(key => {
    key.addEventListener('click', () => {
      const ch = key.dataset.char, act = key.dataset.action;
      if (ch !== undefined) oskType(ch); 
      else if (act) { if (act === 'backspace') oskBackspace(); else if (act === 'clear') oskClear(); else if (idx === 'space') oskType(' '); else if (act === 'results') { if (S.searchResults.length) goToSearchResults(); } else if (act === 'close') closeSearch(); }
    });
  });
  document.getElementById('lib-arrow-left').addEventListener('click', () => document.getElementById('library-scroll').scrollBy({ left: -440, behavior: 'smooth' }));
  document.getElementById('lib-arrow-right').addEventListener('click', () => document.getElementById('library-scroll').scrollBy({ left: 440, behavior: 'smooth' }));
  document.getElementById('library-backdrop').addEventListener('click', closeLibrary);
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-play').addEventListener('click', () => { if (S.currentGame) launchGame(S.currentGame); });
  document.getElementById('detail-store').addEventListener('click', () => { if (S.currentGame) window.open('https://store.steampowered.com/app/' + S.currentGame.appid, '_blank'); });
}

function switchTab(tab) {
  Snd.playSelect();
  S.activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-content-' + tab));
  if (tab === 'media') { S.focus = 'media'; mediaIdx = 0; document.querySelectorAll('.media-app-card').forEach((c, i) => c.classList.toggle('ui-focused', i === 0)); } 
  else { clearTopFocus(); undimGameBar(); stopPlayRunner(); S.focus = 'gamebar'; updateActionFocus(); selectGameBar(S.gameBarIdx); }
  updateHints();
}

function openDetail(g) {
  if (!g) return;
  Snd.playSelect();
  S.detailOpen = true; document.getElementById('detail-panel').classList.remove('hidden');
  document.getElementById('detail-bg').style.backgroundImage = g.artwork?.hero ? 'url("' + g.artwork.hero + '")' : g.artwork?.capsule_small ? 'url("' + g.artwork.capsule_small + '")' : 'none';
  const logo = document.getElementById('detail-logo'); logo.src = g.artwork?.logo || ''; logo.style.display = g.artwork?.logo ? 'block' : 'none';
  document.getElementById('detail-title').textContent = g.name;
  document.getElementById('detail-stats').innerHTML = '<div class="detail-stat"><span class="dsl">App ID</span><span class="dsv">' + g.appid + '</span></div>' +
    (g.size_on_disk ? '<div class="detail-stat"><span class="dsl">Size</span><span class="dsv">' + fmtSize(g.size_on_disk) + '</span></div>' : '') +
    (g.playtime ? '<div class="detail-stat"><span class="dsl">Playtime</span><span class="dsv">' + fmtPlaytime(g.playtime) + '</span></div>' : '') +
    (g.last_played ? '<div class="detail-stat"><span class="dsl">Last Played</span><span class="dsv">' + new Date(g.last_played * 1000).toLocaleDateString() + '</span></div>' : '') +
    '<div class="detail-stat"><span class="dsl">Install Dir</span><span class="dsv" style="font-size:12px">' + (g.install_dir || '—') + '</span></div>';
  updateHints();
}

function closeDetail() { Snd.playBack(); S.detailOpen = false; document.getElementById('detail-panel').classList.add('hidden'); updateHints(); }

function startClock() {
  const el = document.getElementById('clock');
  const up = () => { const n = new Date(); const h = String(n.getHours()).padStart(2, '0'); const m = String(n.getMinutes()).padStart(2, '0'); el.textContent = h + ':' + m; };
  up(); setInterval(up, 15000);
}

let notifTimer = null;
function notify(icon, title, text) {
  const el = document.getElementById('notification');
  const iconEl = document.getElementById('notif-icon');
  iconEl.textContent = icon;
  
  // Make sure notification icon has monochrome style
  iconEl.classList.add('monochrome-icon');
  
  document.getElementById('notification-title').textContent = title;
  document.getElementById('notification-text').textContent = text;
  
  if (notifTimer) clearTimeout(notifTimer);
  el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('show'));
  notifTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 480); }, 3400);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
function fmtSize(b) { if (!b) return '—'; const gb = b / 1073741824; return gb >= 1 ? gb.toFixed(1) + ' GB' : (b / 1048576).toFixed(0) + ' MB'; }
function fmtPlaytime(mins) { if (!mins) return '0 hrs'; const hrs = mins / 60; if (hrs >= 1) return hrs.toFixed(1) + ' hrs'; return mins + ' mins'; }
function os() {}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

document.addEventListener('DOMContentLoaded', boot);
