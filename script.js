/* ============================================================
   DisciplineX v2 — App Script
   10 themes · Confirm delete · Bold UI · No calendar
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════
   THEMES
   ══════════════════════════════════════════════════════════ */
const THEMES = [
  { id:'1',  name:'Void',    colors:['#7c6dfa','#0f0f1a'] },
  { id:'2',  name:'Blue',    colors:['#3b82f6','#0b1628'] },
  { id:'3',  name:'Emerald', colors:['#10b981','#081510'] },
  { id:'4',  name:'Crimson', colors:['#ef4444','#1a0c0c'] },
  { id:'5',  name:'Amber',   colors:['#f59e0b','#1a1000'] },
  { id:'6',  name:'Pink',    colors:['#ec4899','#180c1a'] },
  { id:'7',  name:'Arctic',  colors:['#6366f1','#e4e8f4'] },
  { id:'8',  name:'Slate',   colors:['#38bdf8','#0e1420'] },
  { id:'9',  name:'Forest',  colors:['#84cc16','#0e140e'] },
  { id:'10', name:'Copper',  colors:['#f97316','#160f0a'] },
];

function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id);
  localStorage.setItem('dx_theme', id);
  // sync timer gradient colors
  const theme = THEMES.find(t => t.id === String(id)) || THEMES[0];
  const g1 = document.getElementById('timerGradStop1');
  const g2 = document.getElementById('timerGradStop2');
  if (g1) g1.setAttribute('stop-color', theme.colors[0]);
  if (g2) g2.setAttribute('stop-color', theme.colors[0] + 'aa');
}

function loadTheme() {
  const saved = localStorage.getItem('dx_theme') || '1';
  applyTheme(saved);
  return saved;
}

/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */
const DEFAULT_STATE = {
  goal: null,
  milestones: [],
  dailyLog: {},
  streak: 0,
  lastCompletionDate: null,
  focusDuration: 25,
};

let state = (() => {
  try {
    const raw = localStorage.getItem('dx_state');
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
  } catch { return { ...DEFAULT_STATE }; }
})();

function save() {
  try { localStorage.setItem('dx_state', JSON.stringify(state)); } catch(e) {}
}

/* ══════════════════════════════════════════════════════════
   UTILS
   ══════════════════════════════════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const todayLabel = () => new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
const greeting = () => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; };
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function allTasks() {
  return state.milestones.flatMap(m => m.tasks.map(t => ({ ...t, milestoneId:m.id, milestoneName:m.name })));
}
function completion() {
  const tasks = allTasks();
  const total = tasks.length, done = tasks.filter(t=>t.done).length;
  return { total, done, pct: total ? Math.round(done/total*100) : 0 };
}
function updateStreak() {
  const t = today(), { done, total } = completion();
  state.dailyLog[t] = { completed:done, total };
  if (done>0 && done===total && total>0) {
    if (!state.lastCompletionDate) {
      state.streak = 1;
    } else {
      const diff = (new Date(t) - new Date(state.lastCompletionDate)) / 86400000;
      state.streak = diff===1 ? state.streak+1 : 1;
    }
    state.lastCompletionDate = t;
  }
  save();
}

/* ══════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════ */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ══════════════════════════════════════════════════════════
   CONFIRM DELETE DIALOG
   ══════════════════════════════════════════════════════════ */
let _confirmCb = null;
function confirmDelete(title, text, cb) {
  _confirmCb = cb;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-overlay').classList.add('active');
}
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('active');
  _confirmCb = null;
}

/* ══════════════════════════════════════════════════════════
   FEEDBACK
   ══════════════════════════════════════════════════════════ */
function pulse(x, y) {
  if (navigator.vibrate) navigator.vibrate([12,8,12]);
  const r = document.createElement('div');
  r.className = 'confetti-ring';
  r.style.cssText = `width:40px;height:40px;left:${x-20}px;top:${y-20}px;`;
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 700);
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime+0.1);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.4);
    o.start(); o.stop(ctx.currentTime+0.4);
  } catch(_){}
}

/* ══════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════ */
let currentScreen = 'home';
function navigate(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
  document.querySelector(`[data-nav="${id}"]`).classList.add('active');
  currentScreen = id;
  if (id==='home')    renderHome();
  if (id==='roadmap') renderRoadmap();
  if (id==='stats')   renderStats();
}

/* ══════════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════════ */
function renderHome() {
  document.getElementById('hero-greeting').textContent = greeting();
  document.getElementById('hero-date').textContent = todayLabel();
  document.getElementById('hero-streak').textContent = state.streak;

  const { pct, done, total } = completion();
  document.getElementById('hero-pct').textContent = pct;
  document.getElementById('hero-bar-fill').style.width = pct+'%';
  document.getElementById('completion-chip').textContent = `${done}/${total}`;

  const container = document.getElementById('tasks-list');
  container.innerHTML = '';
  const tasks = allTasks();

  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>No tasks yet.<br>Head to Roadmap to build your plan.</p></div>`;
    return;
  }

  tasks.forEach((task, i) => {
    const el = document.createElement('div');
    el.className = `task-item${task.done?' done':''}`;
    el.style.animationDelay = `${i*35}ms`;
    el.innerHTML = `
      <div class="task-check">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="task-text">${esc(task.text)}</div>
      <div class="task-ms-tag">${esc(task.milestoneName)}</div>
      <button class="task-delete" aria-label="Delete">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1.5 3h9M5 1.5h2M3 3l.5 7.5h5L9 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>`;

    el.querySelector('.task-check').addEventListener('click', e => { e.stopPropagation(); toggleTask(task.milestoneId, task.id, e.clientX, e.clientY); });
    el.querySelector('.task-text').addEventListener('click', e => { toggleTask(task.milestoneId, task.id, e.clientX, e.clientY); });
    el.querySelector('.task-delete').addEventListener('click', e => {
      e.stopPropagation();
      confirmDelete('Delete Task?', `"${task.text}" will be permanently removed.`, () => {
        const ms = state.milestones.find(m => m.id===task.milestoneId);
        if (ms) ms.tasks = ms.tasks.filter(t => t.id!==task.id);
        save(); renderHome(); toast('🗑 Task deleted');
      });
    });
    container.appendChild(el);
  });
}

function toggleTask(msId, tId, x, y) {
  const ms = state.milestones.find(m => m.id===msId); if (!ms) return;
  const task = ms.tasks.find(t => t.id===tId); if (!task) return;
  task.done = !task.done;
  if (task.done) { pulse(x, y); toast('✓ Task completed!'); }
  updateStreak(); save(); renderHome();
}

/* ══════════════════════════════════════════════════════════
   ROADMAP
   ══════════════════════════════════════════════════════════ */
function renderRoadmap() {
  const wrap = document.getElementById('roadmap-content');
  wrap.innerHTML = '';

  if (!state.goal) {
    wrap.innerHTML = `<div class="no-goal-card"><div class="no-goal-icon">🗺️</div><p class="no-goal-text">No goal set yet.<br>Tap the target icon above to create your main goal.</p></div>`;
    appendAddMsBtn(wrap);
    return;
  }

  const { goal } = state;
  const elapsed = Math.floor((Date.now() - new Date(goal.createdAt)) / 86400000);
  const remaining = Math.max(0, goal.durationDays - elapsed);
  const gPct = Math.min(100, Math.round(elapsed/goal.durationDays*100));

  const gc = document.createElement('div');
  gc.className = 'goal-card';
  gc.innerHTML = `
    <div class="goal-label">Main Goal</div>
    <div class="goal-title">${esc(goal.title)}</div>
    <div class="goal-meta"><b>${remaining}</b> days left · ${goal.durationDays} day plan</div>
    <div class="progress-wrap"><div class="progress-bar" style="width:${gPct}%"></div></div>`;
  wrap.appendChild(gc);

  state.milestones.forEach(ms => wrap.appendChild(buildMilestoneCard(ms)));
  appendAddMsBtn(wrap);
}

function appendAddMsBtn(wrap) {
  const btn = document.createElement('button');
  btn.className = 'add-btn';
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add Milestone`;
  btn.addEventListener('click', () => openModal('milestone'));
  wrap.appendChild(btn);
}

function buildMilestoneCard(ms) {
  const done = ms.tasks.filter(t=>t.done).length, total = ms.tasks.length;
  const pct = total ? Math.round(done/total*100) : 0;
  const card = document.createElement('div');
  card.className = 'milestone-card';
  card.innerHTML = `
    <div class="milestone-header">
      <div class="ms-icon">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M1 2.5L5 1L10 2.5L14 1V11L10 12.5L5 11L1 12.5V2.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="ms-info">
        <div class="ms-name">${esc(ms.name)}</div>
        <div class="ms-count">${done}/${total} tasks · ${pct}%</div>
      </div>
      <div class="ms-chevron">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    <div class="ms-body">
      <div class="ms-body-inner" id="ms-body-${ms.id}"></div>
    </div>`;

  card.querySelector('.milestone-header').addEventListener('click', () => card.classList.toggle('open'));

  const body = card.querySelector(`#ms-body-${ms.id}`);

  ms.tasks.forEach(t => {
    const row = document.createElement('div');
    row.className = `ms-task-row${t.done?' done':''}`;
    row.innerHTML = `
      <div class="ms-dot"></div>
      <span class="ms-task-text">${esc(t.text)}</span>
      <button class="ms-task-del" aria-label="Delete task">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M1.5 3h9M5 1.5h2M3 3l.5 7.5h5L9 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>`;
    row.querySelector('.ms-task-del').addEventListener('click', e => {
      e.stopPropagation();
      confirmDelete('Delete Task?', `"${t.text}" will be permanently removed.`, () => {
        ms.tasks = ms.tasks.filter(x => x.id!==t.id);
        save(); renderRoadmap(); renderHome(); toast('🗑 Task deleted');
      });
    });
    body.appendChild(row);
  });

  // Add task btn
  const addTask = document.createElement('button');
  addTask.className = 'add-btn';
  addTask.style.marginTop = '8px';
  addTask.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add Task`;
  addTask.addEventListener('click', e => { e.stopPropagation(); openModal('task', ms.id); });
  body.appendChild(addTask);

  // Delete milestone btn
  const delMs = document.createElement('button');
  delMs.className = 'btn-ghost danger';
  delMs.textContent = 'Delete Milestone';
  delMs.addEventListener('click', e => {
    e.stopPropagation();
    confirmDelete('Delete Milestone?', `"${ms.name}" and all its tasks will be removed.`, () => {
      state.milestones = state.milestones.filter(m => m.id!==ms.id);
      save(); renderRoadmap(); renderHome(); toast('🗑 Milestone deleted');
    });
  });
  body.appendChild(delMs);

  return card;
}

/* ══════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════ */
function renderStats() {
  const { pct, done, total } = completion();
  document.getElementById('stat-pct').textContent    = pct;
  document.getElementById('stat-streak').textContent = state.streak;
  document.getElementById('stat-done').textContent   = done;
  document.getElementById('stat-total').textContent  = total;

  // Theme picker
  renderThemePicker();
}

function renderThemePicker() {
  const grid = document.getElementById('theme-grid');
  if (!grid) return;
  const current = localStorage.getItem('dx_theme') || '1';
  grid.innerHTML = '';
  THEMES.forEach(th => {
    const sw = document.createElement('div');
    sw.className = `theme-swatch${th.id===current?' active':''}`;
    sw.dataset.themeId = th.id;
    sw.innerHTML = `
      <div class="theme-swatch-bg" style="background:${th.colors[1]};flex:1;position:relative;">
        <div style="position:absolute;bottom:4px;right:4px;width:14px;height:14px;border-radius:50%;background:${th.colors[0]};box-shadow:0 0 8px ${th.colors[0]}66;"></div>
      </div>
      <div class="theme-swatch-label">${th.name}</div>`;
    sw.addEventListener('click', () => {
      applyTheme(th.id);
      grid.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.themeId===th.id));
      toast(`🎨 ${th.name} theme`);
    });
    grid.appendChild(sw);
  });
}

/* ══════════════════════════════════════════════════════════
   MODALS
   ══════════════════════════════════════════════════════════ */
function openModal(type, ctx) {
  const overlay = document.getElementById('modal-overlay');
  const body    = document.getElementById('modal-body');
  overlay.classList.add('active');

  if (type === 'goal') {
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">${state.goal?'Edit Goal':'Set Your Main Goal'}</div>
      <div class="form-group">
        <label class="form-label">Goal Title</label>
        <input class="form-input" id="m-goal-title" type="text" placeholder="e.g. Get fit in 90 days" maxlength="80" value="${state.goal?esc(state.goal.title):''}">
      </div>
      <div class="form-group">
        <label class="form-label">Duration (days)</label>
        <input class="form-input" id="m-goal-days" type="number" placeholder="90" min="1" max="3650" value="${state.goal?state.goal.durationDays:''}">
      </div>
      <button class="btn-primary" id="m-save">Save Goal</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;
    setTimeout(() => document.getElementById('m-goal-title')?.focus(), 80);
    document.getElementById('m-save').onclick = () => {
      const title = document.getElementById('m-goal-title').value.trim();
      const days  = parseInt(document.getElementById('m-goal-days').value);
      if (!title || !days || days<1) return toast('Fill all fields');
      state.goal = { title, durationDays:days, createdAt: state.goal?.createdAt || new Date().toISOString() };
      save(); closeModal(); renderRoadmap(); toast('🎯 Goal saved!');
    };
    document.getElementById('m-cancel').onclick = closeModal;
  }

  if (type === 'milestone') {
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Add Milestone</div>
      <div class="form-group">
        <label class="form-label">Milestone Name</label>
        <input class="form-input" id="m-ms-name" type="text" placeholder="e.g. Foundation Phase" maxlength="80">
      </div>
      <button class="btn-primary" id="m-save">Add Milestone</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;
    setTimeout(() => document.getElementById('m-ms-name')?.focus(), 80);
    document.getElementById('m-save').onclick = () => {
      const name = document.getElementById('m-ms-name').value.trim();
      if (!name) return toast('Enter a name');
      state.milestones.push({ id:uid(), name, tasks:[] });
      save(); closeModal(); renderRoadmap(); toast('🏁 Milestone added!');
    };
    document.getElementById('m-cancel').onclick = closeModal;
  }

  if (type === 'task') {
    const ms = state.milestones.find(m => m.id===ctx);
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Add Task to "${esc(ms?.name||'')}"</div>
      <div class="form-group">
        <label class="form-label">Task Description</label>
        <input class="form-input" id="m-task-text" type="text" placeholder="e.g. 20 push-ups" maxlength="120">
      </div>
      <button class="btn-primary" id="m-save">Add Task</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;
    setTimeout(() => document.getElementById('m-task-text')?.focus(), 80);
    document.getElementById('m-save').onclick = () => {
      const text = document.getElementById('m-task-text').value.trim();
      if (!text) return toast('Enter a task');
      if (!ms) return;
      ms.tasks.push({ id:uid(), text, done:false });
      save(); closeModal(); renderRoadmap(); renderHome(); toast('✅ Task added!');
    };
    document.getElementById('m-cancel').onclick = closeModal;
  }

  if (type === 'reset') {
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Reset All Data?</div>
      <p style="color:var(--text-2);font-size:.875rem;margin-bottom:20px;line-height:1.6">This will delete your goal, milestones, tasks and streak. This cannot be undone.</p>
      <button class="btn-danger" id="m-confirm-reset">Yes, Reset Everything</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;
    document.getElementById('m-confirm-reset').onclick = () => {
      state = { ...DEFAULT_STATE };
      save(); closeModal(); navigate('home'); toast('Data cleared.');
    };
    document.getElementById('m-cancel').onclick = closeModal;
  }

  // Enter key submits
  body.addEventListener('keydown', e => { if (e.key==='Enter') { const btn = body.querySelector('#m-save'); if(btn) btn.click(); } });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

/* ══════════════════════════════════════════════════════════
   FOCUS MODE
   ══════════════════════════════════════════════════════════ */
let focusInterval=null, focusRemaining=0, focusTotal=0, focusRunning=false;

function openFocus() {
  const pending = allTasks().filter(t=>!t.done);
  document.getElementById('focus-task-name').textContent = pending[0]?.text || 'No pending tasks';
  document.getElementById('focus-timer-input').value = state.focusDuration;
  focusRemaining = focusTotal = state.focusDuration * 60;
  focusRunning = false;
  updateTimerUI();
  updateRing(1);
  document.getElementById('focus-play-icon').innerHTML = iconPlay();
  document.getElementById('timer-state').textContent = 'READY';
  document.getElementById('focus-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeFocus(force) {
  if (!force && focusRunning && !confirm('Exit focus? Timer will reset.')) return;
  clearInterval(focusInterval);
  focusRunning = false;
  document.getElementById('focus-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

function toggleFocus() {
  if (focusRunning) {
    clearInterval(focusInterval);
    focusRunning = false;
    document.getElementById('focus-play-icon').innerHTML = iconPlay();
    document.getElementById('timer-state').textContent = 'PAUSED';
  } else {
    const mins = Math.max(1, parseInt(document.getElementById('focus-timer-input').value)||25);
    state.focusDuration = mins;
    if (!focusRemaining || focusRemaining===focusTotal) focusRemaining = focusTotal = mins*60;
    focusRunning = true;
    document.getElementById('focus-play-icon').innerHTML = iconPause();
    document.getElementById('timer-state').textContent = 'FOCUS';
    focusInterval = setInterval(tick, 1000);
  }
}

function tick() {
  if (focusRemaining<=0) { clearInterval(focusInterval); focusRunning=false; onTimerDone(); return; }
  focusRemaining--;
  updateTimerUI();
  updateRing(focusRemaining/focusTotal);
}
function updateTimerUI() {
  const m = String(Math.floor(focusRemaining/60)).padStart(2,'0');
  const s = String(focusRemaining%60).padStart(2,'0');
  document.getElementById('timer-display').textContent = `${m}:${s}`;
}
function updateRing(frac) {
  document.getElementById('timer-ring-fill').style.strokeDashoffset = 628*(1-frac);
}
function resetFocus() {
  clearInterval(focusInterval); focusRunning=false;
  const mins = Math.max(1, parseInt(document.getElementById('focus-timer-input').value)||25);
  focusRemaining = focusTotal = mins*60;
  updateTimerUI(); updateRing(1);
  document.getElementById('focus-play-icon').innerHTML = iconPlay();
  document.getElementById('timer-state').textContent = 'READY';
}
function onTimerDone() {
  if (navigator.vibrate) navigator.vibrate([100,50,100,50,200]);
  document.getElementById('timer-state').textContent = 'DONE!';
  document.getElementById('focus-play-icon').innerHTML = iconPlay();
  toast('🔥 Focus session complete!');
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [523,659,784,1047].forEach((f,i) => {
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value=f; o.type='sine';
      const t=ctx.currentTime+i*.18;
      g.gain.setValueAtTime(.18,t); g.gain.exponentialRampToValueAtTime(.001,t+.5);
      o.start(t); o.stop(t+.5);
    });
  } catch(_){}
}

const iconPlay  = () => `<svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><path d="M7 4L18 11L7 18V4Z"/></svg>`;
const iconPause = () => `<svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><rect x="5" y="3" width="4" height="16" rx="1"/><rect x="13" y="3" width="4" height="16" rx="1"/></svg>`;

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // SW
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});

  // Theme
  loadTheme();

  // Nav
  document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));

  // Top bar
  document.getElementById('btn-set-goal').addEventListener('click', () => openModal('goal'));
  document.getElementById('btn-reset').addEventListener('click', () => openModal('reset'));

  // Focus
  document.getElementById('start-focus-btn').addEventListener('click', openFocus);
  document.getElementById('focus-play-btn').addEventListener('click', toggleFocus);
  document.getElementById('focus-reset-btn').addEventListener('click', resetFocus);
  document.getElementById('focus-exit-btn').addEventListener('click', () => closeFocus(false));
  document.getElementById('focus-timer-input').addEventListener('change', e => {
    const v = Math.max(1, Math.min(120, parseInt(e.target.value)||25));
    e.target.value = v;
    state.focusDuration = v;
    if (!focusRunning) { focusRemaining=focusTotal=v*60; updateTimerUI(); updateRing(1); }
  });

  // Modal
  document.getElementById('modal-overlay').addEventListener('click', e => { if(e.target===document.getElementById('modal-overlay')) closeModal(); });

  // Confirm dialog buttons
  document.getElementById('confirm-del-btn').addEventListener('click', () => { if(_confirmCb) _confirmCb(); closeConfirm(); });
  document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirm);

  // Init icon
  document.getElementById('focus-play-icon').innerHTML = iconPlay();

  // Render
  renderHome();
  updateStreak();
});
