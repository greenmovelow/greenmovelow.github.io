/* Division 26 Takeoff Workbench - UI controller (vanilla JS, no build step) */
import * as E from './engine.js';
import * as C from './claude.js';

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const DB_NAME = 'takeoff-workbench';
const STORE = 'projects';
const SETTINGS_KEY = 'takeoff.settings';
const NOTIFIED_KEY = 'takeoff.notified';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAll() { const db = await openDB(); return new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
async function dbPut(p) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(p); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function dbDel(id) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }

function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } }
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let projects = [];
let current = null;
let result = null;
let view = 'dashboard';
let takeoffTab = 'all';
let settings = loadSettings();
let claudeAbort = null;
let saveTimer = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const fmtDate = (d) => d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const fmtQty = (i) => i.qty === null || i.qty === undefined || i.qty === '' ? 'TBD' : String(i.qty);

function newProject(name) {
  return { id: uid(), name, created: new Date().toISOString(), updated: new Date().toISOString(), docs: [], answers: {}, overrides: { items: {} }, manualItems: [], manualRfis: [], rfiStatus: {}, removedRfis: {}, claude: null };
}

function scheduleSave() {
  if (!current) return;
  current.updated = new Date().toISOString();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => dbPut(current).catch((e) => console.error('save failed', e)), 250);
}

/* ------------------------------------------------------------------ */
/* Analysis + overrides                                                */
/* ------------------------------------------------------------------ */

function recompute() {
  if (!current) { result = null; return; }
  result = E.analyzeProject(current.docs, current.answers);
  // Apply overrides to rule items.
  const ov = current.overrides.items || {};
  result.takeoff.items = result.takeoff.items.filter((i) => !(ov[i.id] && ov[i.id].removed)).map((i) => {
    const o = ov[i.id];
    if (!o) return i;
    return { ...i, qty: o.qty !== undefined ? o.qty : i.qty, unit: o.unit || i.unit, bucket: o.bucket || i.bucket, item: o.item || i.item, overridden: true };
  });
  // Manual items.
  for (const m of current.manualItems) result.takeoff.items.push({ ...m, source: 'manual', evidence: m.evidence || [], qualifications: m.qualifications || [], rfis: m.rfis || [], tags: m.tags || [], category: m.category || 'Manual', confidence: m.confidence || 'Confirmed' });
  // Accepted Claude items and RFIs.
  if (current.claude && current.claude.adapted) {
    const acc = current.claude.accepted || { items: {}, rfis: {} };
    for (const it of current.claude.adapted.items) if (acc.items[it.id]) { const o = ov[it.id] || {}; if (!o.removed) result.takeoff.items.push({ ...it, qty: o.qty !== undefined ? o.qty : it.qty, unit: o.unit || it.unit, bucket: o.bucket || it.bucket }); }
    let n = result.takeoff.rfis.length + current.manualRfis.length + 1;
    for (const r of current.claude.adapted.rfis) if (acc.rfis[r.id]) result.takeoff.rfis.push({ ...r, id: `RFI-${String(n++).padStart(2, '0')}`, sourceId: r.id });
  }
  for (const m of current.manualRfis) result.takeoff.rfis.push({ ...m, source: 'manual' });
  result.takeoff.rfis = result.takeoff.rfis.filter((r) => !current.removedRfis[r.sourceId || r.id]);
  const order = { critical: 0, qualify: 1, coordinate: 2, compliance: 3 };
  result.takeoff.rfis.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
  result.takeoff.items.sort((a, b) => (E.BUCKETS[a.bucket]?.order ?? 9) - (E.BUCKETS[b.bucket]?.order ?? 9) || String(a.category).localeCompare(b.category) || a.item.localeCompare(b.item));
  result.summary = summarize(result);
}

function summarize(r) {
  const byBucket = {};
  for (const b of Object.keys(E.BUCKETS)) byBucket[b] = r.takeoff.items.filter((i) => i.bucket === b);
  const rfiByPriority = {};
  for (const p of Object.keys(E.RFI_PRIORITY)) rfiByPriority[p] = r.takeoff.rfis.filter((x) => x.priority === p).length;
  return { ...r.summary, items: r.takeoff.items.length, byBucket: Object.fromEntries(Object.entries(byBucket).map(([k, v]) => [k, v.length])), distributorUnits: byBucket.distributor.reduce((a, i) => a + (typeof i.qty === 'number' ? i.qty : 0), 0), distributorTbd: byBucket.distributor.filter((i) => i.qty === null || i.qty === undefined).length, rfis: r.takeoff.rfis.length, rfiByPriority };
}

/* ------------------------------------------------------------------ */
/* Documents: PDF extraction, hashing                                  */
/* ------------------------------------------------------------------ */

async function sha256Hex(buf) {
  try { const h = await crypto.subtle.digest('SHA-256', buf); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch { return null; }
}

function guessRole(name) {
  if (/addend/i.test(name)) return 'addendum';
  if (/\bE[- ]?\d|E-?SHEETS?|E-?PLAN|PLAN SHEETS|DRAWING|DWG|SHEETS?\b|ONE-?LINE|SCHEDULE/i.test(name)) return 'drawings';
  return 'spec';
}

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('./vendor/pdf.min.mjs').then((m) => { m.GlobalWorkerOptions.workerSrc = '/takeoff/vendor/pdf.worker.min.mjs'; return m; });
  return pdfjsPromise;
}

async function extractPdf(file, onProgress) {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    let text = '';
    let lastY = null;
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) text += '\n';
      text += it.str;
      text += it.hasEOL ? '\n' : ' ';
      lastY = y;
    }
    pages.push({ n, text: text.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ') });
    onProgress && onProgress(n, pdf.numPages);
    page.cleanup();
  }
  return { pages, sha256, numPages: pdf.numPages };
}

async function addFiles(files) {
  const prog = $('#extract-progress'); const bar = $('#extract-progress div'); const status = $('#extract-status');
  prog.classList.remove('hidden');
  for (const file of files) {
    status.textContent = `Extracting ${file.name}…`;
    try {
      let doc;
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        const { pages, sha256 } = await extractPdf(file, (n, total) => { bar.style.width = `${Math.round((n / total) * 100)}%`; status.textContent = `Extracting ${file.name}: page ${n} of ${total}`; });
        const chars = pages.reduce((a, p) => a + p.text.length, 0);
        doc = { id: uid(), name: file.name, role: guessRole(file.name), pages, sha256, chars, added: new Date().toISOString(), size: file.size };
        if (chars < 200 * pages.length * 0.05) status.textContent = `${file.name}: very little text extracted (${chars} chars over ${pages.length} pages). Likely a scanned PDF; run OCR first.`;
      } else {
        const text = await file.text();
        const buf = new TextEncoder().encode(text);
        doc = { id: uid(), name: file.name, role: guessRole(file.name), pages: splitPastedPages(text), sha256: await sha256Hex(buf), chars: text.length, added: new Date().toISOString(), size: file.size };
      }
      current.docs.push(doc);
      scheduleSave();
    } catch (e) {
      console.error(e);
      status.textContent = `Failed to read ${file.name}: ${e.message}`;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  bar.style.width = '0%';
  prog.classList.add('hidden');
  if (!/Failed|scanned/.test(status.textContent)) status.textContent = '';
  recompute();
  renderAll();
}

function splitPastedPages(text) {
  const parts = text.split(/\f|\n-{3,}\n/);
  return parts.map((t, i) => ({ n: i + 1, text: t }));
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderAll() {
  renderProjectSelect();
  renderNav();
  renderTopbar();
  const map = { dashboard: renderDashboard, documents: renderDocuments, questions: renderQuestions, takeoff: renderTakeoff, rfis: renderRfis, schedule: renderSchedule, exports: renderExports, claude: renderClaude, sources: renderSources };
  (map[view] || renderDashboard)();
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
}

function setView(v) { view = v; settings.lastView = v; saveSettings(settings); renderAll(); }

function renderNav() {
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#nav-docs').textContent = current ? current.docs.length || '' : '';
  $('#nav-questions').textContent = result ? result.questions.length : '';
  $('#nav-items').textContent = result ? result.takeoff.items.length || '' : '';
  const crit = result ? result.takeoff.rfis.filter((r) => r.priority === 'critical' && !(current.rfiStatus[r.id] || {}).answered).length : 0;
  const badge = $('#nav-rfis'); badge.textContent = result && result.takeoff.rfis.length ? `${crit}/${result.takeoff.rfis.length}` : ''; badge.className = 'badge' + (crit ? ' critical' : '');
}

function renderProjectSelect() {
  const sel = $('#project-select');
  sel.innerHTML = projects.length ? projects.map((p) => `<option value="${p.id}" ${current && p.id === current.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('') : '<option value="">No projects yet</option>';
  $('#btn-rename-project').disabled = $('#btn-delete-project').disabled = !current;
}

function renderTopbar() {
  const cd = $('#countdown');
  if (!result || !result.schedule.bidDue) { cd.classList.add('hidden'); return; }
  const ms = result.schedule.bidDue.getTime() - Date.now();
  const days = Math.floor(ms / 86400000); const hours = Math.floor((ms % 86400000) / 3600000);
  cd.classList.remove('hidden');
  cd.className = 'countdown ' + (ms < 0 ? 'past' : ms < 86400000 ? 'today' : ms < 3 * 86400000 ? 'soon' : '');
  cd.textContent = ms < 0 ? `Bid was due ${fmtDate(result.schedule.bidDue)}` : `Bid due ${fmtDate(result.schedule.bidDue)} — ${days}d ${hours}h`;
  $('#btn-notify').textContent = settings.notify && Notification.permission === 'granted' ? 'Notifications on' : 'Enable notifications';
}

function renderDashboard() {
  const el = $('#dashboard-list');
  if (!projects.length) { el.innerHTML = '<div class="empty">No projects yet. Click <b>New project</b> to start.</div>'; return; }
  const rows = projects.map((p) => {
    const r = p.id === current?.id ? result : E.analyzeProject(p.docs, p.answers);
    const next = r.schedule.milestones.find((m) => m.status !== 'past');
    const crit = r.takeoff.rfis.filter((x) => x.priority === 'critical' && !(p.rfiStatus[x.id] || {}).answered).length;
    const bid = r.schedule.bidDue;
    const ms = bid ? bid.getTime() - Date.now() : null;
    return `<tr data-id="${p.id}" style="cursor:pointer" class="${p.id === current?.id ? '' : 'dim'}"><td><b>${esc(p.name)}</b><div class="muted" style="font-size:.74rem">updated ${fmtDate(p.updated)}</div></td><td>${bid ? fmtDate(bid) : '<span class="muted">not set</span>'}</td><td class="num">${ms === null ? '' : ms < 0 ? 'past' : Math.ceil(ms / 86400000) + ' d'}</td><td class="num">${p.docs.length}</td><td class="num">${r.takeoff.items.length}</td><td class="num">${crit ? `<span class="badge critical">${crit} critical</span>` : r.takeoff.rfis.length}</td><td>${next ? `<span class="badge ${next.status}">${esc(next.title)}</span><div class="muted" style="font-size:.74rem">${fmtDate(next.when)}</div>` : ''}</td></tr>`;
  }).join('');
  el.innerHTML = `<div class="tablewrap" style="margin-bottom:1rem"><table><thead><tr><th>Project</th><th>Bid due</th><th>Days</th><th>Docs</th><th>Items</th><th>RFIs</th><th>Next milestone</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => selectProject(tr.dataset.id, 'documents')));
}

function renderDocuments() {
  const list = $('#doclist');
  const empty = $('#doclist-empty');
  if (!current) { list.innerHTML = ''; empty.classList.remove('hidden'); $('#detect-summary').innerHTML = ''; return; }
  empty.classList.toggle('hidden', current.docs.length > 0);
  list.innerHTML = current.docs.map((d) => `<li data-id="${d.id}"><div><div class="name">${esc(d.name)}</div><div class="meta">${d.pages.length} pp · ${(d.chars / 1000).toFixed(0)}k chars${d.sha256 ? ' · SHA-256 ' + d.sha256.slice(0, 16) + '…' : ''}</div></div><select class="role"><option value="spec" ${d.role === 'spec' ? 'selected' : ''}>Specification</option><option value="drawings" ${d.role === 'drawings' ? 'selected' : ''}>Drawings / schedules</option><option value="addendum" ${d.role === 'addendum' ? 'selected' : ''}>Addendum</option><option value="other" ${d.role === 'other' ? 'selected' : ''}>Other</option></select><button class="btn small secondary view-text">Text</button><button class="btn small danger remove">Remove</button></li>`).join('');
  $$('li', list).forEach((li) => {
    const d = current.docs.find((x) => x.id === li.dataset.id);
    $('.role', li).addEventListener('change', (e) => { d.role = e.target.value; scheduleSave(); recompute(); renderAll(); });
    $('.remove', li).addEventListener('click', () => { if (confirm(`Remove ${d.name} from this project?`)) { current.docs = current.docs.filter((x) => x.id !== d.id); scheduleSave(); recompute(); renderAll(); } });
    $('.view-text', li).addEventListener('click', () => showModal(`${d.name} - extracted text`, `<textarea readonly style="min-height:60vh;width:100%">${esc(d.pages.map((p) => `===== PAGE ${p.n} =====\n${p.text}`).join('\n\n'))}</textarea>`, []));
  });
  const ds = $('#detect-summary');
  if (!result || !current.docs.length) { ds.innerHTML = '<h2>Detection summary</h2><p class="muted">Load documents to see what the engine finds.</p>'; return; }
  const v = result.detection.values;
  const fams = result.detection.families.slice(0, 18).map((f) => `<span class="badge">${esc(f.label)} <span class="mono">${f.count}</span></span>`).join(' ');
  const secs = result.detection.sections.filter((s) => ['22', '23', '26', '27', '28', '33', '40', '41', '43', '44', '46'].includes(s.division));
  ds.innerHTML = `<h2>Detection summary</h2>
    <div class="stats"><div class="stat"><div class="v">${result.detection.docs.reduce((a, d) => a + d.pages, 0)}</div><div class="l">pages</div></div><div class="stat"><div class="v">${secs.length}</div><div class="l">technical sections</div></div><div class="stat"><div class="v">${result.detection.tags.filter((t) => !t.isSheet).length}</div><div class="l">equipment tags</div></div><div class="stat"><div class="v">${result.detection.families.length}</div><div class="l">equipment families</div></div><div class="stat"><div class="v ${result.takeoff.conflicts.length ? 'bad' : ''}">${result.takeoff.conflicts.length}</div><div class="l">document conflicts</div></div><div class="stat"><div class="v">${v.addenda.length ? v.addenda.join(', ') : '—'}</div><div class="l">addenda referenced</div></div></div>
    <p><b>Bid due:</b> ${result.answers.bidDue ? fmtDate(result.answers.bidDue) : '<span class="muted">not detected</span>'} · <b>Questions due:</b> ${result.answers.questionsDeadline ? fmtDate(result.answers.questionsDeadline) : '<span class="muted">not detected</span>'} · <b>Integrator named:</b> ${v.integratorNamed ? 'yes' : 'no'} · <b>Funding clauses:</b> ${[v.ais && 'AIS', v.baba && 'BABA', v.buyAmerican && 'Buy American', v.srf && 'SRF', v.davisBacon && 'Davis-Bacon'].filter(Boolean).join(', ') || 'none'}</p>
    <p>${fams || '<span class="muted">No equipment families detected.</span>'}</p>
    <div class="actions"><button class="btn" id="btn-go-questions">Continue to questions</button></div>`;
  $('#btn-go-questions').addEventListener('click', () => setView('questions'));
}

function renderQuestions() {
  const form = $('#questions-form');
  if (!result) { form.innerHTML = '<div class="empty">Create a project and load documents first.</div>'; return; }
  const groups = [];
  for (const q of result.questions) { let g = groups.find((x) => x.name === q.group); if (!g) { g = { name: q.group, items: [] }; groups.push(g); } g.items.push(q); }
  form.innerHTML = groups.map((g) => `<div class="card qgroup"><h3>${esc(g.name)}</h3><div class="fields">${g.items.map(renderQuestion).join('')}</div></div>`).join('');
  $$('[data-q]', form).forEach((el) => {
    el.addEventListener('change', () => {
      const id = el.dataset.q;
      let val;
      if (el.type === 'checkbox') val = $$(`[data-q="${id}"]:checked`, form).map((x) => x.value);
      else if (el.type === 'number') val = el.value === '' ? '' : Number(el.value);
      else val = el.value;
      current.answers[id] = val;
      scheduleSave(); recompute(); renderAll();
    });
  });
  // Claude questions
  const cq = $('#claude-questions');
  if (current.claude && current.claude.adapted && current.claude.adapted.questions.length) {
    cq.classList.remove('hidden');
    cq.innerHTML = `<h3>Questions raised by the Claude review</h3><p class="muted">These do not change the rules engine directly; answer them by editing takeoff lines or adding RFIs.</p><ol style="margin:0 0 0 1.1rem;padding:0">${current.claude.adapted.questions.map((q) => `<li style="margin-bottom:.5rem"><b>${esc(q.question)}</b><div class="muted">${esc(q.why)}${q.options && q.options.length ? ' · Options: ' + esc(q.options.join('; ')) : ''}</div></li>`).join('')}</ol>`;
  } else cq.classList.add('hidden');
}

function renderQuestion(q) {
  const val = q.value;
  const why = `<div class="why">${esc(q.why || '')}${(q.evidence || []).slice(0, 2).map((e) => `<span class="ev">${esc(e.doc)} p.${esc(e.page)}: ${esc(e.snippet)}</span>`).join('')}</div>`;
  let input;
  switch (q.type) {
    case 'select': input = `<select data-q="${q.id}">${q.options.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
    case 'multiselect': input = `<div class="checks">${q.options.map((o) => `<label><input type="checkbox" data-q="${q.id}" value="${esc(o)}" ${(val || []).includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div>`; break;
    case 'datetime': input = `<input type="datetime-local" data-q="${q.id}" value="${esc(val || '')}">`; break;
    case 'number': input = `<input type="number" data-q="${q.id}" value="${esc(val ?? '')}">`; break;
    default: input = `<input type="text" data-q="${q.id}" value="${esc(val || '')}">`;
  }
  return `<div class="field"><label>${esc(q.text)}${q.required ? ' *' : ''}</label>${input}${why}</div>`;
}

function renderTakeoff() {
  const stats = $('#takeoff-stats'); const tabs = $('#takeoff-tabs'); const tbody = $('#takeoff-table tbody');
  if (!result) { stats.innerHTML = ''; tabs.innerHTML = ''; tbody.innerHTML = '<tr><td colspan="11" class="muted">Load documents first.</td></tr>'; $('#conflicts-card').innerHTML = ''; $('#responsibility-card').innerHTML = ''; return; }
  const s = result.summary;
  stats.innerHTML = Object.values(E.BUCKETS).sort((a, b) => a.order - b.order).map((b) => `<div class="stat"><div class="v ${b.key === 'ambiguous' && s.byBucket[b.key] ? 'bad' : ''}">${s.byBucket[b.key]}</div><div class="l">${esc(b.short)}${b.key === 'distributor' ? ` · ${s.distributorUnits} units` : ''}</div></div>`).join('');
  const tabList = [{ key: 'all', label: 'All' }, ...Object.values(E.BUCKETS).sort((a, b) => a.order - b.order).map((b) => ({ key: b.key, label: b.short }))];
  tabs.innerHTML = tabList.map((t) => `<button class="${takeoffTab === t.key ? 'active' : ''}" data-tab="${t.key}">${esc(t.label)}<span class="count">${t.key === 'all' ? result.takeoff.items.length : s.byBucket[t.key]}</span></button>`).join('');
  $$('button', tabs).forEach((b) => b.addEventListener('click', () => { takeoffTab = b.dataset.tab; renderTakeoff(); }));
  const rows = result.takeoff.items.filter((i) => takeoffTab === 'all' || i.bucket === takeoffTab);
  tbody.innerHTML = rows.length ? rows.map((i) => `<tr data-id="${i.id}">
      <td><b>${esc(i.item)}</b><div class="muted" style="font-size:.74rem">${esc(i.category)}${i.electricalScope ? ' · Div 26 retains: ' + esc(i.electricalScope) : ''}</div>${i.channelNote ? `<div class="ev">${esc(i.channelNote)}</div>` : ''}</td>
      <td class="tags">${esc(i.tags.join(', '))}</td>
      <td><input class="qty" type="text" value="${esc(fmtQty(i) === 'TBD' ? '' : i.qty)}" placeholder="TBD" title="${esc(i.qtyBasis || '')}"><div class="muted" style="font-size:.7rem;max-width:9rem">${esc(i.qtyBasis || '')}</div></td>
      <td><input class="unit" type="text" value="${esc(i.unit)}" style="width:4.5rem"></td>
      <td><select class="bucket">${Object.values(E.BUCKETS).sort((a, b) => a.order - b.order).map((b) => `<option value="${b.key}" ${b.key === i.bucket ? 'selected' : ''}>${esc(b.short)}</option>`).join('')}</select></td>
      <td class="mono">${esc(i.section)}${i.sectionPresent ? '' : '<div class="muted" style="font-size:.7rem">not located</div>'}</td>
      <td><span class="badge ${i.confidence}">${i.confidence}</span></td>
      <td>${i.qualifications.map((q) => `<div style="font-size:.76rem">• ${esc(q)}</div>`).join('')}${i.rfis.length ? `<div class="mono" style="font-size:.74rem;margin-top:.2rem">${i.rfis.join(', ')}</div>` : ''}</td>
      <td>${i.evidence.length ? `<details class="ev"><summary>${i.evidence.length} source${i.evidence.length > 1 ? 's' : ''}</summary><ul>${i.evidence.map((e) => `<li><b>${esc(e.doc)} p.${esc(e.page)}</b> ${esc(e.snippet)}</li>`).join('')}</ul></details>` : '<span class="muted">—</span>'}</td>
      <td><span class="badge ${i.source}">${i.source}</span>${i.overridden ? '<div class="muted" style="font-size:.7rem">edited</div>' : ''}</td>
      <td><button class="btn small danger remove" title="Remove line">×</button></td></tr>`).join('') : '<tr><td colspan="11" class="muted">No items in this channel.</td></tr>';
  $$('tr[data-id]', tbody).forEach((tr) => {
    const id = tr.dataset.id;
    const item = result.takeoff.items.find((x) => x.id === id);
    const setOverride = (patch) => {
      if (item.source === 'manual') { Object.assign(current.manualItems.find((m) => m.id === id), patch); }
      else current.overrides.items[id] = { ...(current.overrides.items[id] || {}), ...patch };
      scheduleSave(); recompute(); renderAll();
    };
    $('.qty', tr).addEventListener('change', (e) => { const v = e.target.value.trim(); setOverride({ qty: v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : v }); });
    $('.unit', tr).addEventListener('change', (e) => setOverride({ unit: e.target.value.trim() || item.unit }));
    $('.bucket', tr).addEventListener('change', (e) => setOverride({ bucket: e.target.value }));
    $('.remove', tr).addEventListener('click', () => { if (item.source === 'manual') current.manualItems = current.manualItems.filter((m) => m.id !== id); else current.overrides.items[id] = { ...(current.overrides.items[id] || {}), removed: true }; scheduleSave(); recompute(); renderAll(); });
  });
  // Conflicts
  const cc = $('#conflicts-card');
  const conflicts = [...result.takeoff.conflicts, ...((current.claude && current.claude.adapted) ? current.claude.adapted.conflicts : [])];
  cc.innerHTML = `<h2>Document conflicts preserved (${conflicts.length})</h2>` + (conflicts.length ? `<div class="tablewrap"><table><thead><tr><th>Topic</th><th>Values found</th><th>Pricing basis</th><th>RFI</th><th>Src</th></tr></thead><tbody>${conflicts.map((c) => `<tr><td>${esc(c.topic)}</td><td>${esc(c.values.join(' vs '))}</td><td>${esc(c.basis)}</td><td class="mono">${esc(c.rfi || '')}</td><td><span class="badge ${c.source || 'rules'}">${c.source || 'rules'}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No drawing-versus-specification conflicts detected in the loaded text.</p>');
  // Responsibility
  const rc = $('#responsibility-card');
  const rows2 = [...result.takeoff.responsibility.rows, ...((current.claude && current.claude.adapted) ? current.claude.adapted.responsibility : [])];
  rc.innerHTML = `<h2>Responsibility matrix</h2><p class="muted">Likely trade split from explicit clauses and conventions. Unresolved interfaces are marked rather than guessed.</p><div class="tablewrap"><table><thead><tr><th>Item</th><th>Furnished by</th><th>Installed by</th><th>Power wired by</th><th>Control wired by</th><th>Programmed by</th><th>Started by</th><th>Conf.</th></tr></thead><tbody>${rows2.map((r) => `<tr><td><b>${esc(r.item)}</b>${r.tags ? `<div class="tags">${esc(r.tags)}</div>` : ''}${r.source === 'claude' ? '<span class="badge claude">claude</span>' : ''}</td><td>${esc(r.furnishedBy)}</td><td>${esc(r.installedBy)}</td><td>${esc(r.powerWiredBy)}</td><td>${esc(r.controlWiredBy)}</td><td>${esc(r.programmedBy)}</td><td>${esc(r.startedBy)}</td><td><span class="badge ${r.confidence}">${esc(r.confidence)}</span></td></tr>`).join('')}</tbody></table></div>
    ${result.takeoff.responsibility.clauses.length ? `<details style="margin-top:.7rem"><summary style="cursor:pointer;font-weight:600">Explicit furnish / install clauses found in the documents (${result.takeoff.responsibility.clauses.length})</summary><ul style="font-size:.8rem">${result.takeoff.responsibility.clauses.map((c) => `<li><b>${esc(c.evidence[0].doc)} p.${esc(c.evidence[0].page)}:</b> ${esc(c.evidence[0].snippet)}</li>`).join('')}</ul></details>` : ''}`;
}

function renderRfis() {
  const list = $('#rfi-list'); const stats = $('#rfi-stats'); const comp = $('#compliance-card');
  if (!result) { list.innerHTML = '<div class="empty">Load documents first.</div>'; stats.innerHTML = ''; comp.innerHTML = ''; return; }
  const s = result.summary;
  const open = result.takeoff.rfis.filter((r) => !(current.rfiStatus[r.id] || {}).answered).length;
  stats.innerHTML = Object.entries(E.RFI_PRIORITY).map(([k, label]) => `<div class="stat"><div class="v ${k === 'critical' && s.rfiByPriority[k] ? 'bad' : ''}">${s.rfiByPriority[k]}</div><div class="l">${esc(label)}</div></div>`).join('') + `<div class="stat"><div class="v ${open ? 'warn' : ''}">${open}</div><div class="l">open</div></div>`;
  list.innerHTML = result.takeoff.rfis.length ? result.takeoff.rfis.map((r) => {
    const st = current.rfiStatus[r.id] || {};
    return `<div class="rfi ${r.priority} ${st.answered ? 'answered' : ''}" data-id="${r.id}"><header><span class="id">${r.id}</span><span class="badge ${r.priority}">${esc(E.RFI_PRIORITY[r.priority] || r.priority)}</span><b>${esc(r.topic)}</b><span class="badge ${r.source || 'rules'}">${r.source || 'rules'}</span><button class="btn small danger remove" style="margin-left:auto" title="Remove RFI">×</button></header>
      <div class="q">${esc(r.question)}</div>
      <div class="basis"><b>Pricing basis pending answer:</b> ${esc(r.pricingBasis)}${r.risk ? ` <b>Risk:</b> ${esc(r.risk)}` : ''}</div>
      ${(r.evidence || []).length ? `<details class="ev"><summary>${r.evidence.length} source${r.evidence.length > 1 ? 's' : ''}</summary><ul>${r.evidence.map((e) => `<li><b>${esc(e.doc)} p.${esc(e.page)}</b> ${esc(e.snippet)}</li>`).join('')}</ul></details>` : ''}
      <div class="status"><label>Sent <input type="date" class="sent" value="${esc(st.sent || '')}"></label><label>Answered <input type="date" class="answered" value="${esc(st.answered || '')}"></label><input type="text" class="note" placeholder="Answer / note" value="${esc(st.note || '')}" style="flex:1;min-width:200px;font-size:.78rem;padding:.2rem .4rem"></div></div>`;
  }).join('') : '<div class="empty">No RFIs generated. That usually means the documents are thin; check the Source map.</div>';
  $$('.rfi[data-id]', list).forEach((card) => {
    const id = card.dataset.id;
    const upd = (patch) => { current.rfiStatus[id] = { ...(current.rfiStatus[id] || {}), ...patch }; scheduleSave(); renderNav(); };
    $('.sent', card).addEventListener('change', (e) => upd({ sent: e.target.value }));
    $('.answered', card).addEventListener('change', (e) => { upd({ answered: e.target.value }); card.classList.toggle('answered', Boolean(e.target.value)); });
    $('.note', card).addEventListener('change', (e) => upd({ note: e.target.value }));
    $('.remove', card).addEventListener('click', () => { const r = result.takeoff.rfis.find((x) => x.id === id); if (r.source === 'manual') current.manualRfis = current.manualRfis.filter((m) => m.id !== id); else current.removedRfis[r.sourceId || r.id] = true; scheduleSave(); recompute(); renderAll(); });
  });
  comp.innerHTML = `<h2>Bid compliance checklist</h2>` + (result.takeoff.compliance.length ? `<ul style="margin:0;padding-left:1.1rem">${result.takeoff.compliance.map((c) => `<li style="margin-bottom:.35rem"><b>${esc(c.item)}</b><div class="muted" style="font-size:.78rem">${esc(c.why)}</div></li>`).join('')}</ul>` : '<p class="muted">Nothing flagged.</p>');
}

function renderSchedule() {
  const tl = $('#timeline'); const empty = $('#timeline-empty');
  if (!result || !result.schedule.milestones.length) { tl.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tl.innerHTML = result.schedule.milestones.map((m) => `<li><div class="when">${fmtDate(m.when)}</div><div><div class="title">${esc(m.title)}</div><div class="detail">${esc(m.detail)}${m.key === 'rfi-send' ? ` Open RFIs: ${result.takeoff.rfis.filter((r) => !(current.rfiStatus[r.id] || {}).sent).length}.` : ''}</div></div><span class="badge ${m.status}">${m.status === 'past' ? 'past' : m.status === 'today' ? 'within 24 h' : m.status === 'soon' ? 'within 3 days' : relDays(m.when)}</span></li>`).join('');
}

function relDays(d) { const days = Math.ceil((d.getTime() - Date.now()) / 86400000); return `in ${days} d`; }

function renderExports() {
  // Nothing dynamic beyond the preview area; buttons are wired once.
}

function renderClaude() {
  $('#api-key').value = settings.apiKey || '';
  const modelSel = $('#claude-model');
  if (!modelSel.options.length) modelSel.innerHTML = C.MODELS.map((m) => `<option value="${m.id}">${esc(m.label)}</option>`).join('');
  modelSel.value = settings.model || C.DEFAULT_MODEL;
  if (settings.maxChars) $('#claude-maxchars').value = settings.maxChars;
  updateClaudeEstimate();
  const out = $('#claude-result');
  if (!current || !current.claude || !current.claude.adapted) { out.innerHTML = ''; return; }
  const c = current.claude; const a = c.adapted; const acc = c.accepted || { items: {}, rfis: {} };
  const ov = current.overrides.items || {};
  out.innerHTML = `<div class="card"><h2>Claude result <span class="muted" style="font-weight:400;font-size:.8rem">${esc(c.model)} · ${fmtDate(c.ranAt)} · ${c.usage?.input_tokens || '?'} in / ${c.usage?.output_tokens || '?'} out tokens${c.usage?.cache_read_input_tokens ? ' · ' + c.usage.cache_read_input_tokens + ' cached' : ''}</span></h2><p>${esc(a.summary)}</p>
    <div class="actions"><button class="btn small" id="claude-accept-all">Accept all items and RFIs</button><button class="btn small secondary" id="claude-reject-all">Clear acceptances</button><button class="btn small danger" id="claude-discard">Discard Claude result</button></div></div>
    <div class="card"><h3>Takeoff lines from Claude (${a.items.length}) — tick to merge into the takeoff</h3><div class="tablewrap"><table><thead><tr><th></th><th>Item</th><th>Tags</th><th>Qty</th><th>Channel</th><th>Section</th><th>Conf.</th><th>Qualifications</th><th>Evidence</th></tr></thead><tbody>${a.items.map((i) => `<tr class="${ov[i.id]?.removed ? 'dim' : ''}"><td><input type="checkbox" data-accept-item="${i.id}" ${acc.items[i.id] ? 'checked' : ''}></td><td><b>${esc(i.item)}</b>${i.electricalScope ? `<div class="muted" style="font-size:.74rem">Div 26 retains: ${esc(i.electricalScope)}</div>` : ''}</td><td class="tags">${esc(i.tags.join(', '))}</td><td class="num">${fmtQty(i)} ${esc(i.unit)}</td><td><span class="badge ${i.bucket}">${esc(E.BUCKETS[i.bucket]?.short || i.bucket)}</span></td><td class="mono">${esc(i.section)}</td><td><span class="badge ${i.confidence}">${i.confidence}</span></td><td>${i.qualifications.map((q) => `<div style="font-size:.76rem">• ${esc(q)}</div>`).join('')}</td><td>${i.evidence.length ? `<details class="ev"><summary>${i.evidence.length}</summary><ul>${i.evidence.map((e) => `<li><b>${esc(e.doc)} p.${esc(e.page)}</b> ${esc(e.snippet)}</li>`).join('')}</ul></details>` : ''}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>RFIs from Claude (${a.rfis.length}) — tick to merge into the RFI list</h3>${a.rfis.map((r) => `<div class="rfi ${r.priority}"><header><input type="checkbox" data-accept-rfi="${r.id}" ${acc.rfis[r.id] ? 'checked' : ''}><span class="badge ${r.priority}">${esc(E.RFI_PRIORITY[r.priority] || r.priority)}</span><b>${esc(r.topic)}</b></header><div class="q">${esc(r.question)}</div><div class="basis"><b>Pricing basis:</b> ${esc(r.pricingBasis)} <b>Risk:</b> ${esc(r.risk)}</div>${r.evidence.length ? `<details class="ev"><summary>${r.evidence.length} source${r.evidence.length > 1 ? 's' : ''}</summary><ul>${r.evidence.map((e) => `<li><b>${esc(e.doc)} p.${esc(e.page)}</b> ${esc(e.snippet)}</li>`).join('')}</ul></details>` : ''}</div>`).join('')}</div>`;
  $$('[data-accept-item]', out).forEach((cb) => cb.addEventListener('change', () => { current.claude.accepted = current.claude.accepted || { items: {}, rfis: {} }; current.claude.accepted.items[cb.dataset.acceptItem] = cb.checked; scheduleSave(); recompute(); renderNav(); }));
  $$('[data-accept-rfi]', out).forEach((cb) => cb.addEventListener('change', () => { current.claude.accepted = current.claude.accepted || { items: {}, rfis: {} }; current.claude.accepted.rfis[cb.dataset.acceptRfi] = cb.checked; scheduleSave(); recompute(); renderNav(); }));
  $('#claude-accept-all').addEventListener('click', () => { current.claude.accepted = { items: Object.fromEntries(a.items.map((i) => [i.id, true])), rfis: Object.fromEntries(a.rfis.map((r) => [r.id, true])) }; scheduleSave(); recompute(); renderAll(); });
  $('#claude-reject-all').addEventListener('click', () => { current.claude.accepted = { items: {}, rfis: {} }; scheduleSave(); recompute(); renderAll(); });
  $('#claude-discard').addEventListener('click', () => { if (confirm('Discard the Claude result for this project?')) { current.claude = null; scheduleSave(); recompute(); renderAll(); } });
}

function updateClaudeEstimate() {
  const el = $('#claude-estimate');
  if (!current || !current.docs.length) { el.textContent = 'Load documents first.'; el.className = 'notice info'; return; }
  const maxChars = Number($('#claude-maxchars').value) || 900000;
  const sel = E.selectRelevantPages(current.docs.map(E.normalizeDocument), { maxChars });
  const est = C.estimate(sel.chars + 8000, $('#claude-model').value);
  el.className = 'notice ' + (est.cost > 8 ? 'warn' : 'info');
  el.innerHTML = `<b>${sel.pages.length}</b> of ${sel.totalCandidates} relevant pages selected (${(sel.chars / 1000).toFixed(0)}k characters${sel.skipped ? `, ${sel.skipped} lower-relevance pages skipped by the cap` : ''}). Estimated <b>${est.inputTokens.toLocaleString()}</b> input tokens; list-price estimate about <b>$${est.cost.toFixed(2)}</b> including a typical output. Estimates only; the API bills actual tokens.`;
}

function renderSources() {
  const el = $('#sources');
  if (!result) { el.innerHTML = '<div class="empty">Load documents first.</div>'; return; }
  const d = result.detection; const v = d.values;
  const secs = d.sections.filter((s) => s.division !== '00' || s.count > 1);
  el.innerHTML = `
    <div class="card"><h2>Documents</h2><div class="tablewrap"><table><thead><tr><th>Document</th><th>Role</th><th>Pages</th><th>Characters</th><th>SHA-256</th></tr></thead><tbody>${d.docs.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.role)}</td><td class="num">${x.pages}</td><td class="num">${x.chars.toLocaleString()}</td><td class="mono" style="font-size:.7rem;word-break:break-all">${esc(x.sha256 || 'n/a')}</td></tr>`).join('')}</tbody></table></div><p class="muted" style="margin-top:.5rem">Hashes are computed on the file bytes at load time so you can prove which revision the takeoff was read from.</p></div>
    <div class="card"><h2>Bid administration text</h2><dl class="kv">
      <dt>Bid due sentences</dt><dd>${v.bidDue.length ? v.bidDue.map((b) => `<div><b>${esc(b.doc)} p.${b.page}:</b> ${esc(b.text)}</div>`).join('') : '<span class="muted">none</span>'}</dd>
      <dt>Question deadline</dt><dd>${v.questionsDeadline.length ? v.questionsDeadline.map((b) => `<div><b>${esc(b.doc)} p.${b.page}:</b> ${esc(b.text)}</div>`).join('') : '<span class="muted">none</span>'}</dd>
      <dt>Pre-bid</dt><dd>${v.preBid.length ? v.preBid.map((b) => `<div>${esc(b.text)}</div>`).join('') : '<span class="muted">none</span>'}</dd>
      <dt>Addenda referenced</dt><dd>${v.addenda.join(', ') || '<span class="muted">none</span>'}${v.addendumAcknowledge ? ' (acknowledgment required)' : ''}</dd>
      <dt>Funding / domestic content</dt><dd>${[v.ais && 'AIS', v.baba && 'BABA', v.buyAmerican && 'Buy American', v.srf && 'SRF / federal', v.davisBacon && 'Davis-Bacon'].filter(Boolean).join(', ') || '<span class="muted">none</span>'}</dd>
      <dt>Substitutions</dt><dd>${v.noSubstitution ? 'No substitutions' : v.orEqual ? '"Or equal" language present' : '<span class="muted">not stated</span>'}${v.substitutionDeadline.length ? ` · requests due ${v.substitutionDeadline[0].days} days before bid` : ''}</dd>
      <dt>Project fields</dt><dd>${[v.projectTitle && 'Title: ' + v.projectTitle, v.owner && 'Owner: ' + v.owner, v.engineer && 'Engineer: ' + v.engineer, v.projectNumber && 'Project No.: ' + v.projectNumber].filter(Boolean).map(esc).join(' · ') || '<span class="muted">not parsed</span>'}</dd>
    </dl></div>
    <div class="card"><h2>Specification sections located (${secs.length})</h2><div class="tablewrap"><table><thead><tr><th>Section</th><th>Title</th><th>Default channel</th><th>Hits</th><th>Where</th></tr></thead><tbody>${secs.map((s) => `<tr><td class="mono">${esc(s.code)}</td><td>${esc(s.title)}${s.title !== s.catalogTitle ? `<div class="muted" style="font-size:.72rem">catalog: ${esc(s.catalogTitle)}</div>` : ''}</td><td>${s.bucket && E.BUCKETS[s.bucket] ? `<span class="badge ${s.bucket}">${esc(E.BUCKETS[s.bucket].short)}</span>` : esc(s.bucket)}</td><td class="num">${s.count}</td><td class="muted" style="font-size:.74rem">${esc(s.pages.slice(0, 6).map((p) => `${p.doc} p.${p.page}`).join('; '))}${s.pages.length > 6 ? ' …' : ''}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Equipment tags (${d.tags.filter((t) => !t.isSheet).length})</h2><div class="tablewrap"><table><thead><tr><th>Tag</th><th>Family</th><th>Hits</th><th>First occurrence</th></tr></thead><tbody>${d.tags.filter((t) => !t.isSheet).slice(0, 300).map((t) => `<tr><td class="mono">${esc(t.tag)}</td><td>${t.family ? esc(E.FAMILIES.find((f) => f.key === t.family)?.label || t.family) : '<span class="muted">unassigned</span>'}</td><td class="num">${t.count}</td><td class="muted" style="font-size:.74rem"><b>${esc(t.evidence[0].doc)} p.${t.evidence[0].page}</b> ${esc(t.evidence[0].snippet)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Ratings and values</h2><dl class="kv">
      <dt>Voltages</dt><dd>${v.voltages.map((x) => `${esc(x.value)} (${x.count})`).join(', ') || '<span class="muted">none</span>'}</dd>
      <dt>Fault ratings</dt><dd>${v.kaicSummary.length ? v.kaicSummary.map((k) => `<div><b>${esc(k.context)}:</b> ${k.distinct.join(' / ')} kA${k.conflict ? ' <span class="badge critical">conflict</span>' : ''}</div>`).join('') : '<span class="muted">none</span>'}</dd>
      <dt>Enclosures</dt><dd>${v.enclosures.map((x) => `Type ${esc(x.value)} (${x.count})`).join(', ') || '<span class="muted">none</span>'}</dd>
      <dt>Motor HP values</dt><dd>${v.hp.length ? Array.from(new Set(v.hp.map((h) => h.value))).slice(0, 30).join(', ') + ' HP' : '<span class="muted">none</span>'}</dd>
      <dt>Transformer kVA</dt><dd>${v.kva.length ? Array.from(new Set(v.kva.map((k) => k.value))).join(', ') + ' kVA' : '<span class="muted">none</span>'}</dd>
      <dt>Generator kW</dt><dd>${v.kw.length ? Array.from(new Set(v.kw.map((k) => k.value))).join(', ') + ' kW' : '<span class="muted">none</span>'}</dd>
      <dt>Drive details</dt><dd>${[v.hasFLA && 'FLA stated', v.lineReactor && 'line reactor', v.outputReactor && 'output reactor', v.dvdt && 'dV/dt or sine filter', v.harmonics && 'harmonic limits', v.bypass && 'bypass', v.sccr && 'SCCR'].filter(Boolean).join(', ') || '<span class="muted">none</span>'}</dd>
      <dt>Manufacturers named</dt><dd>${v.manufacturers.map((m) => `${esc(m.value)} (${m.count})`).join(', ') || '<span class="muted">none</span>'}</dd>
    </dl></div>
    <div class="card"><h2>Integrator and responsibility clauses</h2>${v.integratorClauses.length ? `<h3>Systems integrator language</h3><ul style="font-size:.8rem">${v.integratorClauses.map((c) => `<li><b>${esc(c.doc)} p.${c.page}:</b> ${esc(c.text)}</li>`).join('')}</ul>` : '<p class="muted">No systems-integrator language found.</p>'}${v.responsibilityClauses.length ? `<h3>Furnish / install clauses</h3><ul style="font-size:.8rem">${v.responsibilityClauses.map((c) => `<li><b>${esc(c.doc)} p.${c.page}:</b> ${esc(c.text)}</li>`).join('')}</ul>` : ''}</div>`;
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

function download(name, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const slug = (s) => String(s || 'project').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

function preview(text) { $('#export-preview').textContent = text.length > 20000 ? text.slice(0, 20000) + '\n… (truncated preview)' : text; }

function exportXlsx() {
  if (!result || typeof XLSX === 'undefined') { alert('Workbook library not loaded yet; try again in a moment.'); return; }
  const wb = XLSX.utils.book_new();
  const s = result.summary; const t = result.takeoff; const a = result.answers;
  const sheet = (name, rows, widths) => { const ws = XLSX.utils.aoa_to_sheet(rows); if (widths) ws['!cols'] = widths.map((w) => ({ wch: w })); ws['!freeze'] = { xSplit: 0, ySplit: 3 }; XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
  const title = (t1, sub) => [[`${current.name} | ${t1}`], [sub], []];
  sheet('Executive Summary', [...title('Executive Summary', `Bid due ${a.bidDue ? fmtDate(a.bidDue) : 'TBD'} · prepared ${fmtDate(new Date())} · engine ${result.version}${current.claude ? ' + Claude review' : ''}`),
    ['Measure', 'Value'], ['Documents', s.documents], ['Pages', s.pages], ['Technical sections located', s.sectionsFound], ['Equipment tags', s.tagsFound], ['Line items', s.items],
    ...Object.values(E.BUCKETS).sort((x, y) => x.order - y.order).map((b) => [`${b.label} lines`, s.byBucket[b.key]]),
    ['Distributor counted units', s.distributorUnits], ['Distributor lines with TBD quantity', s.distributorTbd],
    ...Object.entries(E.RFI_PRIORITY).map(([k, l]) => [`RFIs - ${l}`, s.rfiByPriority[k]]), ['Document conflicts preserved', t.conflicts.length], ['Compliance items', t.compliance.length]], [44, 40]);
  const itemRow = (i) => [i.item, i.tags.join(', '), fmtQty(i), i.unit, E.BUCKETS[i.bucket]?.label || i.bucket, i.section, i.sectionTitle || '', i.confidence, i.qtyBasis || '', i.channelNote || '', i.electricalScope || '', i.qualifications.join(' | '), i.rfis.join(', '), i.evidence.map((e) => `${e.doc} p.${e.page}: ${e.snippet}`).join(' || '), i.source];
  const itemHead = ['Item', 'Tags', 'Qty', 'Unit', 'Quoted by', 'Section', 'Section title', 'Confidence', 'Quantity basis', 'Quote basis / channel note', 'Division 26 retains', 'Qualifications', 'RFIs', 'Evidence', 'Source'];
  const widths = [34, 18, 6, 7, 26, 10, 30, 11, 30, 40, 30, 40, 12, 60, 8];
  sheet('Takeoff', [...title('Division 26 Takeoff', 'All line items by quote channel.'), itemHead, ...t.items.map(itemRow)], widths);
  for (const b of Object.values(E.BUCKETS).sort((x, y) => x.order - y.order)) {
    const rows = t.items.filter((i) => i.bucket === b.key);
    sheet(b.short === 'Ambiguous' ? 'Ambiguous-RFI' : b.short, [...title(b.label, b.description), itemHead, ...rows.map(itemRow)], widths);
  }
  const rr = [...t.responsibility.rows, ...((current.claude && current.claude.adapted) ? current.claude.adapted.responsibility : [])];
  sheet('Responsibility Matrix', [...title('Responsibility Matrix', 'Likely trade split; unresolved interfaces preserved.'), ['Item', 'Tags', 'Furnished by', 'Installed by', 'Power wired by', 'Control wired by', 'Programmed by', 'Started / commissioned by', 'Confidence', 'Evidence'], ...rr.map((r) => [r.item, r.tags, r.furnishedBy, r.installedBy, r.powerWiredBy, r.controlWiredBy, r.programmedBy, r.startedBy, r.confidence, (r.evidence || []).map((e) => `${e.doc} p.${e.page}: ${e.snippet}`).join(' || ')]), [], ['Explicit clauses'], ...t.responsibility.clauses.map((c) => [c.evidence[0].doc + ' p.' + c.evidence[0].page, '', c.evidence[0].snippet])], [30, 14, 30, 26, 22, 30, 22, 30, 11, 60]);
  sheet('RFI Log', [...title('Ambiguous-RFI Items', 'Ranked by pricing impact.'), ['RFI', 'Priority', 'Topic', 'Question', 'Pricing basis pending answer', 'Risk', 'Source evidence', 'Sent', 'Answered', 'Note', 'Source'], ...t.rfis.map((r) => { const st = current.rfiStatus[r.id] || {}; return [r.id, E.RFI_PRIORITY[r.priority] || r.priority, r.topic, r.question, r.pricingBasis, r.risk || '', (r.evidence || []).map((e) => `${e.doc} p.${e.page}: ${e.snippet}`).join(' || '), st.sent || '', st.answered || '', st.note || '', r.source || 'rules']; })], [8, 26, 30, 70, 50, 40, 60, 11, 11, 30, 8]);
  const conflicts = [...t.conflicts, ...((current.claude && current.claude.adapted) ? current.claude.adapted.conflicts : [])];
  sheet('Conflicts', [...title('Document Conflicts', 'Preserved, not resolved.'), ['Topic', 'Values found', 'Pricing basis', 'RFI', 'Source'], ...conflicts.map((c) => [c.topic, c.values.join(' vs '), c.basis, c.rfi || '', c.source || 'rules'])], [30, 50, 40, 10, 8]);
  sheet('Compliance', [...title('Bid Compliance Checklist', 'Administrative items that can disqualify a bid.'), ['Item', 'Why'], ...t.compliance.map((c) => [c.item, c.why])], [60, 80]);
  sheet('Schedule', [...title('Schedule', 'Milestones backed off the bid date.'), ['Milestone', 'When', 'Detail', 'Status'], ...result.schedule.milestones.map((m) => [m.title, fmtDate(m.when), m.detail, m.status])], [50, 22, 60, 10]);
  sheet('Questions', [...title('Intake Questions and Answers', 'Answers drive channel assignment and RFIs.'), ['Group', 'Question', 'Answer', 'Why / evidence'], ...result.questions.map((q) => [q.group, q.text, Array.isArray(q.value) ? q.value.join('; ') : String(q.value ?? ''), q.why || ''])], [22, 60, 40, 70]);
  const secs = result.detection.sections.filter((x) => x.division !== '00' || x.count > 1);
  sheet('Source References', [...title('Source References', 'Documents, hashes and located sections.'), ['Document', 'Role', 'Pages', 'Characters', 'SHA-256'], ...result.detection.docs.map((d) => [d.name, d.role, d.pages, d.chars, d.sha256 || '']), [], ['Section', 'Title', 'Default channel', 'Hits', 'Pages'], ...secs.map((x) => [x.code, x.title, x.bucket, x.count, x.pages.slice(0, 8).map((p) => `${p.doc} p.${p.page}`).join('; ')])], [40, 30, 20, 8, 70]);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(`${slug(current.name)}_Div26_Takeoff.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  preview(`Workbook written with ${wb.SheetNames.length} tabs:\n- ${wb.SheetNames.join('\n- ')}`);
}

function exportJson() {
  const data = JSON.stringify({ format: 'takeoff-workbench-project', version: 1, exported: new Date().toISOString(), project: current }, null, 1);
  download(`${slug(current.name)}_takeoff_project.json`, data, 'application/json');
  preview(`Project JSON exported (${(data.length / 1024).toFixed(0)} KB).`);
}

async function importJson(file) {
  try {
    const data = JSON.parse(await file.text());
    const p = data.project || data;
    if (!p || !Array.isArray(p.docs)) throw new Error('Not a takeoff project file.');
    p.id = p.id && !projects.some((x) => x.id === p.id) ? p.id : uid();
    p.overrides = p.overrides || { items: {} }; p.manualItems = p.manualItems || []; p.manualRfis = p.manualRfis || []; p.rfiStatus = p.rfiStatus || {}; p.removedRfis = p.removedRfis || {};
    projects.push(p); await dbPut(p); await selectProject(p.id, 'takeoff');
  } catch (e) { alert('Import failed: ' + e.message); }
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

function checkReminders() {
  if (!settings.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  let notified = {};
  try { notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch { /* ignore */ }
  const today = new Date().toISOString().slice(0, 10);
  for (const p of projects) {
    const r = p.id === current?.id ? result : E.analyzeProject(p.docs, p.answers);
    for (const m of r.schedule.milestones) {
      const withinDay = m.msUntil < 86400000 && m.msUntil > -2 * 86400000;
      const key = `${p.id}:${m.key}`;
      if (!withinDay || notified[key] === today) continue;
      try { new Notification(`${p.name}: ${m.title}`, { body: `${fmtDate(m.when)} — ${m.detail}`, tag: key }); } catch { /* ignore */ }
      notified[key] = today;
    }
  }
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified)); } catch { /* ignore */ }
}

async function toggleNotifications() {
  if (typeof Notification === 'undefined') { alert('This browser does not support notifications.'); return; }
  if (settings.notify && Notification.permission === 'granted') { settings.notify = false; saveSettings(settings); renderTopbar(); return; }
  const perm = await Notification.requestPermission();
  settings.notify = perm === 'granted'; saveSettings(settings); renderTopbar();
  if (perm === 'granted') { checkReminders(); new Notification('Takeoff reminders enabled', { body: 'Milestones within 24 hours will be announced while this page is open.' }); }
}

/* ------------------------------------------------------------------ */
/* Claude run                                                          */
/* ------------------------------------------------------------------ */

function rulesSummaryText() {
  const t = result.takeoff;
  const lines = ['ITEMS:', ...t.items.map((i) => `- [${i.bucket}] ${i.item}${i.tags.length ? ' (' + i.tags.join(', ') + ')' : ''} qty ${fmtQty(i)} ${i.unit}; ${i.section}; ${i.confidence}${i.qualifications.length ? '; ' + i.qualifications.join(' ') : ''}`), 'RFIS:', ...t.rfis.map((r) => `- ${r.id} [${r.priority}] ${r.topic}: ${r.question}`), 'CONFLICTS:', ...t.conflicts.map((c) => `- ${c.topic}: ${c.values.join(' vs ')} -> ${c.basis}`)];
  return lines.join('\n');
}

async function runClaude() {
  if (!current || !result || !current.docs.length) { alert('Load documents first.'); return; }
  const apiKey = $('#api-key').value.trim();
  if (!apiKey) { alert('Enter an Anthropic API key.'); return; }
  settings.apiKey = apiKey; settings.model = $('#claude-model').value; settings.maxChars = Number($('#claude-maxchars').value) || 900000; saveSettings(settings);
  const sel = E.selectRelevantPages(current.docs.map(E.normalizeDocument), { maxChars: settings.maxChars });
  const est = C.estimate(sel.chars + 8000, settings.model);
  if (!confirm(`Send ${sel.pages.length} pages (${(sel.chars / 1000).toFixed(0)}k characters, about ${est.inputTokens.toLocaleString()} input tokens, list-price estimate around $${est.cost.toFixed(2)}) to ${settings.model}?`)) return;
  const log = $('#claude-log'); const btn = $('#btn-claude-run'); const cancel = $('#btn-claude-cancel');
  btn.disabled = true; cancel.disabled = false;
  claudeAbort = new AbortController();
  const t0 = Date.now();
  log.textContent = `Started ${new Date().toLocaleTimeString()} — ${settings.model}\nPages: ${sel.pages.length} (${sel.chars.toLocaleString()} chars)\nStreaming…\n`;
  try {
    const res = await C.runReview({ apiKey, model: settings.model, project: current, pages: sel.pages, answers: result.answers, rulesSummary: rulesSummaryText(), signal: claudeAbort.signal,
      onProgress: (text) => { log.textContent = log.textContent.split('\nStreaming')[0] + `\nStreaming… ${text.length.toLocaleString()} characters received (${Math.round((Date.now() - t0) / 1000)} s)`; } });
    const adapted = C.adaptResult(res.result, 1);
    current.claude = { ranAt: new Date().toISOString(), model: res.model, usage: res.usage, raw: res.result, adapted, accepted: { items: {}, rfis: {} }, pagesSent: sel.pages.map((p) => `${p.doc} p.${p.page}`) };
    scheduleSave(); recompute();
    log.textContent += `\nDone in ${Math.round((Date.now() - t0) / 1000)} s. ${adapted.items.length} items, ${adapted.rfis.length} RFIs, ${adapted.conflicts.length} conflicts, ${adapted.questions.length} questions.\nTokens: ${res.usage.input_tokens || '?'} in, ${res.usage.output_tokens || '?'} out${res.usage.cache_read_input_tokens ? ', ' + res.usage.cache_read_input_tokens + ' cache read' : ''}.\nReview the result below and tick the lines to merge.`;
    renderAll();
  } catch (e) {
    log.textContent += `\nFailed: ${e.name === 'AbortError' ? 'cancelled' : e.message}`;
  } finally {
    btn.disabled = false; cancel.disabled = true; claudeAbort = null;
  }
}

/* ------------------------------------------------------------------ */
/* Modal helper                                                        */
/* ------------------------------------------------------------------ */

function showModal(title, bodyHtml, fields, onSubmit) {
  const root = $('#modal-root');
  root.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem" id="modal-bg"><div class="card" style="max-width:720px;width:100%;max-height:92vh;overflow:auto;margin:0"><h2>${esc(title)}</h2>${bodyHtml || ''}${fields ? `<form id="modal-form">${fields.map((f) => `<div class="field"><label>${esc(f.label)}</label>${f.type === 'select' ? `<select name="${f.name}">${f.options.map((o) => `<option value="${esc(o.value ?? o)}" ${(o.value ?? o) === f.value ? 'selected' : ''}>${esc(o.label ?? o)}</option>`).join('')}</select>` : f.type === 'textarea' ? `<textarea name="${f.name}" style="min-height:80px;font-family:inherit">${esc(f.value || '')}</textarea>` : `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''}>`}</div>`).join('')}<div class="actions">${onSubmit ? '<button class="btn" type="submit">Save</button>' : ''}<button class="btn secondary" type="button" id="modal-close">Close</button></div></form>` : '<div class="actions" style="margin-top:.6rem"><button class="btn secondary" id="modal-close">Close</button></div>'}</div></div>`;
  const close = () => { root.innerHTML = ''; };
  $('#modal-close').addEventListener('click', close);
  $('#modal-bg').addEventListener('click', (e) => { if (e.target.id === 'modal-bg') close(); });
  const form = $('#modal-form');
  if (form && onSubmit) form.addEventListener('submit', (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(form).entries()); onSubmit(data); close(); });
  const first = form && form.querySelector('input,select,textarea'); if (first) first.focus();
}

/* ------------------------------------------------------------------ */
/* Project actions                                                     */
/* ------------------------------------------------------------------ */

async function selectProject(id, nextView) {
  current = projects.find((p) => p.id === id) || null;
  settings.lastProject = id; saveSettings(settings);
  recompute();
  if (nextView) view = nextView;
  renderAll();
}

function createProject() {
  showModal('New project', '<p class="muted">Use the owner’s bid title or your quote number, e.g. "Q7716C Eastgate Pump Station".</p>', [{ name: 'name', label: 'Project name', required: true }], async (d) => {
    const p = newProject(d.name.trim() || 'Untitled bid'); projects.push(p); await dbPut(p); await selectProject(p.id, 'documents');
  });
}

function wireStatic() {
  $$('#nav button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#project-select').addEventListener('change', (e) => selectProject(e.target.value));
  $('#btn-new-project').addEventListener('click', createProject);
  $('#btn-rename-project').addEventListener('click', () => { if (!current) return; showModal('Rename project', '', [{ name: 'name', label: 'Project name', value: current.name, required: true }], (d) => { current.name = d.name.trim() || current.name; scheduleSave(); renderAll(); }); });
  $('#btn-delete-project').addEventListener('click', async () => { if (!current) return; if (!confirm(`Delete project "${current.name}" and its documents from this browser? Export JSON first if you want a backup.`)) return; await dbDel(current.id); projects = projects.filter((p) => p.id !== current.id); current = projects[0] || null; recompute(); view = current ? view : 'dashboard'; renderAll(); });
  $('#btn-notify').addEventListener('click', toggleNotifications);
  // Documents
  const drop = $('#drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (!current) { alert('Create a project first.'); return; } addFiles(Array.from(e.dataTransfer.files)); });
  $('#file-input').addEventListener('change', (e) => { if (!current) { alert('Create a project first.'); e.target.value = ''; return; } addFiles(Array.from(e.target.files)); e.target.value = ''; });
  $('#btn-add-paste').addEventListener('click', () => {
    if (!current) { alert('Create a project first.'); return; }
    const text = $('#paste-text').value; if (!text.trim()) return;
    const name = $('#paste-name').value.trim() || `Pasted text ${current.docs.length + 1}`;
    current.docs.push({ id: uid(), name, role: $('#paste-role').value, pages: splitPastedPages(text), sha256: null, chars: text.length, added: new Date().toISOString() });
    sha256Hex(new TextEncoder().encode(text)).then((h) => { const d = current.docs[current.docs.length - 1]; if (d) { d.sha256 = h; scheduleSave(); if (view === 'documents') renderDocuments(); } });
    $('#paste-text').value = ''; $('#paste-name').value = '';
    scheduleSave(); recompute(); renderAll();
  });
  $('#btn-analyze').addEventListener('click', () => { recompute(); renderAll(); if (result && current.docs.length) setView('questions'); });
  $('#btn-reset-answers').addEventListener('click', () => { if (!current) return; if (confirm('Reset all answers to the detected defaults?')) { current.answers = {}; scheduleSave(); recompute(); renderAll(); } });
  // Takeoff
  $('#btn-add-item').addEventListener('click', () => { if (!current) return; showModal('Add line item', '', [
    { name: 'item', label: 'Item', required: true }, { name: 'tags', label: 'Tags (comma separated)' }, { name: 'qty', label: 'Quantity (blank = TBD)', type: 'number' }, { name: 'unit', label: 'Unit', value: 'ea' },
    { name: 'bucket', label: 'Quoted by', type: 'select', options: Object.values(E.BUCKETS).sort((a, b) => a.order - b.order).map((b) => ({ value: b.key, label: b.label })), value: 'distributor' },
    { name: 'section', label: 'Specification section', value: '26' }, { name: 'qualifications', label: 'Qualifications', type: 'textarea' }], (d) => {
    current.manualItems.push({ id: uid(), item: d.item, tags: d.tags ? d.tags.split(',').map((x) => x.trim()).filter(Boolean) : [], qty: d.qty === '' ? null : Number(d.qty), unit: d.unit || 'ea', bucket: d.bucket, section: d.section, sectionPresent: true, qtyBasis: 'Manual entry', qualifications: d.qualifications ? [d.qualifications] : [], category: 'Manual', confidence: 'Confirmed', family: 'manual' });
    scheduleSave(); recompute(); renderAll();
  }); });
  $('#btn-clear-overrides').addEventListener('click', () => { if (!current) return; if (confirm('Clear all quantity, unit and channel edits and restore removed rule lines?')) { current.overrides = { items: {} }; scheduleSave(); recompute(); renderAll(); } });
  // RFIs
  $('#btn-add-rfi').addEventListener('click', () => { if (!current) return; showModal('Add RFI', '', [
    { name: 'priority', label: 'Priority', type: 'select', options: Object.entries(E.RFI_PRIORITY).map(([k, l]) => ({ value: k, label: l })), value: 'qualify' }, { name: 'topic', label: 'Topic', required: true }, { name: 'question', label: 'Question (as it will be sent)', type: 'textarea' }, { name: 'pricingBasis', label: 'Pricing basis pending answer', type: 'textarea' }, { name: 'risk', label: 'Risk' }], (d) => {
    const n = result.takeoff.rfis.length + 1;
    current.manualRfis.push({ id: `RFI-M${String(current.manualRfis.length + 1).padStart(2, '0')}`, priority: d.priority, topic: d.topic, question: d.question, pricingBasis: d.pricingBasis, risk: d.risk, evidence: [], n });
    scheduleSave(); recompute(); renderAll();
  }); });
  $('#btn-copy-rfis').addEventListener('click', async () => { if (!result) return; const text = result.takeoff.rfis.map((r) => `${r.id} - ${r.topic}\n${r.question}\n(Bidder's pricing basis if unanswered: ${r.pricingBasis})`).join('\n\n'); try { await navigator.clipboard.writeText(text); $('#btn-copy-rfis').textContent = 'Copied'; setTimeout(() => { $('#btn-copy-rfis').textContent = 'Copy ready-to-send text'; }, 1500); } catch { showModal('RFI text', `<textarea readonly style="min-height:50vh;font-family:inherit">${esc(text)}</textarea>`); } });
  // Schedule
  $('#btn-ics').addEventListener('click', () => { if (!result || !result.schedule.milestones.length) { alert('Set the bid due date first.'); return; } download(`${slug(current.name)}_bid_reminders.ics`, E.buildICS(current, result.schedule, result.takeoff.rfis.map((r) => ({ ...r, status: (current.rfiStatus[r.id] || {}).answered ? 'answered' : 'open' }))), 'text/calendar'); });
  // Exports
  $('#btn-xlsx').addEventListener('click', () => { if (result) exportXlsx(); });
  $$('[data-md]').forEach((b) => b.addEventListener('click', () => { if (!result) return; const md = E.renderQuoteRequest(current, result, b.dataset.md); download(`${slug(current.name)}_Quote_Request_${b.dataset.md}.md`, md, 'text/markdown'); preview(md); }));
  $('#btn-md-report').addEventListener('click', () => { if (!result) return; const md = E.renderTakeoffReport(current, { ...result, claude: current.claude }); download(`${slug(current.name)}_Div26_Takeoff_Report.md`, md, 'text/markdown'); preview(md); });
  $('#btn-md-rfi').addEventListener('click', () => { if (!result) return; const md = E.renderRfiLog(current, result, current.rfiStatus); download(`${slug(current.name)}_RFI_Log.md`, md, 'text/markdown'); preview(md); });
  $('#btn-json-export').addEventListener('click', () => { if (current) exportJson(); });
  $('#json-import').addEventListener('change', (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
  // Claude
  $('#claude-model').addEventListener('change', () => { settings.model = $('#claude-model').value; saveSettings(settings); updateClaudeEstimate(); });
  $('#claude-maxchars').addEventListener('change', () => { settings.maxChars = Number($('#claude-maxchars').value) || 900000; saveSettings(settings); updateClaudeEstimate(); });
  $('#api-key').addEventListener('change', () => { settings.apiKey = $('#api-key').value.trim(); saveSettings(settings); });
  $('#btn-claude-run').addEventListener('click', runClaude);
  $('#btn-claude-cancel').addEventListener('click', () => { if (claudeAbort) claudeAbort.abort(); });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  wireStatic();
  try { projects = await dbAll(); } catch (e) { console.error(e); projects = []; }
  projects.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  current = projects.find((p) => p.id === settings.lastProject) || projects[0] || null;
  view = settings.lastView && current ? settings.lastView : 'dashboard';
  recompute();
  renderAll();
  setInterval(() => { renderTopbar(); checkReminders(); }, 60000);
  checkReminders();
}

boot();
