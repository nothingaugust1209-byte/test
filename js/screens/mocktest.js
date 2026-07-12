// 模擬テスト：用語の意味を答える問題と、計算問題を半々ぐらいの割合で出題する
import { getChapters, getTermsByChapter, pickDistractors, shuffle, pickRandom } from '../data.js';
import { renderMath, renderMathAuto } from '../katexHelper.js';
import { navigateTo } from '../router.js';

let CALC_DATA = [];
let calcLoaded = false;
async function ensureCalcLoaded() {
  if (calcLoaded) return;
  const res = await fetch('data/calc.json');
  CALC_DATA = await res.json();
  calcLoaded = true;
}

export async function render(container) {
  await ensureCalcLoaded();
  renderSetup(container);
}

function renderSetup(container) {
  const chapters = getChapters();
  container.innerHTML = `
    <div class="quiz-setup">
      <div class="option-group">
        <div class="option-label">対象の章</div>
        <div class="chip-select" id="chapter-chips">
          ${chapters.map((ch) => `<div class="chip selected" data-chapter="${ch}">第${ch}章</div>`).join('')}
        </div>
      </div>
      <div class="option-group">
        <div class="option-label">用語問題の形式</div>
        <div class="chip-select" id="format-chips">
          <div class="chip" data-format="mc">選択式</div>
          <div class="chip" data-format="desc">記述式</div>
          <div class="chip selected" data-format="mix">ミックス</div>
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
      <p style="font-size:12.5px;color:var(--color-text-muted);margin:4px 0 16px">用語の意味を答える問題と計算問題を、できるだけ半々の割合で出題します。</p>
      <button class="btn block" id="start-btn">模擬テストを始める</button>
    </div>
  `;

  const setup = { chapters: new Set(getChapters()), format: 'mix', count: 15 };

  container.querySelector('#chapter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const ch = Number(chip.dataset.chapter);
    if (chip.classList.toggle('selected')) setup.chapters.add(ch); else setup.chapters.delete(ch);
  });
  container.querySelector('#format-chips').addEventListener('click', (e) => setSingleChip(e, container, '#format-chips', (v) => setup.format = v, 'format'));
  container.querySelector('#count-chips').addEventListener('click', (e) => setSingleChip(e, container, '#count-chips', (v) => setup.count = Number(v), 'count'));

  container.querySelector('#start-btn').addEventListener('click', () => {
    if (setup.chapters.size === 0) { alert('章を1つ以上選んでください'); return; }
    const questions = buildQuestions(setup);
    if (questions.length === 0) { alert('該当する問題がありません。範囲を変更してください。'); return; }
    startQuiz(container, questions);
  });
}

function setSingleChip(e, container, selector, setter, dataKey) {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  container.querySelectorAll(`${selector} .chip`).forEach((c) => c.classList.remove('selected'));
  chip.classList.add('selected');
  setter(chip.dataset[dataKey]);
}

function buildQuestions({ chapters, format, count }) {
  const wordPool = [];
  for (const ch of chapters) wordPool.push(...getTermsByChapter(ch));
  const calcPool = CALC_DATA.filter((item) => chapters.has(item.chapter));

  const desiredCalc = Math.round(count / 2);
  const calcCount = Math.min(desiredCalc, calcPool.length);
  const wordCount = Math.min(count - calcCount, wordPool.length);

  const chosenTerms = pickRandom(wordPool, wordCount);
  const chosenCalc = pickRandom(calcPool, calcCount);

  const questions = [
    ...chosenTerms.map((term) => buildWordQuestion(term, format)),
    ...chosenCalc.map((item) => ({ kind: 'calc', data: item }))
  ];
  return shuffle(questions);
}

function buildWordQuestion(term, formatSetting) {
  const format = formatSetting === 'mix' ? (Math.random() < 0.5 ? 'mc' : 'desc') : formatSetting;
  const askForTerm = Math.random() < 0.5; // trueなら「意味→用語」、falseなら「用語→意味」
  if (format === 'mc') {
    const distractors = pickDistractors(term, 3);
    if (askForTerm) {
      const choices = shuffle([term, ...distractors]).map((t) => t.term);
      return {
        kind: 'mc',
        promptLabel: '次の説明に当てはまる用語を選べ',
        promptText: term.shortDef,
        choices,
        correctAnswer: term.term,
        revealHtml: `<b>${term.term}</b><br>💡 ${term.intuition}`
      };
    }
    const choices = shuffle([term, ...distractors]).map((t) => t.shortDef);
    return {
      kind: 'mc',
      promptLabel: '次の用語の意味として正しいものを選べ',
      promptText: term.term,
      choices,
      correctAnswer: term.shortDef,
      revealHtml: `<b>${term.shortDef}</b><br>💡 ${term.intuition}`
    };
  }
  if (askForTerm) {
    return {
      kind: 'desc',
      promptLabel: '次の説明が指す用語を答えよ',
      promptText: term.shortDef,
      correctAnswer: term.term,
      revealHtml: `<b>${term.term}</b><br>💡 ${term.intuition}`
    };
  }
  return {
    kind: 'desc',
    promptLabel: '次の用語の意味を説明せよ',
    promptText: term.term,
    correctAnswer: term.shortDef,
    revealHtml: `<b>${term.shortDef}</b><br>💡 ${term.intuition}`
  };
}

function startQuiz(container, questions) {
  let index = 0;
  const answers = [];

  function renderQuestion() {
    if (index >= questions.length) { finishQuiz(); return; }
    const q = questions[index];
    container.innerHTML = `
      <div class="quiz-progress-row"><span>問題 ${index + 1} / ${questions.length}</span></div>
      <div class="card quiz-question-card">
        ${q.kind === 'calc' ? renderCalcQuestion(q) : renderWordQuestion(q)}
      </div>
    `;
    renderMath(container);
    renderMathAuto(container);

    if (q.kind === 'calc') wireCalcQuestion(container, q);
    else wireWordQuestion(container, q);
  }

  function renderWordQuestion(q) {
    return `
      <div class="q-type-badge">${q.kind === 'mc' ? '選択式・用語' : '記述式・用語'}</div>
      <div class="q-text">${q.promptLabel}</div>
      <div class="q-text" style="font-size:15px;font-weight:600;background:var(--color-bg);padding:12px 14px;border-radius:8px">${q.promptText}</div>
      <div id="answer-area" class="mt-16"></div>
      <div id="reveal-area" class="reveal-box"></div>
      <div id="self-grade-area" class="self-grade-row"></div>
    `;
  }

  function wireWordQuestion(container, q) {
    const answerArea = container.querySelector('#answer-area');
    if (q.kind === 'mc') {
      answerArea.innerHTML = `<div class="choice-list">${q.choices.map((c, i) => `<div class="choice-item" data-choice-idx="${i}">${c}</div>`).join('')}</div>`;
      const revealArea = container.querySelector('#reveal-area');
      answerArea.querySelectorAll('.choice-item').forEach((el) => {
        el.addEventListener('click', () => {
          if (container.querySelector('.choice-item.selected')) return;
          const chosen = q.choices[Number(el.dataset.choiceIdx)];
          const correct = chosen === q.correctAnswer;
          answerArea.querySelectorAll('.choice-item').forEach((c2) => {
            c2.classList.add('selected');
            if (c2.textContent === q.correctAnswer) c2.classList.add('correct');
            else if (c2 === el) c2.classList.add('incorrect');
          });
          revealArea.innerHTML = q.revealHtml;
          revealArea.classList.add('show');
          renderMath(revealArea);
          renderMathAuto(revealArea);
          recordAnswer(correct);
        });
      });
    } else {
      answerArea.innerHTML = `
        <textarea class="answer-input" id="desc-answer" placeholder="ここに回答を入力（自己採点なので簡単なメモでもOK）"></textarea>
        <button class="btn block mt-8" id="reveal-btn-word">答え合わせをする</button>
      `;
      answerArea.querySelector('#reveal-btn-word').addEventListener('click', () => {
        const revealArea = container.querySelector('#reveal-area');
        revealArea.innerHTML = q.revealHtml;
        revealArea.classList.add('show');
        renderMath(revealArea);
        renderMathAuto(revealArea);
        answerArea.querySelector('#reveal-btn-word').remove();
        showSelfGrade(container);
      });
    }
  }

  function renderCalcQuestion(q) {
    return `
      <div class="q-type-badge">計算問題</div>
      <span class="chapter-tag mt-8">第${q.data.chapter}章</span>
      <div class="q-text mt-8">${q.data.title}</div>
      <div id="calc-question-body">${q.data.body}</div>
      <div id="self-grade-area" class="self-grade-row"></div>
    `;
  }

  function wireCalcQuestion(container) {
    const body = container.querySelector('#calc-question-body');
    body.querySelectorAll('.reveal-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ans = btn.nextElementSibling;
        ans.classList.toggle('show');
        btn.textContent = ans.classList.contains('show') ? '▲ 答えを隠す' : '▼ 答えを見る';
        if (ans.classList.contains('show')) showSelfGrade(container);
      }, { once: false });
    });
  }

  function showSelfGrade(container) {
    const gradeArea = container.querySelector('#self-grade-area');
    if (gradeArea.classList.contains('show')) return;
    gradeArea.classList.add('show');
    gradeArea.innerHTML = `
      <div class="flex-row mt-8">
        <button class="btn danger block" data-self="wrong">✗ 不正解だった</button>
        <button class="btn success block" data-self="right">✓ 正解だった</button>
      </div>
    `;
    gradeArea.querySelector('[data-self="right"]').addEventListener('click', () => recordAnswer(true));
    gradeArea.querySelector('[data-self="wrong"]').addEventListener('click', () => recordAnswer(false));
  }

  function recordAnswer(correct) {
    answers.push(correct);
    index += 1;
    setTimeout(renderQuestion, correct ? 400 : 900);
  }

  function finishQuiz() {
    const correctCount = answers.filter((a) => a).length;
    container.innerHTML = `
      <div class="quiz-result-summary">
        <div class="result-score">${correctCount} / ${answers.length}</div>
        <div style="color:var(--color-text-muted);font-size:13px">正答率 ${answers.length ? Math.round((correctCount / answers.length) * 100) : 0}%</div>
      </div>
      <div class="flex-row mt-16">
        <button class="btn secondary block" id="back-btn">用語一覧へ</button>
        <button class="btn block" id="retry-btn">もう一度</button>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => navigateTo('terms'));
    container.querySelector('#retry-btn').addEventListener('click', () => navigateTo('mocktest'));
  }

  renderQuestion();
}
