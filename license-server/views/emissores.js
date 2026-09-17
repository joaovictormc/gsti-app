/** Página pública do catálogo de emissores de nota fiscal (guias de configuração). */
const conteudo = require("../lib/conteudo");
const { escapeHtml: e } = require("../lib/http");
const { layout } = require("./layout");

const CERTIFICADO = {
  app: "Certificado A1 cadastrado no GSTI App",
  emissor: "Certificado A1 enviado ao painel do emissor",
};

function cartao(em) {
  const emBreve = em.status !== "disponivel";
  const documentos = (em.emite || em.documentos).map((d) => `<span class="etiqueta">${e(d)}</span>`).join("");
  const guia = em.guia.length
    ? `<details class="emissor__guia"><summary>Como configurar</summary><ol>${em.guia.map((p) => `<li>${e(p)}</li>`).join("")}</ol></details>`
    : "";
  const ondeEmitir = em.ondeEmitirGratis.length
    ? `<div class="emissor__onde"><p class="rotulo-mono">Onde emitir de graça</p><ul>${em.ondeEmitirGratis
        .map((o) => `<li>${o.url ? `<a href="${e(o.url)}" target="_blank" rel="noopener">${e(o.nome)}</a>` : e(o.nome)} <small>(${e(o.documentos.join(", "))})</small></li>`)
        .join("")}</ul></div>`
    : "";
  return `<article class="emissor${emBreve ? " emissor--breve" : ""}" id="${e(em.id)}">
    <header class="emissor__topo">
      <h2>${e(em.nome)}</h2>
      <span class="status ${emBreve ? "status--pendente" : "status--ativa"}">${emBreve ? "Em desenvolvimento" : em.integrado ? "Integrado" : "Todos os planos"}</span>
    </header>
    <p>${e(em.resumo)}</p>
    <dl class="emissor__dados">
      <div><dt>Notas</dt><dd class="etiquetas">${documentos}</dd></div>
      <div><dt>Custo</dt><dd>${e(em.custo.texto)}</dd></div>
      <div><dt>Certificado digital</dt><dd>${e(em.certificado ? CERTIFICADO[em.certificado] : "Não precisa")}</dd></div>
    </dl>
    ${ondeEmitir}
    ${guia}
    ${em.site ? `<p class="emissor__site"><a href="${e(em.site)}" target="_blank" rel="noopener">Site do emissor ↗</a></p>` : ""}
  </article>`;
}

function pagina({ catalogo, planejados, logado }) {
  const p = conteudo.obter("pagina.emissores");
  const corpo = `<section class="pagina">
    <div class="suporte emissores">
      <header class="suporte__cabeca">
        <p class="rotulo-mono">Nota fiscal</p>
        <h1>${e(p.titulo)}</h1>
        <p>${e(p.texto)}</p>
        ${p.aviso ? `<p class="aviso-claro">${e(p.aviso)}</p>` : ""}
      </header>
      <div class="emissores__lista">${catalogo.map(cartao).join("")}</div>
      ${planejados.length
        ? `<section class="emissores__planejados"><h2>Em estudo</h2><ul>${planejados
            .map((x) => `<li><strong>${e(x.nome)}</strong> <span class="status status--pendente">${e(x.statusRotulo)}</span>${x.nota_publica ? `<br><small>${e(x.nota_publica)}</small>` : ""}</li>`)
            .join("")}</ul></section>`
        : ""}
      <section class="cartao suporte__cartao emissores__pedir">
        <h2>Não encontrou o seu?</h2>
        <p>${e(p.solicitarTexto)}</p>
        <a class="btn" href="/cliente#emissores">${logado ? "Pedir outro emissor" : "Entrar na área do cliente"}</a>
      </section>
    </div>
  </section>`;
  return layout({ titulo: p.titulo, pagina: "emissores", descricao: p.texto, corpo });
}

module.exports = { pagina };
