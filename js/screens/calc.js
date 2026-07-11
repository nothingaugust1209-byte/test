import { renderMathAuto } from '../katexHelper.js';

let CALC_DATA = [];
let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  const res = await fetch('data/calc.json');
  CALC_DATA = await res.json();
  loaded = true;
}

const state = {
  chapter: 'all',
  query: '',
  open: new Set()
};

export async function render(container) {
  await ensureLoaded();

  container.innerHTML = `
    <input class="search-box" id="calc-search" type="search" placeholder="計算問題を検索（例：ハフマン、通信路容量）">
    <div class="tabs" id="calc-chapter-tabs"></div>
    <div id="calc-list"></div>
  `;

  const chapterTabs = container.querySelector('#calc-chapter-tabs');
  const list = container.querySelector('#calc-list');
  const search = container.querySelector('#calc-search');
  search.value = state.query;

  const chapters = [...new Set(CALC_DATA.map((c) => c.chapter))].sort((a, b) => a - b);

  function renderChapterTabs() {
    chapterTabs.innerHTML = ['all', ...chapters].map((ch) => {
      const label = ch === 'all' ? '全て' : `第${ch}章`;
      return `<button class="tab-btn ${state.chapter === ch ? 'active' : ''}" data-chapter="${ch}">${label}</button>`;
    }).join('');
  }

  function currentItems() {
    const q = state.query.trim().toLowerCase();
    return CALC_DATA.filter((item) => {
      if (state.chapter !== 'all' && item.chapter !== state.chapter) return false;
      if (!q) return true;
      const haystack = (item.title + ' ' + item.kw + ' ' + item.body).toLowerCase();
      return haystack.includes(q);
    });
  }

  function itemHtml(item) {
    const isOpen = state.open.has(item.id);
    return `
      <div class="card calc-card">
        <div class="calc-card-head" data-toggle="${item.id}">
          <span class="chapter-tag">第${item.chapter}章</span>
          <span class="calc-card-title">${item.title}</span>
          <span class="calc-chev">${isOpen ? '▾' : '▸'}</span>
        </div>
        <div class="calc-card-body ${isOpen ? 'open' : ''}">${item.body}</div>
      </div>
    `;
  }

  function renderList() {
    const items = currentItems();
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="big-emoji">🔍</div><p>該当する計算問題が見つかりません</p></div>`;
      return;
    }
    list.innerHTML = items.map(itemHtml).join('');
    renderMathAuto(list);

    list.querySelectorAll('[data-toggle]').forEach((head) => {
      head.addEventListener('click', () => {
        const id = head.dataset.toggle;
        if (state.open.has(id)) state.open.delete(id);
        else state.open.add(id);
        renderList();
      });
    });
    list.querySelectorAll('.reveal-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ans = btn.nextElementSibling;
        ans.classList.toggle('show');
        btn.textContent = ans.classList.contains('show') ? '▲ 答えを隠す' : '▼ 答えを見る';
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
