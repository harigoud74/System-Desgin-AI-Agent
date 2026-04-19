/**
 * app.js — Memory-First System Design Agent
 * ─────────────────────────────────────────────────────────────
 * Talks to the Express backend at BACKEND_URL.
 * Renders all report sections including the hero memory panels.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

// ── CONFIG ────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:3001';

// ── EXAMPLE PROMPTS ───────────────────────────────────────────
const EXAMPLES = [
  'Build a food delivery app for local restaurants with real-time order tracking, driver location updates, and a restaurant dashboard to manage orders and menus.',
  'Create an online learning platform (LMS) where instructors can upload video courses, students can enrol, track progress, take quizzes, and earn certificates.',
  'Design a SaaS project management tool with kanban boards, team collaboration, time-tracking, Slack integration, and monthly billing via Stripe.',
];

let exampleIndex = 0;
let lastReport   = null;

// ── DOM REFS ──────────────────────────────────────────────────
const userId          = () => document.getElementById('userId').value.trim();
const idea            = () => document.getElementById('ideaInput').value.trim();
const generateBtn     = document.getElementById('generateBtn');
const exampleBtn      = document.getElementById('exampleBtn');
const clearBtn        = document.getElementById('clearBtn');
const copyBtn         = document.getElementById('copyBtn');
const loadingBar      = document.getElementById('loadingBar');
const loadingStatus   = document.getElementById('loadingStatus');
const resultsContainer = document.getElementById('resultsContainer');

// ── EVENT LISTENERS ───────────────────────────────────────────
generateBtn.addEventListener('click', handleGenerate);
exampleBtn.addEventListener('click', loadExample);
clearBtn.addEventListener('click', clearResults);
copyBtn.addEventListener('click', copyReport);

document.getElementById('ideaInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
});

// ── MAIN FLOW ─────────────────────────────────────────────────
async function handleGenerate() {
  const uid  = userId();
  const text = idea();

  if (!uid)           return showStatus('Please enter a Session Identity.');
  if (text.length < 10) return showStatus('Please describe your app idea in at least 10 characters.');

  setLoading(true, 'Recalling your memory bank from Hindsight…');

  try {
    const res = await fetch(`${BACKEND_URL}/api/generate-design`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: uid, idea: text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    setLoading(true, 'Analysing your idea across 4 reasoning stages…');
    const data = await res.json();

    setLoading(true, 'Rendering your system design blueprint…');
    renderReport(data);

    lastReport = data;
    copyBtn.style.display = 'inline-flex';

  } catch (err) {
    showStatus(`⚠ Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

// ── RENDER ────────────────────────────────────────────────────
function renderReport(data) {
  resultsContainer.style.display = 'flex';

  renderMemoryRecalled(data.memoryRecalled || []);
  renderProjectSummary(data);
  renderRoles(data.userRoles || []);
  renderList('functionalList',     data.functionalRequirements    || [], 'req-list');
  renderList('nonFunctionalList',  data.nonFunctionalRequirements || [], 'req-list');
  renderFeatures(data.coreFeatures || []);
  renderImprovements(data.suggestedImprovements || []);
  renderModules(data.systemModules || []);
  renderFlow(data.architectureFlow || []);
  renderEntities(data.databaseEntities || []);
  renderEndpoints(data.apiEndpoints || []);
  renderPhases(data.developmentPlan || []);
  renderDeployment(data.deploymentPlan || []);
  renderAssembly(data.assemblyGuide || []);
  renderMemoryLearned(data.memoryLearned || []);

  // Scroll to results
  setTimeout(() => resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ── MEMORY RECALLED ───────────────────────────────────────────
function renderMemoryRecalled(memories) {
  const grid  = document.getElementById('memoryRecalledGrid');
  const empty = document.getElementById('memoryRecalledEmpty');
  const meta  = document.getElementById('memoryRecalledMeta');

  grid.innerHTML = '';

  if (!memories.length) {
    empty.style.display = 'flex';
    meta.textContent    = 'First session — no prior memories found.';
    return;
  }

  empty.style.display = 'none';
  meta.textContent    = `${memories.length} memor${memories.length === 1 ? 'y' : 'ies'} recalled from your Hindsight bank. Used to personalise this design.`;

  memories.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'memory-chip';
    chip.innerHTML = `
      <span class="memory-key">${esc(m.key || 'memory')}</span>
      <span class="memory-value">${esc(m.value || '')}</span>
      ${m.score != null ? `<span class="memory-score">relevance: ${(m.score * 100).toFixed(0)}%</span>` : ''}
    `;
    grid.appendChild(chip);
  });
}

// ── MEMORY LEARNED ────────────────────────────────────────────
function renderMemoryLearned(memories) {
  const grid = document.getElementById('memoryLearnedGrid');
  grid.innerHTML = '';

  memories.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'memory-chip';
    chip.innerHTML = `
      <span class="memory-key">${esc(m.key || 'memory')}</span>
      <span class="memory-value">${esc(m.value || '')}</span>
    `;
    grid.appendChild(chip);
  });

  if (!memories.length) {
    grid.innerHTML = '<div class="memory-empty"><span>No new memories extracted from this session.</span></div>';
  }
}

// ── PROJECT SUMMARY ───────────────────────────────────────────
function renderProjectSummary(data) {
  document.getElementById('projectTitle').textContent       = data.projectTitle      || 'System Design Report';
  document.getElementById('projectSummaryText').textContent = data.projectSummary    || '';
  const badge = document.getElementById('techStackBadge');
  badge.textContent = data.techStackSummary || '';
  badge.style.display = data.techStackSummary ? 'block' : 'none';
}

// ── ROLES ─────────────────────────────────────────────────────
function renderRoles(roles) {
  const el = document.getElementById('userRolesList');
  el.innerHTML = roles.map(r => `<li>${esc(r)}</li>`).join('') || '<li>—</li>';
}

// ── GENERIC LIST ──────────────────────────────────────────────
function renderList(elId, items, _cls) {
  const el = document.getElementById(elId);
  el.innerHTML = items.map(i => `<li>${esc(i)}</li>`).join('') || '<li>—</li>';
}

// ── FEATURES ─────────────────────────────────────────────────
function renderFeatures(features) {
  const el = document.getElementById('featuresList');
  el.innerHTML = features.map(f => {
    const p = (f.priority || 'must-have').toLowerCase().replace(/[^a-z-]/g, '');
    const badgeClass = p.includes('must') ? 'badge-must' : p.includes('should') ? 'badge-should' : 'badge-nice';
    return `
      <div class="feature-card">
        <span class="feature-badge ${badgeClass}">${esc(f.priority || 'must-have')}</span>
        <div class="feature-name">${esc(f.name || '')}</div>
        <div class="feature-desc">${esc(f.description || '')}</div>
      </div>`;
  }).join('');
}

// ── IMPROVEMENTS ─────────────────────────────────────────────
function renderImprovements(items) {
  const el = document.getElementById('improvementsList');
  el.innerHTML = items.map(item => {
    const effort = (item.effort || 'medium').toLowerCase();
    return `
      <div class="improvement-row">
        <span class="improvement-effort effort-${effort}">${esc(effort)}</span>
        <div class="improvement-body">
          <div class="improvement-title">${esc(item.title || '')}</div>
          <div class="improvement-rationale">${esc(item.rationale || '')}</div>
        </div>
      </div>`;
  }).join('');
}

// ── MODULES ──────────────────────────────────────────────────
function renderModules(modules) {
  const el = document.getElementById('modulesList');
  el.innerHTML = modules.map(m => `
    <div class="module-card">
      <div class="module-name">${esc(m.name || '')}</div>
      <div class="module-resp">${esc(m.responsibility || '')}</div>
      <div class="module-tech">${esc(m.techStack || '')}</div>
    </div>`).join('');
}

// ── ARCHITECTURE FLOW ─────────────────────────────────────────
function renderFlow(steps) {
  const el = document.getElementById('architectureFlowList');
  el.innerHTML = steps.map(s => `<li>${esc(s)}</li>`).join('');
}

// ── DATABASE ENTITIES ─────────────────────────────────────────
function renderEntities(entities) {
  const el = document.getElementById('entityList');
  el.innerHTML = entities.map(e => `
    <div class="entity-card">
      <div class="entity-header">${esc(e.entity || '')}</div>
      <div class="entity-fields">
        ${(e.fields || []).map(f => `<span class="entity-field">${esc(f)}</span>`).join('')}
      </div>
      ${e.relationships?.length ? `<div class="entity-relations">${esc(e.relationships.join(' · '))}</div>` : ''}
    </div>`).join('');
}

// ── API ENDPOINTS ─────────────────────────────────────────────
function renderEndpoints(endpoints) {
  const el = document.getElementById('endpointList');
  el.innerHTML = endpoints.map(ep => `
    <div class="endpoint-row">
      <span class="method-badge method-${(ep.method || 'GET').toUpperCase()}">${esc(ep.method || 'GET')}</span>
      <span class="endpoint-path">${esc(ep.path || '')}</span>
      <div class="endpoint-detail">
        <span class="endpoint-desc">${esc(ep.description || '')}</span>
        ${ep.requestBody ? `<span class="endpoint-contract">req: ${esc(ep.requestBody)}</span>` : ''}
        ${ep.response    ? `<span class="endpoint-contract">res: ${esc(ep.response)}</span>`    : ''}
      </div>
    </div>`).join('');
}

// ── DEV PHASES ────────────────────────────────────────────────
function renderPhases(phases) {
  const el = document.getElementById('phaseList');
  el.innerHTML = phases.map(p => `
    <div class="phase-card">
      <div class="phase-header">
        <span class="phase-name">${esc(p.phase || '')}</span>
        ${p.duration ? `<span class="phase-duration">${esc(p.duration)}</span>` : ''}
      </div>
      <ul class="phase-tasks">
        ${(p.tasks || []).map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>`).join('');
}

// ── DEPLOYMENT ────────────────────────────────────────────────
function renderDeployment(steps) {
  const el = document.getElementById('deployList');
  el.innerHTML = steps.map(s => `
    <li>
      <div class="deploy-action">${esc(s.action || '')}</div>
      ${s.tool  ? `<div class="deploy-tool">${esc(s.tool)}</div>`  : ''}
      ${s.notes ? `<div class="deploy-notes">${esc(s.notes)}</div>` : ''}
    </li>`).join('');
}

// ── ASSEMBLY GUIDE ────────────────────────────────────────────
function renderAssembly(steps) {
  const el = document.getElementById('assemblyList');
  el.innerHTML = steps.map(s => `<li>${esc(s)}</li>`).join('');
}

// ── HELPERS ───────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoading(on, msg = '') {
  generateBtn.disabled = on;
  loadingBar.classList.toggle('active', on);
  loadingStatus.textContent = on ? msg : '';
  if (on) resultsContainer.style.display = 'none';
}

function showStatus(msg) {
  loadingStatus.textContent = msg;
  setTimeout(() => { loadingStatus.textContent = ''; }, 5000);
}

function loadExample() {
  document.getElementById('ideaInput').value = EXAMPLES[exampleIndex % EXAMPLES.length];
  exampleIndex++;
}

function clearResults() {
  resultsContainer.style.display = 'none';
  resultsContainer.innerHTML     = '';
  loadingStatus.textContent      = '';
  copyBtn.style.display          = 'none';
  lastReport = null;
}

function copyReport() {
  if (!lastReport) return;
  const text = JSON.stringify(lastReport, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.querySelector('.btn-text') && (copyBtn.querySelector('.btn-text') || copyBtn).textContent !== undefined
      ? null : null;
    const orig = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = orig; }, 2000);
  });
}
