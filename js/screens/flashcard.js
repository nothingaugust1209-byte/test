import { getChapters, getTermsByChapter, getFormulasByChapter, getTermById, getFormulaById } from '../data.js';
import { getSrsState, applyGrade, isDue, GRADES, srsId } from '../srs.js';
import { recordActivityToday } from '../db.js';
import { renderMath } from '../katexHelper.js';
import { shuffle } from '../data.js';
import { navigateTo } from '../router.js';

const DIRECTION_LABELS = {
  'term-to-def': '用語 → 意味',
  'def-to-term': '意味 → 用語',
  'formula-recall': '公式 穴埋め'
};

export async function render(container, params) {
  const mode = params.get('mode');
  const setup = {
    chapters: new Set(getChapters()),
    directions: new Set(['term-to-def', 'def-to-term']),
    dueOnly: true,
    limit: 15
  };
  if (mode === 'quick') { setup.limit = 8; setup.dueOnly = true; }
  if (mode === 'focus') { setup.limit = 30; setup.dueOnly = true; }

  if (mode === 'quick' || mode === 'focus') {
    const pool = await buildCardPool(setup);
    if (pool.length === 0) {
      renderSetupScreen(container, setup, true);
      return;
    }
    runSession(container, shuffle(pool).slice(0, setup.limit));
    return;
  }

  renderSetupScreen(container, setup, false);
}

function renderSetupScreen(container, setup, noCardsMessage) {
  const chapters = getChapters();
  container.innerHTML = `
    ${noCardsMessage ? `<div class="card" style="border-color:var(--color-warn)">今日やるべきカードはありませんでした。範囲を広げて練習できます。</div>` : ''}
    <div class="flash-setup">
      <div class="option-group">
        <div class="option-label">対象の章</div>
        <div class="chip-select" id="chapter-chips">
          ${chapters.map((ch) => `<div class="chip selected" data-chapter="${ch}">第${ch}章</div>`).join('')}
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">出題方向</div>
        <div class="chip-select" id="direction-chips">
          ${Object.entries(DIRECTION_LABELS).map(([key, label]) => `<div class="chip ${key !== 'formula-recall' ? 'selected' : ''}" data-direction="${key}">${label}</div>`).join('')}
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">範囲</div>
        <div class="chip-select" id="scope-chips">
          <div class="chip selected" data-scope="due">今日やるべきカードのみ</div>
          <div class="chip" data-scope="all">すべてのカード（自主練習）</div>
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">件数</div>
        <div class="chip-select" id="limit-chips">
          <div class="chip" data-limit="8">8問</div>
          <div class="chip selected" data-limit="15">15問</div>
          <div class="chip" data-limit="30">30問</div>
          <div class="chip" data-limit="9999">全部</div>
        </div>
      </div>
      <button class="btn block" id="start-btn">学習を始める</button>
    </div>
  `;

  const state = {
    chapters: new Set(getChapters()),
    directions: new Set(['term-to-def', 'def-to-term']),
    dueOnly: true,
    limit: 15
  };

  container.querySelector('#chapter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const ch = Number(chip.dataset.chapter);
    if (chip.classList.toggle('selected')) state.chapters.add(ch); else state.chapters.delete(ch);
  });
  container.querySelector('#direction-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const dir = chip.dataset.direction;
    if (chip.classList.toggle('selected')) state.directions.add(dir); else state.directions.delete(dir);
  });
  container.querySelector('#scope-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('#scope-chips .chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    state.dueOnly = chip.dataset.scope === 'due';
  });
  container.querySelector('#limit-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('#limit-chips .chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    state.limit = Number(chip.dataset.limit);
  });

  container.querySelector('#start-btn').addEventListener('click', async () => {
    if (state.chapters.size === 0 || state.directions.size === 0) {
      alert('章と出題方向を1つ以上選んでください');
      return;
    }
    const pool = await buildCardPool(state);
    if (pool.length === 0) {
      alert('該当するカードがありません。範囲を広げてください。');
      return;
    }
    runSession(container, shuffle(pool).slice(0, state.limit));
  });
}

async function buildCardPool({ chapters, directions, dueOnly }) {
  const pool = [];
  for (const chapter of chapters) {
    if (directions.has('term-to-def') || directions.has('def-to-term')) {
      const terms = getTermsByChapter(chapter);
      for (const term of terms) {
        for (const direction of ['term-to-def', 'def-to-term']) {
          if (!directions.has(direction)) continue;
          const state = await getSrsState(term.id, direction);
          if (dueOnly && !isDue(state)) continue;
          pool.push({ type: 'term', id: term.id, direction, state });
        }
      }
    }
    if (directions.has('formula-recall')) {
      const formulas = getFormulasByChapter(chapter);
      for (const formula of formulas) {
        const state = await getSrsState(formula.id, 'formula-recall');
        if (dueOnly && !isDue(state)) continue;
        pool.push({ type: 'formula', id: formula.id, direction: 'formula-recall', state });
      }
    }
  }
  return pool;
}

function cardFrontBack(card) {
  if (card.type === 'term') {
    const term = getTermById(card.id);
    if (card.direction === 'term-to-def') {
      return {
        directionLabel: '用語 → 意味',
        front: term.term,
        backHtml: `<div class="answer-shortdef">${term.shortDef}</div><div class="answer-intuition">💡 ${term.intuition}</div>`
      };
    }
    return {
      directionLabel: '意味 → 用語',
      front: term.shortDef,
      backHtml: `<div class="answer-shortdef">${term.term}</div><div class="answer-intuition">💡 ${term.intuition}</div>`
    };
  }
  const formula = getFormulaById(card.id);
  return {
    directionLabel: '公式 穴埋め',
    front: `${formula.name}\n\n${formula.meaning}`,
    backHtml: `<div class="formula-latex" data-latex="${formula.latex.replace(/"/g, '&quot;')}"></div><div class="answer-intuition">${formula.meaning}</div>`
  };
}

function runSession(container, cards) {
  let index = 0;
  let revealed = false;
  const results = [];

  function renderCard() {
    if (index >= cards.length) {
      renderSummary();
      return;
    }
    const card = cards[index];
    const { directionLabel, front, backHtml } = cardFrontBack(card);
    container.innerHTML = `
      <div class="flash-progress">${index + 1} / ${cards.length}</div>
      <div class="flashcard-stage">
        <div class="flashcard-face" id="flash-face">
          <div class="direction-hint">${directionLabel}</div>
          <div id="face-content">
            <div class="prompt-text" style="white-space:pre-line">${escapeHtml(front)}</div>
            <div class="tap-hint">タップして答えを見る</div>
          </div>
        </div>
      </div>
      <div id="grade-area"></div>
    `;
    revealed = false;
    const face = container.querySelector('#flash-face');
    face.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      container.querySelector('#face-content').innerHTML = `<div class="answer-block">${backHtml}</div>`;
      renderMath(container);
      renderGradeButtons(card);
    });
  }

  function renderGradeButtons(card) {
    const area = container.querySelector('#grade-area');
    area.innerHTML = `
      <div class="grade-buttons mt-16">
        <button class="btn danger" data-grade="${GRADES.FORGOT}"><span class="grade-emoji">😵</span>忘れてた</button>
        <button class="btn warn" data-grade="${GRADES.FUZZY}"><span class="grade-emoji">🤔</span>うろ覚え</button>
        <button class="btn success" data-grade="${GRADES.REMEMBERED}"><span class="grade-emoji">😄</span>覚えてた</button>
      </div>
    `;
    area.querySelectorAll('[data-grade]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const grade = btn.dataset.grade;
        await applyGrade(card.id, card.direction, grade);
        results.push({ card, grade });
        index += 1;
        renderCard();
      });
    });
  }

  async function renderSummary() {
    await recordActivityToday();
    const remembered = results.filter((r) => r.grade === GRADES.REMEMBERED).length;
    const fuzzy = results.filter((r) => r.grade === GRADES.FUZZY).length;
    const forgot = results.filter((r) => r.grade === GRADES.FORGOT).length;
    container.innerHTML = `
      <div class="card text-center">
        <div style="font-size:36px">🎉</div>
        <div style="font-size:18px;font-weight:700;margin:8px 0">${cards.length}枚のカードを学習しました</div>
        <div class="grid-3 mt-16">
          <div><div style="font-size:22px;font-weight:800;color:var(--color-success)">${remembered}</div><div style="font-size:12px;color:var(--color-text-muted)">覚えてた</div></div>
          <div><div style="font-size:22px;font-weight:800;color:var(--color-warn)">${fuzzy}</div><div style="font-size:12px;color:var(--color-text-muted)">うろ覚え</div></div>
          <div><div style="font-size:22px;font-weight:800;color:var(--color-danger)">${forgot}</div><div style="font-size:12px;color:var(--color-text-muted)">忘れてた</div></div>
        </div>
        <div class="flex-row mt-16">
          <button class="btn secondary block" id="back-home">ホームへ</button>
          <button class="btn block" id="again-btn">もう一度</button>
        </div>
      </div>
    `;
    container.querySelector('#back-home').addEventListener('click', () => navigateTo('home'));
    container.querySelector('#again-btn').addEventListener('click', () => navigateTo('flashcard'));
  }

  renderCard();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
