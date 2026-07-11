import { loadData } from './data.js';
import { registerRoute, initRouter } from './router.js';
import * as home from './screens/home.js';
import * as flashcard from './screens/flashcard.js';
import * as formulas from './screens/formulas.js';
import * as quiz from './screens/quiz.js';
import * as progress from './screens/progress.js';

async function main() {
  await loadData();

  registerRoute('home', home.render);
  registerRoute('flashcard', flashcard.render);
  registerRoute('formulas', formulas.render);
  registerRoute('quiz', quiz.render);
  registerRoute('progress', progress.render);

  initRouter();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // 新しいService Workerが有効化されたら、古いキャッシュのまま止まらないよう自動で1回だけ再読み込みする
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }
}

main();
