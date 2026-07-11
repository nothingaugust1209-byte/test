// 用語・公式データのロードとアクセスヘルパー
let terms = [];
let formulas = [];
let loaded = false;

export async function loadData() {
  if (loaded) return;
  const [termsRes, formulasRes] = await Promise.all([
    fetch('data/terms.json'),
    fetch('data/formulas.json')
  ]);
  terms = await termsRes.json();
  formulas = await formulasRes.json();
  loaded = true;
}

export function getAllTerms() { return terms; }
export function getAllFormulas() { return formulas; }

export function getTermById(id) { return terms.find((t) => t.id === id); }
export function getFormulaById(id) { return formulas.find((f) => f.id === id); }

export function getTermsByChapter(chapter) {
  return terms.filter((t) => t.chapter === chapter);
}
export function getFormulasByChapter(chapter) {
  return formulas.filter((f) => f.chapter === chapter);
}

export function getChapters() {
  return [...new Set(terms.map((t) => t.chapter))].sort((a, b) => a - b);
}

export function getTermsByChapterMap() {
  const map = {};
  for (const ch of getChapters()) map[ch] = getTermsByChapter(ch);
  return map;
}

export function searchTerms(query) {
  const q = query.trim().toLowerCase();
  if (!q) return terms;
  return terms.filter((t) =>
    t.term.toLowerCase().includes(q) ||
    t.shortDef.toLowerCase().includes(q) ||
    t.intuition.toLowerCase().includes(q)
  );
}

export function searchFormulas(query) {
  const q = query.trim().toLowerCase();
  if (!q) return formulas;
  return formulas.filter((f) =>
    f.name.toLowerCase().includes(q) ||
    f.meaning.toLowerCase().includes(q)
  );
}

// 選択式クイズ用に、confusedWithを優先して紛らわしい誤答選択肢を作る
export function pickDistractors(term, count = 3) {
  const pool = terms.filter((t) => t.id !== term.id && t.chapter === term.chapter);
  const confusedIds = (term.confusedWith || []).map((c) => c.id);
  const confused = pool.filter((t) => confusedIds.includes(t.id));
  const rest = pool.filter((t) => !confusedIds.includes(t.id));
  shuffle(rest);
  const picked = [...confused, ...rest].slice(0, count);
  shuffle(picked);
  return picked;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRandom(arr, count) {
  const copy = shuffle([...arr]);
  return copy.slice(0, count);
}

export const CHAPTER_NAMES = {
  4: '第4章 情報源符号化',
  5: '第5章 通信路',
  6: '第6章 通信路符号化'
};
