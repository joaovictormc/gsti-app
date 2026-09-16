/** Landing page de vendas — todo o texto vem do conteúdo editável (lib/conteudo.js). */
const conteudo = require("../lib/conteudo");
const { escapeHtml: e } = require("../lib/http");
const { layout } = require("./layout");
const { cartaoPlano, dialogoCheckout, inclusos } = require("./componentes");

const pad = (n) => String(n + 1).padStart(2, "0");

// Ordem de serviço ilustrativa (substituída pela imagem de destaque, se houver).
function ticketOs() {
  const t = conteudo.obter("site.ticket");
  return `<figure class="ticket" aria-label="Exemplo de ordem de serviço no sistema">
    <div class="ticket__cabeca">
      <span class="rotulo-mono">Ordem de serviço</span>
      <span class="ticket__numero">Nº ${e(t.numero)}</span>
    </div>
    <dl class="ticket__dados">
      <div><dt>Cliente</dt><dd>${e(t.cliente)}</dd></div>
      <div><dt>Equipamento</dt><dd>${e(t.equipamento)}</dd></div>
      <div><dt>Defeito relatado</dt><dd>${e(t.defeito)}</dd></div>
      <div class="ticket__linha"><div><dt>Garantia</dt><dd>${e(t.garantia)}</dd></div><div><dt>Total</dt><dd class="ticket__total">${e(t.total)}</dd></div></div>
    </dl>
    <ol class="ticket__etapas">
      ${t.etapas.map((p) => `<li class="${e(p.estado)}"><span>${e(p.titulo)}</span><time>${e(p.quando)}</time></li>`).join("")}
    </ol>
    ${t.rodape ? `<figcaption class="ticket__rodape">${e(t.rodape)}</figcaption>` : ""}
  </figure>`;
}

function renderLanding({ ofertas, pagamentosAtivos }) {
  const c = conteudo.obterVarios([
    "site.geral", "site.hero", "site.recursos", "site.como_funciona", "site.telas",
    "site.planos", "site.depoimentos", "site.faq", "site.cta_final", "site.secoes",
  ]);
  const g = c["site.geral"], h = c["site.hero"];

  const hero = `<section class="hero">
    <div class="hero__in">
      <div class="hero__texto">
        ${h.selo ? `<p class="selo">${e(h.selo)}</p>` : ""}
        <h1>${e(h.titulo)}</h1>
        <p class="hero__sub">${e(h.subtitulo)}</p>
        <div class="hero__acoes">
          ${h.ctaPrimario ? `<a class="btn" href="#planos">${e(h.ctaPrimario)}</a>` : ""}
          ${h.ctaSecundario ? `<a class="btn btn--contorno" href="/teste-gratis">${e(h.ctaSecundario)}</a>` : ""}
        </div>
        ${h.fatos.length ? `<ul class="fatos">${h.fatos.filter((f) => f.texto).map((f) => `<li>${e(f.texto)}</li>`).join("")}</ul>` : ""}
      </div>
      <div class="hero__visual">
        ${h.imagem ? `<img class="hero__imagem" src="${e(h.imagem)}" alt="Tela do ${e(g.nomeProduto)}" width="1200" height="760">` : ticketOs()}
      </div>
    </div>
  </section>`;

  const rec = c["site.recursos"];
  const recursos = !rec.itens.length ? "" : `<section class="secao" id="recursos">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(rec.titulo)}</h2>${rec.subtitulo ? `<p>${e(rec.subtitulo)}</p>` : ""}</header>
      <ul class="recursos">
        ${rec.itens.map((it, i) => `<li class="recurso"><span class="etiqueta">${pad(i)}</span><h3>${e(it.titulo)}</h3><p>${e(it.texto)}</p></li>`).join("")}
      </ul>
    </div>
  </section>`;

  const cf = c["site.como_funciona"];
  const como = !cf.passos.length ? "" : `<section class="secao secao--papel">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(cf.titulo)}</h2></header>
      <ol class="passos">
        ${cf.passos.map((p, i) => `<li class="passo"><span class="passo__num">${i + 1}</span><h3>${e(p.titulo)}</h3><p>${e(p.texto)}</p></li>`).join("")}
      </ol>
    </div>
  </section>`;

  const tl = c["site.telas"];
  const imagensTelas = tl.imagens.filter((i) => i.imagem);
  const telas = !imagensTelas.length ? "" : `<section class="secao">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(tl.titulo)}</h2></header>
      <div class="telas">
        ${imagensTelas.map((i) => `<figure class="tela"><img src="${e(i.imagem)}" alt="${e(i.legenda || "Tela do sistema")}" loading="lazy"><figcaption>${e(i.legenda)}</figcaption></figure>`).join("")}
      </div>
    </div>
  </section>`;

  const pl = c["site.planos"];
  const lista = inclusos();
  const planos = `<section class="secao secao--escura" id="planos">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(pl.titulo)}</h2>${pl.subtitulo ? `<p>${e(pl.subtitulo)}</p>` : ""}</header>
      ${ofertas.length
        ? `<div class="planos planos--${Math.min(ofertas.length, 3)}">${ofertas.map((o) => cartaoPlano(o, { pagamentosAtivos, textoBotao: "Comprar" })).join("")}</div>`
        : `<p class="aviso-claro">Os planos serão publicados em breve. ${g.emailContato ? `Fale com a gente: <a href="mailto:${e(g.emailContato)}">${e(g.emailContato)}</a>` : ""}</p>`}
      ${lista.length ? `<div class="incluso"><p class="rotulo-mono">Incluso em todos os planos</p><ul>${lista.map((l) => `<li>${e(l)}</li>`).join("")}</ul></div>` : ""}
      ${pl.observacao ? `<p class="planos__obs">${e(pl.observacao)}</p>` : ""}
    </div>
  </section>`;

  const dp = c["site.depoimentos"];
  const depoimentos = !dp.itens.length ? "" : `<section class="secao">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(dp.titulo)}</h2></header>
      <div class="depoimentos">
        ${dp.itens.map((d) => `<figure class="depoimento"><blockquote>${e(d.texto)}</blockquote><figcaption><strong>${e(d.nome)}</strong>${d.empresa ? `<span>${e(d.empresa)}</span>` : ""}</figcaption></figure>`).join("")}
      </div>
    </div>
  </section>`;

  const fq = c["site.faq"];
  const faq = !fq.itens.length ? "" : `<section class="secao secao--papel" id="duvidas">
    <div class="secao__in secao__in--estreito">
      <header class="secao__cabeca"><h2>${e(fq.titulo)}</h2></header>
      <div class="faq">
        ${fq.itens.map((q) => `<details class="faq__item"><summary>${e(q.pergunta)}</summary><p>${e(q.resposta)}</p></details>`).join("")}
      </div>
    </div>
  </section>`;

  const ct = c["site.cta_final"];
  const cta = `<section class="cta">
    <div class="cta__in">
      <h2>${e(ct.titulo)}</h2>
      <p>${e(ct.texto)}</p>
      <a class="btn btn--grande" href="/teste-gratis">${e(ct.botao)}</a>
      ${g.requisitos || g.versaoApp ? `<p class="cta__req">${e(g.requisitos)}${g.versaoApp ? ` · versão ${e(g.versaoApp)}` : ""}</p>` : ""}
    </div>
  </section>`;

  // Ordem e visibilidade vêm de "Ordem e visibilidade das seções".
  const blocos = { recursos, como_funciona: como, telas, planos, depoimentos, faq, cta_final: cta };
  const corpoSecoes = c["site.secoes"].itens
    .filter((i) => i.visivel)
    .map((i) => blocos[i.id] || "")
    .join("");

  return layout({
    pagina: "inicio",
    corpo: hero + corpoSecoes + (pagamentosAtivos ? dialogoCheckout() : ""),
  });
}

module.exports = { renderLanding };
