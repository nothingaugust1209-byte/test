// 簡易ハッシュルーター
const routes = new Map();
let mainView = null;
let navItems = null;

export function registerRoute(name, renderFn) {
  routes.set(name, renderFn);
}

function parseHash() {
  const hash = location.hash.replace(/^#\//, '') || 'terms';
  const [route, queryStr] = hash.split('?');
  const params = new URLSearchParams(queryStr || '');
  return { route: route || 'terms', params };
}

async function renderCurrentRoute() {
  const { route, params } = parseHash();
  const renderFn = routes.get(route) || routes.get('terms');
  navItems.forEach((el) => {
    el.classList.toggle('active', el.dataset.route === route);
  });
  mainView.innerHTML = '<div class="text-center" style="padding:60px 0;color:var(--color-text-muted)">読み込み中...</div>';
  try {
    await renderFn(mainView, params);
  } catch (err) {
    console.error(err);
    mainView.innerHTML = `<div class="empty-state"><div class="big-emoji">⚠️</div><p>読み込みエラーが発生しました。</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

export function navigateTo(route) {
  location.hash = `#/${route}`;
}

export function initRouter() {
  mainView = document.getElementById('main-view');
  navItems = document.querySelectorAll('.nav-item');
  window.addEventListener('hashchange', renderCurrentRoute);
  renderCurrentRoute();
}
