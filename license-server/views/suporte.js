/** Páginas do suporte: abrir chamado e acompanhar um chamado. */
const conteudo = require("../lib/conteudo");
const { CATEGORIAS } = require("../lib/suporte");
const { escapeHtml: e } = require("../lib/http");
const { layout } = require("./layout");

const ACEITE_ANEXOS = "image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.log";

function campoAnexos(nome = "anexos") {
  return `<label class="campo"><span>Arquivos <em>(opcional)</em></span>
    <input name="${nome}" type="file" multiple accept="${ACEITE_ANEXOS}">
    <small>Prints da tela, PDF ou arquivos de log (.txt, .log). Até 5 arquivos de 5 MB cada.</small>
  </label>`;
}

function abrir({ cliente }) {
  const p = conteudo.obter("pagina.suporte");
  const corpo = `<section class="pagina">
    <div class="suporte">
      <header class="suporte__cabeca">
        <p class="rotulo-mono">Suporte</p>
        <h1>${e(p.titulo)}</h1>
        <p>${e(p.texto)}</p>
        ${cliente ? `<p class="suporte__cliente">Você está na área do cliente como <strong>${e(cliente.email)}</strong>. <a href="/cliente#chamados">Ver meus chamados</a></p>` : ""}
      </header>
      <div class="cartao suporte__cartao">
        <form class="form" id="suporte-form" novalidate>
          <div class="form__linha">
            <label class="campo"><span>Seu nome</span><input name="nome" autocomplete="name" maxlength="120" value="${e(cliente?.nome || "")}"></label>
            <label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="email" required maxlength="160" value="${e(cliente?.email || "")}"><small>As respostas chegam neste e-mail. Clientes: use o e-mail da compra.</small></label>
          </div>
          <label class="campo"><span>Tipo</span>
            <select name="categoria" required>
              <option value="">Selecione…</option>
              ${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${e(k)}">${e(v)}</option>`).join("")}
            </select>
          </label>
          <label class="campo"><span>Assunto</span><input name="assunto" required maxlength="150" placeholder="Ex.: Erro ao imprimir a OS"></label>
          <label class="campo"><span>Mensagem</span><textarea name="mensagem" required maxlength="5000" rows="7" placeholder="O que você estava fazendo, o que aconteceu e, se houver, a mensagem de erro."></textarea></label>
          ${campoAnexos()}
          <label class="campo campo--oculto" aria-hidden="true"><span>Site</span><input name="site" tabindex="-1" autocomplete="off"></label>
          <p class="form__erro" role="alert" hidden></p>
          <button class="btn btn--bloco" type="submit"><span data-texto>Enviar chamado</span></button>
          ${p.aviso ? `<p class="form__nota">${e(p.aviso)}</p>` : ""}
        </form>
        <div class="form__ok estado" id="suporte-ok" hidden>
          <span class="estado__icone ok" aria-hidden="true"></span>
          <p class="rotulo-mono" data-numero></p>
          <h2>${e(p.enviadoTitulo)}</h2>
          <p>${e(p.enviadoTexto)}</p>
          <p class="form__erro" data-aviso-anexos hidden></p>
          <div class="estado__acoes"><a class="btn" data-acompanhar href="/">Acompanhar o chamado</a></div>
        </div>
      </div>
    </div>
  </section>`;
  return layout({ titulo: "Suporte", pagina: "suporte", descricao: p.texto, corpo });
}

function chamado({ id }) {
  const corpo = `<section class="pagina">
    <div class="suporte suporte--chamado" id="chamado" data-id="${e(id)}">
      <p class="carregando" data-carregando>Carregando o chamado…</p>
      <div data-conteudo hidden>
        <header class="suporte__cabeca">
          <p class="rotulo-mono" data-numero></p>
          <h1 data-assunto></h1>
          <p class="suporte__meta"><span class="status" data-status></span> <span data-datas></span></p>
        </header>
        <ol class="conversa" data-mensagens></ol>
        <div class="cartao suporte__cartao" data-responder>
          <form class="form" id="resposta-form" novalidate>
            <label class="campo"><span>Responder</span><textarea name="texto" required maxlength="5000" rows="5" placeholder="Escreva sua mensagem"></textarea></label>
            ${campoAnexos()}
            <p class="form__erro" role="alert" hidden></p>
            <button class="btn" type="submit"><span data-texto>Enviar resposta</span></button>
          </form>
        </div>
        <p class="aviso-claro" data-fechado hidden>Este chamado foi encerrado. Se precisar de mais ajuda, <a href="/suporte">abra um novo chamado</a>.</p>
      </div>
      <div class="cartao cartao--estreito" data-erro hidden>
        <h1>Chamado não encontrado</h1>
        <p>O link pode estar incompleto. Use o link do e-mail de confirmação ou entre na <a href="/cliente">área do cliente</a>.</p>
        <a class="btn" href="/suporte">Abrir um chamado</a>
      </div>
    </div>
  </section>`;
  return layout({ titulo: `Chamado #${id}`, pagina: "chamado", corpo });
}

module.exports = { abrir, chamado };
