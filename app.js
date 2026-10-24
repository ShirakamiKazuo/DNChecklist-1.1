const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const DN_DEFAULTS = [
  {
    id: 'efm', name: 'Erosion Fission Maze', type: 'weekly', color: '#b5a642', collapsed: false,
    chars: [
      { id: 'c1', name: 'Silver Hunter', done: false },
      { id: 'c2', name: 'Light Fury', done: false },
      { id: 'c3', name: 'Duelist', done: false },
      { id: 'c4', name: 'Moonlord', done: false },
    ]
  },
  {
    id: 'aot', name: 'Ark of Transcendence', type: 'weekly', color: '#9b72cf', collapsed: false,
    chars: [
      { id: 'c1', name: 'Silver Hunter', done: false },
      { id: 'c2', name: 'Light Fury', done: false },
      { id: 'c3', name: 'Duelist', done: false },
      { id: 'c4', name: 'Moonlord', done: false },
    ]
  },
  {
    id: 'bdnl', name: 'Bone Dragon Nest Light', type: 'weekly', color: '#6c8ebf', collapsed: false,
    chars: [
      { id: 'c1', name: 'Silver Hunter', done: false },
      { id: 'c2', name: 'Light Fury', done: false },
    ]
  },
  {
    id: 'bdnh', name: 'Black Dragon Nest Hardcore', type: 'weekly', color: '#ae4132', collapsed: false,
    chars: [
      { id: 'c1', name: 'Silver Hunter', done: false },
    ]
  },
];

function getDNWeeklyResetUTC() {
  const now = Date.now();
  const PH = 8 * 3600000;
  const nowPH = new Date(now + PH);
  const daysSinceSat = (nowPH.getUTCDay() + 1) % 7;
  const satPH = new Date(now + PH);
  satPH.setUTCDate(nowPH.getUTCDate() - daysSinceSat);
  satPH.setUTCHours(9, 0, 0, 0);
  const satUTC = satPH.getTime() - PH;
  return satUTC > now ? satUTC - 7 * 86400000 : satUTC;
}

function getDNDailyResetUTC() {
  const now = Date.now();
  const PH = 8 * 3600000;
  const todayPH = new Date(now + PH);
  todayPH.setUTCHours(9, 0, 0, 0);
  const resetUTC = todayPH.getTime() - PH;
  return resetUTC > now ? resetUTC - 86400000 : resetUTC;
}

function getCustomWeeklyResetUTC(targetDay, timeStr, tz) {
  const now = Date.now();
  const [h, m] = timeStr.split(':').map(Number);
  const nowInTz = new Date(new Date(now).toLocaleString('en-US', { timeZone: tz }));
  const currentDay = nowInTz.getDay();
  const diff = (currentDay - targetDay + 7) % 7;
  const candidate = new Date(now - diff * 86400000);
  const tzCandidate = new Date(candidate.toLocaleString('en-US', { timeZone: tz }));
  tzCandidate.setHours(h, m, 0, 0);
  const utcOffset = candidate.getTime() - new Date(candidate.toLocaleString('en-US', { timeZone: tz })).getTime();
  const resetUTC = tzCandidate.getTime() + utcOffset;
  return resetUTC > now ? resetUTC - 7 * 86400000 : resetUTC;
}

function getCustomDailyResetUTC(timeStr, tz) {
  const now = Date.now();
  const [h, m] = timeStr.split(':').map(Number);
  const todayInTz = new Date(new Date(now).toLocaleString('en-US', { timeZone: tz }));
  todayInTz.setHours(h, m, 0, 0);
  const utcOffset = new Date(now).getTime() - new Date(new Date(now).toLocaleString('en-US', { timeZone: tz })).getTime();
  const resetUTC = todayInTz.getTime() + utcOffset;
  return resetUTC > now ? resetUTC - 86400000 : resetUTC;
}

function loadState() {
  try {
    const saved = localStorage.getItem('adv_tracker_v1');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return {
    dn: {
      sections: JSON.parse(JSON.stringify(DN_DEFAULTS)),
      lastWeeklyReset: getDNWeeklyResetUTC(),
      lastDailyReset: getDNDailyResetUTC(),
    },
    custom: { sections: [] },
    activeTab: 'dn',
  };
}

function saveState() {
  try { localStorage.setItem('adv_tracker_v1', JSON.stringify(state)); } catch(e) {}
}

function checkAndAutoResetDN() {
  const cw = getDNWeeklyResetUTC();
  const cd = getDNDailyResetUTC();
  let changed = false;
  if (!state.dn.lastWeeklyReset || cw > state.dn.lastWeeklyReset) {
    state.dn.sections.forEach(s => { if (s.type === 'weekly') s.chars.forEach(c => c.done = false); });
    state.dn.lastWeeklyReset = cw;
    changed = true;
  }
  if (!state.dn.lastDailyReset || cd > state.dn.lastDailyReset) {
    state.dn.sections.forEach(s => { if (s.type === 'daily') s.chars.forEach(c => c.done = false); });
    state.dn.lastDailyReset = cd;
    changed = true;
  }
  if (changed) saveState();
}

function checkAndAutoResetCustom() {
  let changed = false;
  state.custom.sections.forEach(s => {
    if (s.type === 'counter' || s.type === 'once') return;
    const lastReset = s.type === 'weekly'
      ? getCustomWeeklyResetUTC(s.resetDay, s.resetTime, s.resetTz)
      : getCustomDailyResetUTC(s.resetTime, s.resetTz);
    if (!s.lastReset || lastReset > s.lastReset) {
      s.chars.forEach(c => c.done = false);
      s.lastReset = lastReset;
      changed = true;
    }
  });
  if (changed) saveState();
}

let state = loadState();

const reorderingCards = new Set();

function currentSections() {
  return state[state.activeTab].sections;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function switchTab(tab) {
  state.activeTab = tab;
  reorderingCards.clear();
  saveState();
  document.getElementById('tab-dn').classList.toggle('active', tab === 'dn');
  document.getElementById('tab-custom').classList.toggle('active', tab === 'custom');
  document.getElementById('dn-banner').style.display = tab === 'dn' ? 'flex' : 'none';
  document.getElementById('custom-banner').style.display = tab === 'custom' ? 'flex' : 'none';
  if (tab === 'dn') { checkAndAutoResetDN(); updateResetTimers(); }
  else checkAndAutoResetCustom();
  render();
  initCardDragDrop();
}

function render() {
  const container = document.getElementById('sections-container');
  const sections = currentSections();
  if (!sections.length) {
    container.innerHTML = `<div style="padding:48px 0;text-align:center;color:var(--text-muted);font-size:0.82rem;">No activities yet. Click "+ Add Activity" to get started.</div>`;
    return;
  }
  container.innerHTML = sections.map((sec, si) => renderSection(sec, si)).join('');
  sections.forEach((sec, si) => {
    if (reorderingCards.has(sec.id)) initItemDragDrop(si);
  });
}

function renderSection(sec, si) {
  const total = sec.chars.length;
  const done = sec.chars.filter(c => c.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const isCounter = sec.type === 'counter';
  const isReordering = reorderingCards.has(sec.id);
  const badgeClass = { weekly: 'badge-weekly', daily: 'badge-daily', once: 'badge-once', counter: 'badge-counter' }[sec.type] || 'badge-weekly';
  const badgeLabel = { weekly: 'Weekly', daily: 'Daily', once: 'One-time', counter: 'Counter' }[sec.type];

  let resetTag = '';
  if (state.activeTab === 'custom' && sec.type === 'weekly' && sec.resetDay !== undefined) {
    const tzShort = sec.resetTz.split('/')[1]?.replace('_', ' ') || sec.resetTz;
    resetTag = `<div class="reset-tag">${DAYS[sec.resetDay]} ${sec.resetTime} · ${tzShort}</div>`;
  } else if (state.activeTab === 'custom' && sec.type === 'daily' && sec.resetTime) {
    const tzShort = sec.resetTz.split('/')[1]?.replace('_', ' ') || sec.resetTz;
    resetTag = `<div class="reset-tag">Daily ${sec.resetTime} · ${tzShort}</div>`;
  }

  const progressBar = !isCounter
    ? `<div class="section-progress-bar" style="width:${pct}%;background:${sec.color};opacity:0.7;"></div>`
    : '';

  const toolbar = !isCounter ? `
    <div class="section-toolbar">
      <button class="btn-tool ${isReordering ? 'active' : ''}" onclick="toggleReorder(${si})">
        ${isReordering ? 'Done Reordering' : 'Reorder Items'}
      </button>
    </div>` : '';

  const items = isCounter
    ? sec.chars.map((ch, ci) => renderCounter(sec, si, ch, ci)).join('')
    : sec.chars.map((ch, ci) => renderChar(sec, si, ch, ci, isReordering)).join('');

  return `
  <div class="section-card ${sec.collapsed ? 'collapsed' : ''}" id="sec-${sec.id}" draggable="true" data-sec-id="${sec.id}">
    <div class="section-header" onclick="toggleCollapse(${si})">
      <span class="drag-handle" onmousedown="event.stopPropagation()" title="Drag to reorder">⠿⠿</span>
      <div class="section-dot" style="background:${sec.color}"></div>
      <div class="section-title-wrap">
        <div class="section-title">${esc(sec.name)}</div>
        <div class="section-meta">${isCounter ? sec.chars.reduce((a,c) => a + (c.count||0), 0) + ' total' : `${done} / ${total}`}</div>
        ${resetTag}
      </div>
      <span class="section-badge ${badgeClass}">${badgeLabel}</span>
      <button class="btn-item-action" title="Rename" onclick="event.stopPropagation();renameSection(${si})">✎</button>
      <span class="section-chevron">▼</span>
      ${progressBar}
    </div>
    <div class="section-body">
      ${toolbar}
      <div class="char-grid" id="items-${sec.id}">
        ${items}
      </div>
      <div class="add-char-row">
        <input type="text" class="input-field" id="newchar-${sec.id}"
          placeholder="${isCounter ? 'Item name...' : 'Character name...'}"
          onkeydown="if(event.key==='Enter')addChar(${si})" />
        <button class="btn-add-char" onclick="addChar(${si})">+ Add</button>
      </div>
      <div class="section-footer">
        <button class="btn-footer btn-check-all" onclick="checkAll(${si}, true)">Check All</button>
        <button class="btn-footer btn-uncheck-all" onclick="checkAll(${si}, false)">Uncheck</button>
        <button class="btn-footer btn-del-section" onclick="deleteSection(${si})">Remove</button>
      </div>
    </div>
  </div>`;
}

function renderChar(sec, si, ch, ci, isReordering) {
  return `
  <div class="char-row ${ch.done ? 'done' : ''} ${isReordering ? 'reorder-mode' : ''}"
       ${isReordering ? `draggable="true" data-item-idx="${ci}"` : `onclick="toggleChar(${si},${ci})"`}
       id="item-${sec.id}-${ci}">
    <span class="item-drag-handle" onmousedown="event.stopPropagation()">⠿⠿</span>
    <div class="char-check"><span class="char-check-icon">✓</span></div>
    <span class="char-name">${esc(ch.name)}</span>
    <div class="char-actions">
      <button class="btn-item-action" onclick="event.stopPropagation();renameChar(${si},${ci})" title="Rename">✎</button>
      <button class="btn-item-action danger" onclick="event.stopPropagation();deleteChar(${si},${ci})" title="Remove">✕</button>
    </div>
  </div>`;
}

function renderCounter(sec, si, ch, ci) {
  const val = ch.count || 0;
  return `
  <div class="counter-row" id="item-${sec.id}-${ci}">
    <span class="counter-name">${esc(ch.name)}</span>
    <div class="counter-controls">
      <button class="counter-btn minus" onclick="adjustCount(${si},${ci},-1)">−</button>
      <span class="counter-val ${val === 0 ? 'zero' : ''}">${val}</span>
      <button class="counter-btn plus" onclick="adjustCount(${si},${ci},1)">+</button>
    </div>
    <div class="char-actions">
      <button class="btn-item-action" onclick="renameChar(${si},${ci})" title="Rename">✎</button>
      <button class="btn-item-action danger" onclick="deleteChar(${si},${ci})" title="Remove">✕</button>
    </div>
  </div>`;
}

function toggleReorder(si) {
  const sec = currentSections()[si];
  if (reorderingCards.has(sec.id)) reorderingCards.delete(sec.id);
  else reorderingCards.add(sec.id);
  render();
  initCardDragDrop();
  if (reorderingCards.has(sec.id)) initItemDragDrop(si);
}

function adjustCount(si, ci, delta) {
  const ch = currentSections()[si].chars[ci];
  ch.count = Math.max(0, (ch.count || 0) + delta);
  saveState(); render(); initCardDragDrop();
}

function toggleChar(si, ci) {
  currentSections()[si].chars[ci].done = !currentSections()[si].chars[ci].done;
  saveState(); render(); initCardDragDrop();
}

function toggleCollapse(si) {
  currentSections()[si].collapsed = !currentSections()[si].collapsed;
  saveState(); render(); initCardDragDrop();
}

function renameSection(si) {
  const sec = currentSections()[si];
  const name = prompt('Rename activity:', sec.name);
  if (name && name.trim()) {
    sec.name = name.trim();
    saveState(); render(); initCardDragDrop();
  }
}

function renameChar(si, ci) {
  const ch = currentSections()[si].chars[ci];
  const name = prompt('Rename entry:', ch.name);
  if (name && name.trim()) {
    ch.name = name.trim();
    saveState(); render(); initCardDragDrop();
    const sec = currentSections()[si];
    if (reorderingCards.has(sec.id)) initItemDragDrop(si);
  }
}

function addChar(si) {
  const sec = currentSections()[si];
  const input = document.getElementById(`newchar-${sec.id}`);
  const name = input ? input.value.trim() : '';
  if (!name) return;
  sec.chars.push(sec.type === 'counter'
    ? { id: 'c' + Date.now(), name, count: 0 }
    : { id: 'c' + Date.now(), name, done: false }
  );
  saveState(); render(); initCardDragDrop();
}

function deleteChar(si, ci) {
  if (!confirm('Remove this entry?')) return;
  currentSections()[si].chars.splice(ci, 1);
  saveState(); render(); initCardDragDrop();
}

function checkAll(si, val) {
  currentSections()[si].chars.forEach(c => c.done = val);
  saveState(); render(); initCardDragDrop();
}

function deleteSection(si) {
  const sec = currentSections()[si];
  if (!confirm(`Remove "${sec.name}"?`)) return;
  reorderingCards.delete(sec.id);
  currentSections().splice(si, 1);
  saveState(); render(); initCardDragDrop();
}

function resetAll() {
  if (!confirm('Reset all checkboxes?')) return;
  currentSections().forEach(s => s.chars.forEach(c => c.done = false));
  saveState(); render(); initCardDragDrop();
}

function onTypeChange() {
  const type = document.getElementById('modalSectionType').value;
  const isCustom = state.activeTab === 'custom';
  document.getElementById('custom-reset-fields').style.display = (isCustom && type === 'weekly') ? 'block' : 'none';
  document.getElementById('daily-reset-fields').style.display = (isCustom && type === 'daily') ? 'block' : 'none';
}

function openAddSection() {
  document.getElementById('modalSectionName').value = '';
  document.getElementById('modalSectionType').value = 'weekly';
  onTypeChange();
  document.getElementById('sectionModal').classList.add('open');
  setTimeout(() => document.getElementById('modalSectionName').focus(), 100);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openTutorial() {
  document.getElementById('tutorialModal').classList.add('open');
}

function confirmAddSection() {
  const name = document.getElementById('modalSectionName').value.trim();
  if (!name) { document.getElementById('modalSectionName').focus(); return; }
  const type = document.getElementById('modalSectionType').value;
  const color = document.getElementById('modalSectionColor').value;
  const id = 'sec_' + Date.now();
  const sec = { id, name, type, color, collapsed: false, chars: [] };

  if (state.activeTab === 'custom') {
    if (type === 'weekly') {
      sec.resetDay = parseInt(document.getElementById('modalResetDay').value);
      sec.resetTime = document.getElementById('modalResetTime').value;
      sec.resetTz = document.getElementById('modalResetTz').value;
      sec.lastReset = getCustomWeeklyResetUTC(sec.resetDay, sec.resetTime, sec.resetTz);
    } else if (type === 'daily') {
      sec.resetTime = document.getElementById('modalDailyResetTime').value;
      sec.resetTz = document.getElementById('modalDailyResetTz').value;
      sec.lastReset = getCustomDailyResetUTC(sec.resetTime, sec.resetTz);
    }
  }

  currentSections().push(sec);
  saveState(); render(); initCardDragDrop();
  closeModal('sectionModal');
}

function exportData() {
  const exportObj = {
    version: 1,
    exportedAt: new Date().toISOString(),
    dn: {
      sections: state.dn.sections.map(s => ({
        ...s,
        chars: s.chars.map(c => ({ ...c, done: false }))
      }))
    },
    custom: {
      sections: state.custom.sections.map(s => ({
        ...s,
        chars: s.chars.map(c => ({ ...c, done: false, count: c.count || 0 }))
      }))
    }
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tracker-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.dn || !data.custom) { alert('Invalid config file.'); return; }
      if (!confirm('This will replace your current config. Continue?')) return;
      state.dn.sections = data.dn.sections || [];
      state.custom.sections = data.custom.sections || [];
      state.dn.lastWeeklyReset = getDNWeeklyResetUTC();
      state.dn.lastDailyReset = getDNDailyResetUTC();
      state.custom.sections.forEach(s => {
        if (s.type === 'weekly' && s.resetDay !== undefined)
          s.lastReset = getCustomWeeklyResetUTC(s.resetDay, s.resetTime, s.resetTz);
        else if (s.type === 'daily' && s.resetTime)
          s.lastReset = getCustomDailyResetUTC(s.resetTime, s.resetTz);
      });
      reorderingCards.clear();
      saveState(); render(); initCardDragDrop();
      if (state.activeTab === 'dn') updateResetTimers();
    } catch(err) {
      alert('Failed to read config file. Make sure it\'s a valid tracker export.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function updateResetTimers() {
  const now = new Date();
  const nowPH = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const nextWeek = new Date(now);
  const daysPH = (6 - nowPH.getDay() + 7) % 7 || 7;
  nextWeek.setDate(now.getDate() + daysPH);
  nextWeek.setUTCHours(1, 0, 0, 0);
  if (nextWeek <= now) nextWeek.setDate(nextWeek.getDate() + 7);
  document.getElementById('nextReset').textContent = formatCountdown(nextWeek - now);

  const nextDay = new Date(now);
  nextDay.setUTCHours(1, 0, 0, 0);
  if (nextDay <= now) nextDay.setDate(nextDay.getDate() + 1);
  document.getElementById('nextDaily').textContent = formatCountdown(nextDay - now);
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

let dragSrcCardId = null;

function initCardDragDrop() {
  const container = document.getElementById('sections-container');
  const fresh = container.cloneNode(true);
  container.parentNode.replaceChild(fresh, container);
  const c = document.getElementById('sections-container');

  c.addEventListener('dragstart', e => {
    const card = e.target.closest('.section-card');
    if (!card) return;
    if (e.target.closest('.char-row[draggable]')) return;
    dragSrcCardId = card.dataset.secId;
    setTimeout(() => card.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });

  c.addEventListener('dragend', e => {
    const card = e.target.closest('.section-card');
    if (card) card.classList.remove('dragging');
    c.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
    dragSrcCardId = null;
  });

  c.addEventListener('dragover', e => {
    e.preventDefault();
    const card = e.target.closest('.section-card');
    c.querySelectorAll('.section-card.drag-over').forEach(x => x.classList.remove('drag-over'));
    if (card && card.dataset.secId !== dragSrcCardId && dragSrcCardId) card.classList.add('drag-over');
  });

  c.addEventListener('dragleave', e => {
    const card = e.target.closest('.section-card');
    if (card) card.classList.remove('drag-over');
  });

  c.addEventListener('drop', e => {
    e.preventDefault();
    const targetCard = e.target.closest('.section-card');
    if (!targetCard || !dragSrcCardId) return;
    const targetId = targetCard.dataset.secId;
    if (targetId === dragSrcCardId) return;
    const sections = currentSections();
    const srcIdx = sections.findIndex(s => s.id === dragSrcCardId);
    const tgtIdx = sections.findIndex(s => s.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const [moved] = sections.splice(srcIdx, 1);
    sections.splice(tgtIdx, 0, moved);
    saveState(); render(); initCardDragDrop();
    const sec = sections.find(s => reorderingCards.has(s.id));
    if (sec) initItemDragDrop(sections.indexOf(sec));
  });

  currentSections().forEach((sec, si) => {
    if (reorderingCards.has(sec.id)) initItemDragDrop(si);
  });
}

let dragSrcItemIdx = null;
let dragSrcItemSi = null;

function initItemDragDrop(si) {
  const sec = currentSections()[si];
  const grid = document.getElementById(`items-${sec.id}`);
  if (!grid) return;

  grid.addEventListener('dragstart', e => {
    const row = e.target.closest('.char-row[draggable]');
    if (!row) return;
    dragSrcItemIdx = parseInt(row.dataset.itemIdx);
    dragSrcItemSi = si;
    setTimeout(() => row.classList.add('item-dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  });

  grid.addEventListener('dragend', e => {
    grid.querySelectorAll('.item-dragging').forEach(x => x.classList.remove('item-dragging'));
    grid.querySelectorAll('.item-drag-over').forEach(x => x.classList.remove('item-drag-over'));
    dragSrcItemIdx = null;
    dragSrcItemSi = null;
  });

  grid.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    const row = e.target.closest('.char-row[draggable]');
    grid.querySelectorAll('.item-drag-over').forEach(x => x.classList.remove('item-drag-over'));
    if (row && parseInt(row.dataset.itemIdx) !== dragSrcItemIdx) row.classList.add('item-drag-over');
  });

  grid.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    const row = e.target.closest('.char-row[draggable]');
    if (!row || dragSrcItemIdx === null) return;
    const tgtIdx = parseInt(row.dataset.itemIdx);
    if (tgtIdx === dragSrcItemIdx) return;
    const chars = currentSections()[si].chars;
    const [moved] = chars.splice(dragSrcItemIdx, 1);
    chars.splice(tgtIdx, 0, moved);
    saveState(); render(); initCardDragDrop();
    initItemDragDrop(si);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ['sectionModal', 'tutorialModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) closeModal(id);
    });
  });
});

checkAndAutoResetDN();
checkAndAutoResetCustom();
switchTab(state.activeTab);
updateResetTimers();
setInterval(() => {
  checkAndAutoResetDN();
  checkAndAutoResetCustom();
  render();
  initCardDragDrop();
  if (state.activeTab === 'dn') updateResetTimers();
}, 60000);
