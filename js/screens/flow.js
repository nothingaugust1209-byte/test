import { getTermById } from '../data.js';
import { renderMathAuto } from '../katexHelper.js';

const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];

let FLOW_DATA = null;
let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  const res = await fetch('data/flow.json');
  FLOW_DATA = await res.json();
  loaded = true;
}

const state = {
  view: 'basics', // 'basics' | 4 | 5 | 6
  open: new Set()
};

function basicsCardHtml(b) {
  const isOpen = state.open.has(b.id);
  return `
    <div class="card calc-card">
      <div class="calc-card-head" data-toggle="${b.id}">
        <span class="calc-card-title">${b.title}</span>
        <span class="calc-chev">${isOpen ? '▾' : '▸'}</span>
      </div>
      <div class="calc-card-body ${isOpen ? 'open' : ''}">
        <p class="flow-lead">${b.lead}</p>
        ${b.bodyHtml}
      </div>
    </div>
  `;
}

function chainCardHtml(chain) {
  const isOpen = state.open.has(chain.id);
  const nodesHtml = chain.nodes.map((termId, i) => {
    const t = getTermById(termId);
    if (!t) return '';
    const arrow = i < chain.nodes.length - 1 ? '<div class="flow-arrow">↓</div>' : '';
    return `
      <div class="flow-node">
        <span class="flow-node-num">${CIRCLED[i] || (i + 1)}</span><span class="flow-node-term">${t.term}</span>
        <div class="flow-node-def">${t.shortDef}</div>
      </div>
      ${arrow}
    `;
  }).join('');
  return `
    <div class="card calc-card">
      <div class="calc-card-head" data-toggle="${chain.id}">
        <span class="chapter-tag">第${chain.chapter}章</span>
        <span class="calc-card-title">${chain.title}</span>
        <span class="calc-chev">${isOpen ? '▾' : '▸'}</span>
      </div>
      <div class="calc-card-body ${isOpen ? 'open' : ''}">
        <p class="flow-lead">${chain.lead}</p>
        <div class="flow-node-list">${nodesHtml}</div>
        <div class="flow-narrative">${chain.narrativeHtml}</div>
      </div>
    </div>
  `;
}

export async function render(container) {
  await ensureLoaded();

  container.innerHTML = `
    <div class="tabs" id="flow-tabs">
      <button class="tab-btn" data-view="basics">🧩 基礎知識</button>
      <button class="tab-btn" data-view="4">第4章</button>
      <button class="tab-btn" data-view="5">第5章</button>
      <button class="tab-btn" data-view="6">第6章</button>
    </div>
    <div id="flow-list"></div>
  `;

  const tabs = container.querySelector('#flow-tabs');
  const list = container.querySelector('#flow-list');

  function renderTabs() {
    tabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === String(state.view));
    });
  }

  function renderList() {
    let html;
    if (state.view === 'basics') {
      html = FLOW_DATA.basics.map(basicsCardHtml).join('');
    } else {
      html = FLOW_DATA.chains.filter((c) => c.chapter === state.view).map(chainCardHtml).join('');
    }
    list.innerHTML = html;
    renderMathAuto(list);

    list.querySelectorAll('[data-toggle]').forEach((head) => {
      head.addEventListener('click', () => {
        const id = head.dataset.toggle;
        if (state.open.has(id)) state.open.delete(id);
        else state.open.add(id);
        renderList();
      });
    });
  }

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.view = btn.dataset.view === 'basics' ? 'basics' : Number(btn.dataset.view);
    renderTabs();
    renderList();
  });

  renderTabs();
  renderList();
}
