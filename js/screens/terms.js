// 「用語」画面：用語一覧・確率の基礎知識・章ごとの概念フローの3モードをまとめた画面
import { getTermsByChapter, getAllTerms, getTermById, searchTerms, getChapters } from '../data.js';
import { renderMath, renderMathAuto } from '../katexHelper.js';

const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];

let FLOW_DATA = null;
let flowLoaded = false;
async function ensureFlowLoaded() {
  if (flowLoaded) return;
  const res = await fetch('data/flow.json');
  FLOW_DATA = await res.json();
  flowLoaded = true;
}

const state = {
  mode: 'list', // 'list' | 'basics' | 'flow'
  chapter: 'all',
  query: '',
  flowChapter: 4,
  open: new Set()
};

export async function render(container) {
  await ensureFlowLoaded();

  container.innerHTML = `
    <div class="tabs" id="mode-tabs">
      <button class="tab-btn" data-mode="list">📖 用語一覧</button>
      <button class="tab-btn" data-mode="basics">🧩 基礎知識</button>
      <button class="tab-btn" data-mode="flow">🔗 概念フロー</button>
    </div>
    <div id="mode-body"></div>
  `;

  const modeTabs = container.querySelector('#mode-tabs');
  const body = container.querySelector('#mode-body');

  function renderModeTabs() {
    modeTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });
  }

  function renderBody() {
    if (state.mode === 'list') renderListMode(body);
    else if (state.mode === 'basics') renderBasicsMode(body);
    else renderFlowMode(body);
  }

  modeTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    renderModeTabs();
    renderBody();
  });

  renderModeTabs();
  renderBody();
}

// ---------------- 用語一覧 ----------------
function renderListMode(body) {
  body.innerHTML = `
    <input class="search-box" id="term-search" type="search" placeholder="キーワードで検索...">
    <div class="tabs" id="term-chapter-tabs"></div>
    <div id="term-list"></div>
  `;
  const chapterTabs = body.querySelector('#term-chapter-tabs');
  const list = body.querySelector('#term-list');
  const search = body.querySelector('#term-search');
  search.value = state.query;

  function renderChapterTabs() {
    const chapters = getChapters();
    chapterTabs.innerHTML = ['all', ...chapters].map((ch) => {
      const label = ch === 'all' ? '全て' : `第${ch}章`;
      return `<button class="tab-btn ${state.chapter === ch ? 'active' : ''}" data-chapter="${ch}">${label}</button>`;
    }).join('');
  }

  function currentItems() {
    let items = state.query ? searchTerms(state.query) : (state.chapter === 'all' ? getAllTerms() : getTermsByChapter(state.chapter));
    if (state.query && state.chapter !== 'all') items = items.filter((t) => t.chapter === state.chapter);
    return items;
  }

  function termCardHtml(t) {
    const confuse = (t.confusedWith || []).map((c) => {
      const ct = getTermById(c.id);
      return `<div class="confuse-box"><b>${ct ? ct.term : c.id} との違い：</b>${c.diff}</div>`;
    }).join('');
    const related = (t.relatedTerms || []).map((id) => {
      const rt = getTermById(id);
      return rt ? `<span class="related-chip" data-jump-term="${rt.id}">${rt.term}</span>` : '';
    }).join('');
    return `
      <div class="card term-card" id="term-${t.id}">
        <span class="chapter-tag">第${t.chapter}章</span>
        <div class="term-name mt-8">${t.term}</div>
        <div class="term-shortdef">${t.shortDef}</div>
        <div class="term-intuition">💡 ${t.intuition}</div>
        ${confuse}
        ${related ? `<div class="related-chip-row">${related}</div>` : ''}
      </div>
    `;
  }

  function renderList() {
    const items = currentItems();
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="big-emoji">🔍</div><p>該当する項目が見つかりません</p></div>`;
      return;
    }
    list.innerHTML = items.map(termCardHtml).join('');
    renderMath(list);
    renderMathAuto(list);

    list.querySelectorAll('[data-jump-term]').forEach((el) => {
      el.addEventListener('click', () => {
        state.chapter = 'all';
        state.query = '';
        search.value = '';
        renderChapterTabs();
        renderList();
        setTimeout(() => {
          const target = document.getElementById(`term-${el.dataset.jumpTerm}`);
          if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.style.outline = '2px solid var(--color-primary)'; setTimeout(() => target.style.outline = '', 1500); }
        }, 50);
      });
    });
  }

  chapterTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const raw = btn.dataset.chapter;
    state.chapter = raw === 'all' ? 'all' : Number(raw);
    renderChapterTabs();
    renderList();
  });

  let searchTimer = null;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = search.value;
      renderList();
    }, 150);
  });

  renderChapterTabs();
  renderList();
}

// ---------------- 基礎知識 ----------------
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

function renderBasicsMode(body) {
  body.innerHTML = `<div id="basics-list"></div>`;
  const list = body.querySelector('#basics-list');

  function renderList() {
    list.innerHTML = FLOW_DATA.basics.map(basicsCardHtml).join('');
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
  renderList();
}

// ---------------- 概念フロー ----------------
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

function renderFlowMode(body) {
  body.innerHTML = `
    <div class="tabs" id="flow-chapter-tabs">
      <button class="tab-btn" data-chapter="4">第4章</button>
      <button class="tab-btn" data-chapter="5">第5章</button>
      <button class="tab-btn" data-chapter="6">第6章</button>
    </div>
    <div id="flow-list"></div>
  `;
  const chapterTabs = body.querySelector('#flow-chapter-tabs');
  const list = body.querySelector('#flow-list');

  function renderChapterTabs() {
    chapterTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.chapter) === state.flowChapter);
    });
  }

  function renderList() {
    list.innerHTML = FLOW_DATA.chains.filter((c) => c.chapter === state.flowChapter).map(chainCardHtml).join('');
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

  chapterTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.flowChapter = Number(btn.dataset.chapter);
    renderChapterTabs();
    renderList();
  });

  renderChapterTabs();
  renderList();
}
