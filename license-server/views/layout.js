/**
 * Layout base do site público (cabeçalho, rodapé, <head>).
 * Todo texto dinâmico passa por escapeHtml.
 */
const conteudo = require("../lib/conteudo");
const cfg = require("../lib/config");
const { escapeHtml: e } = require("../lib/http");

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#10213a"/><path d="M18 22h28M18 32h20M18 42h14" stroke="#f6f1e7" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="42" r="6" fill="#ff6a2b"/></svg>'
  );

const brl = (centavos) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const whatsappUrl = (numero) => {
  const n = String(numero || "").replace(/\D/g, "");
  return n.length >= 10 ? `https://wa.me/${n}` : null;
};

function layout({ titulo, descricao, corpo, pagina = "", semNav = false }) {
  const g = conteudo.obter("site.geral");
  const tituloFinal = titulo ? `${titulo} · ${g.nomeProduto}` : g.seoTitulo;
  const whats = whatsappUrl(g.whatsapp);
  const nav = semNav
    ? ""
    : `<nav class="nav" aria-label="Principal">
        <a href="/#recursos">Recursos</a>
        <a href="/#planos">Planos</a>
        <a href="/#duvidas">Dúvidas</a>
      </nav>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(tituloFinal)}</title>
<meta name="description" content="${e(descricao || g.seoDescricao)}">
<meta property="og:title" content="${e(tituloFinal)}">
<meta property="og:description" content="${e(descricao || g.seoDescricao)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#10213a">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Schibsted+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap">
<link rel="stylesheet" href="/site/site.css">
<script src="/site/site.js" defer></script>
</head>
<body class="pg-${e(pagina)}">
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
${cfg.MP_API_BASE !== cfg.MP_API_OFICIAL ? `<p class="faixa-homologacao">Ambiente de homologação · pagamentos simulados, nenhuma cobrança é real</p>` : ""}
<header class="topo">
  <div class="topo__in">
    <a class="marca" href="/" aria-label="${e(g.nomeProduto)} — início">
      <span class="marca__icone" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="marca__nome">${e(g.nomeProduto)}</span>
    </a>
    ${nav}
    <div class="topo__acoes">
      <a class="link-discreto" href="/cliente">Área do cliente</a>
      ${semNav ? "" : `<a class="btn btn--pequeno" href="/#planos">Ver planos</a>`}
    </div>
  </div>
</header>
<main id="conteudo">
${corpo}
</main>
<footer class="rodape">
  <div class="rodape__in">
    <div class="rodape__marca">
      <a class="marca marca--claro" href="/"><span class="marca__icone" aria-hidden="true"><i></i><i></i><i></i></span><span class="marca__nome">${e(g.nomeProduto)}</span></a>
      <p>${e(g.rodape)}</p>
    </div>
    <ul class="rodape__links">
      <li><a href="/cliente">Área do cliente</a></li>
      <li><a href="/termos">Termos de uso</a></li>
      <li><a href="/privacidade">Privacidade</a></li>
    </ul>
    <ul class="rodape__links">
      ${g.emailContato ? `<li><a href="mailto:${e(g.emailContato)}">${e(g.emailContato)}</a></li>` : ""}
      ${whats ? `<li><a href="${e(whats)}" rel="noopener" target="_blank">WhatsApp</a></li>` : ""}
    </ul>
  </div>
  <p class="rodape__legal">© ${new Date().getFullYear()} ${e(g.nomeProduto)}. Pagamentos processados pelo Mercado Pago.</p>
</footer>
</body>
</html>`;
}

module.exports = { layout, brl, whatsappUrl };
