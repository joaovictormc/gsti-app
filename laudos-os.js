// Laudos técnicos na OS (módulo "diagnostico"): importar o arquivo gerado pelo agente
// GSTI Diagnóstico, receber pela rede local, listar, visualizar e gerar PDF (simples ou
// comparativo antes/depois). O laudo completo fica no banco (JSONB) junto da OS.
const fs = require("fs");
const { validarLaudo, resumo, comparar } = require("./diagnostico/laudo");
const { laudoHtml, comparativoHtml } = require("./diagnostico/laudo-html");
const rede = require("./diagnostico/rede-local");

const EXTENSAO = "gstilaudo";
const MAX_BYTES = 3 * 1024 * 1024;

const SQL_TABELA = [
  "CREATE TABLE IF NOT EXISTS os_laudos (id SERIAL PRIMARY KEY, id_os INT NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE, laudo_id VARCHAR(40) NOT NULL, momento VARCHAR(10) NOT NULL, gerado_em TIMESTAMP NOT NULL, situacao VARCHAR(10) NOT NULL, equipamento TEXT, numero_serie VARCHAR(120), resumo JSONB NOT NULL, dados JSONB NOT NULL, origem VARCHAR(10) NOT NULL, id_usuario INT REFERENCES usuarios(id) ON DELETE SET NULL, criado_em TIMESTAMP NOT NULL DEFAULT NOW())",
  "CREATE UNIQUE INDEX IF NOT EXISTS ux_os_laudos ON os_laudos(id_os, laudo_id)",
];

function criarLaudosOS({ obterPool, BrowserWindow, dialog, obterEmpresa, notificar }) {
  let receptor = null; // um recebimento por vez

  async function salvar(osId, laudo, { origem, usuarioId }) {
    const v = validarLaudo(laudo);
    if (!v.valido) return { success: false, error: v.erro };
    const pool = obterPool();
    const os = (await pool.query("SELECT id, numero_serie FROM ordens_servico WHERE id = $1", [osId])).rows[0];
    if (!os) return { success: false, error: "OS não encontrada." };
    const r = resumo(laudo);
    const { rows } = await pool.query(
      `INSERT INTO os_laudos (id_os, laudo_id, momento, gerado_em, situacao, equipamento, numero_serie, resumo, dados, origem, id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id_os, laudo_id) DO NOTHING RETURNING id`,
      [osId, laudo.id, r.momento, laudo.geradoEm, r.situacao, r.equipamento, r.numeroSerie || null, r, laudo, origem, usuarioId || null]
    );
    if (!rows.length) return { success: false, duplicado: true, error: "Este laudo já está anexado a esta OS." };
    // Avisos para o técnico conferir (não impedem salvar)
    const avisos = [];
    if (laudo.os && String(laudo.os) !== String(osId)) avisos.push(`O laudo foi gerado para a OS ${laudo.os}, mas foi anexado à OS ${osId}.`);
    const serieOS = String(os.numero_serie || "").trim().toLowerCase();
    if (serieOS && r.numeroSerie && serieOS !== r.numeroSerie.toLowerCase()) avisos.push(`Número de série do laudo (${r.numeroSerie}) diferente do cadastrado na OS (${os.numero_serie}).`);
    return { success: true, id: rows[0].id, avisos };
  }

  async function listar(osId) {
    const { rows } = await obterPool().query(
      `SELECT l.id, l.momento, l.gerado_em, l.situacao, l.equipamento, l.numero_serie, l.resumo, l.origem, l.criado_em, u.nome AS usuario
         FROM os_laudos l LEFT JOIN usuarios u ON u.id = l.id_usuario
        WHERE l.id_os = $1 ORDER BY l.gerado_em`,
      [osId]
    );
    return rows;
  }

  async function obterLaudo(id) {
    const { rows } = await obterPool().query("SELECT id, id_os, dados FROM os_laudos WHERE id = $1", [id]);
    return rows[0] || null;
  }

  function importarArquivo(caminho) {
    const tamanho = fs.statSync(caminho).size;
    if (tamanho > MAX_BYTES) return { success: false, error: "Arquivo grande demais para um laudo." };
    try {
      return { success: true, laudo: JSON.parse(fs.readFileSync(caminho, "utf8")) };
    } catch {
      return { success: false, error: "Não foi possível ler o arquivo do laudo." };
    }
  }

  async function iniciarRecebimento(osId, { usuarioId, nomeLoja }) {
    encerrarRecebimento();
    const atual = rede.criarReceptor({
      nome: nomeLoja || "GSTI App",
      aoReceber: async (laudo) => {
        const r = await salvar(osId, laudo, { origem: "rede", usuarioId });
        if (!r.success && !r.duplicado) throw new Error(r.error);
        notificar({ osId, ...r });
        return { os: String(osId) };
      },
      aoEncerrar: (motivo) => {
        if (receptor === atual) receptor = null;
        notificar({ osId, encerrado: motivo });
      },
    });
    receptor = atual;
    try {
      const info = await atual.iniciar();
      return { success: true, ...info };
    } catch (e) {
      receptor = null;
      atual.encerrar("erro");
      const ocupado = /EADDRINUSE/.test(e.message);
      return { success: false, error: ocupado ? "Outro GSTI App deste computador já está recebendo laudos. Feche o recebimento nele e tente de novo." : `Não foi possível abrir o recebimento: ${e.message}` };
    }
  }

  function encerrarRecebimento() {
    if (receptor) receptor.encerrar("fechado");
    receptor = null;
  }

  function carregarHtml(janela, html) {
    return janela.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(html).toString("base64")}`);
  }

  function abrirHtml(pai, html, titulo) {
    const w = new BrowserWindow({ width: 900, height: 900, title: titulo, parent: pai || undefined, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
    w.setMenu(null);
    carregarHtml(w, html);
  }

  async function salvarPdf(pai, html, nomePadrao) {
    const { canceled, filePath } = await dialog.showSaveDialog(pai, { defaultPath: nomePadrao, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (canceled || !filePath) return { success: false, cancelado: true };
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
    try {
      await carregarHtml(w, html);
      fs.writeFileSync(filePath, await w.webContents.printToPDF({ pageSize: "A4", printBackground: true, margins: { marginType: "none" } }));
      return { success: true, caminho: filePath };
    } finally {
      w.destroy();
    }
  }

  const htmlDoLaudo = (laudo) => laudoHtml(laudo, { empresa: obterEmpresa() });
  const htmlComparativo = (entrada, saida) => comparativoHtml(entrada, saida, { empresa: obterEmpresa() });

  return {
    salvar, listar, obterLaudo, importarArquivo, iniciarRecebimento, encerrarRecebimento, abrirHtml, salvarPdf,
    htmlDoLaudo, htmlComparativo, comparar,
    recebendo: () => !!receptor,
  };
}

// Baixa o agente portátil publicado no servidor de licenças (licença com o módulo)
// para a pasta escolhida (pen drive), conferindo o sha512.
async function baixarAgente({ servidor, token, pasta, http = require("axios") }) {
  const base = String(servidor || "").replace(/\/+$/, "");
  if (!base || !token) return { success: false, error: "Ative a licença para baixar o GSTI Diagnóstico." };
  const headers = { "x-gsti-licenca": token };
  const erro = (e) => {
    const status = e?.response?.status;
    if (status === 403) return "O plano desta licença não inclui o módulo Diagnóstico.";
    if (status === 404) return "O GSTI Diagnóstico ainda não foi publicado no servidor.";
    if (status === 401) return "A licença não foi reconhecida pelo servidor.";
    return "Sem conexão com o servidor para baixar o GSTI Diagnóstico.";
  };
  let info;
  try {
    ({ data: info } = await http.get(`${base}/atualizacoes/diagnostico/info`, { headers, timeout: 15000 }));
  } catch (e) {
    return { success: false, error: erro(e) };
  }
  const destino = require("path").join(pasta, info.arquivo);
  const temp = `${destino}.baixando`;
  try {
    const resp = await http.get(`${base}/atualizacoes/diagnostico/baixar`, { headers, responseType: "stream", timeout: 600000 });
    const hash = require("crypto").createHash("sha512");
    await new Promise((resolve, reject) => {
      const saida = fs.createWriteStream(temp);
      resp.data.on("data", (parte) => hash.update(parte));
      resp.data.on("error", reject);
      saida.on("error", reject);
      saida.on("finish", resolve);
      resp.data.pipe(saida);
    });
    if (hash.digest("base64") !== info.sha512) {
      fs.rmSync(temp, { force: true });
      return { success: false, error: "O arquivo baixado não confere (download corrompido). Tente de novo." };
    }
    fs.renameSync(temp, destino);
    return { success: true, caminho: destino, versao: info.versao };
  } catch (e) {
    fs.rmSync(temp, { force: true });
    return { success: false, error: e.code === "EACCES" || e.code === "EPERM" ? "Não foi possível gravar na pasta escolhida (pen drive protegido?)." : erro(e) };
  }
}

// Cabeçalho do laudo com a marca da assistência (logo como data URL)
function empresaParaLaudo({ branding = {}, empresa = {} }) {
  let logo = null;
  if (branding.logoPath && /\.(png|jpe?g)$/i.test(branding.logoPath)) {
    try {
      const mime = /\.png$/i.test(branding.logoPath) ? "image/png" : "image/jpeg";
      const dados = fs.readFileSync(branding.logoPath);
      if (dados.length <= 2 * 1024 * 1024) logo = `data:${mime};base64,${dados.toString("base64")}`;
    } catch { /* logo removida do disco: segue sem */ }
  }
  const contato = [empresa.telefone, empresa.email, empresa.site].filter(Boolean).join(" · ");
  return { nome: branding.companyName || "", contato, logo };
}

const nomeArquivoPdf = (osId, momento) => `laudo-OS${osId}-${momento}.pdf`.replace(/[^\w.-]+/g, "_");

module.exports = { criarLaudosOS, empresaParaLaudo, baixarAgente, SQL_TABELA, EXTENSAO, nomeArquivoPdf };
