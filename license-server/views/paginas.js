/** Páginas auxiliares: legais, retorno do checkout, renovação, portal do cliente e erros. */
const { escapeHtml: e } = require("../lib/http");
const { markdown } = require("../lib/markdown");
const vendas = require("../lib/vendas");
const conteudo = require("../lib/conteudo");
const { layout } = require("./layout");
const { cartaoPlano, dialogoCheckout } = require("./componentes");

const cartao = (conteudoHtml, classe = "") => `<section class="pagina"><div class="cartao ${classe}">${conteudoHtml}</div></section>`;

function legal(c) {
  return layout({
    titulo: c.titulo,
    pagina: "legal",
    corpo: `<article class="pagina pagina--leitura"><h1>${e(c.titulo)}</h1><div class="prosa">${markdown(c.texto)}</div></article>`,
  });
}

function retornoCheckout({ pedido, falha }) {
  if (!pedido) return naoEncontrada();
  const assinatura = pedido.modalidade === "assinatura";
  const c = conteudo.obter("pagina.checkout");
  // {{email}} vira o e-mail mascarado preenchido pelo JavaScript da página.
  const comEmail = (txt) => e(txt).replace("{{email}}", '<strong data-email></strong>');
  return layout({
    titulo: "Pagamento",
    pagina: "retorno",
    semNav: true,
    corpo: cartao(
      `<div id="retorno" data-pedido="${e(pedido.id)}" data-status="${e(pedido.status)}" data-falha="${falha ? 1 : 0}" data-assinatura="${assinatura ? 1 : 0}">
        <div class="estado estado--pendente">
          <span class="estado__icone girando" aria-hidden="true"></span>
          <h1>${e(c.aguardandoTitulo)}</h1>
          <p>${e(c.aguardandoTexto)}</p>
          <p class="rotulo-mono">Pedido ${e(pedido.id.slice(0, 8))}</p>
        </div>
        <div class="estado estado--pago" hidden>
          <span class="estado__icone ok" aria-hidden="true"></span>
          <h1>${e(c.pagoTitulo)}</h1>
          <p>${comEmail(c.pagoTexto)}</p>
          <div class="estado__acoes"><a class="btn" href="/#duvidas">Como ativar</a><a class="btn btn--contorno" href="/cliente">Área do cliente</a></div>
        </div>
        <div class="estado estado--falha" hidden>
          <span class="estado__icone erro" aria-hidden="true"></span>
          <h1>${e(c.falhaTitulo)}</h1>
          <p>${e(c.falhaTexto)}</p>
          <div class="estado__acoes"><a class="btn" href="/#planos">Voltar aos planos</a></div>
        </div>
      </div>`
    ),
  });
}

function renovar({ licenca, ofertas, renovacaoAutomatica, pagamentosAtivos }) {
  const validade = vendas.dataBR(licenca.validade);
  const expirada = licenca.validade && new Date(licenca.validade).getTime() < Date.now();
  const corpo = `<section class="pagina">
    <div class="secao__in">
      <header class="secao__cabeca secao__cabeca--esquerda">
        <p class="rotulo-mono">Renovação de licença · ${e(licenca.emailMascarado)}</p>
        <h1>${expirada ? `Sua licença venceu em ${e(validade)}` : `Sua licença vale até ${e(validade)}`}</h1>
        <p>${e(conteudo.obter("pagina.cliente").renovarTexto)}</p>
      </header>
      ${renovacaoAutomatica
        ? `<p class="aviso-claro">Esta licença já tem renovação automática ativa. Nada a fazer por aqui.</p>`
        : ofertas.length
          ? `<div class="planos planos--${Math.min(ofertas.length, 3)} planos--claros">${ofertas.map((o) => cartaoPlano(o, { pagamentosAtivos, textoBotao: "Renovar" })).join("")}</div>`
          : `<p class="aviso-claro">A renovação online está indisponível no momento. Fale com o suporte.</p>`}
    </div>
  </section>`;
  return layout({
    titulo: "Renovar licença",
    pagina: "renovar",
    semNav: true,
    corpo: corpo + (pagamentosAtivos ? dialogoCheckout({ renovarLicencaId: licenca.id, nomePadrao: licenca.nome }) : ""),
  });
}

function portal({ logado }) {
  const c = conteudo.obter("pagina.cliente");
  const entrar = `<div class="cartao cartao--estreito" id="portal-login">
    <p class="rotulo-mono">Área do cliente</p>
    <h1>${e(c.titulo)}</h1>
    <p>${e(c.texto)}</p>
    <form class="form" id="portal-form" novalidate>
      <label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label>
      <p class="form__erro" role="alert" hidden></p>
      <button class="btn btn--bloco" type="submit"><span data-texto>${e(c.botao)}</span></button>
    </form>
    <div class="form__ok" hidden>
      <h2>${e(c.enviadoTitulo)}</h2>
      <p>${e(c.enviadoTexto)}</p>
    </div>
  </div>`;
  const painel = `<div class="portal" id="portal-painel" data-carregar="1">
    <header class="portal__topo">
      <div><p class="rotulo-mono">Área do cliente</p><h1 data-nome>Suas licenças</h1><p data-email class="portal__email"></p></div>
      <button class="btn btn--contorno btn--pequeno" type="button" data-sair>Sair</button>
    </header>
    <p class="form__erro" role="alert" hidden></p>
    <div data-licencas class="portal__licencas"><p class="carregando">Carregando…</p></div>
    <section class="portal__pedidos"><h2>Pedidos</h2><div data-pedidos></div></section>
    <section class="portal__pedidos portal__chamados" id="emissores">
      <div class="portal__secao-topo"><h2>Emissores de nota fiscal</h2><a class="btn btn--contorno btn--pequeno" href="/emissores">Ver guias</a></div>
      <p class="portal__ajuda">Usa um emissor que ainda não está no GSTI App? Peça a integração: os mais pedidos entram primeiro e avisamos por e-mail quando chegar.</p>
      <form class="form cartao suporte__cartao" id="emissor-form" novalidate>
        <div class="form__linha">
          <label class="campo"><span>Nome do emissor</span><input name="nome" required maxlength="80" placeholder="Ex.: Focus NFe, eNotas, portal da prefeitura"></label>
          <label class="campo"><span>Site <em>(opcional)</em></span><input name="site" type="url" maxlength="200" placeholder="https://"></label>
        </div>
        <fieldset class="campo campo--grupo"><span>Notas que você emite</span>
          <div class="opcoes">
            <label class="aceite"><input type="checkbox" name="documentos" value="NFS-e" checked> <span>NFS-e (serviço)</span></label>
            <label class="aceite"><input type="checkbox" name="documentos" value="NF-e"> <span>NF-e (produto)</span></label>
            <label class="aceite"><input type="checkbox" name="documentos" value="NFC-e"> <span>NFC-e (consumidor)</span></label>
          </div>
        </fieldset>
        <div class="form__linha">
          <label class="campo"><span>Município <em>(opcional)</em></span><input name="municipio" maxlength="80"></label>
          <label class="campo"><span>UF <em>(opcional)</em></span><input name="uf" maxlength="2" autocapitalize="characters"></label>
        </div>
        <label class="campo"><span>Observação <em>(opcional)</em></span><textarea name="observacao" maxlength="500" rows="3"></textarea></label>
        <p class="form__erro" role="alert" hidden></p>
        <p class="form__sucesso" role="status" hidden></p>
        <button class="btn" type="submit"><span data-texto>Enviar pedido</span></button>
      </form>
      <div data-emissores></div>
    </section>
    <section class="portal__pedidos portal__chamados" id="chamados">
      <div class="portal__secao-topo"><h2>Chamados de suporte</h2><a class="btn btn--pequeno" href="/suporte">Abrir chamado</a></div>
      <div data-chamados><p class="carregando">Carregando…</p></div>
    </section>
  </div>`;
  return layout({ titulo: "Área do cliente", pagina: "portal", semNav: true, corpo: `<section class="pagina">${logado ? painel : entrar}</section>` });
}

function testeGratis() {
  const g = conteudo.obter("site.geral");
  const p = conteudo.obter("pagina.teste_gratis");
  const baixar = g.linkDownload
    ? `<a class="btn btn--grande" href="${e(g.linkDownload)}" download>${e(p.botao)}</a>
       ${g.requisitos || g.versaoApp ? `<p class="rotulo-mono" style="margin-top:1rem">${e(g.requisitos)}${g.versaoApp ? ` · versão ${e(g.versaoApp)}` : ""}</p>` : ""}`
    : `<p class="aviso-claro">${e(p.semDownload)}${g.emailContato ? ` <a href="mailto:${e(g.emailContato)}">${e(g.emailContato)}</a>` : ""}</p>`;
  return layout({
    titulo: "Teste grátis",
    pagina: "teste",
    corpo: `<section class="pagina">
      <div class="secao__in">
        <header class="secao__cabeca">
          ${p.selo ? `<p class="rotulo-mono">${e(p.selo)}</p>` : ""}
          <h1>${e(p.titulo)}</h1>
          ${p.subtitulo ? `<p>${e(p.subtitulo)}</p>` : ""}
        </header>
        <ol class="passos passos--teste">
          ${p.passos.map((item, i) => `<li class="passo"><span class="passo__num">${i + 1}</span><h3>${e(item.titulo)}</h3><p>${e(item.texto)}</p></li>`).join("")}
        </ol>
        <div class="teste__acoes">${baixar}${p.linkPlanos ? `<p><a href="/#planos">${e(p.linkPlanos)}</a></p>` : ""}</div>
      </div>
    </section>`,
  });
}

function linkInvalido() {
  return layout({
    titulo: "Link expirado",
    pagina: "erro",
    semNav: true,
    corpo: cartao(`<h1>Este link não é mais válido</h1><p>Links de acesso valem por 30 minutos e só podem ser usados uma vez.</p><a class="btn" href="/cliente">Pedir um novo link</a>`, "cartao--estreito"),
  });
}

function naoEncontrada() {
  return layout({
    titulo: "Página não encontrada",
    pagina: "erro",
    semNav: true,
    corpo: cartao(`<p class="rotulo-mono">Erro 404</p><h1>Não encontramos esta página</h1><p>O endereço pode ter mudado ou o link está incompleto.</p><a class="btn" href="/">Ir para o início</a>`, "cartao--estreito"),
  });
}

module.exports = { legal, retornoCheckout, renovar, portal, testeGratis, linkInvalido, naoEncontrada };
