/** Landing page de vendas — todo o texto vem do conteúdo editável (lib/conteudo.js). */
const conteudo = require("../lib/conteudo");
const cfg = require("../lib/config");
const { escapeHtml: e } = require("../lib/http");
const { layout } = require("./layout");
const { cartaoPlano, dialogoCheckout, inclusos } = require("./componentes");

const pad = (n) => String(n + 1).padStart(2, "0");

// Ordem de serviço ilustrativa (substituída pela imagem de destaque, se houver).
function ticketOs() {
  const etapas = [
    ["Entrada", "09:12", "feito"],
    ["Diagnóstico", "10:40", "feito"],
    ["Aguardando peça", "ontem", "feito"],
    ["Pronto para retirada", "agora", "atual"],
    ["Entregue", "", ""],
  ];
  return `<figure class="ticket" aria-label="Exemplo de ordem de serviço no sistema">
    <div class="ticket__cabeca">
      <span class="rotulo-mono">Ordem de serviço</span>
      <span class="ticket__numero">Nº 0427</span>
    </div>
    <dl class="ticket__dados">
      <div><dt>Cliente</dt><dd>Carla Menezes</dd></div>
      <div><dt>Equipamento</dt><dd>Notebook Dell Inspiron 15</dd></div>
      <div><dt>Defeito relatado</dt><dd>Não liga após queda de energia</dd></div>
      <div class="ticket__linha"><div><dt>Garantia</dt><dd>90 dias</dd></div><div><dt>Total</dt><dd class="ticket__total">R$ 380,00</dd></div></div>
    </dl>
    <ol class="ticket__etapas">
      ${etapas.map(([n, h, s]) => `<li class="${s}"><span>${n}</span><time>${h}</time></li>`).join("")}
    </ol>
    <figcaption class="ticket__rodape">Cliente avisado por e-mail · PDF de entrada emitido</figcaption>
  </figure>`;
}

function renderLanding({ ofertas, pagamentosAtivos }) {
  const c = conteudo.obterVarios([
    "site.geral", "site.hero", "site.recursos", "site.como_funciona", "site.telas",
    "site.planos", "site.depoimentos", "site.faq", "site.cta_final",
  ]);
  const g = c["site.geral"], h = c["site.hero"];

  const hero = `<section class="hero">
    <div class="hero__in">
      <div class="hero__texto">
        ${h.selo ? `<p class="selo">${e(h.selo)}</p>` : ""}
        <h1>${e(h.titulo)}</h1>
        <p class="hero__sub">${e(h.subtitulo)}</p>
        <div class="hero__acoes">
          <a class="btn" href="#planos">${e(h.ctaPrimario)}</a>
          <a class="btn btn--contorno" href="/teste-gratis">${e(h.ctaSecundario)}</a>
        </div>
        <ul class="fatos">
          <li>Funciona sem internet no dia a dia</li>
          <li>Dados no seu próprio banco</li>
          <li>Pix, boleto ou cartão</li>
          <li>${cfg.TRIAL_DIAS} dias grátis, sem cartão</li>
        </ul>
      </div>
      <div class="hero__visual">
        ${h.imagem ? `<img class="hero__imagem" src="${e(h.imagem)}" alt="Tela do ${e(g.nomeProduto)}" width="1200" height="760">` : ticketOs()}
      </div>
    </div>
  </section>`;

  const rec = c["site.recursos"];
  const recursos = rec.itens.length
    ? `<section class="secao" id="recursos">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(rec.titulo)}</h2>${rec.subtitulo ? `<p>${e(rec.subtitulo)}</p>` : ""}</header>
      <ul class="recursos">
        ${rec.itens.map((it, i) => `<li class="recurso"><span class="etiqueta">${pad(i)}</span><h3>${e(it.titulo)}</h3><p>${e(it.texto)}</p></li>`).join("")}
      </ul>
    </div>
  </section>`
    : "";

  const cf = c["site.como_funciona"];
  const como = cf.passos.length
    ? `<section class="secao secao--papel">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(cf.titulo)}</h2></header>
      <ol class="passos">
        ${cf.passos.map((p, i) => `<li class="passo"><span class="passo__num">${i + 1}</span><h3>${e(p.titulo)}</h3><p>${e(p.texto)}</p></li>`).join("")}
      </ol>
    </div>
  </section>`
    : "";

  const tl = c["site.telas"];
  const imagensTelas = tl.imagens.filter((i) => i.imagem);
  const telas = tl.ativo && imagensTelas.length
    ? `<section class="secao">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(tl.titulo)}</h2></header>
      <div class="telas">
        ${imagensTelas.map((i) => `<figure class="tela"><img src="${e(i.imagem)}" alt="${e(i.legenda || "Tela do sistema")}" loading="lazy"><figcaption>${e(i.legenda)}</figcaption></figure>`).join("")}
      </div>
    </div>
  </section>`
    : "";

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
  const depoimentos = dp.ativo && dp.itens.length
    ? `<section class="secao">
    <div class="secao__in">
      <header class="secao__cabeca"><h2>${e(dp.titulo)}</h2></header>
      <div class="depoimentos">
        ${dp.itens.map((d) => `<figure class="depoimento"><blockquote>${e(d.texto)}</blockquote><figcaption><strong>${e(d.nome)}</strong>${d.empresa ? `<span>${e(d.empresa)}</span>` : ""}</figcaption></figure>`).join("")}
      </div>
    </div>
  </section>`
    : "";

  const fq = c["site.faq"];
  const faq = fq.itens.length
    ? `<section class="secao secao--papel" id="duvidas">
    <div class="secao__in secao__in--estreito">
      <header class="secao__cabeca"><h2>${e(fq.titulo)}</h2></header>
      <div class="faq">
        ${fq.itens.map((q) => `<details class="faq__item"><summary>${e(q.pergunta)}</summary><p>${e(q.resposta)}</p></details>`).join("")}
      </div>
    </div>
  </section>`
    : "";

  const ct = c["site.cta_final"];
  const cta = `<section class="cta">
    <div class="cta__in">
      <h2>${e(ct.titulo)}</h2>
      <p>${e(ct.texto)}</p>
      <a class="btn btn--grande" href="/teste-gratis">${e(ct.botao)}</a>
      <p class="cta__req">${e(g.requisitos)}${g.versaoApp ? ` · versão ${e(g.versaoApp)}` : ""}</p>
    </div>
  </section>`;

  return layout({
    pagina: "inicio",
    corpo: hero + recursos + como + telas + planos + depoimentos + faq + cta + (pagamentosAtivos ? dialogoCheckout() : ""),
  });
}

module.exports = { renderLanding };
