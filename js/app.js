import { loadData } from './data.js';
import { registerRoute, initRouter } from './router.js';
import * as terms from './screens/terms.js';
import * as flashcard from './screens/flashcard.js';
import * as calc from './screens/calc.js';
import * as mocktest from './screens/mocktest.js';

async function main() {
  await loadData();

  registerRoute('terms', terms.render);
  registerRoute('flashcard', flashcard.render);
  registerRoute('calc', calc.render);
  registerRoute('mocktest', mocktest.render);

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
