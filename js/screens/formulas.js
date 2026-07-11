import {
  getFormulasByChapter, getAllFormulas, getFormulaById,
  getTermsByChapter, getAllTerms, getTermById,
  searchFormulas, searchTerms, getChapters, CHAPTER_NAMES
} from '../data.js';
import { renderMath, renderMathAuto } from '../katexHelper.js';

const state = {
  mode: 'formula', // 'formula' | 'term'
  chapter: 'all',
  query: '',
  openDerivations: new Set()
};

export async function render(container) {
  container.innerHTML = `
    <div class="tabs" id="mode-tabs">
      <button class="tab-btn" data-mode="formula">Σ 公式</button>
      <button class="tab-btn" data-mode="term">📖 用語</button>
    </div>
    <input class="search-box" id="ref-search" type="search" placeholder="キーワードで検索...">
    <div class="tabs" id="chapter-tabs"></div>
    <div id="ref-list"></div>
  `;

  const modeTabs = container.querySelector('#mode-tabs');
  const chapterTabs = container.querySelector('#chapter-tabs');
  const list = container.querySelector('#ref-list');
  const search = container.querySelector('#ref-search');
  search.value = state.query;

  function renderChapterTabs() {
    const chapters = getChapters();
    chapterTabs.innerHTML = ['all', ...chapters].map((ch) => {
      const label = ch === 'all' ? '全て' : `第${ch}章`;
      return `<button class="tab-btn ${state.chapter === ch ? 'active' : ''}" data-chapter="${ch}">${label}</button>`;
    }).join('');
  }

  function renderModeTabs() {
    modeTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });
  }

  function currentItems() {
    if (state.mode === 'formula') {
      let items = state.query ? searchFormulas(state.query) : (state.chapter === 'all' ? getAllFormulas() : getFormulasByChapter(state.chapter));
      if (state.query && state.chapter !== 'all') items = items.filter((f) => f.chapter === state.chapter);
      return items;
    } else {
      let items = state.query ? searchTerms(state.query) : (state.chapter === 'all' ? getAllTerms() : getTermsByChapter(state.chapter));
      if (state.query && state.chapter !== 'all') items = items.filter((t) => t.chapter === state.chapter);
      return items;
    }
  }

  function formulaCardHtml(f) {
    const open = state.openDerivations.has(f.id);
    const related = (f.relatedFormulaIds || []).map((id) => {
      const rf = getFormulaById(id);
      return rf ? `<span class="related-chip" data-jump-formula="${rf.id}">${rf.name}</span>` : '';
    }).join('');
    return `
      <div class="card formula-card" id="formula-${f.id}">
        <span class="chapter-tag">第${f.chapter}章</span>
        <div class="formula-name mt-8">${f.name}</div>
        <div class="formula-latex" data-latex="${escapeAttr(f.latex)}"></div>
        <div class="formula-meaning">${f.meaning}</div>
        <div class="derivation-toggle" data-toggle-derivation="${f.id}">${open ? '▲ 導出の流れを閉じる' : '▼ 導出の流れを見る'}</div>
        <div class="derivation-panel ${open ? 'open' : ''}">
          <ol>${f.derivation.map((d) => `<li>${d}</li>`).join('')}</ol>
        </div>
        ${related ? `<div class="related-chip-row">${related}</div>` : ''}
      </div>
    `;
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
    list.innerHTML = items.map((item) => (state.mode === 'formula' ? formulaCardHtml(item) : termCardHtml(item))).join('');
    renderMath(list);
    renderMathAuto(list);

    list.querySelectorAll('[data-toggle-derivation]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.toggleDerivation;
        if (state.openDerivations.has(id)) state.openDerivations.delete(id);
        else state.openDerivations.add(id);
        renderList();
      });
    });
    list.querySelectorAll('[data-jump-formula]').forEach((el) => {
      el.addEventListener('click', () => {
        state.mode = 'formula';
        state.chapter = 'all';
        state.query = '';
        search.value = '';
        renderModeTabs(); renderChapterTabs(); renderList();
        setTimeout(() => {
          const target = document.getElementById(`formula-${el.dataset.jumpFormula}`);
          if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.style.outline = '2px solid var(--color-primary)'; setTimeout(() => target.style.outline = '', 1500); }
        }, 50);
      });
    });
    list.querySelectorAll('[data-jump-term]').forEach((el) => {
      el.addEventListener('click', () => {
        state.mode = 'term';
        state.chapter = 'all';
        state.query = '';
        search.value = '';
        renderModeTabs(); renderChapterTabs(); renderList();
        setTimeout(() => {
          const target = document.getElementById(`term-${el.dataset.jumpTerm}`);
          if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.style.outline = '2px solid var(--color-primary)'; setTimeout(() => target.style.outline = '', 1500); }
        }, 50);
      });
    });
  }

  modeTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    renderModeTabs();
    renderList();
  });

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

  renderModeTabs();
  renderChapterTabs();
  renderList();
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
