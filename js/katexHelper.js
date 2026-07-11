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

// 計算問題画面用：本文中の $...$ / \[...\] を自動検出してレンダリングする（KaTeX auto-render拡張）。
// 用語・公式カードは data-latex 方式のままなので、こちらは calc.js からのみ呼び出す。
export function renderMathAuto(container) {
  if (typeof window === 'undefined' || typeof window.renderMathInElement !== 'function') return;
  window.renderMathInElement(container, {
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false
  });
}
