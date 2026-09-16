/**
 * Configurações sensíveis (Mercado Pago, SMTP) editáveis pelo painel.
 *
 * - Ficam CIFRADAS no banco (AES-256-GCM) com a chave data/config.key, que só
 *   existe no servidor: um vazamento apenas do banco não expõe as credenciais.
 * - A variável de ambiente, quando definida, tem PRIORIDADE e o painel apenas
 *   informa "definido no servidor" (permite travar a configuração em produção).
 * - O valor nunca volta para o navegador: a API devolve só um resumo mascarado.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cfg = require("./config");
const { abrir } = require("./db");
const { LicencaErro } = require("./erros");

const CHAVE_PATH = path.join(cfg.DATA_DIR, "config.key");

// Definição dos campos (também usada pelo painel para montar o formulário).
const CAMPOS = [
  {
    grupo: "mercadopago",
    titulo: "Mercado Pago",
    ajuda: "Credenciais em mercadopago.com.br/developers → Suas integrações → sua aplicação.",
    campos: [
      { nome: "MP_ACCESS_TOKEN", rotulo: "Access token", tipo: "segredo", ajuda: "Produção começa com APP_USR-. Use as credenciais de teste para homologar." },
      { nome: "MP_WEBHOOK_SECRET", rotulo: "Assinatura secreta do webhook", tipo: "segredo", ajuda: "Em Webhooks → assinatura secreta. Sem ela, notificações não são verificadas." },
      { nome: "MP_SANDBOX", rotulo: "Usar credenciais de teste (sandbox)", tipo: "booleano" },
      { nome: "MP_STATEMENT_DESCRIPTOR", rotulo: "Nome na fatura do cartão", tipo: "texto", max: 22 },
    ],
  },
  {
    grupo: "email",
    titulo: "E-mail (SMTP)",
    ajuda: "Servidor de envio dos e-mails automáticos (chave de licença, links de acesso, lembretes).",
    campos: [
      { nome: "SMTP_HOST", rotulo: "Servidor SMTP", tipo: "texto", max: 120 },
      { nome: "SMTP_PORT", rotulo: "Porta", tipo: "numero" },
      { nome: "SMTP_SECURE", rotulo: "Conexão SSL/TLS direta (porta 465)", tipo: "booleano" },
      { nome: "SMTP_USER", rotulo: "Usuário", tipo: "texto", max: 160 },
      { nome: "SMTP_PASS", rotulo: "Senha", tipo: "segredo" },
      { nome: "EMAIL_FROM", rotulo: "Remetente", tipo: "texto", max: 160, ajuda: 'Formato: Nome <endereco@dominio>' },
      { nome: "EMAIL_SUPORTE", rotulo: "E-mail de suporte (responder para)", tipo: "texto", max: 160 },
    ],
  },
];

const PORNOME = Object.fromEntries(CAMPOS.flatMap((g) => g.campos.map((c) => [c.nome, { ...c, grupo: g.grupo }])));

// --- Cifragem ---
function chave() {
  if (!fs.existsSync(CHAVE_PATH)) {
    fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
    fs.writeFileSync(CHAVE_PATH, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  return Buffer.from(fs.readFileSync(CHAVE_PATH, "utf8").trim(), "base64");
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${dados.toString("base64")}`;
}

function decifrar(guardado) {
  try {
    const [iv, tag, dados] = String(guardado).split(".");
    const d = crypto.createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return d.update(Buffer.from(dados, "base64"), undefined, "utf8") + d.final("utf8");
  } catch {
    console.error("[config] não foi possível decifrar um valor — data/config.key mudou?");
    return "";
  }
}

// --- Leitura ---
let cache = null;
const recarregar = () => { cache = null; };

function doBanco() {
  if (!cache) {
    cache = {};
    for (const row of abrir().prepare("SELECT chave, valor FROM configuracoes").all()) {
      cache[row.chave] = decifrar(row.valor);
    }
  }
  return cache;
}

const doAmbiente = (nome) => {
  const v = process.env[nome];
  return v === undefined || v === "" ? null : v;
};

/** Valor efetivo: ambiente (prioridade) → painel → "". */
function obter(nome) {
  const amb = doAmbiente(nome);
  if (amb !== null) return amb;
  return doBanco()[nome] ?? "";
}

const BOOL = (v) => /^(1|true|sim|yes)$/i.test(String(v || ""));
const obterBool = (nome) => BOOL(obter(nome));
const obterNum = (nome, padrao) => Number(obter(nome)) || padrao;

/** De onde vem o valor: "ambiente" | "painel" | null (não configurado). */
function origem(nome) {
  if (doAmbiente(nome) !== null) return "ambiente";
  return doBanco()[nome] ? "painel" : null;
}

function mascarar(nome) {
  const campo = PORNOME[nome];
  const valor = obter(nome);
  if (!valor) return "";
  if (campo?.tipo === "segredo") {
    const fim = valor.slice(-4);
    return `${"•".repeat(Math.min(12, Math.max(4, valor.length - 4)))}${fim}`;
  }
  if (campo?.tipo === "booleano") return BOOL(valor) ? "Sim" : "Não";
  return valor;
}

/** Estado de todos os campos para o painel (sem expor segredos). */
function estado() {
  const db = abrir();
  return CAMPOS.map((g) => ({
    grupo: g.grupo,
    titulo: g.titulo,
    ajuda: g.ajuda,
    campos: g.campos.map((c) => {
      const meta = db.prepare("SELECT atualizado_por, atualizado_em FROM configuracoes WHERE chave = ?").get(c.nome);
      return {
        ...c,
        origem: origem(c.nome),
        valor: mascarar(c.nome),
        // Campos não sensíveis voltam preenchidos para edição; segredos, não.
        valorEditavel: c.tipo === "segredo" ? "" : origem(c.nome) === "painel" ? obter(c.nome) : "",
        atualizadoPor: meta?.atualizado_por || null,
        atualizadoEm: meta?.atualizado_em || null,
      };
    }),
  }));
}

/**
 * Salva valores vindos do painel. Campos ausentes ficam como estão;
 * string vazia em um segredo mantém o valor atual; "__limpar__" apaga.
 */
function salvar(valores, autor) {
  const db = abrir();
  const agora = new Date().toISOString();
  const alterados = [];
  for (const [nome, bruto] of Object.entries(valores || {})) {
    const campo = PORNOME[nome];
    if (!campo) continue;
    if (doAmbiente(nome) !== null) {
      throw new LicencaErro("DEFINIDO_NO_SERVIDOR", `"${campo.rotulo}" está definido por variável de ambiente no servidor e não pode ser alterado pelo painel.`);
    }
    let valor = typeof bruto === "boolean" ? (bruto ? "true" : "false") : String(bruto ?? "").trim();
    if (campo.tipo === "segredo" && valor === "") continue; // não enviou = mantém
    if (valor === "__limpar__") {
      db.prepare("DELETE FROM configuracoes WHERE chave = ?").run(nome);
      alterados.push(nome);
      continue;
    }
    if (campo.tipo === "numero" && valor && !/^\d{1,5}$/.test(valor)) {
      throw new LicencaErro("VALOR_INVALIDO", `"${campo.rotulo}" deve ser um número.`);
    }
    if (campo.max && valor.length > campo.max) valor = valor.slice(0, campo.max);
    db.prepare(
      `INSERT INTO configuracoes (chave, valor, atualizado_por, atualizado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em`
    ).run(nome, cifrar(valor), autor, agora);
    alterados.push(nome);
  }
  recarregar();
  if (alterados.length) {
    db.prepare("INSERT INTO auditoria (ator, acao, alvo, dados, criado_em) VALUES (?, 'config_salvar', NULL, ?, ?)")
      .run(autor, JSON.stringify({ campos: alterados }), agora);
  }
  return alterados;
}

module.exports = { CAMPOS, obter, obterBool, obterNum, origem, estado, salvar, recarregar, mascarar };
