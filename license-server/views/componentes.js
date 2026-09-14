/** Blocos reutilizados entre landing e renovação: cartões de plano e diálogo de checkout. */
const conteudo = require("../lib/conteudo");
const { escapeHtml: e } = require("../lib/http");
const { brl } = require("./layout");

const ROTULO_MODALIDADE = { avulso: "Pagamento único", assinatura: "Renovação automática" };

function cartaoPlano(o, { pagamentosAtivos, textoBotao }) {
  const linhas = String(o.descricao || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const periodo = o.plano === "vitalicia" ? "uma vez" : o.modalidade === "assinatura" ? "por ano" : "por 12 meses";
  const parcelas = o.parcelas_max > 1 ? `ou em até ${o.parcelas_max}x no cartão` : o.modalidade === "assinatura" ? "cobrado anualmente no cartão" : "à vista";
  const botao = pagamentosAtivos
    ? `<button class="btn ${o.destaque ? "" : "btn--contorno"} btn--bloco" type="button" data-comprar="${e(o.id)}" data-plano-nome="${e(o.nome)}" data-plano-preco="${e(brl(o.preco_centavos))}">${e(textoBotao)}</button>`
    : `<p class="plano__indisponivel">Vendas online em breve.</p>`;

  return `<article class="plano${o.destaque ? " plano--destaque" : ""}">
    ${o.destaque ? `<p class="plano__selo">Recomendado</p>` : ""}
    <header>
      <p class="plano__modalidade">${e(ROTULO_MODALIDADE[o.modalidade] || "")}</p>
      <h3 class="plano__nome">${e(o.nome)}</h3>
    </header>
    <p class="plano__preco"><span class="plano__valor">${e(brl(o.preco_centavos))}</span> <span class="plano__periodo">${e(periodo)}</span></p>
    <p class="plano__parcelas">${e(parcelas)}</p>
    <ul class="plano__lista">${linhas.map((l) => `<li>${e(l)}</li>`).join("")}</ul>
    ${botao}
  </article>`;
}

function dialogoCheckout({ renovarLicencaId = "", nomePadrao = "" } = {}) {
  return `<dialog class="dialogo" id="checkout" aria-labelledby="checkout-titulo">
  <form class="form" id="checkout-form" novalidate>
    <header class="dialogo__topo">
      <div>
        <p class="rotulo-mono" id="checkout-plano">Plano</p>
        <h2 id="checkout-titulo">Seus dados para a licença</h2>
      </div>
      <button class="dialogo__fechar" type="button" data-fechar aria-label="Fechar">×</button>
    </header>
    <input type="hidden" name="ofertaId">
    <input type="hidden" name="renovarLicencaId" value="${e(renovarLicencaId)}">
    <label class="campo"><span>Nome completo</span><input name="nome" autocomplete="name" required minlength="3" maxlength="120" value="${e(nomePadrao)}"></label>
    <label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="email" required maxlength="160"><small>A chave de licença será enviada para este e-mail.</small></label>
    <label class="campo"><span>CPF ou CNPJ <em>(opcional)</em></span><input name="documento" inputmode="numeric" maxlength="18" autocomplete="off"></label>
    <label class="aceite"><input type="checkbox" name="aceite" required> <span>Li e aceito os <a href="/termos" target="_blank">termos de uso</a> e a <a href="/privacidade" target="_blank">política de privacidade</a>.</span></label>
    <p class="form__erro" role="alert" hidden></p>
    <button class="btn btn--bloco" type="submit"><span data-texto>Ir para o pagamento</span></button>
    <p class="form__nota">Você será levado ao Mercado Pago para pagar com Pix, boleto ou cartão.</p>
  </form>
</dialog>`;
}

const inclusos = () =>
  String(conteudo.obter("site.planos").incluso || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

module.exports = { cartaoPlano, dialogoCheckout, inclusos };
