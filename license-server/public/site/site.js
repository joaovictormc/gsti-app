/* GSTI App — comportamento do site público (sem dependências). */
(() => {
  "use strict";

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const brl = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const data = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "Sem expiração");

  async function api(metodo, url, corpo, csrf) {
    const headers = { "Content-Type": "application/json" };
    if (csrf) headers["X-CSRF-Token"] = csrf;
    let resp;
    try {
      resp = await fetch(url, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined, credentials: "same-origin" });
    } catch {
      throw new Error("Sem conexão. Verifique sua internet e tente novamente.");
    }
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.success === false) {
      const erro = new Error(json.error || "Algo deu errado. Tente novamente.");
      erro.status = resp.status;
      throw erro;
    }
    return json;
  }

  function el(tag, attrs = {}, filhos = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    for (const f of [].concat(filhos)) if (f != null) n.append(f);
    return n;
  }

  const STATUS_CHAMADO = { aberto: "Aberto", em_andamento: "Em andamento", aguardando_cliente: "Aguardando você", resolvido: "Resolvido", fechado: "Fechado" };
  const MAX_ARQUIVOS = 5;
  const MAX_BYTES_ARQUIVO = 5 * 1024 * 1024;

  function conferirArquivos(input) {
    const arquivos = input ? [...input.files] : [];
    if (arquivos.length > MAX_ARQUIVOS) return { erro: `Envie no máximo ${MAX_ARQUIVOS} arquivos.` };
    const grande = arquivos.find((a) => a.size > MAX_BYTES_ARQUIVO);
    if (grande) return { erro: `"${grande.name}" passa de 5 MB.` };
    return { arquivos };
  }

  // Envia os arquivos de uma mensagem; devolve a lista dos que falharam
  async function enviarArquivos(base, mensagemId, arquivos, { token, csrf } = {}) {
    const falhas = [];
    for (const arquivo of arquivos) {
      const headers = { "Content-Type": "application/octet-stream", "X-Nome-Arquivo": encodeURIComponent(arquivo.name) };
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const url = `${base}/mensagens/${mensagemId}/anexos${token ? `?t=${encodeURIComponent(token)}` : ""}`;
      try {
        const resp = await fetch(url, { method: "POST", headers, body: arquivo, credentials: "same-origin" });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.success === false) throw new Error(json.error || "falha no envio");
      } catch (e) {
        falhas.push(`${arquivo.name}: ${e.message}`);
      }
    }
    return falhas;
  }

  function mostrarErro(form, msg) {
    const p = $(".form__erro", form);
    if (!p) return;
    p.textContent = msg || "";
    p.hidden = !msg;
  }

  function ocupado(botao, sim, texto) {
    if (!botao) return;
    const alvo = $("[data-texto]", botao) || botao;
    if (sim) {
      botao.dataset.original = alvo.textContent;
      alvo.textContent = texto;
    } else if (botao.dataset.original) {
      alvo.textContent = botao.dataset.original;
    }
    botao.disabled = sim;
  }

  // ---------------- Checkout ----------------
  const dialogo = $("#checkout");
  if (dialogo) {
    const form = $("#checkout-form");
    let ultimoBotao = null;

    $$("[data-comprar]").forEach((b) =>
      b.addEventListener("click", () => {
        ultimoBotao = b;
        form.ofertaId.value = b.dataset.comprar;
        $("#checkout-plano").textContent = `${b.dataset.planoNome} · ${b.dataset.planoPreco}`;
        mostrarErro(form, "");
        if (typeof dialogo.showModal === "function") dialogo.showModal();
        else dialogo.setAttribute("open", "");
        (form.nome.value ? form.email : form.nome).focus();
      })
    );
    $$("[data-fechar]", dialogo).forEach((b) => b.addEventListener("click", () => dialogo.close()));
    dialogo.addEventListener("click", (ev) => { if (ev.target === dialogo) dialogo.close(); });
    dialogo.addEventListener("close", () => ultimoBotao && ultimoBotao.focus());

    form.documento.addEventListener("input", () => {
      const d = form.documento.value.replace(/\D/g, "").slice(0, 14);
      form.documento.value = d.length <= 11
        ? d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2")
        : d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, "$1.$2.$3/$4-$5");
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      mostrarErro(form, "");
      for (const campo of [form.nome, form.email]) campo.removeAttribute("aria-invalid");
      if (form.nome.value.trim().length < 3) { form.nome.setAttribute("aria-invalid", "true"); form.nome.focus(); return mostrarErro(form, "Informe seu nome completo."); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) { form.email.setAttribute("aria-invalid", "true"); form.email.focus(); return mostrarErro(form, "Informe um e-mail válido."); }
      if (!form.aceite.checked) return mostrarErro(form, "Para continuar, aceite os termos de uso e a política de privacidade.");

      const botao = $("button[type=submit]", form);
      ocupado(botao, true, "Abrindo o Mercado Pago…");
      try {
        const r = await api("POST", "/api/checkout", {
          ofertaId: form.ofertaId.value,
          nome: form.nome.value.trim(),
          email: form.email.value.trim(),
          documento: form.documento.value,
          renovarLicencaId: form.renovarLicencaId.value || undefined,
          aceite: true,
        });
        window.location.assign(r.url);
      } catch (e) {
        mostrarErro(form, e.message);
        ocupado(botao, false);
      }
    });
  }

  // ---------------- Retorno do checkout ----------------
  const retorno = $("#retorno");
  if (retorno) {
    const mostrar = (estado) => $$(".estado", retorno).forEach((b) => { b.hidden = !b.classList.contains(`estado--${estado}`); });
    const falha = retorno.dataset.falha === "1";
    let tentativas = 0;

    const verificar = async () => {
      try {
        const r = await api("GET", `/api/pedidos/${encodeURIComponent(retorno.dataset.pedido)}/status`);
        if (r.status === "pago") {
          $("[data-email]", retorno).textContent = r.email;
          return mostrar("pago");
        }
        if (["cancelado", "expirado"].includes(r.status) || (falha && tentativas >= 2)) return mostrar("falha");
      } catch { /* tenta de novo */ }
      tentativas++;
      // Consulta a cada 4 s por 2 minutos; depois a cada 30 s.
      setTimeout(verificar, tentativas < 30 ? 4000 : 30000);
    };
    if (retorno.dataset.status === "pago") verificar();
    else if (falha) { mostrar("falha"); verificar(); }
    else verificar();
  }

  // ---------------- Portal do cliente: login ----------------
  const portalForm = $("#portal-form");
  if (portalForm) {
    portalForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      mostrarErro(portalForm, "");
      const email = portalForm.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarErro(portalForm, "Informe um e-mail válido.");
      const botao = $("button[type=submit]", portalForm);
      ocupado(botao, true, "Enviando…");
      try {
        await api("POST", "/api/cliente/link", { email });
        portalForm.hidden = true;
        $(".form__ok").hidden = false;
      } catch (e) {
        mostrarErro(portalForm, e.message);
        ocupado(botao, false);
      }
    });
  }

  // ---------------- Portal do cliente: painel ----------------
  const painel = $("#portal-painel");
  if (painel) {
    const NOMES = { anual: "Anual", vitalicia: "Vitalícia", cortesia: "Cortesia", mensal: "Mensal" };
    const STATUS = { ativa: "Ativa", suspensa: "Suspensa", revogada: "Revogada", pago: "Pago", pendente: "Aguardando pagamento", reembolsado: "Reembolsado", contestado: "Contestado", expirado: "Expirado", authorized: "Ativa", cancelled: "Cancelada", paused: "Pausada", pending: "Pendente" };
    let csrf = "";

    const erroPainel = (msg) => mostrarErro(painel, msg);

    const acao = async (botao, url, confirmar, depois) => {
      if (confirmar && !window.confirm(confirmar)) return;
      erroPainel("");
      ocupado(botao, true, "Aguarde…");
      try {
        const r = await api("POST", url, {}, csrf);
        if (depois) depois(r); else carregar();
      } catch (e) {
        if (e.status === 401) return window.location.reload();
        erroPainel(e.message);
        ocupado(botao, false);
      }
    };

    function renderLicenca(l) {
      const expirada = l.validade && new Date(l.validade) < new Date();
      const statusLic = l.status === "ativa" && expirada ? "expirada" : l.status;
      const cartao = el("article", { class: "licenca" });

      cartao.append(el("div", { class: "licenca__topo" }, [
        el("h2", { text: `Licença ${NOMES[l.plano] || l.plano}` }),
        el("span", { class: `status status--${statusLic}`, text: statusLic === "expirada" ? "Vencida" : STATUS[l.status] || l.status }),
      ]));

      const dados = el("dl", { class: "licenca__dados" });
      const item = (rot, val) => dados.append(el("div", {}, [el("dt", { text: rot }), el("dd", { text: val })]));
      item("Chave", `GSTI-••••-••••-••••-${l.chaveFinal}`);
      item("Validade", data(l.validade));
      item("Computadores", `${l.ativacoes.length} de ${l.maxMaquinas}`);
      item("Módulos incluídos", l.modulos && l.modulos.length ? l.modulos.join(", ") : "Plano base");
      if (l.assinatura) item("Renovação automática", `${STATUS[l.assinatura.status] || l.assinatura.status}${l.assinatura.proxima_cobranca && l.assinatura.status === "authorized" ? ` · próxima em ${data(l.assinatura.proxima_cobranca)}` : ""}`);
      cartao.append(dados);
      if (l.motivo && l.status !== "ativa") cartao.append(el("p", { class: "form__erro", text: l.motivo }));

      const maquinas = el("div", { class: "licenca__maquinas" }, [el("h3", { text: "Computadores ativados" })]);
      if (!l.ativacoes.length) maquinas.append(el("p", { class: "vazio", text: "Nenhum computador ativado ainda." }));
      for (const a of l.ativacoes) {
        const b = el("button", { class: "btn btn--contorno btn--pequeno", type: "button", text: "Desvincular" });
        b.addEventListener("click", () => acao(b, `/api/cliente/ativacoes/${a.id}/desativar`, `Desvincular "${a.nome_maquina || "este computador"}"? O sistema pedirá a chave novamente nele.`));
        maquinas.append(el("div", { class: "maquina" }, [
          el("div", {}, [document.createTextNode(a.nome_maquina || "Computador"), el("small", { text: `Ativado em ${data(a.ativado_em)} · último contato ${data(a.ultimo_contato)}` })]),
          b,
        ]));
      }
      cartao.append(maquinas);

      const acoes = el("div", { class: "licenca__acoes" });
      if (l.status !== "revogada") {
        const bChave = el("button", { class: "btn btn--contorno btn--pequeno", type: "button", text: "Gerar nova chave" });
        bChave.addEventListener("click", () =>
          acao(bChave, `/api/cliente/licencas/${l.id}/nova-chave`, "Gerar uma nova chave? A chave antiga deixa de ativar novos computadores (os já ativados continuam funcionando).", (r) => {
            ocupado(bChave, false);
            cartao.querySelector(".chave-nova")?.remove();
            cartao.append(el("p", { class: "chave-nova", text: r.chave }));
          })
        );
        acoes.append(bChave);
      }
      const assinaturaAtiva = l.assinatura && l.assinatura.status === "authorized";
      if (l.plano === "anual" && l.status !== "revogada" && !assinaturaAtiva) {
        acoes.prepend(el("a", { class: "btn btn--pequeno", href: `/renovar/${encodeURIComponent(l.id)}`, text: "Renovar" }));
      }
      if (assinaturaAtiva) {
        const bCancel = el("button", { class: "btn btn--contorno btn--pequeno", type: "button", text: "Cancelar renovação automática" });
        bCancel.addEventListener("click", () => acao(bCancel, `/api/cliente/assinaturas/${encodeURIComponent(l.assinatura.id)}/cancelar`, "Cancelar a renovação automática? A licença continua válida até o fim do período já pago."));
        acoes.append(bCancel);
      }
      cartao.append(acoes);
      return cartao;
    }

    async function carregar() {
      try {
        const r = await api("GET", "/api/cliente/me");
        csrf = r.csrf;
        $("[data-nome]", painel).textContent = r.cliente.nome ? `Olá, ${r.cliente.nome.split(" ")[0]}` : "Suas licenças";
        $("[data-email]", painel).textContent = r.cliente.email;

        const lista = $("[data-licencas]", painel);
        lista.replaceChildren(...(r.licencas.length ? r.licencas.map(renderLicenca) : [el("p", { class: "vazio", text: "Você ainda não tem licenças. Pedidos aguardando pagamento aparecem abaixo." })]));

        const ped = $("[data-pedidos]", painel);
        if (!r.pedidos.length) return ped.replaceChildren(el("p", { class: "vazio", text: "Nenhum pedido." }));
        const corpo = el("tbody", {}, r.pedidos.map((p) => el("tr", {}, [
          el("td", { text: data(p.criado_em) }),
          el("td", { text: `${p.tipo === "renovacao" ? "Renovação" : "Licença"} ${NOMES[p.plano] || p.plano}${p.modalidade === "assinatura" ? " (automática)" : ""}` }),
          el("td", { text: brl(p.valor_centavos) }),
          el("td", {}, el("span", { class: `status status--${p.status}`, text: STATUS[p.status] || p.status })),
        ])));
        ped.replaceChildren(el("div", { class: "tabela-rolagem" }, el("table", { class: "tabela" }, [
          el("thead", {}, el("tr", {}, ["Data", "Descrição", "Valor", "Situação"].map((t) => el("th", { text: t })))),
          corpo,
        ])));
      } catch (e) {
        if (e.status === 401) return window.location.reload();
        erroPainel(e.message);
      }
    }

    async function carregarChamados() {
      const alvo = $("[data-chamados]", painel);
      try {
        const r = await api("GET", "/api/cliente/chamados");
        if (!r.itens.length) return alvo.replaceChildren(el("p", { class: "vazio", text: "Nenhum chamado. Precisa de ajuda? Abra um chamado." }));
        const corpo = el("tbody", {}, r.itens.map((c) => el("tr", {}, [
          el("td", { text: `#${c.numero}` }),
          el("td", {}, el("a", { href: c.url, text: c.assunto })),
          el("td", {}, el("span", { class: `status status--${c.status}`, text: STATUS_CHAMADO[c.status] || c.status })),
          el("td", { text: data(c.atualizado_em) }),
        ])));
        alvo.replaceChildren(el("div", { class: "tabela-rolagem" }, el("table", { class: "tabela" }, [
          el("thead", {}, el("tr", {}, ["Nº", "Assunto", "Situação", "Atualizado"].map((t) => el("th", { text: t })))),
          corpo,
        ])));
      } catch (e) {
        alvo.replaceChildren(el("p", { class: "vazio", text: e.message }));
      }
    }
    carregarChamados();

    // Pedidos de novos emissores de nota fiscal
    const formEmissor = $("#emissor-form");
    async function carregarEmissores() {
      const alvo = $("[data-emissores]", painel);
      try {
        const r = await api("GET", "/api/cliente/emissores");
        if (!r.pedidos.length) return alvo.replaceChildren();
        const corpo = el("tbody", {}, r.pedidos.map((p) => el("tr", {}, [
          el("td", { text: p.nome }),
          el("td", { text: p.documentos.join(", ") }),
          el("td", {}, [el("span", { class: `status status--${p.status}`, text: p.statusRotulo }), p.nota_publica ? el("small", { class: "vazio", text: ` ${p.nota_publica}` }) : null]),
          el("td", { text: data(p.criado_em) }),
        ])));
        alvo.replaceChildren(el("h3", { text: "Seus pedidos" }), el("div", { class: "tabela-rolagem" }, el("table", { class: "tabela" }, [
          el("thead", {}, el("tr", {}, ["Emissor", "Notas", "Situação", "Pedido em"].map((t) => el("th", { text: t })))),
          corpo,
        ])));
      } catch (e) {
        alvo.replaceChildren(el("p", { class: "vazio", text: e.message }));
      }
    }
    if (formEmissor) {
      carregarEmissores();
      formEmissor.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        mostrarErro(formEmissor, "");
        const sucesso = $(".form__sucesso", formEmissor);
        sucesso.hidden = true;
        const documentos = $$("input[name=documentos]:checked", formEmissor).map((c) => c.value);
        if (formEmissor.nome.value.trim().length < 3) { formEmissor.nome.focus(); return mostrarErro(formEmissor, "Informe o nome do emissor."); }
        if (!documentos.length) return mostrarErro(formEmissor, "Marque quais notas você emite.");
        const botao = $("button[type=submit]", formEmissor);
        ocupado(botao, true, "Enviando…");
        try {
          if (!csrf) csrf = (await api("GET", "/api/cliente/me")).csrf;
          await api("POST", "/api/cliente/emissores", {
            nome: formEmissor.nome.value.trim(), site: formEmissor.site.value.trim(), documentos,
            municipio: formEmissor.municipio.value.trim(), uf: formEmissor.uf.value.trim(), observacao: formEmissor.observacao.value.trim(),
          }, csrf);
          const nome = formEmissor.nome.value.trim();
          formEmissor.reset();
          sucesso.textContent = `Pedido de "${nome}" registrado. Avisaremos por e-mail quando estiver disponível.`;
          sucesso.hidden = false;
          carregarEmissores();
        } catch (e) {
          if (e.status === 401) return window.location.reload();
          mostrarErro(formEmissor, e.message);
        } finally {
          ocupado(botao, false);
        }
      });
    }

    $("[data-sair]", painel).addEventListener("click", async () => {
      await api("POST", "/api/cliente/sair").catch(() => {});
      window.location.assign("/cliente");
    });
    carregar();
  }

  // ---------------- Suporte: abrir chamado ----------------
  const suporteForm = $("#suporte-form");
  if (suporteForm) {
    suporteForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      mostrarErro(suporteForm, "");
      const f = suporteForm;
      const campos = { email: f.email.value.trim(), categoria: f.categoria.value, assunto: f.assunto.value.trim(), mensagem: f.mensagem.value.trim() };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email)) { f.email.focus(); return mostrarErro(f, "Informe um e-mail válido para receber as respostas."); }
      if (!campos.categoria) { f.categoria.focus(); return mostrarErro(f, "Escolha o tipo do chamado."); }
      if (campos.assunto.length < 5) { f.assunto.focus(); return mostrarErro(f, "Descreva o assunto em poucas palavras."); }
      if (campos.mensagem.length < 10) { f.mensagem.focus(); return mostrarErro(f, "Conte com mais detalhes o que aconteceu."); }
      const { arquivos, erro } = conferirArquivos(f.anexos);
      if (erro) return mostrarErro(f, erro);

      const botao = $("button[type=submit]", f);
      ocupado(botao, true, "Enviando…");
      try {
        const r = await api("POST", "/api/suporte/chamados", { ...campos, nome: f.nome.value.trim(), site: f.site.value });
        const ok = $("#suporte-ok");
        if (r.numero) {
          if (arquivos.length) ocupado(botao, true, "Enviando arquivos…");
          const falhas = arquivos.length ? await enviarArquivos(`/api/suporte/chamados/${r.id}`, r.mensagemId, arquivos, { token: r.token }) : [];
          $("[data-numero]", ok).textContent = `Chamado #${r.numero}`;
          $("[data-acompanhar]", ok).href = `/suporte/chamado/${r.id}?t=${encodeURIComponent(r.token)}`;
          if (falhas.length) {
            const aviso = $("[data-aviso-anexos]", ok);
            aviso.textContent = `Alguns arquivos não foram enviados (${falhas.join("; ")}). Você pode enviá-los na página do chamado.`;
            aviso.hidden = false;
          }
        } else {
          $("[data-acompanhar]", ok).hidden = true;
        }
        f.hidden = true;
        ok.hidden = false;
        ok.scrollIntoView({ block: "center" });
      } catch (e) {
        mostrarErro(f, e.message);
        ocupado(botao, false);
      }
    });
  }

  // ---------------- Suporte: página do chamado ----------------
  const chamadoEl = $("#chamado");
  if (chamadoEl) {
    const id = chamadoEl.dataset.id;
    const token = new URLSearchParams(window.location.search).get("t") || "";
    const base = `/api/suporte/chamados/${id}`;
    const q = token ? `?t=${encodeURIComponent(token)}` : "";
    const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    let csrf = "";

    // Sem link assinado, usa a sessão da área do cliente (precisa do token CSRF)
    const prepararSessao = async () => {
      if (token || csrf) return;
      try { csrf = (await api("GET", "/api/cliente/me")).csrf; } catch { /* sem sessão */ }
    };

    function renderMensagem(m) {
      const item = el("li", { class: `mensagem mensagem--${m.autor}` });
      if (m.autor !== "sistema") {
        item.append(el("div", { class: "mensagem__topo" }, [
          el("strong", { text: m.autor === "cliente" ? `${m.autorNome || "Você"}` : m.autorNome }),
          el("span", { text: dataHora(m.criadoEm) }),
        ]));
      }
      item.append(el("p", { class: "mensagem__texto", text: m.texto }));
      if (m.anexos.length) {
        item.append(el("div", { class: "anexos" }, m.anexos.map((a) => {
          const url = `${base}/anexos/${encodeURIComponent(a.id)}${q}`;
          return el("a", { class: "anexo", href: url, target: "_blank", rel: "noopener", title: a.nome }, [
            a.mime.startsWith("image/") ? el("img", { src: url, alt: "" }) : null,
            document.createTextNode(a.nome),
          ]);
        })));
      }
      return item;
    }

    async function carregar() {
      try {
        const { chamado: c } = await api("GET", base + q);
        $("[data-carregando]", chamadoEl).hidden = true;
        $("[data-conteudo]", chamadoEl).hidden = false;
        $("[data-numero]", chamadoEl).textContent = `Chamado #${c.numero}`;
        $("[data-assunto]", chamadoEl).textContent = c.assunto;
        document.title = `Chamado #${c.numero} · ${document.title.split(" · ").pop()}`;
        const st = $("[data-status]", chamadoEl);
        st.className = `status status--${c.status}`;
        st.textContent = STATUS_CHAMADO[c.status] || c.status;
        $("[data-datas]", chamadoEl).textContent = `Aberto em ${dataHora(c.criadoEm)} · atualizado em ${dataHora(c.atualizadoEm)}`;
        $("[data-mensagens]", chamadoEl).replaceChildren(...c.mensagens.map(renderMensagem));
        const fechado = c.status === "fechado";
        $("[data-responder]", chamadoEl).hidden = fechado;
        $("[data-fechado]", chamadoEl).hidden = !fechado;
      } catch (e) {
        $("[data-carregando]", chamadoEl).hidden = true;
        if (e.status === 404) return ($("[data-erro]", chamadoEl).hidden = false);
        const p = $("[data-carregando]", chamadoEl);
        p.textContent = e.message;
        p.hidden = false;
      }
    }

    const form = $("#resposta-form");
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      mostrarErro(form, "");
      const texto = form.texto.value.trim();
      if (texto.length < 2) { form.texto.focus(); return mostrarErro(form, "Escreva sua mensagem."); }
      const { arquivos, erro } = conferirArquivos(form.anexos);
      if (erro) return mostrarErro(form, erro);
      const botao = $("button[type=submit]", form);
      ocupado(botao, true, "Enviando…");
      try {
        await prepararSessao();
        const r = await api("POST", `${base}/mensagens${q}`, { texto }, csrf);
        const falhas = arquivos.length ? await enviarArquivos(base, r.mensagemId, arquivos, { token, csrf }) : [];
        form.reset();
        ocupado(botao, false);
        await carregar();
        if (falhas.length) mostrarErro(form, `Mensagem enviada, mas alguns arquivos falharam: ${falhas.join("; ")}`);
      } catch (e) {
        mostrarErro(form, e.message);
        ocupado(botao, false);
      }
    });

    carregar();
  }
})();
