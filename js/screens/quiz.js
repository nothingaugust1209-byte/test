import {
  getChapters, getTermsByChapter, getFormulasByChapter,
  pickDistractors, shuffle, pickRandom
} from '../data.js';
import { getSrsState, applyGrade, GRADES } from '../srs.js';
import { recordActivityToday, db } from '../db.js';
import { renderMath, renderMathAuto } from '../katexHelper.js';
import { navigateTo } from '../router.js';

export async function render(container, params) {
  const mode = params.get('mode');
  if (mode === 'review') {
    const setup = { chapters: new Set(getChapters()), format: 'mix', scope: 'weak', count: 15, timeAttack: false };
    const pool = await buildPool(setup);
    if (pool.length === 0) {
      renderSetup(container, true);
      return;
    }
    startQuiz(container, pool, setup);
    return;
  }
  renderSetup(container, false);
}

function renderSetup(container, noItemsMessage) {
  const chapters = getChapters();
  container.innerHTML = `
    ${noItemsMessage ? `<div class="card" style="border-color:var(--color-warn)">苦手項目がまだ十分にありません。範囲を「全範囲」にして挑戦してみましょう。</div>` : ''}
    <div class="quiz-setup">
      <div class="option-group">
        <div class="option-label">出題形式</div>
        <div class="chip-select" id="format-chips">
          <div class="chip" data-format="mc">選択式</div>
          <div class="chip" data-format="desc">記述式</div>
          <div class="chip selected" data-format="mix">ミックス</div>
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">範囲</div>
        <div class="chip-select" id="scope-chips">
          <div class="chip selected" data-scope="all">全範囲</div>
          <div class="chip" data-scope="weak">苦手のみ</div>
          <div class="chip" data-scope="confused">紛らわしいペア集中</div>
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">対象の章</div>
        <div class="chip-select" id="chapter-chips">
          ${chapters.map((ch) => `<div class="chip selected" data-chapter="${ch}">第${ch}章</div>`).join('')}
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">問題数</div>
        <div class="chip-select" id="count-chips">
          <div class="chip" data-count="10">10問</div>
          <div class="chip selected" data-count="15">15問</div>
          <div class="chip" data-count="25">25問</div>
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">タイムアタック</div>
        <div class="chip-select" id="timer-chips">
          <div class="chip selected" data-timer="off">オフ</div>
          <div class="chip" data-timer="on">オン（本番想定）</div>
        </div>
      </div>
      <button class="btn block" id="start-quiz-btn">クイズを始める</button>
    </div>
  `;

  const setup = { chapters: new Set(getChapters()), format: 'mix', scope: 'all', count: 15, timeAttack: false };

  container.querySelector('#format-chips').addEventListener('click', (e) => setSingleChip(e, container, '#format-chips', (v) => setup.format = v, 'format'));
  container.querySelector('#scope-chips').addEventListener('click', (e) => setSingleChip(e, container, '#scope-chips', (v) => setup.scope = v, 'scope'));
  container.querySelector('#count-chips').addEventListener('click', (e) => setSingleChip(e, container, '#count-chips', (v) => setup.count = Number(v), 'count'));
  container.querySelector('#timer-chips').addEventListener('click', (e) => setSingleChip(e, container, '#timer-chips', (v) => setup.timeAttack = v === 'on', 'timer'));
  container.querySelector('#chapter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const ch = Number(chip.dataset.chapter);
    if (chip.classList.toggle('selected')) setup.chapters.add(ch); else setup.chapters.delete(ch);
  });

  container.querySelector('#start-quiz-btn').addEventListener('click', async () => {
    if (setup.chapters.size === 0) { alert('章を1つ以上選んでください'); return; }
    const pool = await buildPool(setup);
    if (pool.length === 0) { alert('該当する問題がありません。範囲を変更してください。'); return; }
    startQuiz(container, pool, setup);
  });
}

function setSingleChip(e, container, selector, setter, dataKey) {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  container.querySelectorAll(`${selector} .chip`).forEach((c) => c.classList.remove('selected'));
  chip.classList.add('selected');
  setter(chip.dataset[dataKey]);
}

async function buildPool({ chapters, scope }) {
  const items = [];
  for (const chapter of chapters) {
    for (const term of getTermsByChapter(chapter)) {
      if (scope === 'confused' && (!term.confusedWith || term.confusedWith.length === 0)) continue;
      if (scope === 'weak') {
        const state = await getSrsState(term.id, 'term-to-def');
        if (!(state.lastResult === GRADES.FORGOT || (state.reviewCount > 0 && state.correctStreak === 0))) continue;
      }
      items.push({ type: 'term', data: term });
    }
    if (scope === 'all') {
      for (const formula of getFormulasByChapter(chapter)) {
        items.push({ type: 'formula', data: formula });
      }
    }
  }
  return items;
}

function buildQuestion(item, formatSetting, allTermsSameChapterFn) {
  const format = formatSetting === 'mix' ? (Math.random() < 0.5 ? 'mc' : 'desc') : formatSetting;
  if (item.type === 'term') {
    const term = item.data;
    const askForTerm = Math.random() < 0.5; // trueなら「意味→用語」、falseなら「用語→意味」
    if (format === 'mc') {
      const distractors = pickDistractors(term, 3);
      if (askForTerm) {
        const choices = shuffle([term, ...distractors]).map((t) => t.term);
        return {
          kind: 'mc', sourceId: term.id, direction: 'def-to-term',
          promptLabel: '次の説明に当てはまる用語を選べ',
          promptText: term.shortDef,
          choices,
          correctAnswer: term.term,
          revealHtml: `<b>${term.term}</b><br>💡 ${term.intuition}`
        };
      }
      const choices = shuffle([term, ...distractors]).map((t) => t.shortDef);
      return {
        kind: 'mc', sourceId: term.id, direction: 'term-to-def',
        promptLabel: '次の用語の意味として正しいものを選べ',
        promptText: term.term,
        choices,
        correctAnswer: term.shortDef,
        revealHtml: `<b>${term.shortDef}</b><br>💡 ${term.intuition}`
      };
    }
    // descriptive
    if (askForTerm) {
      return {
        kind: 'desc', sourceId: term.id, direction: 'def-to-term',
        promptLabel: '次の説明が指す用語を答えよ',
        promptText: term.shortDef,
        correctAnswer: term.term,
        revealHtml: `<b>${term.term}</b><br>💡 ${term.intuition}`
      };
    }
    return {
      kind: 'desc', sourceId: term.id, direction: 'term-to-def',
      promptLabel: '次の用語の意味を説明せよ',
      promptText: term.term,
      correctAnswer: term.shortDef,
      revealHtml: `<b>${term.shortDef}</b><br>💡 ${term.intuition}`
    };
  }
  // formula
  const formula = item.data;
  if (format === 'mc') {
    const choices = [formula.name];
    return {
      kind: 'mc', sourceId: formula.id, direction: 'formula-recall',
      promptLabel: '次の式に対応する名称を選べ',
      promptLatex: formula.latex,
      choices: null,
      correctAnswer: formula.name,
      revealHtml: `<b>${formula.name}</b><br>${formula.meaning}`,
      isFormulaPrompt: true
    };
  }
  return {
    kind: 'desc', sourceId: formula.id, direction: 'formula-recall',
    promptLabel: '次の式の名称・意味を答えよ',
    promptLatex: formula.latex,
    correctAnswer: formula.name,
    revealHtml: `<b>${formula.name}</b><br>${formula.meaning}`
  };
}

function startQuiz(container, pool, setup) {
  const items = pickRandom(pool, Math.min(setup.count, pool.length));
  const questions = items.map((item) => buildQuestion(item, setup.format));
  // 選択式の選択肢生成をformula MCにも対応させる（同章formulaのnameから）
  questions.forEach((q, i) => {
    if (q.isFormulaPrompt) {
      const others = pool.filter((p) => p.type === 'formula' && p.data.id !== q.sourceId).map((p) => p.data.name);
      q.choices = shuffle([q.correctAnswer, ...pickRandom(others, Math.min(3, others.length))]);
    }
  });

  let index = 0;
  const answers = [];
  let timerInterval = null;
  let timeLeft = setup.timeAttack ? questions.length * 25 : null;

  function renderTimer(area) {
    if (!setup.timeAttack) return;
    const min = Math.floor(timeLeft / 60);
    const sec = String(timeLeft % 60).padStart(2, '0');
    area.innerHTML = `<div class="timer-row ${timeLeft <= 10 ? 'low-time' : ''}">⏱ 残り ${min}:${sec}</div>`;
  }

  function startTimer() {
    if (!setup.timeAttack) return;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft -= 1;
      const area = container.querySelector('#timer-area');
      if (area) renderTimer(area);
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        finishQuiz();
      }
    }, 1000);
  }

  function renderQuestion() {
    if (index >= questions.length) { finishQuiz(); return; }
    const q = questions[index];
    container.innerHTML = `
      <div id="timer-area"></div>
      <div class="quiz-progress-row"><span>問題 ${index + 1} / ${questions.length}</span></div>
      <div class="card quiz-question-card">
        <div class="q-type-badge">${q.kind === 'mc' ? '選択式' : '記述式'}</div>
        <div class="q-text">${q.promptLabel}</div>
        ${q.promptLatex ? `<div class="formula-latex" data-latex="${q.promptLatex.replace(/"/g, '&quot;')}"></div>` : ''}
        ${q.promptText ? `<div class="q-text" style="font-size:15px;font-weight:600;background:var(--color-bg);padding:12px 14px;border-radius:8px">${q.promptText}</div>` : ''}
        <div id="answer-area" class="mt-16"></div>
        <div id="reveal-area" class="reveal-box"></div>
        <div id="self-grade-area" class="self-grade-row"></div>
      </div>
    `;
    renderTimer(container.querySelector('#timer-area'));
    renderMath(container);
    renderMathAuto(container);

    const answerArea = container.querySelector('#answer-area');
    if (q.kind === 'mc') {
      answerArea.innerHTML = `<div class="choice-list">${q.choices.map((c, i) => `<div class="choice-item" data-choice-idx="${i}">${c}</div>`).join('')}</div>`;
      answerArea.querySelectorAll('.choice-item').forEach((el) => {
        el.addEventListener('click', () => {
          if (container.querySelector('.choice-item.selected')) return; // 一度回答したら固定
          const chosen = q.choices[Number(el.dataset.choiceIdx)];
          const correct = chosen === q.correctAnswer;
          answerArea.querySelectorAll('.choice-item').forEach((c2) => {
            c2.classList.add('selected');
            if (c2.textContent === q.correctAnswer) c2.classList.add('correct');
            else if (c2 === el) c2.classList.add('incorrect');
          });
          recordAnswer(q, correct);
        });
      });
    } else {
      answerArea.innerHTML = `
        <textarea class="answer-input" id="desc-answer" placeholder="ここに回答を入力（自己採点なので簡単なメモでもOK）"></textarea>
        <button class="btn block mt-8" id="reveal-btn">答え合わせをする</button>
      `;
      answerArea.querySelector('#reveal-btn').addEventListener('click', () => {
        const revealArea = container.querySelector('#reveal-area');
        revealArea.innerHTML = q.revealHtml;
        revealArea.classList.add('show');
        renderMath(revealArea);
        renderMathAuto(revealArea);
        answerArea.querySelector('#reveal-btn').remove();
        const gradeArea = container.querySelector('#self-grade-area');
        gradeArea.classList.add('show');
        gradeArea.innerHTML = `
          <div class="flex-row mt-8">
            <button class="btn danger block" data-self="wrong">✗ 不正解だった</button>
            <button class="btn success block" data-self="right">✓ 正解だった</button>
          </div>
        `;
        gradeArea.querySelector('[data-self="right"]').addEventListener('click', () => recordAnswer(q, true));
        gradeArea.querySelector('[data-self="wrong"]').addEventListener('click', () => recordAnswer(q, false));
      });
    }

    if (q.kind === 'mc') {
      const revealArea = container.querySelector('#reveal-area');
      // 選択後に解説を出すためのフック（choice-item クリック時にも表示する）
      answerArea.querySelectorAll('.choice-item').forEach((el) => {
        el.addEventListener('click', () => {
          revealArea.innerHTML = q.revealHtml;
          revealArea.classList.add('show');
          renderMath(revealArea);
          renderMathAuto(revealArea);
        }, { once: true });
      });
    }
  }

  async function recordAnswer(q, correct) {
    answers.push({ q, correct });
    await applyGrade(q.sourceId, q.direction, correct ? GRADES.REMEMBERED : GRADES.FORGOT);
    index += 1;
    setTimeout(renderQuestion, correct ? 400 : 900);
  }

  async function finishQuiz() {
    clearInterval(timerInterval);
    await recordActivityToday();
    const correctCount = answers.filter((a) => a.correct).length;
    const wrong = answers.filter((a) => !a.correct);
    await db.add('quizHistory', {
      date: new Date().toISOString(),
      total: questions.length,
      correct: correctCount,
      wrongIds: wrong.map((w) => w.q.sourceId)
    });
    container.innerHTML = `
      <div class="quiz-result-summary">
        <div class="result-score">${correctCount} / ${answers.length}</div>
        <div style="color:var(--color-text-muted);font-size:13px">正答率 ${answers.length ? Math.round((correctCount / answers.length) * 100) : 0}%</div>
      </div>
      ${wrong.length > 0 ? `<h2 class="section-title">間違えた項目（SRSキューに追加済み）</h2><div class="card">${wrong.map((w) => `<div class="wrong-list-item"><span>${w.q.correctAnswer}</span><span class="chapter-tag">要復習</span></div>`).join('')}</div>` : `<div class="card text-center">全問正解でした！🎉</div>`}
      <div class="flex-row mt-16">
        <button class="btn secondary block" id="back-home">ホームへ</button>
        <button class="btn block" id="retry-btn">もう一度</button>
      </div>
    `;
    container.querySelector('#back-home').addEventListener('click', () => navigateTo('home'));
    container.querySelector('#retry-btn').addEventListener('click', () => navigateTo('quiz'));
  }

  renderQuestion();
  startTimer();
}
