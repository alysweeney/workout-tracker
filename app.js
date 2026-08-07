// ---------- Utilities ----------
const STORAGE_KEY = 'workoutTrackerSessions_v1';

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

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Storage ----------
function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load sessions', e);
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function upsertSession(session) {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  saveSessions(sessions);
}

function deleteSession(id) {
  const sessions = loadSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
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

function getExerciseIndex() {
  // { exerciseName: { dayId, dayName, unit, perSide } }
  const idx = {};
  WORKOUT_PLAN.forEach((day) => {
    day.exercises.forEach((ex) => {
      idx[ex.name] = { dayId: day.id, dayName: day.name, unit: ex.unit, perSide: !!ex.perSide, target: `${ex.sets} x ${ex.reps}${ex.perSide ? ' each side' : ''}` };
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
  render();
  registerServiceWorker();
});

document.getElementById('settings-btn').addEventListener('click', openSettingsModal);

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});

// ---------- Render dispatch ----------
function render() {
  const { name, params } = getRoute();
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === (name === 'log' ? 'log' : name));
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
  } else if (name === 'trends') {
    title.textContent = 'Trends';
    app.appendChild(renderTrends(params[0] || null));
  } else {
    title.textContent = 'Workout Tracker';
    app.appendChild(renderLogHome());
  }
}

// ---------- Log Home ----------
function renderLogHome() {
  const wrap = el('<div class="day-list"></div>');
  WORKOUT_PLAN.forEach((day) => {
    const last = getLastSessionForDay(day.id);
    const lastText = last ? `Last logged ${formatDateShort(last.date)}` : 'Not logged yet';
    const card = el(`
      <button class="day-card">
        <div>
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
  return wrap;
}

// ---------- Log Form ----------
function renderLogForm(dayId, sessionId) {
  const day = dayById(dayId);
  if (!day) {
    const back = el('<div class="empty-state">Unknown workout day.</div>');
    return back;
  }

  const wrap = el('<div></div>');
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

    day.exercises.forEach((ex) => {
      const card = el('<div class="card exercise-card"></div>');
      const targetLabel = `${ex.sets} x ${ex.reps} reps${ex.perSide ? ' each side' : ''}${ex.unit === 'bodyweight' ? ' · bodyweight' : ''}`;
      card.appendChild(el(`
        <div class="exercise-header">
          <h3>${ex.name}</h3>
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
          card.appendChild(row);
        }
      }

      formHost.appendChild(card);
    });

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
          if (existing) deleteSession(existing.id);
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
      const reps = repsInput && repsInput.value !== '' ? parseInt(repsInput.value, 10) : null;
      if ((weight !== null && !isNaN(weight)) || (reps !== null && !isNaN(reps))) {
        if (!rawEntries[exName]) rawEntries[exName] = [];
        rawEntries[exName][setIdx] = {
          weight: weight !== null && !isNaN(weight) ? weight : null,
          reps: reps !== null && !isNaN(reps) ? reps : null,
        };
      }
    });

    // Drop exercises that ended up with no actual sets filled in.
    const entries = {};
    Object.keys(rawEntries).forEach((k) => {
      if (rawEntries[k].some((s) => s)) entries[k] = rawEntries[k];
    });

    const hasData = Object.keys(entries).length > 0;
    if (!hasData) {
      showToast('Enter at least one set before saving');
      return;
    }

    const current = findSessionByDayAndDate(dayId, state.date, null) || existing;
    const session = {
      id: current ? current.id : uid(),
      dayId,
      date: state.date,
      entries,
      updatedAt: new Date().toISOString(),
    };
    upsertSession(session);
    showToast('Workout saved');
    navigate('log');
  }

  return wrap;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

// ---------- History ----------
function renderHistoryList() {
  const sessions = getAllSessionsSorted();
  if (sessions.length === 0) {
    return el('<div class="empty-state">No workouts logged yet.<br/>Head to the Log tab to record your first session.</div>');
  }
  const wrap = el('<div class="session-list"></div>');
  sessions.forEach((s) => {
    const day = dayById(s.dayId);
    const exCount = Object.keys(s.entries).length;
    const item = el(`
      <button class="session-item">
        <div>
          <h3>${day ? day.name : 'Workout'}</h3>
          <div class="meta">${formatDate(s.date)} · ${exCount} exercises logged</div>
        </div>
        <div class="chevron">›</div>
      </button>
    `);
    item.addEventListener('click', () => navigate(`log/${s.dayId}/${s.id}`));
    wrap.appendChild(item);
  });
  return wrap;
}

// ---------- Trends ----------
function renderTrends(selectedExercise) {
  const wrap = el('<div></div>');
  const exIndex = getExerciseIndex();
  const exNames = Object.keys(exIndex);

  if (getAllSessionsSorted().length === 0) {
    wrap.appendChild(el('<div class="empty-state">Log a few workouts to start seeing trends here.</div>'));
    return wrap;
  }

  const current = selectedExercise && exIndex[selectedExercise] ? selectedExercise : exNames[0];

  const selectEl = el('<select id="exercise-select"></select>');
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

  const meta = exIndex[current];
  const isBodyweight = meta.unit === 'bodyweight';

  const points = [];
  getAllSessionsSorted()
    .slice()
    .reverse()
    .forEach((s) => {
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

  const chartWrap = el('<div class="chart-wrap"></div>');

  if (points.length === 0) {
    chartWrap.appendChild(el(`<div class="chart-empty">No logged sets yet for ${current}.</div>`));
  } else {
    const metricState = { key: isBodyweight ? 'totalReps' : 'topWeight' };

    if (!isBodyweight) {
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
          svgHost.appendChild(buildChart(points, metricState.key, isBodyweight));
        });
      });
      chartWrap.appendChild(toggle);
    }

    const svgHost = el('<div></div>');
    svgHost.appendChild(buildChart(points, metricState.key, isBodyweight));
    chartWrap.appendChild(svgHost);
  }

  wrap.appendChild(chartWrap);

  if (points.length > 0) {
    const table = el(`
      <table class="trend-table">
        <thead><tr><th>Date</th><th>${isBodyweight ? 'Total reps' : 'Top set'}</th><th>Volume</th></tr></thead>
        <tbody></tbody>
      </table>
    `);
    const tbody = table.querySelector('tbody');
    points
      .slice()
      .reverse()
      .forEach((p) => {
        const topCell = isBodyweight ? `${p.totalReps} reps` : `${p.topWeight} lbs`;
        tbody.appendChild(el(`<tr><td>${formatDateShort(p.date)}</td><td>${topCell}</td><td>${p.volume}</td></tr>`));
      });
    wrap.appendChild(table);
  }

  return wrap;
}

function buildChart(points, metricKey, isBodyweight) {
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
  line.setAttribute('stroke', '#8888a0');
  line.setAttribute('stroke-width', '1');
  line.setAttribute('opacity', '0.3');
  svg.appendChild(line);

  [minV, maxV].forEach((v) => {
    const y = yFor(v);
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', 2);
    text.setAttribute('y', y + 4);
    text.setAttribute('font-size', '9');
    text.setAttribute('fill', '#8888a0');
    text.textContent = Math.round(v);
    svg.appendChild(text);
  });

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', pathD.trim());
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#6d63f0');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  dots.forEach((d, i) => {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', d.x);
    c.setAttribute('cy', d.y);
    c.setAttribute('r', '3.2');
    c.setAttribute('fill', '#6d63f0');
    svg.appendChild(c);

    if (i === 0 || i === dots.length - 1 || dots.length <= 5) {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', d.x);
      label.setAttribute('y', h - padB + 14);
      label.setAttribute('font-size', '8');
      label.setAttribute('fill', '#8888a0');
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
        <h3>Backup & Restore</h3>
        <p>Your data is stored only on this device. Export a backup now and then to avoid losing your history if you clear your browser or switch phones.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="export-btn">Export backup (${sessions.length} sessions)</button>
          <label class="btn btn-secondary" for="import-file" style="text-align:center;">Import backup</label>
          <input type="file" id="import-file" accept="application/json" style="display:none;" />
          <button class="btn btn-danger" id="clear-btn">Delete all data</button>
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
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = Array.isArray(parsed) ? parsed : parsed.sessions;
        if (!Array.isArray(imported)) throw new Error('Invalid file');
        const existing = loadSessions();
        const byId = {};
        existing.forEach((s) => (byId[s.id] = s));
        imported.forEach((s) => (byId[s.id] = s));
        saveSessions(Object.values(byId));
        root.innerHTML = '';
        render();
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
      body: 'This permanently erases every logged workout on this device. Export a backup first if you want to keep it.',
      confirmLabel: 'Delete everything',
      danger: true,
      onConfirm: () => {
        saveSessions([]);
        root.innerHTML = '';
        render();
        showToast('All data deleted');
      },
    });
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
