import { getTermsByChapterMap, getTermById, getFormulaById } from '../data.js';
import { getMasteryByChapter, getAllSrsStates } from '../srs.js';
import { db } from '../db.js';

function getLabelForId(id) {
  const term = getTermById(id);
  if (term) return term.term;
  const formula = getFormulaById(id);
  if (formula) return formula.name;
  return id;
}

export async function render(container) {
  const termsByChapter = getTermsByChapterMap();
  const [mastery, allStates, history] = await Promise.all([
    getMasteryByChapter(termsByChapter),
    getAllSrsStates(),
    db.getAll('quizHistory')
  ]);

  const chapterRows = Object.entries(termsByChapter).map(([chapter, terms]) => {
    const pct = mastery[chapter] || 0;
    return `
      <div class="chapter-gauge-row">
        <div class="label">第${chapter}章</div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="pct">${pct}%</div>
      </div>`;
  }).join('');

  const wrongCounts = new Map();
  history.forEach((h) => {
    (h.wrongIds || []).forEach((id) => wrongCounts.set(id, (wrongCounts.get(id) || 0) + 1));
  });
  const ranking = [...wrongCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const recentHistory = [...history].reverse().slice(0, 10);

  container.innerHTML = `
    <h2 class="section-title">章別習熟度</h2>
    <div class="card">${chapterRows || '<div class="empty-state">まだデータがありません</div>'}</div>

    <h2 class="section-title">よく間違える用語・公式ランキング</h2>
    <div class="card">
      ${ranking.length === 0 ? '<div class="empty-state">クイズに挑戦するとここにランキングが表示されます</div>' :
        ranking.map(([id, count], i) => {
          const label = getLabelForId(id);
          return `<div class="wrong-list-item"><span>${i + 1}. ${label}</span><span class="chapter-tag">${count}回</span></div>`;
        }).join('')}
    </div>

    <h2 class="section-title">クイズ履歴</h2>
    <div class="card">
      ${recentHistory.length === 0 ? '<div class="empty-state">まだクイズの記録がありません</div>' :
        recentHistory.map((h) => {
          const date = new Date(h.date);
          const dateLabel = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          return `<div class="wrong-list-item"><span>${dateLabel}</span><span class="chapter-tag">${h.correct}/${h.total}</span></div>`;
        }).join('')}
    </div>

    <h2 class="section-title">学習統計</h2>
    <div class="card">
      <div class="wrong-list-item"><span>累計レビュー回数</span><span>${allStates.reduce((s, st) => s + (st.reviewCount || 0), 0)} 回</span></div>
      <div class="wrong-list-item"><span>学習中のカード数</span><span>${allStates.filter((s) => s.reviewCount > 0).length} 枚</span></div>
      <div class="wrong-list-item"><span>累計クイズ回数</span><span>${history.length} 回</span></div>
    </div>
  `;
}
