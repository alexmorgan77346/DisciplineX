/* ============================================================
   DisciplineX — Core App Script
   Pure vanilla JS, localStorage persistence, modular design
   ============================================================ */

'use strict';

/* ── ════════════════════════════════════════════════════════
   STATE MANAGEMENT
   ════════════════════════════════════════════════════════ ── */

const DEFAULT_STATE = {
  goal: null,           // { title, durationDays, createdAt }
  milestones: [],       // [{ id, name, tasks:[{id,text,done}] }]
  dailyLog: {},         // { "YYYY-MM-DD": { completed: n, total: n } }
  streak: 0,
  lastCompletionDate: null,
  focusDuration: 25,    // minutes
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem('disciplinex_state');
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
  } catch { return { ...DEFAULT_STATE }; }
}

function saveState() {
  try { localStorage.setItem('disciplinex_state', JSON.stringify(state)); }
  catch (e) { console.error('Save failed', e); }
}

/* ── ════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════ ── */

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const todayLabel = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
};

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* Get all tasks from all milestones as a flat array */
function allTasks() {
  return state.milestones.flatMap(m => m.tasks.map(t => ({ ...t, milestoneId: m.id, milestoneName: m.name })));
}

/* Count today's completion */
function todayCompletion() {
  const tasks = allTasks();
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* Streak logic — called once on load & after task toggle */
function updateStreak() {
  const t = today();
  const { done, total } = todayCompletion();
  const log = state.dailyLog;

  // Record today
  log[t] = { completed: done, total };

  if (done > 0 && done === total && total > 0) {
    // All tasks done today
    if (state.lastCompletionDate === null) {
      state.streak = 1;
    } else {
      const last = new Date(state.lastCompletionDate);
      const now  = new Date(t);
      const diff = (now - last) / 86400000;
      if (diff === 1) state.streak += 1;
      else if (diff > 1) state.streak = 1;
    }
    state.lastCompletionDate = t;
  }

  saveState();
}

/* Show toast notification */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

/* Haptic + sound feedback on task complete */
function completionFeedback(x, y) {
  // Vibration
  if (navigator.vibrate) navigator.vibrate([15, 10, 15]);

  // Ripple effect
  const ring = document.createElement('div');
  ring.className = 'confetti-ring';
  ring.style.cssText = `width:40px;height:40px;left:${x-20}px;top:${y-20}px;`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 600);

  // Web Audio soft chime
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) { /* audio not available */ }
}

/* ── ════════════════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════════════════ ── */

let currentScreen = 'home';

function navigate(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`screen-${screenId}`).classList.add('active');
  document.querySelector(`[data-nav="${screenId}"]`).classList.add('active');
  currentScreen = screenId;
  renderScreen(screenId);
}

function renderScreen(id) {
  if (id === 'home')    renderHome();
  if (id === 'roadmap') renderRoadmap();
  if (id === 'stats')   renderStats();
}

/* ── ════════════════════════════════════════════════════════
   HOME SCREEN
   ════════════════════════════════════════════════════════ ── */

function renderHome() {
  // Greeting
  document.getElementById('greeting-text').textContent = greetingText();
  document.getElementById('greeting-date').textContent = todayLabel();

  // Streak badge
  const { streak } = state;
  document.getElementById('streak-count').textContent = streak;

  // Completion chip
  const { pct, done, total } = todayCompletion();
  document.getElementById('completion-pct').textContent = `${pct}%`;

  // Tasks list
  const container = document.getElementById('tasks-list');
  const tasks = allTasks();
  container.innerHTML = '';

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <p>No tasks yet.<br>Build your roadmap to get started.</p>
      </div>`;
    return;
  }

  tasks.forEach((task, i) => {
    const item = document.createElement('div');
    item.className = `task-item${task.done ? ' done' : ''}`;
    item.style.animationDelay = `${i * 40}ms`;
    item.innerHTML = `
      <div class="task-check">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="task-text">${escHtml(task.text)}</div>
      <div class="task-meta">${escHtml(task.milestoneName)}</div>
      <button class="task-delete" aria-label="Delete task" data-mid="${task.milestoneId}" data-tid="${task.id}">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>`;

    item.querySelector('.task-check').addEventListener('click', e => {
      e.stopPropagation();
      toggleTask(task.milestoneId, task.id, e.clientX, e.clientY);
    });
    item.querySelector('.task-text').addEventListener('click', e => {
      toggleTask(task.milestoneId, task.id, e.clientX, e.clientY);
    });
    item.querySelector('.task-delete').addEventListener('click', e => {
      e.stopPropagation();
      deleteTask(task.milestoneId, task.id);
    });

    container.appendChild(item);
  });

  // Update progress bar
  document.getElementById('overall-progress').style.width = `${pct}%`;
}

function toggleTask(milestoneId, taskId, x, y) {
  const milestone = state.milestones.find(m => m.id === milestoneId);
  if (!milestone) return;
  const task = milestone.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.done = !task.done;

  if (task.done) {
    completionFeedback(x, y);
    showToast('✓ Task completed!');
  }

  updateStreak();
  saveState();
  renderHome();
}

function deleteTask(milestoneId, taskId) {
  const milestone = state.milestones.find(m => m.id === milestoneId);
  if (!milestone) return;
  milestone.tasks = milestone.tasks.filter(t => t.id !== taskId);
  saveState();
  renderHome();
}

/* ── ════════════════════════════════════════════════════════
   ROADMAP SCREEN
   ════════════════════════════════════════════════════════ ── */

function renderRoadmap() {
  const container = document.getElementById('roadmap-content');
  container.innerHTML = '';

  if (!state.goal) {
    container.innerHTML = `
      <div class="no-goal-card">
        <div class="no-goal-icon">🗺️</div>
        <p class="no-goal-text">No goal set yet.<br>Create your main goal to start building your roadmap.</p>
      </div>`;
    return;
  }

  const { goal, milestones } = state;
  const elapsed = Math.floor((Date.now() - new Date(goal.createdAt)) / 86400000);
  const remaining = Math.max(0, goal.durationDays - elapsed);

  container.innerHTML = `
    <div class="goal-card">
      <div class="section-label">Main Goal</div>
      <div class="goal-title">${escHtml(goal.title)}</div>
      <div class="goal-duration">
        <span>${remaining}</span> days remaining · ${goal.durationDays} day plan
      </div>
      <div class="progress-wrap">
        <div class="progress-bar" style="width:${Math.min(100, Math.round((elapsed/goal.durationDays)*100))}%"></div>
      </div>
    </div>`;

  // Milestones
  if (milestones.length > 0) {
    const msWrap = document.createElement('div');
    msWrap.id = 'milestones-wrap';
    milestones.forEach(ms => msWrap.appendChild(buildMilestoneCard(ms)));
    container.appendChild(msWrap);
  }

  // Add milestone button
  const addMs = document.createElement('button');
  addMs.className = 'add-btn';
  addMs.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    Add Milestone`;
  addMs.addEventListener('click', () => openModal('milestone'));
  container.appendChild(addMs);
}

function buildMilestoneCard(ms) {
  const done  = ms.tasks.filter(t => t.done).length;
  const total = ms.tasks.length;
  const pct   = total ? Math.round((done/total)*100) : 0;

  const card = document.createElement('div');
  card.className = 'milestone-card';
  card.dataset.id = ms.id;

  card.innerHTML = `
    <div class="milestone-header">
      <div class="milestone-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 2L5 1L9 2L13 1V10L9 11L5 10L1 11V2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="milestone-info">
        <div class="milestone-name">${escHtml(ms.name)}</div>
        <div class="milestone-count">${done}/${total} tasks · ${pct}%</div>
      </div>
      <div class="milestone-chevron">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    <div class="milestone-tasks">
      <div class="milestone-tasks-inner">
        ${ms.tasks.map(t => `
          <div class="ms-task${t.done ? ' done' : ''}">
            <div class="ms-task-dot"></div>
            <span>${escHtml(t.text)}</span>
          </div>`).join('')}
        <button class="add-btn" style="margin-top:var(--sp-3)" data-add-task="${ms.id}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Add Task
        </button>
        <button class="btn-ghost" style="color:var(--red);margin-top:0" data-del-milestone="${ms.id}">Delete Milestone</button>
      </div>
    </div>`;

  // Toggle expand
  card.querySelector('.milestone-header').addEventListener('click', () => {
    card.classList.toggle('open');
  });

  // Add task
  card.querySelector(`[data-add-task]`).addEventListener('click', e => {
    e.stopPropagation();
    openModal('task', ms.id);
  });

  // Delete milestone
  card.querySelector(`[data-del-milestone]`).addEventListener('click', e => {
    e.stopPropagation();
    deleteMilestone(ms.id);
  });

  return card;
}

function deleteMilestone(id) {
  state.milestones = state.milestones.filter(m => m.id !== id);
  saveState();
  renderRoadmap();
}

/* ── ════════════════════════════════════════════════════════
   STATS SCREEN
   ════════════════════════════════════════════════════════ ── */

function renderStats() {
  const { total, done, pct } = todayCompletion();
  const tasks = allTasks();
  const totalAll  = tasks.length;
  const doneAll   = tasks.filter(t => t.done).length;

  document.getElementById('stat-pct').textContent    = `${pct}`;
  document.getElementById('stat-done').textContent   = doneAll;
  document.getElementById('stat-total').textContent  = totalAll;
  document.getElementById('stat-streak').textContent = state.streak;

  // Streak calendar (last 28 days)
  const cal = document.getElementById('streak-calendar');
  cal.innerHTML = '';
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const log = state.dailyLog[key];
    const div = document.createElement('div');
    div.className = 'cal-day';
    if (log && log.completed > 0 && log.completed === log.total && log.total > 0) div.classList.add('done');
    if (key === today()) div.classList.add('today');
    div.title = key;
    cal.appendChild(div);
  }
}

/* ── ════════════════════════════════════════════════════════
   MODALS
   ════════════════════════════════════════════════════════ ── */

let activeModalContext = null;

function openModal(type, context) {
  activeModalContext = context || null;
  const overlay = document.getElementById('modal-overlay');
  const body    = document.getElementById('modal-body');
  overlay.classList.add('active');

  if (type === 'goal') {
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">${state.goal ? 'Edit Goal' : 'Set Your Main Goal'}</div>
      <div class="form-group">
        <label class="form-label">Goal Title</label>
        <input class="form-input" id="m-goal-title" type="text" placeholder="e.g. Get fit in 90 days" maxlength="80" value="${state.goal ? escHtml(state.goal.title) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Duration (days)</label>
        <input class="form-input" id="m-goal-days" type="number" placeholder="90" min="1" max="3650" value="${state.goal ? state.goal.durationDays : ''}">
      </div>
      <button class="btn-primary" id="m-save-goal">Save Goal</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;

    setTimeout(() => document.getElementById('m-goal-title').focus(), 100);
    document.getElementById('m-save-goal').addEventListener('click', saveGoal);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
  }

  if (type === 'milestone') {
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Add Milestone</div>
      <div class="form-group">
        <label class="form-label">Milestone Name</label>
        <input class="form-input" id="m-ms-name" type="text" placeholder="e.g. Foundation Phase" maxlength="80">
      </div>
      <button class="btn-primary" id="m-save-ms">Add Milestone</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;

    setTimeout(() => document.getElementById('m-ms-name').focus(), 100);
    document.getElementById('m-save-ms').addEventListener('click', saveMilestone);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
  }

  if (type === 'task') {
    const ms = state.milestones.find(m => m.id === context);
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Add Task to "${escHtml(ms?.name || '')}"</div>
      <div class="form-group">
        <label class="form-label">Task</label>
        <input class="form-input" id="m-task-text" type="text" placeholder="e.g. Complete 20 push-ups" maxlength="120">
      </div>
      <button class="btn-primary" id="m-save-task">Add Task</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;

    setTimeout(() => document.getElementById('m-task-text').focus(), 100);
    document.getElementById('m-save-task').addEventListener('click', () => saveTask(context));
    document.getElementById('m-cancel').addEventListener('click', closeModal);
  }

  if (type === 'reset') {
    body.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Reset All Data?</div>
      <p style="color:var(--text-2);font-size:0.875rem;margin-bottom:var(--sp-5)">This will permanently delete your goal, milestones, tasks, and streak. This cannot be undone.</p>
      <button class="btn-danger" id="m-confirm-reset">Yes, Reset Everything</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>`;

    document.getElementById('m-confirm-reset').addEventListener('click', resetAll);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  activeModalContext = null;
}

function saveGoal() {
  const title = document.getElementById('m-goal-title').value.trim();
  const days  = parseInt(document.getElementById('m-goal-days').value);
  if (!title || !days || days < 1) { showToast('Please fill all fields'); return; }
  state.goal = { title, durationDays: days, createdAt: state.goal?.createdAt || new Date().toISOString() };
  saveState();
  closeModal();
  renderRoadmap();
  showToast('🎯 Goal saved!');
}

function saveMilestone() {
  const name = document.getElementById('m-ms-name').value.trim();
  if (!name) { showToast('Enter a milestone name'); return; }
  state.milestones.push({ id: uid(), name, tasks: [] });
  saveState();
  closeModal();
  renderRoadmap();
  showToast('🏁 Milestone added!');
}

function saveTask(milestoneId) {
  const text = document.getElementById('m-task-text').value.trim();
  if (!text) { showToast('Enter a task description'); return; }
  const ms = state.milestones.find(m => m.id === milestoneId);
  if (!ms) return;
  ms.tasks.push({ id: uid(), text, done: false });
  saveState();
  closeModal();
  renderRoadmap();
  renderHome();
  showToast('✅ Task added!');
}

function resetAll() {
  state = { ...DEFAULT_STATE };
  saveState();
  closeModal();
  navigate('home');
  showToast('Data cleared.');
}

/* ── ════════════════════════════════════════════════════════
   FOCUS MODE
   ════════════════════════════════════════════════════════ ── */

let focusInterval  = null;
let focusRemaining = 0;
let focusTotal     = 0;
let focusRunning   = false;

function openFocusMode() {
  const tasks = allTasks().filter(t => !t.done);
  const currentTask = tasks[0] || null;

  document.getElementById('focus-task-name').textContent = currentTask ? currentTask.text : 'No pending tasks';
  document.getElementById('focus-timer-input').value = state.focusDuration;
  focusRemaining = focusTotal = state.focusDuration * 60;
  focusRunning = false;

  updateTimerDisplay();
  updateTimerRing(1);

  document.getElementById('focus-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeFocusMode(force) {
  if (!force) {
    if (focusRunning) {
      if (!confirm('Exit focus mode? Your timer will be lost.')) return;
    }
  }
  clearInterval(focusInterval);
  focusInterval = null;
  focusRunning  = false;
  document.getElementById('focus-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

function toggleFocusTimer() {
  if (focusRunning) {
    clearInterval(focusInterval);
    focusRunning = false;
    document.getElementById('focus-play-icon').innerHTML = playIcon();
    document.getElementById('timer-state').textContent = 'PAUSED';
  } else {
    const mins = parseInt(document.getElementById('focus-timer-input').value) || 25;
    state.focusDuration = mins;
    if (focusRemaining === 0 || focusRemaining === focusTotal) {
      focusRemaining = focusTotal = mins * 60;
    }
    focusRunning = true;
    document.getElementById('focus-play-icon').innerHTML = pauseIcon();
    document.getElementById('timer-state').textContent = 'FOCUS';
    focusInterval = setInterval(focusTick, 1000);
  }
}

function focusTick() {
  if (focusRemaining <= 0) {
    clearInterval(focusInterval);
    focusRunning = false;
    timerDone();
    return;
  }
  focusRemaining--;
  updateTimerDisplay();
  updateTimerRing(focusRemaining / focusTotal);
}

function updateTimerDisplay() {
  const m = String(Math.floor(focusRemaining / 60)).padStart(2, '0');
  const s = String(focusRemaining % 60).padStart(2, '0');
  document.getElementById('timer-display').textContent = `${m}:${s}`;
}

function updateTimerRing(fraction) {
  const circumference = 628; // 2π × 100
  const offset = circumference * (1 - fraction);
  document.getElementById('timer-ring-fill').style.strokeDashoffset = offset;
}

function focusResetTimer() {
  clearInterval(focusInterval);
  focusRunning = false;
  const mins = parseInt(document.getElementById('focus-timer-input').value) || 25;
  focusRemaining = focusTotal = mins * 60;
  updateTimerDisplay();
  updateTimerRing(1);
  document.getElementById('focus-play-icon').innerHTML = playIcon();
  document.getElementById('timer-state').textContent = 'READY';
}

function timerDone() {
  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
  document.getElementById('timer-state').textContent = 'DONE!';
  document.getElementById('focus-play-icon').innerHTML = playIcon();
  showToast('🔥 Focus session complete!');

  // Chime
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      o.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t); o.stop(t + 0.5);
    });
  } catch (_) {}
}

const playIcon  = () => `<svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><path d="M7 4L18 11L7 18V4Z"/></svg>`;
const pauseIcon = () => `<svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><rect x="5" y="3" width="4" height="16" rx="1"/><rect x="13" y="3" width="4" height="16" rx="1"/></svg>`;

/* ── ════════════════════════════════════════════════════════
   HELPER
   ════════════════════════════════════════════════════════ ── */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── ════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════ ── */

document.addEventListener('DOMContentLoaded', () => {

  /* Register service worker */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  /* Navigation */
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.nav));
  });

  /* Top-bar actions */
  document.getElementById('btn-set-goal').addEventListener('click', () => openModal('goal'));
  document.getElementById('btn-reset').addEventListener('click', () => openModal('reset'));

  /* Focus mode */
  document.getElementById('start-focus-btn').addEventListener('click', openFocusMode);
  document.getElementById('focus-play-btn').addEventListener('click', toggleFocusTimer);
  document.getElementById('focus-reset-btn').addEventListener('click', focusResetTimer);
  document.getElementById('focus-exit-btn').addEventListener('click', () => closeFocusMode(false));

  document.getElementById('focus-timer-input').addEventListener('change', e => {
    const v = Math.max(1, Math.min(120, parseInt(e.target.value) || 25));
    e.target.value = v;
    state.focusDuration = v;
    if (!focusRunning) {
      focusRemaining = focusTotal = v * 60;
      updateTimerDisplay();
      updateTimerRing(1);
    }
  });

  /* Set play icon initially */
  document.getElementById('focus-play-icon').innerHTML = playIcon();

  /* Modal overlay close on backdrop click */
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  /* Initial render */
  renderHome();

  /* Streak check on load */
  updateStreak();
});
