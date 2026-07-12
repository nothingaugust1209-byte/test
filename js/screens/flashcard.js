// フラッシュカード：資料に出てくる順番通り、またはランダムに用語→意味を出題するシンプルなカード学習
import { getChapters, getTermsByChapter, shuffle } from '../data.js';
import { renderMath, renderMathAuto } from '../katexHelper.js';
import { navigateTo } from '../router.js';

export async function render(container) {
  renderSetupScreen(container);
}

function renderSetupScreen(container) {
  const chapters = getChapters();
  container.innerHTML = `
    <div class="flash-setup">
      <div class="option-group">
        <div class="option-label">対象の章</div>
        <div class="chip-select" id="chapter-chips">
          ${chapters.map((ch) => `<div class="chip selected" data-chapter="${ch}">第${ch}章</div>`).join('')}
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">出題順</div>
        <div class="chip-select" id="order-chips">
          <div class="chip selected" data-order="sequential">資料の順番通り</div>
          <div class="chip" data-order="random">ランダム</div>
        </div>
      </div>
      <button class="btn block" id="start-btn">学習を始める</button>
    </div>
  `;

  const state = {
    chapters: new Set(chapters),
    order: 'sequential'
  };

  container.querySelector('#chapter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const ch = Number(chip.dataset.chapter);
    if (chip.classList.toggle('selected')) state.chapters.add(ch); else state.chapters.delete(ch);
  });
  container.querySelector('#order-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('#order-chips .chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    state.order = chip.dataset.order;
  });

  container.querySelector('#start-btn').addEventListener('click', () => {
    if (state.chapters.size === 0) { alert('章を1つ以上選んでください'); return; }
    let cards = [];
    for (const ch of chapters) {
      if (!state.chapters.has(ch)) continue;
      cards = cards.concat(getTermsByChapter(ch));
    }
    if (state.order === 'random') cards = shuffle([...cards]);
    if (cards.length === 0) { alert('該当するカードがありません'); return; }
    runSession(container, cards);
  });
}

function runSession(container, cards) {
  let index = 0;
  let revealed = false;

  function renderCard() {
    if (index >= cards.length) { renderSummary(); return; }
    const term = cards[index];
    container.innerHTML = `
      <div class="flash-progress">${index + 1} / ${cards.length}</div>
      <div class="flashcard-stage">
        <div class="flashcard-face" id="flash-face">
          <div class="direction-hint">用語 → 意味</div>
          <div id="face-content">
            <div class="prompt-text">${term.term}</div>
            <div class="tap-hint">タップして意味を見る</div>
          </div>
        </div>
      </div>
      <div class="flex-row mt-16">
        <button class="btn secondary block" id="prev-btn" ${index === 0 ? 'disabled' : ''}>◀ 前へ</button>
        <button class="btn block" id="next-btn">次へ ▶</button>
      </div>
    `;
    revealed = false;
    const face = container.querySelector('#flash-face');
    face.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      container.querySelector('#face-content').innerHTML = `
        <div class="answer-block">
          <div class="answer-shortdef">${term.shortDef}</div>
          <div class="answer-intuition">💡 ${term.intuition}</div>
        </div>
      `;
      renderMath(container);
      renderMathAuto(container);
    });
    container.querySelector('#prev-btn').addEventListener('click', () => {
      if (index === 0) return;
      index -= 1;
      renderCard();
    });
    container.querySelector('#next-btn').addEventListener('click', () => {
      index += 1;
      renderCard();
    });
  }

  function renderSummary() {
    container.innerHTML = `
      <div class="card text-center">
        <div style="font-size:36px">🎉</div>
        <div style="font-size:18px;font-weight:700;margin:8px 0">${cards.length}枚のカードを学習しました</div>
        <div class="flex-row mt-16">
          <button class="btn secondary block" id="back-btn">用語一覧へ</button>
          <button class="btn block" id="again-btn">もう一度</button>
        </div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => navigateTo('terms'));
    container.querySelector('#again-btn').addEventListener('click', () => navigateTo('flashcard'));
  }

  renderCard();
}
