/* GSTI Diagnóstico — interface do agente (sem bibliotecas). */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const api = window.agente;
  const ETAPAS = ["coleta", "cpu", "disco", "rede", "laudo"];
  const SITUACAO = { ok: "Nenhum problema encontrado", atencao: "Pontos de atenção encontrados", critico: "Problemas críticos encontrados" };
  const NIVEL = { critico: "Crítico", atencao: "Atenção", info: "Informação" };

  let estado = null;
  let laudo = null;
  let comparativo = null;
  let ultimasOpcoes = null;
  // Otimização feita nesta visita: entra no próximo laudo de saída
  let servicosSessao = null;
  const mb = (b) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${Math.round((b || 0) / 1048576)} MB`);

  function el(tag, attrs = {}, filhos = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (v != null && v !== false) n.setAttribute(k, v === true ? "" : v);
    }
    for (const f of [].concat(filhos)) if (f != null) n.append(f);
    return n;
  }

  const mostrarTela = (nome) => $$("[data-tela]").forEach((t) => { t.hidden = t.dataset.tela !== nome; });
  const mensagem = (texto, tipo = "") => {
    const p = $("[data-mensagem]");
    p.textContent = texto || "";
    p.className = `nota ${tipo}`;
  };

  async function iniciar() {
    estado = await api.estado();
    $("[data-versao]").textContent = `versão ${estado.versao}`;
    $("[data-aviso-admin]").hidden = estado.admin;
    if (estado.plataforma !== "win32") {
      $("[data-acao='reabrir-admin']").hidden = true;
      $("[data-aviso-admin] span").textContent = estado.plataforma === "linux"
        ? "Sem root: para ler a saúde SMART dos discos, rode o programa com sudo (e instale smartmontools)."
        : "No macOS, as ações de otimização que exigem administrador pedem a senha na hora.";
    }
    $("#form-inicio").tecnico.value = estado.config.tecnico || "";
  }

  // ----- Diagnóstico -----
  $("#form-inicio").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.target;
    diagnosticar({
      momento: f.momento.value, os: f.os.value, tecnico: f.tecnico.value, observacao: f.observacao.value,
      testeDisco: f.testeDisco.checked, testeRede: f.testeRede.checked,
    });
  });

  async function diagnosticar(opcoes) {
    ultimasOpcoes = opcoes;
    if (opcoes.momento === "saida" && servicosSessao) opcoes = { ...opcoes, servicos: servicosSessao };
    $$("[data-etapa]").forEach((li) => {
      li.className = "";
      li.hidden = (li.dataset.etapa === "disco" && !opcoes.testeDisco) || (li.dataset.etapa === "rede" && !opcoes.testeRede);
    });
    mostrarTela("progresso");
    const parar = api.aoProgredir((etapa) => {
      const i = ETAPAS.indexOf(etapa);
      $$("[data-etapa]").forEach((li) => {
        const j = ETAPAS.indexOf(li.dataset.etapa);
        li.className = j < i ? "feita" : j === i ? "ativa" : "";
      });
    });
    const r = await api.diagnosticar(opcoes);
    parar();
    if (!r.success) {
      mostrarTela("inicio");
      window.alert(`Não foi possível concluir o diagnóstico: ${r.error}`);
      return;
    }
    laudo = r.laudo;
    comparativo = null;
    if (laudo.servicos) servicosSessao = null; // já registrada neste laudo
    mostrarResultado();
  }

  function mostrarResultado() {
    const e = laudo.equipamento;
    $("[data-momento]").textContent = `${laudo.momento === "saida" ? "Saída" : "Entrada"}${laudo.os ? ` · OS ${laudo.os}` : ""}`;
    $("[data-equipamento]").textContent = [e.fabricante, e.modelo].filter(Boolean).join(" ") || e.computador;
    const disco = laudo.discos[0];
    $("[data-resumo]").textContent = [
      laudo.processador[0]?.nome, laudo.memoria.totalGB ? `${laudo.memoria.totalGB} GB RAM` : "",
      disco ? `${disco.tipo} ${disco.tamanhoGB} GB` : "", laudo.sistema.nome,
    ].filter(Boolean).join(" · ");
    const s = $("[data-situacao]");
    s.className = `situacao ${laudo.situacao}`;
    s.textContent = SITUACAO[laudo.situacao];
    const lista = $("[data-alertas]");
    lista.replaceChildren(...(laudo.alertas.length
      ? laudo.alertas.map((a) => el("li", { class: a.nivel }, [el("b", { text: `${NIVEL[a.nivel]} · ${a.area}: ${a.titulo}` }), a.detalhe ? el("small", { text: a.detalhe }) : null]))
      : [el("li", { class: "ok", text: "Nenhum problema encontrado." })]));
    $("[data-so-saida]").hidden = laudo.momento !== "saida";
    mensagem("");
    mostrarTela("resultado");
  }

  // ----- Ações do resultado -----
  document.addEventListener("click", async (ev) => {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    if (acao === "novo") return mostrarTela("inicio");
    if (acao === "ver") return api.verLaudo(laudo);
    if (acao === "pasta") return api.abrirPasta();
    if (acao === "reabrir-admin") return api.reabrirAdmin();
    if (acao === "pdf") {
      const r = await api.salvarPdf(laudo);
      if (r.success) mensagem(`PDF salvo em ${r.caminho}`, "sucesso");
      return;
    }
    if (acao === "arquivo") {
      const r = await api.salvarArquivo(laudo);
      if (r.success) mensagem(`Laudo salvo em ${r.caminho}. Importe no GSTI App se não puder enviar pela rede.`, "sucesso");
      return;
    }
    if (acao === "comparar") {
      const r = await api.comparar(laudo);
      if (r.success) {
        comparativo = { entrada: r.entrada, saida: r.saida };
        mensagem(r.mesmoEquipamento ? "Comparativo aberto. Use Salvar PDF do comparativo abaixo." : "Atenção: os laudos parecem ser de equipamentos diferentes.", r.mesmoEquipamento ? "sucesso" : "erro");
        let b = $("[data-acao='pdf-comparativo']");
        if (!b) {
          b = el("button", { class: "botao botao--contorno", type: "button", "data-acao": "pdf-comparativo", text: "Salvar PDF do comparativo" });
          $("[data-so-saida]").after(b);
        }
      } else if (!r.cancelado) mensagem(r.error, "erro");
      return;
    }
    if (acao === "pdf-comparativo" && comparativo) {
      const r = await api.salvarPdfComparativo(comparativo);
      if (r.success) mensagem(`PDF do comparativo salvo em ${r.caminho}`, "sucesso");
      return;
    }
    if (acao === "otimizar") return abrirOtimizacao();
    if (acao === "voltar-resultado") return mostrarTela("resultado");
    if (acao === "laudo-saida") return diagnosticar({ ...(ultimasOpcoes || {}), momento: "saida" });
    if (acao === "enviar") return abrirEnvio();
    if (acao === "procurar") return procurar();
    if (acao === "fechar-envio") return $("#dialogo-enviar").close();
    if (acao === "config") return abrirConfig();
    if (acao === "fechar-config") return $("#dialogo-config").close();
  });

  // ----- Otimização -----
  let acoesOtimizacao = [];

  async function abrirOtimizacao() {
    const r = await api.otimizacaoCatalogo();
    acoesOtimizacao = r.acoes || [];
    const grupos = [
      ["Recomendadas", (a) => !a.personalizado && a.risco === "baixo" && !a.lento],
      ["Demoradas (vários minutos)", (a) => !a.personalizado && a.risco === "baixo" && a.lento],
      ["Apagam dados — só com autorização do cliente", (a) => !a.personalizado && a.risco !== "baixo"],
      ["Scripts da assistência", (a) => a.personalizado],
    ];
    const caixas = grupos.map(([titulo, filtro]) => {
      const itens = acoesOtimizacao.filter(filtro);
      if (!itens.length) return null;
      return el("div", { class: "cartao grupo" }, [
        el("h2", { text: titulo }),
        ...itens.map((a) => el("label", { class: "acao" }, [
          el("input", { type: "checkbox", name: "acao", value: a.id, checked: a.padrao }),
          el("span", {}, [
            el("b", { text: a.nome }),
            el("span", { class: "selos" }, [
              a.admin ? el("span", { class: "selo", text: "Administrador" }) : null,
              a.lento ? el("span", { class: "selo selo--lento", text: "Demorada" }) : null,
              a.risco !== "baixo" ? el("span", { class: "selo selo--risco", text: "Apaga dados" }) : null,
            ]),
            el("small", { text: a.descricao }),
          ]),
        ])),
      ]);
    }).filter(Boolean);
    caixas.push(el("p", { class: "nota", text: `Scripts próprios: coloque arquivos ${estado.plataforma === "win32" ? ".ps1" : ".sh"} em ${r.pastaScripts} (cabeçalho com "# nome:", "# descricao:", "# risco:").` }));
    $("[data-grupos]").replaceChildren(...caixas);
    const f = $("#form-otimizacao");
    f.confirmo.checked = false;
    $("[data-erro-otimizacao]").hidden = true;
    mostrarTela("otimizacao");
  }

  $("#form-otimizacao").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const erro = $("[data-erro-otimizacao]");
    const ids = $$("input[name=acao]:checked", f).map((c) => c.value);
    const falha = !ids.length ? "Escolha ao menos uma ação." : !f.autorizadoPor.value.trim() ? "Informe quem autorizou." : !f.confirmo.checked ? "Confirme que o cliente autorizou as ações." : "";
    if (falha) {
      erro.textContent = falha;
      erro.hidden = false;
      return;
    }
    const lista = $("[data-lista-otimizacao]");
    lista.replaceChildren(...ids.map((id) => el("li", { "data-otimizacao": id, text: acoesOtimizacao.find((a) => a.id === id)?.nome || id })));
    $("[data-fim-otimizacao]").hidden = true;
    $("[data-titulo-otimizando]").textContent = "Otimizando…";
    mostrarTela("otimizando");
    const parar = api.aoProgredirOtimizacao((p) => {
      const li = $(`[data-otimizacao="${CSS.escape(p.id)}"]`, lista);
      if (!li) return;
      if (p.fase === "inicio") li.className = "ativa";
      else {
        const r = p.resultado;
        li.className = r.status === "ok" ? "feita" : "erro-etapa";
        li.replaceChildren(el("span", {}, [document.createTextNode(`${r.nome}${r.liberadoBytes ? ` · ${mb(r.liberadoBytes)} liberados` : ""}`), el("small", { text: r.detalhe })]));
      }
    });
    const r = await api.otimizar({ ids, autorizadoPor: f.autorizadoPor.value, tecnico: $("#form-inicio").tecnico.value });
    parar();
    $("[data-titulo-otimizando]").textContent = r.success ? "Otimização concluída" : "Otimização não executada";
    const total = $("[data-total-otimizacao]");
    if (r.success) {
      servicosSessao = r.servicos;
      const falhas = r.servicos.acoes.filter((a) => a.status !== "ok").length;
      total.className = `situacao ${falhas ? "atencao" : "ok"}`;
      total.textContent = `${mb(r.servicos.liberadoTotalBytes)} liberados · ${r.servicos.acoes.length - falhas} ação(ões) concluída(s)${falhas ? `, ${falhas} com falha` : ""}. Gere o laudo de saída para registrar.`;
    } else {
      total.className = "situacao critico";
      total.textContent = r.error;
    }
    $("[data-fim-otimizacao]").hidden = false;
  });

  // ----- Envio pela rede -----
  async function procurar() {
    const caixa = $("[data-lojas]");
    caixa.replaceChildren(el("p", { class: "nota", text: "Procurando o GSTI App na rede…" }));
    const r = await api.descobrir();
    const itens = r.itens || [];
    const opcoes = itens.map((l, i) =>
      el("label", { class: "loja" }, [
        el("input", { type: "radio", name: "destino", value: String(i), checked: i === 0 }),
        el("span", {}, [el("b", { text: l.nome }), el("small", { text: `${l.hosts.join(", ")} · porta ${l.porta}` })]),
      ])
    );
    opcoes.push(el("label", { class: "loja" }, [el("input", { type: "radio", name: "destino", value: "manual", checked: !itens.length }), el("span", {}, [el("b", { text: "Digitar o endereço" }), el("small", { text: "Se o GSTI App não aparecer na lista" })])]));
    caixa.replaceChildren(...opcoes);
    caixa._itens = itens;
    atualizarManual();
  }
  const atualizarManual = () => {
    const sel = $("#form-enviar input[name=destino]:checked");
    $("[data-manual]").hidden = !sel || sel.value !== "manual";
  };
  $("[data-lojas]").addEventListener("change", atualizarManual);

  function abrirEnvio() {
    const f = $("#form-enviar");
    f.codigo.value = "";
    $("[data-erro-envio]").hidden = true;
    $("#dialogo-enviar").showModal();
    procurar();
  }

  $("#form-enviar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const erro = $("[data-erro-envio]");
    erro.hidden = true;
    const sel = $("input[name=destino]:checked", f);
    const destino = !sel || sel.value === "manual" ? f.manual.value : $("[data-lojas]")._itens[Number(sel.value)];
    const botao = $("button[type=submit]", f);
    botao.disabled = true;
    botao.textContent = "Enviando…";
    const r = await api.enviar({ destino, codigo: f.codigo.value, laudo });
    botao.disabled = false;
    botao.textContent = "Enviar";
    if (r.success) {
      $("#dialogo-enviar").close();
      mensagem(`Laudo enviado ao GSTI App${r.os ? ` e anexado à OS ${r.os}` : ""}.`, "sucesso");
    } else {
      erro.textContent = r.error;
      erro.hidden = false;
    }
  });

  // ----- Configurações -----
  function abrirConfig() {
    const f = $("#form-config");
    f.empresa.value = estado.config.empresa || "";
    f.contato.value = estado.config.contato || "";
    f.tecnico.value = estado.config.tecnico || "";
    $("#dialogo-config").showModal();
  }
  $("#form-config").addEventListener("submit", async (ev) => {
    const f = ev.target;
    estado.config = { empresa: f.empresa.value.trim(), contato: f.contato.value.trim(), tecnico: f.tecnico.value.trim() };
    await api.salvarConfig(estado.config);
    if (!$("#form-inicio").tecnico.value) $("#form-inicio").tecnico.value = estado.config.tecnico;
  });

  iniciar();
})();
