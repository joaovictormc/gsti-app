// Drivers (Windows): leitura de arquivos INF, índice do repositório da assistência e dos
// backups, comparação de versões e plano de instalação pós-formatação.
//
// Estratégia: o backup do cliente é rede de segurança; a preferência é sempre a versão mais
// nova — repositório da assistência, Windows Update e ferramenta do fabricante — e nenhuma
// instalação rebaixa um driver já presente.
const fs = require("fs");
const path = require("path");

const MAX_INF_BYTES = 4 * 1024 * 1024;
const MAX_INFS = 5000;
// Classes que liberam internet: instaladas primeiro na pós-formatação
const CLASSES_REDE = /^(net|netservice)$/i;

// ---------------------------------------------------------------------------
// INF
// ---------------------------------------------------------------------------
function lerTextoInf(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.slice(2).toString("utf16le");
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.slice(3).toString("utf8");
  // INF sem BOM: UTF-16 sem marca tem zeros intercalados
  if (buffer.length > 4 && buffer[1] === 0 && buffer[3] === 0) return buffer.toString("utf16le");
  return buffer.toString("latin1");
}

// Remove comentário (;) fora de aspas
function semComentario(linha) {
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    if (linha[i] === '"') aspas = !aspas;
    else if (linha[i] === ";" && !aspas) return linha.slice(0, i);
  }
  return linha;
}

function secoesInf(texto) {
  const secoes = new Map();
  let atual = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = semComentario(bruta).trim();
    if (!linha) continue;
    const m = linha.match(/^\[([^\]]+)\]$/);
    if (m) {
      atual = m[1].trim().toLowerCase();
      if (!secoes.has(atual)) secoes.set(atual, []);
    } else if (atual) {
      secoes.get(atual).push(linha);
    }
  }
  return secoes;
}

const tirarAspas = (v) => String(v || "").trim().replace(/^"(.*)"$/, "$1");

function resolverString(valor, strings) {
  return tirarAspas(valor).replace(/%([^%]+)%/g, (_m, k) => strings.get(k.toLowerCase()) ?? `%${k}%`);
}

// "10/05/2024,23.60.1.2" -> { data: "2024-10-05", versao: "23.60.1.2" }  (data no INF é mm/dd/aaaa)
function lerDriverVer(valor) {
  const [data, versao] = String(valor || "").split(",").map((x) => x.trim());
  const m = (data || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return {
    data: m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null,
    versao: versao || null,
  };
}

// Plataformas de modelos aceitas (x64); ignora seções só de x86/ARM
const decoracaoX64 = (sufixo) => !sufixo || /^ntamd64/i.test(sufixo) || /^nt(\.|$)/i.test(sufixo);

function interpretarInf(texto) {
  const s = secoesInf(texto);
  const strings = new Map();
  for (const [nome, linhas] of s) {
    if (nome !== "strings" && !nome.startsWith("strings.")) continue;
    for (const l of linhas) {
      const i = l.indexOf("=");
      if (i > 0) {
        const chave = l.slice(0, i).trim().toLowerCase();
        // [Strings] padrão tem prioridade sobre as traduzidas
        if (nome === "strings" || !strings.has(chave)) strings.set(chave, tirarAspas(l.slice(i + 1)));
      }
    }
  }
  const versao = new Map();
  for (const l of s.get("version") || []) {
    const i = l.indexOf("=");
    if (i > 0) versao.set(l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim());
  }
  const dv = lerDriverVer(versao.get("driverver"));

  // [Manufacturer]: %Fab% = Modelos, NTamd64, NTamd64.10.0...
  const hardwareIds = new Set();
  const fabricantes = [];
  for (const l of s.get("manufacturer") || []) {
    const i = l.indexOf("=");
    const direita = i > 0 ? l.slice(i + 1) : l;
    const [base, ...decoracoes] = direita.split(",").map((x) => x.trim()).filter(Boolean);
    if (!base) continue;
    fabricantes.push(resolverString(i > 0 ? l.slice(0, i) : base, strings));
    const nomesSecao = [base, ...decoracoes.filter(decoracaoX64).map((d) => `${base}.${d}`)].map((x) => x.toLowerCase());
    for (const nome of nomesSecao) {
      for (const linha of s.get(nome) || []) {
        const j = linha.indexOf("=");
        if (j < 0) continue;
        const ids = linha.slice(j + 1).split(",").slice(1).map((x) => tirarAspas(x).toLowerCase()).filter((x) => /\\|^\*/.test(x));
        ids.forEach((id) => hardwareIds.add(id));
      }
    }
  }
  return {
    classe: resolverString(versao.get("class"), strings) || null,
    provedor: resolverString(versao.get("provider"), strings) || null,
    catalogo: tirarAspas(versao.get("catalogfile") || versao.get("catalogfile.ntamd64") || "") || null,
    data: dv.data,
    versao: dv.versao,
    fabricantes,
    hardwareIds: [...hardwareIds],
  };
}

// ---------------------------------------------------------------------------
// Índice de uma pasta (repositório da assistência ou backup)
// ---------------------------------------------------------------------------
function listarInfs(pasta, limite = MAX_INFS) {
  const achados = [];
  const pilha = [pasta];
  while (pilha.length && achados.length < limite) {
    const atual = pilha.pop();
    let itens = [];
    try {
      itens = fs.readdirSync(atual, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const it of itens) {
      const completo = path.join(atual, it.name);
      if (it.isDirectory()) pilha.push(completo);
      else if (/\.inf$/i.test(it.name)) achados.push(completo);
    }
  }
  return achados;
}

function indexarPasta(pasta, { fonte }) {
  const entradas = [];
  const erros = [];
  for (const arquivo of listarInfs(pasta)) {
    try {
      const tamanho = fs.statSync(arquivo).size;
      if (tamanho > MAX_INF_BYTES) continue;
      const inf = interpretarInf(lerTextoInf(fs.readFileSync(arquivo)));
      if (!inf.hardwareIds.length) continue;
      entradas.push({ fonte, arquivo, pasta: path.dirname(arquivo), ...inf, temCatalogo: !!inf.catalogo && fs.existsSync(path.join(path.dirname(arquivo), inf.catalogo)) });
    } catch (e) {
      erros.push({ arquivo, erro: e.message });
    }
  }
  return { entradas, erros };
}

// ---------------------------------------------------------------------------
// Versões
// ---------------------------------------------------------------------------
const partes = (v) => String(v || "").split(".").map((x) => Number.parseInt(x, 10));

// > 0 se "a" é mais novo que "b"
function compararDrivers(a, b) {
  if (!b) return 1;
  if (!a) return -1;
  const pa = partes(a.versao);
  const pb = partes(b.versao);
  const mesmoProvedor = a.provedor && b.provedor && a.provedor.toLowerCase() === b.provedor.toLowerCase();
  if (mesmoProvedor && pa.length === pb.length && pa.every(Number.isFinite) && pb.every(Number.isFinite)) {
    for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  }
  if (a.data && b.data && a.data !== b.data) return a.data > b.data ? 1 : -1;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// Mesmo fornecedor ("Realtek" = "Realtek Semiconductor Corp.", "INTEL" = "Intel Corporation")
const fornecedor = (p) => String(p || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/)[0] || "";
const mesmoFornecedor = (a, b) => !!fornecedor(a) && fornecedor(a) === fornecedor(b);

const anosDesde = (dataIso, agora = Date.now()) => (dataIso ? (agora - new Date(dataIso).getTime()) / (365.25 * 86400000) : null);

// ---------------------------------------------------------------------------
// Plano pós-formatação
// ---------------------------------------------------------------------------
/**
 * @param {object} p
 * @param {Array} p.dispositivos  [{ id, nome, classe, erro, hardwareIds[], compativeis[], driver: { provedor, versao, data, inf } | null }]
 * @param {Array} p.repositorio   entradas de indexarPasta (fonte "repositorio")
 * @param {Array} p.backup        entradas de indexarPasta (fonte "backup")
 * @returns {Array} itens do plano (um por INF), com os dispositivos atendidos
 */
function planejar({ dispositivos = [], repositorio = [], backup = [] }) {
  const porInf = new Map();
  for (const d of dispositivos) {
    const ids = (d.hardwareIds || []).map((x) => x.toLowerCase());
    const compat = (d.compativeis || []).map((x) => x.toLowerCase());
    const casa = (e, lista) => lista.some((id) => e.hardwareIds.includes(id));
    // Hardware ID exato tem prioridade sobre ID compatível (genérico)
    const candidatos = (lista) => {
      const exatos = lista.filter((e) => casa(e, ids));
      return exatos.length ? exatos : lista.filter((e) => casa(e, compat));
    };
    const melhor = (lista) => lista.slice().sort((a, b) => compararDrivers(b, a))[0] || null;
    const semDriver = d.erro === 28 || !d.driver;
    // Com driver instalado: só atualização do mesmo fornecedor (não troca o driver do fabricante
    // por um genérico) e mais nova que a instalada
    const util = (lista) => (semDriver ? lista : lista.filter((e) => mesmoFornecedor(e.provedor, d.driver.provedor) && compararDrivers(e, d.driver) > 0));
    // Backup só entra se o repositório não tiver opção
    const escolhido = melhor(util(candidatos(repositorio))) || melhor(util(candidatos(backup)));
    if (!escolhido) continue;
    const motivo = semDriver ? "sem-driver" : "mais-novo";

    const chave = escolhido.arquivo.toLowerCase();
    if (!porInf.has(chave)) {
      porInf.set(chave, {
        chave, fonte: escolhido.fonte, arquivo: escolhido.arquivo, provedor: escolhido.provedor, classe: escolhido.classe,
        versao: escolhido.versao, data: escolhido.data, temCatalogo: escolhido.temCatalogo,
        rede: CLASSES_REDE.test(escolhido.classe || "") || CLASSES_REDE.test(d.classe || ""),
        // Sem catálogo assinado (.cat) o Windows x64 recusa: vem desmarcado
        dispositivos: [], selecionado: !!escolhido.temCatalogo,
      });
    }
    const item = porInf.get(chave);
    item.dispositivos.push({ id: d.id, nome: d.nome, classe: d.classe, motivo, instalado: d.driver ? { versao: d.driver.versao, data: d.driver.data, provedor: d.driver.provedor } : null });
    if (CLASSES_REDE.test(d.classe || "")) item.rede = true;
  }
  // Rede primeiro, depois sem driver, depois atualizações
  const peso = (i) => (i.rede ? 0 : i.dispositivos.some((x) => x.motivo === "sem-driver") ? 1 : 2);
  return [...porInf.values()].sort((a, b) => peso(a) - peso(b) || String(a.classe).localeCompare(String(b.classe)));
}

// Dispositivos ainda pendentes (sem driver) depois de um plano
const pendentes = (dispositivos) => dispositivos.filter((d) => d.erro === 28 || (d.erro && !d.driver));

// Resumo para o laudo: drivers de terceiros e dispositivos com problema
function resumoDrivers(dispositivos, { agora = Date.now() } = {}) {
  const terceiros = dispositivos.filter((d) => d.driver && d.driver.provedor && !/^microsoft/i.test(d.driver.provedor));
  return {
    total: terceiros.length,
    antigos: terceiros.filter((d) => anosDesde(d.driver.data, agora) >= 3).length,
    semDriver: dispositivos.filter((d) => d.erro === 28).map((d) => ({ nome: d.nome || "Dispositivo desconhecido", classe: d.classe, hardwareId: (d.hardwareIds || [])[0] || "" })),
    comErro: dispositivos.filter((d) => d.erro && d.erro !== 28).map((d) => ({ nome: d.nome, classe: d.classe, codigo: d.erro })),
    lista: terceiros.map((d) => ({ nome: d.nome, classe: d.classe, provedor: d.driver.provedor, versao: d.driver.versao, data: d.driver.data })).sort((a, b) => String(a.data).localeCompare(String(b.data))),
  };
}

module.exports = { mesmoFornecedor, lerTextoInf, interpretarInf, indexarPasta, listarInfs, compararDrivers, planejar, pendentes, resumoDrivers, anosDesde, lerDriverVer };
