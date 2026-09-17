// Atualização automática do app (electron-updater, provedor "generic").
// Consulta <servidor de licenças>/atualizacoes/win/latest.yml com o token da licença
// (só licenças válidas baixam), baixa em segundo plano e instala ao reiniciar/fechar.
// Só funciona no app instalado (app.isPackaged).

const INTERVALO_MS = 6 * 60 * 60 * 1000;
const ATRASO_INICIAL_MS = 20 * 1000;

function textoNotas(notas) {
  if (!notas) return "";
  if (typeof notas === "string") return notas;
  if (Array.isArray(notas)) return notas.map((n) => (typeof n === "string" ? n : n.note || "")).filter(Boolean).join("\n\n");
  return "";
}

function mensagemErro(erro) {
  const texto = String(erro?.message || erro || "");
  if (/\b401\b/.test(texto)) return "A licença não foi reconhecida pelo servidor de atualizações.";
  if (/\b403\b/.test(texto)) return "A licença não tem direito a atualizações (vencida, suspensa ou revogada).";
  if (/\b404\b/.test(texto)) return "Nenhuma atualização publicada no servidor.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET|net::/i.test(texto)) return "Sem conexão com o servidor de atualizações.";
  if (/sha512|checksum/i.test(texto)) return "O arquivo baixado não confere; a atualização foi descartada e será tentada de novo.";
  return "Não foi possível verificar atualizações.";
}

function criarAtualizador({ app, obterServidor, obterToken, aoMudar = () => {}, updater }) {
  let autoUpdater = null;
  let timer = null;
  let estado = { fase: "ocioso", versaoAtual: app.getVersion(), versaoNova: null, progresso: 0, notas: "", erro: null, verificadoEm: null };

  const mudar = (parcial) => {
    estado = { ...estado, ...parcial };
    aoMudar({ ...estado });
  };

  function obterAutoUpdater() {
    if (autoUpdater) return autoUpdater;
    autoUpdater = updater || require("electron-updater").autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.logger = null;
    autoUpdater.on("checking-for-update", () => mudar({ fase: "verificando", erro: null }));
    autoUpdater.on("update-not-available", () => mudar({ fase: "atualizado", versaoNova: null, verificadoEm: new Date().toISOString() }));
    autoUpdater.on("update-available", (info) =>
      mudar({ fase: "baixando", versaoNova: info.version, notas: textoNotas(info.releaseNotes), progresso: 0, verificadoEm: new Date().toISOString() })
    );
    autoUpdater.on("download-progress", (p) => mudar({ fase: "baixando", progresso: Math.round(p.percent || 0) }));
    autoUpdater.on("update-downloaded", (info) =>
      mudar({ fase: "pronta", versaoNova: info.version, notas: textoNotas(info.releaseNotes) || estado.notas, progresso: 100 })
    );
    autoUpdater.on("error", (e) => {
      console.warn("[Atualização]", e?.message || e);
      mudar({ fase: estado.fase === "pronta" ? "pronta" : "erro", erro: mensagemErro(e) });
    });
    return autoUpdater;
  }

  async function verificar() {
    if (!app.isPackaged && !process.env.GSTI_ATUALIZADOR_DEV) {
      mudar({ fase: "indisponivel", erro: "A atualização automática funciona no app instalado." });
      return { ...estado };
    }
    if (estado.fase === "baixando" || estado.fase === "pronta") return { ...estado };
    const servidor = String(obterServidor() || "").replace(/\/+$/, "");
    const token = obterToken();
    if (!servidor || !token) {
      mudar({ fase: "indisponivel", erro: "Ative a licença para receber atualizações." });
      return { ...estado };
    }
    const u = obterAutoUpdater();
    u.setFeedURL({ provider: "generic", url: `${servidor}/atualizacoes/win`, useMultipleRangeRequest: false });
    u.requestHeaders = { "x-gsti-licenca": token };
    try {
      mudar({ fase: "verificando", erro: null });
      await u.checkForUpdates();
    } catch (e) {
      mudar({ fase: "erro", erro: mensagemErro(e), verificadoEm: new Date().toISOString() });
    }
    return { ...estado };
  }

  function iniciar() {
    if (timer) return;
    setTimeout(() => verificar().catch(() => {}), ATRASO_INICIAL_MS);
    timer = setInterval(() => verificar().catch(() => {}), INTERVALO_MS);
  }

  function instalar() {
    if (estado.fase !== "pronta") return { success: false, error: "Nenhuma atualização pronta para instalar." };
    setImmediate(() => obterAutoUpdater().quitAndInstall(false, true));
    return { success: true };
  }

  return { verificar, iniciar, instalar, estado: () => ({ ...estado }) };
}

module.exports = { criarAtualizador, mensagemErro, textoNotas };
