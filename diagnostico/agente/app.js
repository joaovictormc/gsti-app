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
  // Tela de onde a otimização/drivers/programas foi aberta (início ou resultado)
  let origem = "inicio";
  const telaAtual = () => $$("[data-tela]").find((t) => !t.hidden)?.dataset.tela;
  const abrirDe = (nome) => {
    const atual = telaAtual();
    if (atual === "inicio" || atual === "resultado") origem = atual;
    mostrarTela(nome);
  };
  // Serviços da visita (otimização, drivers, programas) somam no mesmo registro do laudo
  const juntarServicos = (a, b) => (!a ? b : {
    ...b, executadoEm: a.executadoEm, liberadoTotalBytes: (a.liberadoTotalBytes || 0) + (b.liberadoTotalBytes || 0),
    requerReinicio: !!(a.requerReinicio || b.requerReinicio), acoes: [...a.acoes, ...b.acoes],
    autorizadoPor: a.autorizadoPor === b.autorizadoPor ? b.autorizadoPor : [a.autorizadoPor, b.autorizadoPor].filter(Boolean).join(", "),
  });
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
    $$("[data-so-windows]").forEach((b) => { b.hidden = estado.plataforma !== "win32"; });
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
    if (acao === "voltar-resultado" || acao === "voltar") return mostrarTela(origem === "resultado" && !laudo ? "inicio" : origem);
    if (acao === "drivers") return abrirDrivers();
    if (acao === "drivers-backup") return backupDrivers(alvo);
    if (acao === "programas") return abrirProgramas();
    if (acao === "programas-padrao" || acao === "programas-nenhum") {
      $$("input[name=programa]").forEach((c) => { c.checked = acao === "programas-padrao" && c.dataset.padrao === "1"; });
      return contarProgramas();
    }
    if (acao === "laudo-saida") return diagnosticar({ testeDisco: true, testeRede: true, tecnico: tecnicoAtual(), ...(ultimasOpcoes || {}), momento: "saida" });
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
      ["Manutenção e reparo", (a) => a.categoria === "manutencao", "O ponto de restauração é criado antes de qualquer outra ação."],
      ["Limpeza", (a) => a.categoria === "limpeza" && a.risco === "baixo", "Libera espaço sem apagar arquivos do cliente."],
      ["Desempenho e aparência", (a) => a.categoria === "desempenho" && a.risco === "baixo", "Ajustes guardados: podem ser desfeitos depois em “Desfazer ajustes”."],
      ["Apagam dados ou removem programas — só com autorização do cliente", (a) => !a.personalizado && a.risco !== "baixo", ""],
      ["Desfazer ajustes", (a) => a.categoria === "reverter", "Use se o cliente quiser voltar às configurações anteriores."],
      ["Scripts da assistência", (a) => a.personalizado, ""],
    ];
    const caixas = grupos.map(([titulo, filtro, ajuda]) => {
      const itens = acoesOtimizacao.filter(filtro);
      if (!itens.length) return null;
      return el("div", { class: "cartao grupo" }, [
        el("h2", { text: titulo }),
        ajuda ? el("p", { class: "nota", text: ajuda }) : null,
        ...itens.map((a) => el("label", { class: "acao" }, [
          el("input", { type: "checkbox", name: "acao", value: a.id, checked: a.padrao }),
          el("span", {}, [
            el("b", { text: a.nome }),
            el("span", { class: "selos" }, [
              a.admin ? el("span", { class: "selo", text: "Administrador" }) : null,
              a.lento ? el("span", { class: "selo selo--lento", text: "Demorada" }) : null,
              a.reinicio ? el("span", { class: "selo selo--lento", text: "Reiniciar" }) : null,
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
    abrirDe("otimizacao");
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
    $("[data-sub-otimizando]").textContent = "Não desligue o computador. Ações demoradas podem levar vários minutos; no macOS e no Linux o sistema pede a senha de administrador uma vez.";
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
      servicosSessao = juntarServicos(servicosSessao, r.servicos);
      const falhas = r.servicos.acoes.filter((a) => a.status !== "ok").length;
      total.className = `situacao ${falhas ? "atencao" : "ok"}`;
      total.textContent = `${mb(r.servicos.liberadoTotalBytes)} liberados · ${r.servicos.acoes.length - falhas} ação(ões) concluída(s)${falhas ? `, ${falhas} com falha` : ""}.${r.servicos.requerReinicio ? " Reinicie o computador para aplicar todos os ajustes (o laudo de saída pode ser gerado depois de reiniciar)." : ""} Gere o laudo de saída para registrar.`;
    } else {
      total.className = "situacao critico";
      total.textContent = r.error;
    }
    $("[data-fim-otimizacao]").hidden = false;
  });

  // ----- Execução com lista montada durante o andamento (drivers e programas) -----
  async function executarComProgresso({ titulo, sub, itens = [], chamar, concluir }) {
    const lista = $("[data-lista-otimizacao]");
    lista.replaceChildren(...itens.map((i) => el("li", { "data-otimizacao": i.id, text: i.nome })));
    $("[data-fim-otimizacao]").hidden = true;
    $("[data-titulo-otimizando]").textContent = titulo;
    $("[data-sub-otimizando]").textContent = sub;
    mostrarTela("otimizando");
    const parar = api.aoProgredirOtimizacao((p) => {
      if (p.fase === "inicio") {
        let li = $(`[data-otimizacao="${CSS.escape(p.id)}"]`, lista);
        if (!li) lista.append(li = el("li", { "data-otimizacao": p.id, text: p.nome || p.id }));
        li.className = "ativa";
        return;
      }
      const r = p.resultado;
      let li = (p.id && $(`[data-otimizacao="${CSS.escape(p.id)}"]`, lista)) || $("li.ativa", lista);
      if (!li) lista.append(li = el("li"));
      li.className = r.status === "ok" ? "feita" : "erro-etapa";
      li.replaceChildren(el("span", {}, [document.createTextNode(r.nome), el("small", { text: r.detalhe })]));
    });
    const r = await chamar();
    parar();
    const total = $("[data-total-otimizacao]");
    if (r.success) {
      servicosSessao = juntarServicos(servicosSessao, r.servicos);
      const falhas = r.servicos.acoes.filter((a) => a.status !== "ok").length;
      total.className = `situacao ${falhas ? "atencao" : "ok"}`;
      total.textContent = `${r.servicos.acoes.length - falhas} concluído(s)${falhas ? `, ${falhas} com falha` : ""}.${concluir ? concluir(r) : ""}${r.servicos.requerReinicio ? " Reinicie o computador para concluir." : ""} Gere o laudo de saída para registrar.`;
    } else {
      total.className = "situacao critico";
      total.textContent = r.error;
    }
    $("[data-titulo-otimizando]").textContent = r.success ? titulo.replace("…", " — concluído") : "Não executado";
    $("[data-fim-otimizacao]").hidden = false;
  }

  const validarAutorizacao = (f, erro, vazio) => {
    const falha = vazio || (!f.autorizadoPor.value.trim() ? "Informe quem autorizou." : !f.confirmo.checked ? "Confirme a autorização do cliente." : "");
    erro.textContent = falha;
    erro.hidden = !falha;
    return !falha;
  };
  const tecnicoAtual = () => $("#form-inicio").tecnico.value || estado.config.tecnico || "";

  // ----- Drivers (Windows) -----
  let analise = null;
  const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "sem data");

  async function abrirDrivers() {
    abrirDe("drivers");
    const f = $("#form-drivers");
    f.confirmo.checked = false;
    $("[data-erro-drivers]").hidden = true;
    $("[data-drivers-backup-msg]").textContent = "";
    $("[data-drivers-backup-info]").textContent = "";
    $("[data-drivers-situacao]").replaceChildren(el("p", { class: "nota", text: "Lendo os dispositivos e o repositório de drivers…" }));
    $("[data-drivers-fontes]").replaceChildren();
    analise = await api.driversAnalisar({ numeroSerie: laudo?.equipamento?.numeroSerie });
    if (!analise.success) {
      $("[data-drivers-situacao]").replaceChildren(el("p", { class: "erro", text: analise.error }));
      return;
    }
    const a = analise;
    const faltam = a.pendentes;
    $("[data-drivers-situacao]").replaceChildren(...[
      el("h2", { text: [a.fabricante, a.modelo].filter(Boolean).join(" ") || "Situação atual" }),
      el("p", { class: `situacao ${faltam.length ? "atencao" : "ok"}`, text: faltam.length ? `${faltam.length} dispositivo(s) sem driver ou com erro` : "Todos os dispositivos têm driver" }),
      el("p", { class: "nota", text: `${a.resumo.total} driver(s) de fabricantes · ${a.resumo.antigos} com mais de 3 anos` }),
      faltam.length ? el("ul", { class: "lista-simples" }, faltam.slice(0, 12).map((d) => el("li", {}, [document.createTextNode(d.nome), el("small", { text: ` · ${d.classe || "sem tipo"} · ${d.hardwareId}` })]))) : null,
    ].filter(Boolean));
    $("[data-drivers-backup-info]").textContent = a.backup
      ? `Backup deste computador no pen drive: ${dataCurta(a.backup.geradoEm)} (${a.backup.pacotes} pacotes). Só é usado quando o repositório não tiver o driver.`
      : "Nenhum backup deste computador no pen drive.";

    const caixa = (nome, valor, titulo, detalhe, marcado = true) => el("label", { class: "acao" }, [
      el("input", { type: "checkbox", name, value: valor, checked: marcado }),
      el("span", {}, [el("b", { text: titulo }), el("small", { text: detalhe })]),
    ]);
    const motivo = (i) => i.dispositivos
      .map((d) => (d.motivo === "sem-driver" ? `${d.nome}: sem driver` : `${d.nome}: ${d.instalado?.versao || "?"} → ${i.versao}`))
      .slice(0, 3).join(" · ");
    $("[data-drivers-fontes]").replaceChildren(...[
      el("h2", { text: "O que instalar" }),
      caixa("windowsUpdate", "1", "Windows Update", "Drivers oficiais publicados pela Microsoft e pelos fabricantes. Precisa de internet e pode demorar."),
      a.ferramenta ? caixa("fabricante", "1", a.ferramenta, "Ferramenta oficial do fabricante (instalada pelo winget se faltar). Atualiza só drivers, não a BIOS.") : null,
      el("p", { class: "nota", text: a.plano.length
        ? `Do repositório da assistência (${a.repositorio.pacotes} pacotes) e do backup:`
        : `Repositório da assistência: ${a.repositorio.pacotes} pacote(s) em ${a.repositorio.pasta}. Nenhum deles falta ou é mais novo neste computador.` }),
      ...a.plano.map((i) => caixa("inf", i.chave,
        `${i.classe || "Driver"} · ${i.provedor || ""} ${i.versao || ""} (${dataCurta(i.data)})`,
        `${i.fonte === "repositorio" ? "Repositório" : "Backup"} · ${i.arquivo}${i.rede ? " · rede: instalado primeiro" : ""}${i.temCatalogo ? "" : " · sem assinatura (.cat)"} — ${motivo(i)}`,
        i.selecionado)),
    ].filter(Boolean));
  }

  async function backupDrivers(botao) {
    const msg = $("[data-drivers-backup-msg]");
    botao.disabled = true;
    msg.className = "nota";
    msg.textContent = "Exportando os drivers… pode levar alguns minutos.";
    const r = await api.driversBackup({ equipamento: laudo?.equipamento });
    botao.disabled = false;
    msg.className = `nota ${r.success && r.status === "ok" ? "sucesso" : "erro"}`;
    msg.textContent = r.success ? `${r.detalhe}${r.antigos ? ` (${r.antigos} com mais de 3 anos)` : ""} em ${r.pasta}` : r.error;
  }

  $("#form-drivers").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (!analise?.success) return;
    const selecionados = $$("input[name=inf]:checked", f).map((c) => c.value);
    const wu = !!f.windowsUpdate?.checked;
    const fab = !!f.fabricante?.checked;
    if (!validarAutorizacao(f, $("[data-erro-drivers]"), !selecionados.length && !wu && !fab ? "Escolha ao menos uma fonte de drivers." : "")) return;
    executarComProgresso({
      titulo: "Instalando drivers…",
      sub: "Não desligue o computador. O Windows Update e a ferramenta do fabricante podem levar muitos minutos; a tela pode piscar quando o driver de vídeo for trocado.",
      chamar: () => api.driversExecutar({ selecionados, incluirWindowsUpdate: wu, incluirFabricante: fab, autorizadoPor: f.autorizadoPor.value, tecnico: tecnicoAtual() }),
      concluir: (r) => (r.pendentes?.length ? ` Continuam sem driver: ${r.pendentes.map((d) => d.nome).slice(0, 5).join(", ")}.` : " Todos os dispositivos têm driver."),
    });
  });

  // ----- Programas -----
  let programas = [];
  const contarProgramas = () => {
    $("[data-programas-contagem]").textContent = `${$$("input[name=programa]:checked").length} programa(s) selecionado(s)`;
  };

  async function abrirProgramas() {
    const r = await api.programasCatalogo();
    programas = r.programas || [];
    const fonte = { win32: "winget, da Microsoft", darwin: "Homebrew", linux: "Flathub" }[estado.plataforma];
    $("[data-programas-sub]").textContent = `Instalação silenciosa pela fonte oficial (${fonte}), sempre na versão mais recente. Programas já instalados são mantidos. Precisa de internet, exceto os instaladores offline da assistência.`;
    const grupos = Object.entries(r.categorias).map(([cat, titulo]) => {
      const itens = programas.filter((p) => p.categoria === cat);
      if (!itens.length) return null;
      return el("div", { class: "cartao grupo" }, [
        el("h2", { text: titulo }),
        ...itens.map((p) => el("label", { class: "acao" }, [
          el("input", { type: "checkbox", name: "programa", value: p.id, checked: !!p.padrao, "data-padrao": p.padrao ? "1" : "0" }),
          el("span", {}, [
            el("b", { text: p.nome }),
            el("span", { class: "selos" }, [
              p.personalizado ? el("span", { class: "selo", text: "Assistência" }) : null,
              p.local ? el("span", { class: "selo", text: "Offline" }) : null,
            ]),
            p.nota ? el("small", { text: p.nota }) : null,
          ]),
        ])),
      ]);
    }).filter(Boolean);
    $("[data-programas]").replaceChildren(...grupos, el("p", { class: "nota", text: `Programas próprios e instaladores offline: arquivo programas.json na pasta ${r.pastaProgramas} (formato no README do agente).` }));
    const f = $("#form-programas");
    f.confirmo.checked = false;
    $("[data-erro-programas]").hidden = true;
    contarProgramas();
    abrirDe("programas");
  }
  $("[data-programas]").addEventListener("change", contarProgramas);

  $("#form-programas").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const ids = $$("input[name=programa]:checked", f).map((c) => c.value);
    if (!validarAutorizacao(f, $("[data-erro-programas]"), ids.length ? "" : "Escolha ao menos um programa.")) return;
    executarComProgresso({
      titulo: "Instalando programas…",
      sub: "Não desligue o computador. Cada programa é baixado e instalado em sequência; alguns levam vários minutos.",
      itens: ids.map((id) => ({ id, nome: programas.find((p) => p.id === id)?.nome || id })),
      chamar: () => api.programasInstalar({ ids, autorizadoPor: f.autorizadoPor.value, tecnico: tecnicoAtual() }),
    });
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
