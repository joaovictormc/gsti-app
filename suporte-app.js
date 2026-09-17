// Suporte dentro do app: abre chamados no servidor de licenças com o token da licença,
// dados técnicos (versão, sistema, licença, erros recentes) e captura da tela opcional.
const os = require("os");

const LIMITE_ERROS = 20;

// Últimos erros do processo principal (console.error), para anexar ao chamado
function criarRegistroErros(limite = LIMITE_ERROS) {
  const itens = [];
  const registrar = (args) => {
    const texto = args
      .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "object" ? safeJson(a) : String(a)))
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 500);
    itens.push(`${new Date().toISOString()} ${texto}`);
    if (itens.length > limite) itens.shift();
  };
  return { registrar, listar: () => [...itens] };
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function mensagemErro(e) {
  const status = e?.response?.status;
  const doServidor = e?.response?.data?.error;
  if (status === 401) return "A licença não foi reconhecida pelo servidor. Abra o chamado pelo site.";
  if (status === 429) return "Muitos chamados em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (doServidor) return doServidor;
  if (!e?.response) return "Sem conexão com o servidor de suporte. Verifique a internet ou abra o chamado pelo site.";
  return "Não foi possível abrir o chamado. Tente novamente.";
}

function criarSuporteApp({ app, obterServidor, obterToken, obterLicenca, erros, http }) {
  const cliente = () => http || require("axios");
  const servidor = () => String(obterServidor() || "").replace(/\/+$/, "");
  // Origens dos links de chamado devolvidos pelo servidor (o PUBLIC_URL pode diferir do serverUrl do app)
  const origensDoServidor = new Set();
  const lembrarOrigem = (link) => {
    try {
      origensDoServidor.add(new URL(link).origin);
    } catch {
      /* ignora */
    }
  };

  function dadosTecnicos({ usuario, tela } = {}) {
    const lic = obterLicenca() || {};
    return {
      versaoApp: app.getVersion(),
      electron: process.versions.electron,
      sistema: `${os.type()} ${os.release()} (${os.arch()})`,
      memoria: `${Math.round(os.totalmem() / 1073741824)} GB`,
      idioma: typeof app.getLocale === "function" ? app.getLocale() : "",
      computador: os.hostname(),
      licenca: lic.tipo ? `${lic.tipo} · ${lic.plano || "-"} · ${lic.active ? "ativa" : "inativa"}${lic.validade ? ` · até ${String(lic.validade).slice(0, 10)}` : ""}` : "não ativada",
      modulos: Array.isArray(lic.modulos) ? lic.modulos.join(", ") || "base" : "todos",
      perfilUsuario: usuario?.role || "",
      tela: tela || "",
      errosRecentes: erros ? erros.listar() : [],
    };
  }

  function contexto({ usuario, tela } = {}) {
    const lic = obterLicenca() || {};
    return {
      temLicenca: !!(servidor() && obterToken()),
      email: lic.email || "",
      nome: usuario?.nome || "",
      dadosTecnicos: dadosTecnicos({ usuario, tela }),
    };
  }

  async function abrirChamado({ categoria, assunto, mensagem, email, incluirDados = true, captura = null, usuario, tela }) {
    const token = obterToken();
    if (!servidor() || !token) return { success: false, semLicenca: true, error: "Ative a licença para abrir chamados pelo sistema, ou use o site." };
    const headers = { "x-gsti-licenca": token };
    let r;
    try {
      ({ data: r } = await cliente().post(
        `${servidor()}/v2/suporte/chamados`,
        {
          categoria, assunto, mensagem, email: email || undefined, nome: usuario?.nome || undefined,
          dadosTecnicos: incluirDados ? dadosTecnicos({ usuario, tela }) : undefined,
        },
        { headers, timeout: 20000 }
      ));
    } catch (e) {
      return { success: false, error: mensagemErro(e) };
    }

    let avisoCaptura = null;
    if (captura && captura.length) {
      try {
        await cliente().post(
          `${servidor()}/api/suporte/chamados/${r.id}/mensagens/${r.mensagemId}/anexos?t=${encodeURIComponent(r.token)}`,
          captura,
          { headers: { "Content-Type": "application/octet-stream", "X-Nome-Arquivo": "captura-da-tela.png" }, timeout: 30000, maxBodyLength: 6 * 1024 * 1024 }
        );
      } catch (e) {
        avisoCaptura = `O chamado foi aberto, mas a captura da tela não foi enviada (${mensagemErro(e)}).`;
      }
    }
    lembrarOrigem(r.link);
    return { success: true, numero: r.numero, link: r.link, avisoCaptura };
  }

  async function listarChamados() {
    const token = obterToken();
    if (!servidor() || !token) return { success: false, semLicenca: true, itens: [] };
    try {
      const { data } = await cliente().get(`${servidor()}/v2/suporte/chamados`, { headers: { "x-gsti-licenca": token }, timeout: 15000 });
      (data.itens || []).forEach((i) => lembrarOrigem(i.link));
      return { success: true, itens: data.itens || [] };
    } catch (e) {
      return { success: false, error: mensagemErro(e), itens: [] };
    }
  }

  // Pedido de integração com outro emissor de nota fiscal (ranking no painel)
  async function pedirEmissor({ nome, documentos, municipio, uf, site, observacao }) {
    const token = obterToken();
    if (!servidor() || !token) return { success: false, semLicenca: true, error: "Ative a licença para pedir um emissor, ou use a área do cliente no site." };
    try {
      const { data } = await cliente().post(
        `${servidor()}/v2/emissores/pedidos`,
        { nome, documentos, municipio, uf, site, observacao },
        { headers: { "x-gsti-licenca": token }, timeout: 15000 }
      );
      return { success: true, status: data.status };
    } catch (e) {
      if (e?.response?.status === 401) return { success: false, error: "A licença não foi reconhecida pelo servidor. Peça pela área do cliente no site." };
      return { success: false, error: mensagemErro(e) };
    }
  }

  // Só abre no navegador links do próprio servidor de suporte
  const linkPermitido = (url) => {
    let u;
    let origemApp = null;
    try {
      u = new URL(String(url));
      origemApp = new URL(servidor()).origin;
    } catch {
      if (!u) return false;
    }
    const origemOk = u.origin === origemApp || origensDoServidor.has(u.origin);
    return /^https?:$/.test(u.protocol) && origemOk && /^\/suporte(\/chamado\/\d+)?$/.test(u.pathname);
  };

  return { dadosTecnicos, contexto, abrirChamado, listarChamados, pedirEmissor, linkPermitido, urlSite: () => (servidor() ? `${servidor()}/suporte` : "") };
}

module.exports = { criarSuporteApp, criarRegistroErros, mensagemErro };
