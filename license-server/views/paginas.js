/** Páginas auxiliares: legais, retorno do checkout, renovação, portal do cliente e erros. */
const { escapeHtml: e } = require("../lib/http");
const { markdown } = require("../lib/markdown");
const vendas = require("../lib/vendas");
const conteudo = require("../lib/conteudo");
const cfg = require("../lib/config");
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
  return layout({
    titulo: "Pagamento",
    pagina: "retorno",
    semNav: true,
    corpo: cartao(
      `<div id="retorno" data-pedido="${e(pedido.id)}" data-status="${e(pedido.status)}" data-falha="${falha ? 1 : 0}" data-assinatura="${assinatura ? 1 : 0}">
        <div class="estado estado--pendente">
          <span class="estado__icone girando" aria-hidden="true"></span>
          <h1>Confirmando seu pagamento…</h1>
          <p>Pix costuma confirmar em segundos. Boleto pode levar até 3 dias úteis — você recebe a chave por e-mail assim que for compensado.</p>
          <p class="rotulo-mono">Pedido ${e(pedido.id.slice(0, 8))}</p>
        </div>
        <div class="estado estado--pago" hidden>
          <span class="estado__icone ok" aria-hidden="true"></span>
          <h1>Pagamento confirmado!</h1>
          <p>Enviamos a chave de licença para <strong data-email></strong>. Verifique também a caixa de spam.</p>
          <div class="estado__acoes"><a class="btn" href="/#duvidas">Como ativar</a><a class="btn btn--contorno" href="/cliente">Área do cliente</a></div>
        </div>
        <div class="estado estado--falha" hidden>
          <span class="estado__icone erro" aria-hidden="true"></span>
          <h1>O pagamento não foi concluído</h1>
          <p>Nenhuma cobrança foi feita. Você pode tentar novamente com outra forma de pagamento.</p>
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
        <p>A renovação soma 12 meses à validade atual — você não perde nenhum dia.</p>
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
  const entrar = `<div class="cartao cartao--estreito" id="portal-login">
    <p class="rotulo-mono">Área do cliente</p>
    <h1>Acesse suas licenças</h1>
    <p>Informe o e-mail usado na compra. Enviaremos um link de acesso — sem senha.</p>
    <form class="form" id="portal-form" novalidate>
      <label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label>
      <p class="form__erro" role="alert" hidden></p>
      <button class="btn btn--bloco" type="submit"><span data-texto>Enviar link de acesso</span></button>
    </form>
    <div class="form__ok" hidden>
      <h2>Confira seu e-mail</h2>
      <p>Se houver compras com esse endereço, o link chega em instantes. Ele vale por 30 minutos.</p>
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
  </div>`;
  return layout({ titulo: "Área do cliente", pagina: "portal", semNav: true, corpo: `<section class="pagina">${logado ? painel : entrar}</section>` });
}

function testeGratis() {
  const g = conteudo.obter("site.geral");
  const baixar = g.linkDownload
    ? `<a class="btn btn--grande" href="${e(g.linkDownload)}" download>Baixar o instalador</a>
       <p class="rotulo-mono" style="margin-top:1rem">${e(g.requisitos)}${g.versaoApp ? ` · versão ${e(g.versaoApp)}` : ""}</p>`
    : `<p class="aviso-claro">O instalador estará disponível para download em breve.${g.emailContato ? ` Enquanto isso, fale com a gente: <a href="mailto:${e(g.emailContato)}">${e(g.emailContato)}</a>` : ""}</p>`;
  const passos = [
    ["Baixe e instale", "Execute o instalador no computador da assistência. É necessário ter o PostgreSQL instalado (o guia de instalação explica em poucos passos)."],
    ["Escolha “Testar grátis”", `Na primeira abertura, na tela de ativação, selecione “Testar ${cfg.TRIAL_DIAS} dias grátis” e informe seu e-mail. Não pedimos cartão.`],
    ["Use à vontade", `Durante ${cfg.TRIAL_DIAS} dias todos os recursos ficam liberados. Gostou? Compre um plano e ative com a chave recebida por e-mail — seus dados continuam no banco.`],
  ];
  return layout({
    titulo: "Teste grátis",
    pagina: "teste",
    corpo: `<section class="pagina">
      <div class="secao__in">
        <header class="secao__cabeca">
          <p class="rotulo-mono">${cfg.TRIAL_DIAS} dias grátis · sem cartão</p>
          <h1>Teste o ${e(g.nomeProduto)} na sua bancada</h1>
          <p>O teste é feito no próprio sistema, no seu computador, com os seus dados.</p>
        </header>
        <ol class="passos passos--teste">
          ${passos.map(([t, d], i) => `<li class="passo"><span class="passo__num">${i + 1}</span><h3>${e(t)}</h3><p>${e(d)}</p></li>`).join("")}
        </ol>
        <div class="teste__acoes">${baixar}<p><a href="/#planos">Prefiro ver os planos</a></p></div>
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
