import * as Cloud from './cloud.js';

// ---------- Utilities ----------
const STORAGE_KEY = 'workoutTrackerSessions_v1'; // legacy on-device store, used only for one-time migration

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayById(dayId) {
  return WORKOUT_PLAN.find((d) => d.id === dayId);
}

// Links to a YouTube search rather than a specific video: exact video IDs
// can't be verified from here and would risk linking to something wrong,
// deleted, or unrelated. A search for the exercise name reliably surfaces
// good form tutorials.
function youtubeSearchUrl(exerciseName) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(exerciseName + ' exercise form tutorial');
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Storage (Firestore-backed, live cache kept in sync via onSnapshot) ----------
let currentUser = null;
let sessionsCache = [];
let unsubscribeSessions = null;
let migrationChecked = false;

function loadSessions() {
  // Copy: getAllSessionsSorted() below sorts in place, and callers shouldn't
  // be able to mutate the live cache that onSnapshot keeps refreshing.
  return sessionsCache.slice();
}

async function upsertSession(session) {
  await Cloud.saveSessionCloud(currentUser.uid, session);
}

async function deleteSession(id) {
  await Cloud.deleteSessionCloud(currentUser.uid, id);
}

// One-time offer to pull in any workouts saved locally before cloud sync existed.
async function maybeOfferLocalMigration() {
  if (migrationChecked) return;
  migrationChecked = true;
  if (localStorage.getItem('workoutTrackerMigrationOffered_v1')) return;
  let localSessions = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    localSessions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    localSessions = [];
  }
  localStorage.setItem('workoutTrackerMigrationOffered_v1', 'true');
  if (!Array.isArray(localSessions) || localSessions.length === 0) return;

  confirmModal({
    title: 'Import workouts from this device?',
    body: `Found ${localSessions.length} workout${localSessions.length === 1 ? '' : 's'} saved on this device from before cloud sync. Import them into your account?`,
    confirmLabel: 'Import',
    onConfirm: async () => {
      await Cloud.bulkImportCloud(currentUser.uid, localSessions);
      showToast('Imported local workouts');
    },
  });
}

function findSessionByDayAndDate(dayId, date, excludeId) {
  return loadSessions().find((s) => s.dayId === dayId && s.date === date && s.id !== excludeId);
}

function getLastSessionForDay(dayId, beforeDateExclusiveId) {
  const sessions = loadSessions()
    .filter((s) => s.dayId === dayId && s.id !== beforeDateExclusiveId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return sessions[0] || null;
}

function getMostRecentSessionBefore(dayId, date, excludeId) {
  const sessions = loadSessions()
    .filter((s) => s.dayId === dayId && s.id !== excludeId && s.date <= date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return sessions[0] || null;
}

function getAllSessionsSorted() {
  return loadSessions().sort((a, b) => (a.date < b.date ? 1 : -1));
}

function getSessionsByType(type) {
  return loadSessions()
    .filter((s) => s.type === type)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function findSessionByTypeAndDate(type, date, excludeId) {
  return loadSessions().find((s) => s.type === type && s.date === date && s.id !== excludeId);
}

function getLastSessionByType(type) {
  return getSessionsByType(type)[0] || null;
}

function getExerciseIndex() {
  // { exerciseName: { dayId, dayName, unit, perSide } }
  const idx = {};
  WORKOUT_PLAN.forEach((day) => {
    day.exercises.forEach((ex) => {
      idx[ex.name] = { dayId: day.id, dayName: day.name, dayColor: day.color, unit: ex.unit, perSide: !!ex.perSide, target: `${ex.sets} x ${ex.reps}${ex.perSide ? ' each side' : ''}` };
    });
  });
  return idx;
}

// ---------- Router ----------
function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  return { name: parts[0] || 'log', params: parts.slice(1) };
}

function navigate(path) {
  window.location.hash = path;
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
});

document.getElementById('settings-btn').addEventListener('click', () => {
  if (currentUser) openSettingsModal();
});

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});

Cloud.onAuthChange((user) => {
  currentUser = user;
  if (unsubscribeSessions) {
    unsubscribeSessions();
    unsubscribeSessions = null;
  }
  sessionsCache = [];
  migrationChecked = false;

  if (user) {
    unsubscribeSessions = Cloud.subscribeSessions(
      user.uid,
      (sessions) => {
        sessionsCache = sessions;
        maybeOfferLocalMigration();
        render();
      },
      () => showToast('Could not reach the cloud database')
    );
  }
  render();
});

// ---------- Render dispatch ----------
function render() {
  document.body.classList.toggle('signed-out', !currentUser);

  if (!currentUser) {
    const app = document.getElementById('app');
    const title = document.getElementById('topbar-title');
    title.textContent = 'Workout Tracker';
    app.innerHTML = '';
    app.appendChild(renderAuthGate());
    return;
  }

  const { name, params } = getRoute();
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === (name === 'log' || ACTIVITY_TYPES[name] ? 'log' : name));
  });

  const app = document.getElementById('app');
  const title = document.getElementById('topbar-title');
  app.innerHTML = '';

  if (name === 'log' && params.length === 0) {
    title.textContent = 'Workout Tracker';
    app.appendChild(renderLogHome());
  } else if (name === 'log' && params.length >= 1) {
    const dayId = params[0];
    const sessionId = params[1] || null;
    title.textContent = dayById(dayId) ? dayById(dayId).name : 'Log';
    app.appendChild(renderLogForm(dayId, sessionId));
  } else if (name === 'history' && params.length === 0) {
    title.textContent = 'History';
    app.appendChild(renderHistoryList());
  } else if (ACTIVITY_TYPES[name]) {
    title.textContent = ACTIVITY_TYPES[name].meta.name;
    app.appendChild(renderActivityForm(name, params[0] || null));
  } else if (name === 'trends') {
    title.textContent = 'Trends';
    app.appendChild(renderTrends(params[0] || null));
  } else {
    title.textContent = 'Workout Tracker';
    app.appendChild(renderLogHome());
  }
}

// ---------- Auth Gate ----------
function renderAuthGate() {
  const state = { mode: 'signin' };

  const wrap = el(`
    <div style="max-width:360px; margin: 32px auto 0;">
      <div class="card">
        <h2 id="auth-heading" style="margin-top:0;">Sign in</h2>
        <p style="color:var(--muted); font-size:14px; margin-top:-8px;">Your workouts sync to this account across devices.</p>
        <form id="auth-form">
          <div style="display:flex; flex-direction:column; gap:10px; margin:14px 0;">
            <input type="email" id="auth-email" placeholder="Email" autocomplete="email" required
              style="border:1px solid var(--border); background:var(--bg); color:var(--text); border-radius:8px; padding:11px 12px; font-size:15px; font-family:inherit;" />
            <input type="password" id="auth-password" placeholder="Password" autocomplete="current-password" required minlength="6"
              style="border:1px solid var(--border); background:var(--bg); color:var(--text); border-radius:8px; padding:11px 12px; font-size:15px; font-family:inherit;" />
          </div>
          <div id="auth-error" style="color:var(--danger); font-size:13px; margin-bottom:10px; display:none;"></div>
          <button type="submit" class="btn btn-primary btn-block" id="auth-submit">Sign In</button>
        </form>
        <button type="button" id="auth-toggle" class="btn btn-secondary btn-block" style="margin-top:10px;">New here? Create an account</button>
      </div>
    </div>
  `);

  const heading = wrap.querySelector('#auth-heading');
  const submitBtn = wrap.querySelector('#auth-submit');
  const toggleBtn = wrap.querySelector('#auth-toggle');
  const errorBox = wrap.querySelector('#auth-error');

  function applyMode() {
    const isSignIn = state.mode === 'signin';
    heading.textContent = isSignIn ? 'Sign in' : 'Create your account';
    submitBtn.textContent = isSignIn ? 'Sign In' : 'Create Account';
    toggleBtn.textContent = isSignIn ? "New here? Create an account" : 'Already have an account? Sign in';
    errorBox.style.display = 'none';
  }

  toggleBtn.addEventListener('click', () => {
    state.mode = state.mode === 'signin' ? 'signup' : 'signin';
    applyMode();
  });

  wrap.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = wrap.querySelector('#auth-email').value.trim();
    const password = wrap.querySelector('#auth-password').value;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';
    errorBox.style.display = 'none';
    try {
      if (state.mode === 'signin') {
        await Cloud.signIn(email, password);
      } else {
        await Cloud.signUp(email, password);
      }
      // onAuthChange fires render() once signed in.
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = state.mode === 'signin' ? 'Sign In' : 'Create Account';
      errorBox.textContent = Cloud.authErrorMessage(err);
      errorBox.style.display = 'block';
    }
  });

  applyMode();
  return wrap;
}

// ---------- Log Home ----------
function renderLogHome() {
  const outer = el('<div></div>');
  outer.appendChild(renderStatsCard());

  const wrap = el('<div class="day-list"></div>');
  WORKOUT_PLAN.forEach((day) => {
    const last = getLastSessionForDay(day.id);
    const lastText = last ? `Last logged ${formatDateShort(last.date)}` : 'Not logged yet';
    const card = el(`
      <button class="day-card" style="--day-color:${day.color}">
        <div class="day-icon-badge">${day.icon}</div>
        <div class="day-body">
          <h3>${day.name}</h3>
          <div class="meta">${day.exercises.length} exercises</div>
          <div class="last-logged">${lastText}</div>
        </div>
        <div class="chevron">›</div>
      </button>
    `);
    card.addEventListener('click', () => navigate(`log/${day.id}`));
    wrap.appendChild(card);
  });

  Object.keys(ACTIVITY_TYPES).forEach((type) => {
    const { meta } = ACTIVITY_TYPES[type];
    const last = getLastSessionByType(type);
    const lastText = last
      ? `Last logged ${formatDateShort(last.date)} · ${last.activity} · ${last.minutes} min`
      : `Any day -- log ${meta.name.toLowerCase()} separately from your lifting days`;
    const card = el(`
      <button class="day-card" style="--day-color:${meta.color}">
        <div class="day-icon-badge">${meta.icon}</div>
        <div class="day-body">
          <h3>${meta.name}</h3>
          <div class="last-logged">${lastText}</div>
        </div>
        <div class="chevron">›</div>
      </button>
    `);
    card.addEventListener('click', () => navigate(type));
    wrap.appendChild(card);
  });

  outer.appendChild(wrap);
  return outer;
}

function toDateStr(d) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function computeActivityStats(sessions) {
  const today = new Date();
  const todayS = todayStr();

  const dow = today.getDay(); // 0=Sun..6=Sat
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - mondayOffset);
  const weekStartS = toDateStr(weekStart);

  const monthStartS = todayS.slice(0, 7) + '-01';

  const thisWeek = sessions.filter((s) => s.date >= weekStartS && s.date <= todayS).length;
  const thisMonth = sessions.filter((s) => s.date >= monthStartS && s.date <= todayS).length;

  const loggedDates = new Set(sessions.map((s) => s.date));
  let streak = 0;
  const cursor = new Date(today);
  if (!loggedDates.has(todayS)) cursor.setDate(cursor.getDate() - 1);
  while (loggedDates.has(toDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { thisWeek, thisMonth, streak };
}

function renderStatsCard() {
  const { thisWeek, thisMonth, streak } = computeActivityStats(getAllSessionsSorted());
  return el(`
    <div class="card stats-card">
      <div class="stats-row">
        <div class="stat-tile">
          <div class="stat-value">${thisWeek}</div>
          <div class="stat-label">This week</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">${thisMonth}</div>
          <div class="stat-label">This month</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">${streak > 0 ? '🔥 ' : ''}${streak}</div>
          <div class="stat-label">Day streak</div>
        </div>
      </div>
    </div>
  `);
}

// ---------- Log Form ----------
function renderLogForm(dayId, sessionId) {
  const day = dayById(dayId);
  if (!day) {
    const back = el('<div class="empty-state">Unknown workout day.</div>');
    return back;
  }

  const wrap = el(`<div style="--day-color:${day.color}"></div>`);
  const backRow = el(`<div class="back-row"><button class="back-btn">‹ All days</button></div>`);
  backRow.querySelector('.back-btn').addEventListener('click', () => navigate('log'));
  wrap.appendChild(backRow);

  let existing = sessionId ? loadSessions().find((s) => s.id === sessionId) : null;
  const initialDate = existing ? existing.date : todayStr();

  const state = { date: initialDate, session: existing };

  const dateRow = el(`
    <div class="date-row">
      <input type="date" id="session-date" value="${state.date}" max="${todayStr()}" />
      ${existing ? '<span class="pill">Editing saved workout</span>' : ''}
    </div>
  `);
  wrap.appendChild(dateRow);

  const formHost = el('<div></div>');
  wrap.appendChild(formHost);

  const saveBar = el(`
    <div class="save-bar">
      <button class="btn btn-primary btn-block" id="save-session-btn">Save Workout</button>
      ${existing ? '<button class="btn btn-danger btn-block" id="delete-session-btn" style="margin-top:8px;">Delete this session</button>' : ''}
    </div>
  `);

  function buildForm(date) {
    formHost.innerHTML = '';
    const sessionForDate = findSessionByDayAndDate(dayId, date, null);
    const activeSession = sessionForDate || existing;
    const prevSession = getMostRecentSessionBefore(dayId, date, activeSession ? activeSession.id : null);

    const savedWarmup = (activeSession && activeSession.warmup) || {};
    const warmupCard = el('<div class="card info-card"></div>');
    warmupCard.appendChild(el('<div class="info-card-title">🔥 Warm-up</div>'));
    warmupCard.appendChild(checklistItem(day.warmup.cardio, !!savedWarmup.cardioDone, 'warmup-cardio-done'));
    warmupCard.appendChild(el(`
      <div class="cardio-minutes-row">
        <input type="number" inputmode="numeric" id="warmup-cardio-minutes" placeholder="8–12" value="${savedWarmup.cardioMinutes != null ? savedWarmup.cardioMinutes : ''}" />
        <span>min</span>
      </div>
    `));
    day.warmup.stretches.forEach((label, idx) => {
      const done = !!(savedWarmup.stretches && savedWarmup.stretches[idx]);
      warmupCard.appendChild(checklistItem(label, done, `warmup-stretch-${idx}`));
    });
    formHost.appendChild(warmupCard);

    day.exercises.forEach((ex) => {
      const card = el('<div class="card exercise-card"></div>');
      const targetLabel = `${ex.sets} x ${ex.reps} reps${ex.perSide ? ' each side' : ''}${ex.unit === 'bodyweight' ? ' · bodyweight' : ''}`;
      card.appendChild(el(`
        <div class="exercise-header">
          <h3>${ex.name}</h3>
          <a class="tutorial-link" href="${youtubeSearchUrl(ex.name)}" target="_blank" rel="noopener noreferrer">▶ Watch form</a>
        </div>
      `));
      card.appendChild(el(`<div class="exercise-target" style="margin-bottom:10px;">${targetLabel}</div>`));

      const savedEntry = activeSession && activeSession.entries[ex.name] ? activeSession.entries[ex.name] : null;
      const prevEntry = prevSession && prevSession.entries[ex.name] ? prevSession.entries[ex.name] : null;

      for (let i = 0; i < ex.sets; i++) {
        const savedSet = savedEntry && savedEntry[i] ? savedEntry[i] : null;
        const prevSet = prevEntry && prevEntry[i] ? prevEntry[i] : null;

        if (ex.unit === 'bodyweight') {
          const row = el(`
            <div class="set-row bodyweight" data-exercise="${escapeAttr(ex.name)}" data-set="${i}">
              <div class="set-label">Set ${i + 1}</div>
              <div class="input-wrap">
                <input type="number" inputmode="numeric" class="reps-input" placeholder="${prevSet ? prevSet.reps : ex.reps}" value="${savedSet ? savedSet.reps : ''}" />
                <span>reps</span>
              </div>
            </div>
          `);
          card.appendChild(row);
        } else {
          const row = el(`
            <div class="set-row" data-exercise="${escapeAttr(ex.name)}" data-set="${i}">
              <div class="set-label">Set ${i + 1}</div>
              <div class="input-wrap">
                <input type="number" inputmode="decimal" step="0.5" class="weight-input" placeholder="${prevSet ? prevSet.weight + ' lbs' : 'lbs'}" value="${savedSet ? savedSet.weight : ''}" />
                <span>lbs</span>
              </div>
              <div class="input-wrap">
                <input type="number" inputmode="numeric" class="reps-input" placeholder="${prevSet ? prevSet.reps : ex.reps}" value="${savedSet ? savedSet.reps : ''}" />
                <span>reps</span>
              </div>
            </div>
          `);
          const weightInputEl = row.querySelector('.weight-input');
          const repsInputEl = row.querySelector('.reps-input');
          // Once weight is entered and focus leaves the row (not just moving
          // into the reps box to type a real value), commit the shown
          // placeholder reps as the actual value so it's visibly confirmed
          // rather than an implication that only shows up after saving.
          weightInputEl.addEventListener('blur', () => {
            if (weightInputEl.value === '' || isNaN(parseFloat(weightInputEl.value))) return;
            setTimeout(() => {
              if (document.activeElement === repsInputEl) return;
              if (repsInputEl.value === '') {
                const placeholderReps = parseInt(repsInputEl.placeholder, 10);
                if (!isNaN(placeholderReps)) repsInputEl.value = placeholderReps;
              }
            }, 0);
          });
          repsInputEl.addEventListener('focus', () => repsInputEl.select());
          card.appendChild(row);
        }
      }

      formHost.appendChild(card);
    });

    const savedCooldown = (activeSession && activeSession.cooldown) || {};
    const cooldownCard = el('<div class="card info-card"></div>');
    cooldownCard.appendChild(el('<div class="info-card-title">🧘 Cool-down</div>'));
    cooldownCard.appendChild(el(`<div class="exercise-target" style="margin:-4px 0 10px;">~5 min · targets ${day.cooldown.target}</div>`));
    day.cooldown.stretches.forEach((label, idx) => {
      const done = !!(savedCooldown.stretches && savedCooldown.stretches[idx]);
      cooldownCard.appendChild(checklistItem(label, done, `cooldown-stretch-${idx}`));
    });
    formHost.appendChild(cooldownCard);

    formHost.appendChild(saveBar);
  }

  buildForm(state.date);

  dateRow.querySelector('#session-date').addEventListener('change', (e) => {
    state.date = e.target.value;
    existing = findSessionByDayAndDate(dayId, state.date, null);
    buildForm(state.date);
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.id === 'save-session-btn') {
      saveCurrentForm();
    } else if (e.target.id === 'delete-session-btn') {
      confirmModal({
        title: 'Delete this workout?',
        body: 'This removes the logged weights and reps for this session. This can\'t be undone.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: () => {
          // Don't await: Firestore applies this to the local cache instantly and
          // syncs in the background, so the UI shouldn't block waiting on the network.
          if (existing) deleteSession(existing.id).catch(() => showToast('Could not delete -- will retry when back online'));
          navigate('history');
          showToast('Session deleted');
        },
      });
    }
  });

  function saveCurrentForm() {
    const rawEntries = {};
    formHost.querySelectorAll('.set-row').forEach((row) => {
      const exName = row.dataset.exercise;
      const setIdx = Number(row.dataset.set);
      const weightInput = row.querySelector('.weight-input');
      const repsInput = row.querySelector('.reps-input');
      const weight = weightInput ? parseFloat(weightInput.value) : null;
      let reps = repsInput && repsInput.value !== '' ? parseInt(repsInput.value, 10) : null;
      // Weight entered but reps left blank: assume the shown target/previous
      // rep count (that's what the grey placeholder implies) rather than
      // silently dropping reps. Only for weighted rows -- a bodyweight row's
      // reps field is its only signal that the set was touched at all, so it
      // still requires an explicit value.
      if (weightInput && !isNaN(weight) && (reps === null || isNaN(reps)) && repsInput) {
        const placeholderReps = parseInt(repsInput.placeholder, 10);
        if (!isNaN(placeholderReps)) reps = placeholderReps;
      }
      if ((weight !== null && !isNaN(weight)) || (reps !== null && !isNaN(reps))) {
        if (!rawEntries[exName]) rawEntries[exName] = [];
        rawEntries[exName][setIdx] = {
          weight: weight !== null && !isNaN(weight) ? weight : null,
          reps: reps !== null && !isNaN(reps) ? reps : null,
        };
      }
    });

    // Drop exercises with no sets filled in, and densify sparse arrays (e.g. only
    // set 3 filled in) into explicit nulls -- Firestore rejects `undefined` values,
    // and a hole reads back as undefined outside of hole-skipping array methods.
    const entries = {};
    Object.keys(rawEntries).forEach((k) => {
      const sparse = rawEntries[k];
      if (sparse.some((s) => s)) {
        const dense = [];
        for (let i = 0; i < sparse.length; i++) dense.push(sparse[i] || null);
        entries[k] = dense;
      }
    });

    const hasData = Object.keys(entries).length > 0;
    if (!hasData) {
      showToast('Enter at least one set before saving');
      return;
    }

    const cardioDoneEl = formHost.querySelector('#warmup-cardio-done');
    const cardioMinutesEl = formHost.querySelector('#warmup-cardio-minutes');
    const cardioMinutesRaw = cardioMinutesEl ? cardioMinutesEl.value : '';
    const stretches = {};
    day.warmup.stretches.forEach((_, idx) => {
      const cb = formHost.querySelector(`#warmup-stretch-${idx}`);
      stretches[idx] = cb ? cb.checked : false;
    });
    const cooldownStretches = {};
    day.cooldown.stretches.forEach((_, idx) => {
      const cb = formHost.querySelector(`#cooldown-stretch-${idx}`);
      cooldownStretches[idx] = cb ? cb.checked : false;
    });

    const current = findSessionByDayAndDate(dayId, state.date, null) || existing;
    const session = {
      id: current ? current.id : uid(),
      dayId,
      date: state.date,
      entries,
      warmup: {
        cardioDone: cardioDoneEl ? cardioDoneEl.checked : false,
        cardioMinutes: cardioMinutesRaw !== '' ? parseInt(cardioMinutesRaw, 10) : null,
        stretches,
      },
      cooldown: { stretches: cooldownStretches },
      updatedAt: new Date().toISOString(),
    };
    // Don't await: Firestore applies this to the local cache instantly and
    // syncs in the background, so the UI shouldn't block waiting on the network.
    upsertSession(session).catch(() => showToast('Could not save -- will retry when back online'));
    showToast('Workout saved');
    navigate('log');
  }

  return wrap;
}

// ---------- Cardio Form ----------
function renderActivityForm(type, sessionId) {
  const { meta, options, optionLabel, saveLabel } = ACTIVITY_TYPES[type];
  const wrap = el(`<div style="--day-color:${meta.color}"></div>`);
  const backRow = el(`<div class="back-row"><button class="back-btn">‹ All days</button></div>`);
  backRow.querySelector('.back-btn').addEventListener('click', () => navigate('log'));
  wrap.appendChild(backRow);

  let existing = sessionId ? loadSessions().find((s) => s.id === sessionId) : null;
  if (!existing && !sessionId) {
    // No explicit session requested -- if today already has an entry of this type, edit that instead of creating a duplicate.
    existing = findSessionByTypeAndDate(type, todayStr(), null);
  }
  const initialDate = existing ? existing.date : todayStr();
  const state = { date: initialDate };

  const dateRow = el(`
    <div class="date-row">
      <input type="date" id="session-date" value="${state.date}" max="${todayStr()}" />
      ${existing ? `<span class="pill">Editing saved ${meta.name.toLowerCase()}</span>` : ''}
    </div>
  `);
  wrap.appendChild(dateRow);

  const formHost = el('<div></div>');
  wrap.appendChild(formHost);

  const saveBar = el(`
    <div class="save-bar">
      <button class="btn btn-primary btn-block" id="save-activity-btn">${saveLabel}</button>
      ${existing ? '<button class="btn btn-danger btn-block" id="delete-activity-btn" style="margin-top:8px;">Delete this session</button>' : ''}
    </div>
  `);

  function buildForm(date) {
    formHost.innerHTML = '';
    const activeSession = findSessionByTypeAndDate(type, date, null) || existing;
    const prevSession = getSessionsByType(type).find((s) => s.date <= date && s.id !== (activeSession ? activeSession.id : null));

    const card = el('<div class="card"></div>');

    const activityField = el(`<div class="field-group"><label>${optionLabel}</label></div>`);
    const activitySelect = el('<select id="activity-option"></select>');
    options.forEach((opt) => {
      const optEl = el(`<option value="${escapeAttr(opt)}">${opt}</option>`);
      if (activeSession ? activeSession.activity === opt : opt === options[0]) optEl.selected = true;
      activitySelect.appendChild(optEl);
    });
    activitySelect.style.marginBottom = '0';
    activityField.appendChild(activitySelect);
    card.appendChild(activityField);

    const minutesField = el(`
      <div class="field-group">
        <label>Duration</label>
        <input type="number" inputmode="numeric" id="activity-minutes" placeholder="${prevSession ? prevSession.minutes + ' min' : 'e.g. 10'}" value="${activeSession ? activeSession.minutes : ''}" />
      </div>
    `);
    card.appendChild(minutesField);

    const notesField = el(`
      <div class="field-group" style="margin-bottom:0;">
        <label>Notes (optional)</label>
        <input type="text" id="activity-notes" placeholder="${type === 'class' ? 'studio, instructor...' : 'incline, speed, distance...'}" value="${activeSession && activeSession.notes ? escapeAttr(activeSession.notes) : ''}" />
      </div>
    `);
    card.appendChild(notesField);

    formHost.appendChild(card);
    formHost.appendChild(saveBar);
  }

  buildForm(state.date);

  dateRow.querySelector('#session-date').addEventListener('change', (e) => {
    state.date = e.target.value;
    existing = findSessionByTypeAndDate(type, state.date, null);
    buildForm(state.date);
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.id === 'save-activity-btn') {
      saveActivity();
    } else if (e.target.id === 'delete-activity-btn') {
      confirmModal({
        title: `Delete this ${meta.name.toLowerCase()} session?`,
        body: "This removes the logged activity and duration. This can't be undone.",
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: () => {
          if (existing) deleteSession(existing.id).catch(() => showToast('Could not delete -- will retry when back online'));
          navigate('history');
          showToast('Session deleted');
        },
      });
    }
  });

  function saveActivity() {
    const activity = formHost.querySelector('#activity-option').value;
    const minutesRaw = formHost.querySelector('#activity-minutes').value;
    const notes = formHost.querySelector('#activity-notes').value.trim();
    const minutes = minutesRaw !== '' ? parseInt(minutesRaw, 10) : null;

    if (minutes === null || isNaN(minutes)) {
      showToast('Enter a duration before saving');
      return;
    }

    const current = findSessionByTypeAndDate(type, state.date, null) || existing;
    const session = {
      id: current ? current.id : uid(),
      type,
      date: state.date,
      activity,
      minutes,
      notes: notes || null,
      updatedAt: new Date().toISOString(),
    };
    upsertSession(session).catch(() => showToast('Could not save -- will retry when back online'));
    showToast(`${meta.name} saved`);
    navigate('log');
  }

  return wrap;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

function checklistItem(label, checked, inputId) {
  const row = el(`
    <label class="checklist-item${checked ? ' done' : ''}">
      <input type="checkbox" id="${inputId}" ${checked ? 'checked' : ''} />
      <span class="checklist-label">${label}</span>
    </label>
  `);
  const checkbox = row.querySelector('input');
  checkbox.addEventListener('change', () => row.classList.toggle('done', checkbox.checked));
  return row;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- History ----------
// Swipe-left-to-reveal-delete for a row, using pointer events so it works
// for both touch and mouse. Only one row stays open at a time.
let openSwipeRowCloser = null;
const SWIPE_REVEAL_PX = 84;

function setupSwipeRow(itemEl, { onTap, onDelete }) {
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let dx = 0;
  let dragging = false;
  let axis = null; // 'h' | 'v' | null
  let isOpen = false;

  function apply(x, animate) {
    itemEl.style.transition = animate ? 'transform 0.2s ease' : 'none';
    itemEl.style.transform = x ? `translateX(${x}px)` : '';
  }
  function close(animate = true) {
    apply(0, animate);
    isOpen = false;
    if (openSwipeRowCloser === close) openSwipeRowCloser = null;
  }
  function open(animate = true) {
    if (openSwipeRowCloser && openSwipeRowCloser !== close) openSwipeRowCloser();
    apply(-SWIPE_REVEAL_PX, animate);
    isOpen = true;
    openSwipeRowCloser = close;
  }

  itemEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    baseX = isOpen ? -SWIPE_REVEAL_PX : 0;
    dragging = false;
    axis = null;
    itemEl.setPointerCapture(e.pointerId);
  });

  itemEl.addEventListener('pointermove', (e) => {
    const mdx = e.clientX - startX;
    const mdy = e.clientY - startY;
    if (axis === null) {
      if (Math.abs(mdx) < 6 && Math.abs(mdy) < 6) return;
      axis = Math.abs(mdx) > Math.abs(mdy) ? 'h' : 'v';
    }
    if (axis === 'v') return;
    dragging = true;
    dx = Math.max(-SWIPE_REVEAL_PX, Math.min(0, baseX + mdx));
    apply(dx, false);
  });

  itemEl.addEventListener('pointerup', () => {
    if (axis === 'h' && dragging) {
      if (dx < -SWIPE_REVEAL_PX / 2) open();
      else close();
    } else if (axis !== 'v') {
      // Minimal movement -- treat as a tap.
      if (isOpen) close();
      else onTap();
    }
    dragging = false;
    axis = null;
  });

  itemEl.addEventListener('pointercancel', () => {
    close();
    dragging = false;
    axis = null;
  });

  onDelete();
}

function renderHistoryList() {
  openSwipeRowCloser = null;
  const sessions = getAllSessionsSorted();
  if (sessions.length === 0) {
    return el('<div class="empty-state"><span class="empty-icon">📅</span>No workouts logged yet.<br/>Head to the Log tab to record your first session.</div>');
  }
  const wrap = el('<div class="session-list"></div>');
  sessions.forEach((s) => {
    const activityType = ACTIVITY_TYPES[s.type];
    const day = activityType ? null : dayById(s.dayId);
    const color = activityType ? activityType.meta.color : day ? day.color : null;
    const icon = activityType ? activityType.meta.icon : day ? day.icon : '🏋️';
    const title = activityType ? activityType.meta.name : day ? day.name : 'Workout';
    const meta = activityType
      ? `${formatDate(s.date)} · ${s.activity} · ${s.minutes} min`
      : `${formatDate(s.date)} · ${Object.keys(s.entries || {}).length} exercises logged`;

    const row = el('<div class="session-row"></div>');
    row.appendChild(el(`
      <div class="session-delete-action"><button type="button" class="session-delete-btn">🗑️ Delete</button></div>
    `));
    const item = el(`
      <button class="session-item"${color ? ` style="--day-color:${color}"` : ''}>
        <div class="day-icon-badge">${icon}</div>
        <div class="session-body">
          <h3>${title}</h3>
          <div class="meta">${meta}</div>
        </div>
        <div class="chevron">›</div>
      </button>
    `);
    row.appendChild(item);

    setupSwipeRow(item, {
      onTap: () => navigate(activityType ? `${s.type}/${s.id}` : `log/${s.dayId}/${s.id}`),
      onDelete: () => {
        row.querySelector('.session-delete-btn').addEventListener('click', () => {
          confirmModal({
            title: 'Delete this workout?',
            body: "This removes the logged session. This can't be undone.",
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: () => {
              deleteSession(s.id).catch(() => showToast('Could not delete -- will retry when back online'));
              showToast('Session deleted');
            },
          });
        });
      },
    });

    wrap.appendChild(row);
  });
  return wrap;
}

// ---------- Trends ----------
function activityTrendKey(type) {
  return `__${type}__`;
}

function trendKeyToActivityType(key) {
  const m = /^__(.+)__$/.exec(key || '');
  return m && ACTIVITY_TYPES[m[1]] ? m[1] : null;
}

function renderTrends(selectedExercise) {
  const wrap = el('<div></div>');
  const exIndex = getExerciseIndex();
  const exNames = Object.keys(exIndex);

  if (getAllSessionsSorted().length === 0) {
    wrap.appendChild(el('<div class="empty-state"><span class="empty-icon">📈</span>Log a few workouts to start seeing trends here.</div>'));
    return wrap;
  }

  const current = selectedExercise && (trendKeyToActivityType(selectedExercise) || exIndex[selectedExercise]) ? selectedExercise : exNames[0];
  const activityType = trendKeyToActivityType(current);
  const isActivity = !!activityType;

  const selectEl = el('<select id="exercise-select"></select>');
  Object.keys(ACTIVITY_TYPES).forEach((type) => {
    const { meta } = ACTIVITY_TYPES[type];
    const key = activityTrendKey(type);
    const group = el(`<optgroup label="${meta.name}"></optgroup>`);
    const opt = el(`<option value="${key}">Total ${meta.name.toLowerCase()} minutes</option>`);
    if (current === key) opt.selected = true;
    group.appendChild(opt);
    selectEl.appendChild(group);
  });
  WORKOUT_PLAN.forEach((day) => {
    const group = el(`<optgroup label="${day.name}"></optgroup>`);
    day.exercises.forEach((ex) => {
      const opt = el(`<option value="${escapeAttr(ex.name)}">${ex.name}</option>`);
      if (ex.name === current) opt.selected = true;
      group.appendChild(opt);
    });
    selectEl.appendChild(group);
  });
  selectEl.addEventListener('change', (e) => navigate(`trends/${encodeURIComponent(e.target.value)}`));
  wrap.appendChild(selectEl);

  const meta = isActivity ? { dayColor: ACTIVITY_TYPES[activityType].meta.color } : exIndex[current];
  const isBodyweight = !isActivity && meta.unit === 'bodyweight';

  const points = [];
  if (isActivity) {
    getSessionsByType(activityType)
      .slice()
      .reverse()
      .forEach((s) => {
        points.push({ date: s.date, topWeight: null, totalReps: s.minutes, volume: s.minutes });
      });
  } else {
    getAllSessionsSorted()
      .slice()
      .reverse()
      .forEach((s) => {
        if (ACTIVITY_TYPES[s.type]) return;
        const entry = s.entries[current];
        if (!entry) return;
        const validSets = entry.filter(Boolean);
        if (validSets.length === 0) return;
        if (isBodyweight) {
          const totalReps = validSets.reduce((sum, st) => sum + (st.reps || 0), 0);
          points.push({ date: s.date, topWeight: null, totalReps, volume: totalReps });
        } else {
          const topWeight = Math.max(...validSets.map((st) => st.weight || 0));
          const volume = validSets.reduce((sum, st) => sum + (st.weight || 0) * (st.reps || 0), 0);
          points.push({ date: s.date, topWeight, volume });
        }
      });
  }

  const chartWrap = el('<div class="chart-wrap"></div>');

  if (points.length === 0) {
    chartWrap.appendChild(el(`<div class="chart-empty">No logged sets yet for ${isActivity ? ACTIVITY_TYPES[activityType].meta.name.toLowerCase() : current}.</div>`));
  } else {
    const metricState = { key: isActivity || isBodyweight ? 'totalReps' : 'topWeight' };

    if (!isActivity && !isBodyweight) {
      const toggle = el(`
        <div class="metric-toggle">
          <button data-key="topWeight" class="active">Top set weight</button>
          <button data-key="volume">Total volume</button>
        </div>
      `);
      toggle.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          metricState.key = btn.dataset.key;
          toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
          svgHost.innerHTML = '';
          svgHost.appendChild(buildChart(points, metricState.key, isBodyweight, meta.dayColor));
        });
      });
      chartWrap.appendChild(toggle);
    }

    const svgHost = el('<div></div>');
    svgHost.appendChild(buildChart(points, metricState.key, isBodyweight, meta.dayColor));
    chartWrap.appendChild(svgHost);
  }

  wrap.appendChild(chartWrap);

  if (points.length > 0) {
    const columnLabel = isActivity ? 'Minutes' : isBodyweight ? 'Total reps' : 'Top set';
    const volumeLabel = isActivity ? '' : '<th>Volume</th>';
    const table = el(`
      <table class="trend-table">
        <thead><tr><th>Date</th><th>${columnLabel}</th>${volumeLabel}</tr></thead>
        <tbody></tbody>
      </table>
    `);
    const tbody = table.querySelector('tbody');
    points
      .slice()
      .reverse()
      .forEach((p) => {
        const topCell = isActivity ? `${p.totalReps} min` : isBodyweight ? `${p.totalReps} reps` : `${p.topWeight} lbs`;
        const volumeCell = isActivity ? '' : `<td>${p.volume}</td>`;
        tbody.appendChild(el(`<tr><td>${formatDateShort(p.date)}</td><td>${topCell}</td>${volumeCell}</tr>`));
      });
    wrap.appendChild(table);
  }

  return wrap;
}

function buildChart(points, metricKey, isBodyweight, color) {
  const lineColor = color || '#c1622c';
  const w = 300;
  const h = 160;
  const padL = 34;
  const padR = 10;
  const padT = 14;
  const padB = 24;

  const values = points.map((p) => (metricKey === 'topWeight' ? p.topWeight : metricKey === 'totalReps' ? p.totalReps : p.volume));
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const n = points.length;
  const xFor = (i) => padL + (n === 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (n - 1));
  const yFor = (v) => padT + (h - padT - padB) * (1 - (v - minV) / range);

  let pathD = '';
  const dots = [];
  points.forEach((p, i) => {
    const v = metricKey === 'topWeight' ? p.topWeight : metricKey === 'totalReps' ? p.totalReps : p.volume;
    const x = xFor(i);
    const y = yFor(v);
    pathD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    dots.push({ x, y, v, date: p.date });
  });

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('style', 'display:block; max-width:100%;');

  const axisColor = 'var(--border)';
  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('x1', padL);
  line.setAttribute('x2', w - padR);
  line.setAttribute('y1', h - padB);
  line.setAttribute('y2', h - padB);
  line.setAttribute('stroke', '#9c8776');
  line.setAttribute('stroke-width', '1');
  line.setAttribute('opacity', '0.3');
  svg.appendChild(line);

  [minV, maxV].forEach((v) => {
    const y = yFor(v);
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', 2);
    text.setAttribute('y', y + 4);
    text.setAttribute('font-size', '9');
    text.setAttribute('fill', '#9c8776');
    text.textContent = Math.round(v);
    svg.appendChild(text);
  });

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', pathD.trim());
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', lineColor);
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  dots.forEach((d, i) => {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', d.x);
    c.setAttribute('cy', d.y);
    c.setAttribute('r', '3.2');
    c.setAttribute('fill', lineColor);
    svg.appendChild(c);

    if (i === 0 || i === dots.length - 1 || dots.length <= 5) {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', d.x);
      label.setAttribute('y', h - padB + 14);
      label.setAttribute('font-size', '8');
      label.setAttribute('fill', '#9c8776');
      label.setAttribute('text-anchor', i === 0 ? 'start' : i === dots.length - 1 ? 'end' : 'middle');
      label.textContent = formatDateShort(d.date);
      svg.appendChild(label);
    }
  });

  return svg;
}

// ---------- Modals & Toast ----------
function confirmModal({ title, body, confirmLabel, danger, onConfirm }) {
  const root = document.getElementById('modal-root');
  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal-sheet">
        <h3>${title}</h3>
        <p>${body}</p>
        <div class="modal-actions">
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmLabel}</button>
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) root.innerHTML = '';
  });
  backdrop.querySelector('#modal-cancel').addEventListener('click', () => (root.innerHTML = ''));
  backdrop.querySelector('#modal-confirm').addEventListener('click', () => {
    root.innerHTML = '';
    onConfirm();
  });
  root.innerHTML = '';
  root.appendChild(backdrop);
}

function showToast(msg) {
  const t = el(`<div class="toast">${msg}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

function openSettingsModal() {
  const root = document.getElementById('modal-root');
  const sessions = getAllSessionsSorted();
  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal-sheet">
        <h3>Account & Backup</h3>
        <p>Signed in as ${escapeHtml(currentUser.email || '')}. Your workouts sync automatically across any device you sign into.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="export-btn">Export backup (${sessions.length} sessions)</button>
          <label class="btn btn-secondary" for="import-file" style="text-align:center;">Import backup</label>
          <input type="file" id="import-file" accept="application/json" style="display:none;" />
          <button class="btn btn-danger" id="clear-btn">Delete all data</button>
          <button class="btn btn-secondary" id="signout-btn">Sign out</button>
          <button class="btn btn-secondary" id="modal-close">Close</button>
        </div>
      </div>
    </div>
  `);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) root.innerHTML = '';
  });
  backdrop.querySelector('#modal-close').addEventListener('click', () => (root.innerHTML = ''));

  backdrop.querySelector('#export-btn').addEventListener('click', () => {
    const data = JSON.stringify({ exportedAt: new Date().toISOString(), sessions }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  backdrop.querySelector('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = Array.isArray(parsed) ? parsed : parsed.sessions;
        if (!Array.isArray(imported) || imported.some((s) => !s || !s.id)) throw new Error('Invalid file');
        await Cloud.bulkImportCloud(currentUser.uid, imported);
        root.innerHTML = '';
        showToast(`Imported ${imported.length} sessions`);
      } catch (err) {
        showToast('Could not read that file');
      }
    };
    reader.readAsText(file);
  });

  backdrop.querySelector('#clear-btn').addEventListener('click', () => {
    confirmModal({
      title: 'Delete all data?',
      body: 'This permanently erases every logged workout in your account, on every device. Export a backup first if you want to keep it.',
      confirmLabel: 'Delete everything',
      danger: true,
      onConfirm: async () => {
        await Cloud.bulkDeleteCloud(currentUser.uid, sessions);
        root.innerHTML = '';
        showToast('All data deleted');
      },
    });
  });

  backdrop.querySelector('#signout-btn').addEventListener('click', () => {
    root.innerHTML = '';
    Cloud.signOutUser();
  });

  root.innerHTML = '';
  root.appendChild(backdrop);
}

// ---------- Service worker ----------
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}
