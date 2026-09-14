/**
 * Markdown mínimo e seguro (texto é escapado antes de formatar).
 * Suporta: ## / ### títulos, parágrafos, listas "- ", **negrito**, *itálico*,
 * [texto](https://link) e quebras de linha.
 */
const { escapeHtml } = require("./http");

function inline(texto) {
  return escapeHtml(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^\s)]+)\)/g, (_m, t, url) => {
      const externo = /^https?:/.test(url);
      return `<a href="${url}"${externo ? ' target="_blank" rel="noopener noreferrer"' : ""}>${t}</a>`;
    });
}

function markdown(fonte) {
  const linhas = String(fonte || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let paragrafo = [];
  let lista = [];

  const fecharParagrafo = () => {
    if (paragrafo.length) out.push(`<p>${paragrafo.map(inline).join("<br>")}</p>`);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista.length) out.push(`<ul>${lista.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
    lista = [];
  };

  for (const bruta of linhas) {
    const linha = bruta.trimEnd();
    let m;
    if (!linha.trim()) {
      fecharParagrafo();
      fecharLista();
    } else if ((m = linha.match(/^(#{2,3})\s+(.*)$/))) {
      fecharParagrafo();
      fecharLista();
      const n = m[1].length;
      out.push(`<h${n}>${inline(m[2])}</h${n}>`);
    } else if ((m = linha.match(/^\s*[-*]\s+(.*)$/))) {
      fecharParagrafo();
      lista.push(m[1]);
    } else {
      fecharLista();
      paragrafo.push(linha);
    }
  }
  fecharParagrafo();
  fecharLista();
  return out.join("\n");
}

// Texto simples (para versão texto dos e-mails).
function textoPuro(fonte) {
  return String(fonte || "")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

module.exports = { markdown, inline, textoPuro };
