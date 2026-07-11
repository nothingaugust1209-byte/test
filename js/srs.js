// SM-2簡易版のSRS(間隔反復)アルゴリズム
import { db } from './db.js';

export const GRADES = {
  REMEMBERED: 'おぼえてた',
  FUZZY: 'うろ覚え',
  FORGOT: '忘れてた'
};

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function srsId(termId, direction) {
  return `${termId}::${direction}`;
}

export async function getSrsState(termId, direction) {
  const rec = await db.get('srs', srsId(termId, direction));
  if (rec) return rec;
  return {
    id: srsId(termId, direction),
    termId,
    direction,
    easeFactor: DEFAULT_EASE,
    intervalDays: 0,
    dueDate: todayStr(-1), // 未学習は常に「今日やるべき」扱い
    correctStreak: 0,
    lastResult: null,
    reviewCount: 0
  };
}

export async function getAllSrsStates() {
  return db.getAll('srs');
}

// カードを自己採点した結果に基づき、次回の出題日を計算して保存する
export async function applyGrade(termId, direction, grade) {
  const state = await getSrsState(termId, direction);
  let { easeFactor, intervalDays, correctStreak } = state;

  if (grade === GRADES.REMEMBERED) {
    intervalDays = intervalDays <= 0 ? 1 : Math.round(intervalDays * easeFactor);
    easeFactor = Math.min(easeFactor + 0.1, 3.0);
    correctStreak += 1;
  } else if (grade === GRADES.FUZZY) {
    intervalDays = Math.max(1, intervalDays);
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.05);
    // intervalは維持（correctStreakも維持）
  } else {
    intervalDays = 1;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
    correctStreak = 0;
  }

  const updated = {
    ...state,
    easeFactor,
    intervalDays,
    dueDate: todayStr(intervalDays),
    correctStreak,
    lastResult: grade,
    reviewCount: (state.reviewCount || 0) + 1,
    lastReviewed: todayStr()
  };
  await db.put('srs', updated);
  return updated;
}

export function isDue(state) {
  return state.dueDate <= todayStr();
}

// termId一覧・方向一覧から「今日やるべきカード」を抽出する
export async function getDueCards(termIds, directions) {
  const allStates = await getAllSrsStates();
  const stateMap = new Map(allStates.map((s) => [s.id, s]));
  const due = [];
  for (const termId of termIds) {
    for (const direction of directions) {
      const id = srsId(termId, direction);
      const state = stateMap.get(id) || {
        id, termId, direction, easeFactor: DEFAULT_EASE, intervalDays: 0,
        dueDate: todayStr(-1), correctStreak: 0, lastResult: null, reviewCount: 0
      };
      if (isDue(state)) due.push(state);
    }
  }
  return due;
}

export async function getMasteryByChapter(termsByChapter) {
  const allStates = await getAllSrsStates();
  const stateMap = new Map(allStates.map((s) => [s.id, s]));
  const result = {};
  for (const [chapter, terms] of Object.entries(termsByChapter)) {
    let masteredPoints = 0;
    const totalPoints = terms.length * 2; // term-to-def, def-to-term の2方向
    for (const term of terms) {
      for (const direction of ['term-to-def', 'def-to-term']) {
        const state = stateMap.get(srsId(term.id, direction));
        if (state && state.correctStreak >= 2) masteredPoints += 1;
        else if (state && state.correctStreak >= 1) masteredPoints += 0.5;
      }
    }
    result[chapter] = totalPoints === 0 ? 0 : Math.round((masteredPoints / totalPoints) * 100);
  }
  return result;
}
