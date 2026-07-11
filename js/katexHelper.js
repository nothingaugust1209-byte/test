// KaTeXレンダリングのヘルパー。data-latex属性を持つ要素をまとめて描画する。
export function renderMath(container) {
  if (typeof katex === 'undefined') return;
  const nodes = container.querySelectorAll('[data-latex]');
  nodes.forEach((node) => {
    const latex = node.getAttribute('data-latex');
    try {
      katex.render(latex, node, { throwOnError: false, displayMode: node.dataset.display !== 'false' });
    } catch (e) {
      node.textContent = latex;
    }
  });
}
