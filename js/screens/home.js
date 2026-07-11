import { getTermsByChapterMap, CHAPTER_NAMES } from '../data.js';
import { getDueCards, getMasteryByChapter } from '../srs.js';
import { getStreak } from '../db.js';
import { navigateTo } from '../router.js';

export async function render(container) {
  const termsByChapter = getTermsByChapterMap();
  const allTermIds = Object.values(termsByChapter).flat().map((t) => t.id);
  const directions = ['term-to-def', 'def-to-term'];

  const [dueCards, mastery, streak] = await Promise.all([
    getDueCards(allTermIds, directions),
    getMasteryByChapter(termsByChapter),
    getStreak()
  ]);

  document.getElementById('streak-badge').textContent = `🔥 ${streak}日`;

  const chapterRows = Object.entries(termsByChapter).map(([chapter, terms]) => {
    const pct = mastery[chapter] || 0;
    return `
      <div class="chapter-gauge-row">
        <div class="label">第${chapter}章</div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="pct">${pct}%</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="home-hero">
      <div class="hero-label">今日のノルマ</div>
      <div class="hero-num">${dueCards.length}<span style="font-size:16px;font-weight:600"> 件</span></div>
      <div class="hero-label">やるべきフラッシュカードがあります</div>
    </div>

    <h2 class="section-title">クイックスタート</h2>
    <div class="quick-actions">
      <div class="quick-action-btn" id="qa-quick">
        <span class="qa-icon">⏱️</span>隙間時間<br>5分
      </div>
      <div class="quick-action-btn" id="qa-focus">
        <span class="qa-icon">📖</span>じっくり<br>30分
      </div>
      <div class="quick-action-btn" id="qa-review">
        <span class="qa-icon">🎯</span>直前<br>総復習
      </div>
    </div>

    <h2 class="section-title">章別習熟度</h2>
    <div class="card">${chapterRows}</div>

    <h2 class="section-title">学習ストリーク</h2>
    <div class="card text-center">
      <div style="font-size:28px;font-weight:800">🔥 ${streak} 日連続</div>
      <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px">毎日ちょっとずつ続けよう</div>
    </div>
  `;

  container.querySelector('#qa-quick').addEventListener('click', () => {
    navigateTo('flashcard?mode=quick');
  });
  container.querySelector('#qa-focus').addEventListener('click', () => {
    navigateTo('flashcard?mode=focus');
  });
  container.querySelector('#qa-review').addEventListener('click', () => {
    navigateTo('quiz?mode=review');
  });
}
