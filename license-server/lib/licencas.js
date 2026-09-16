/**
 * Regras de negócio do licenciamento v2 — usadas pelo servidor HTTP e pelo CLI admin.
 */
const crypto = require("crypto");
const { abrir, transacao } = require("./db");
const tokens = require("./tokens");
const cfg = require("./config");

const DIA_MS = 86400000;
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32 (sem I, L, O, U)
const PLANOS = ["mensal", "anual", "vitalicia", "cortesia"];

const { LicencaErro } = require("./erros");

const agoraIso = () => new Date().toISOString();
const normEmail = (e) => String(e || "").trim().toLowerCase();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const expirou = (iso) => !!iso && new Date(iso).getTime() < Date.now();

// --- Chave de licença: GSTI-XXXX-XXXX-XXXX-XXXX (80 bits aleatórios) ---
function gerarChave() {
  let s = "";
  for (let i = 0; i < 16; i++) s += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return "GSTI-" + s.match(/.{4}/g).join("-");
}

// Aceita variações de digitação (minúsculas, sem hífens, O→0, I/L→1).
function canonizarChave(entrada) {
  let s = String(entrada || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("GSTI")) s = s.slice(4);
  s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== 16 || [...s].some((c) => !ALFABETO.includes(c))) return null;
  return s;
}

const hashChave = (canonica) => crypto.createHash("sha256").update(canonica).digest("hex");

function auditar(ator, acao, alvo, dados) {
  abrir()
    .prepare("INSERT INTO auditoria (ator, acao, alvo, dados, criado_em) VALUES (?, ?, ?, ?, ?)")
    .run(ator, acao, alvo || null, dados ? JSON.stringify(dados) : null, agoraIso());
}

// --- Consultas ---
function licencaComCliente(id) {
  return abrir()
    .prepare(
      `SELECT l.*, c.email, c.nome
         FROM licencas l JOIN clientes c ON c.id = l.cliente_id
        WHERE l.id = ?`
    )
    .get(id);
}

function maquinasAtivas(licencaId) {
  return abrir()
    .prepare("SELECT COUNT(*) AS n FROM ativacoes WHERE licenca_id = ? AND desativado_em IS NULL")
    .get(licencaId).n;
}

// Recursos extras levados no token. Emissor fiscal integrado: só com assinatura anual
// ativa (renovação automática) ou licença de cortesia emitida pela equipe.
function recursosDaLicenca(lic) {
  const recursos = [];
  const assinaturaAtiva = abrir()
    .prepare("SELECT 1 FROM assinaturas WHERE licenca_id = ? AND status = 'authorized'")
    .get(lic.id);
  if (assinaturaAtiva || lic.plano === "cortesia") recursos.push("emissorFiscal");
  return recursos;
}

function detalhes(lic) {
  return {
    plano: lic.plano,
    recursos: recursosDaLicenca(lic),
    chaveFinal: lic.chave_final,
    validade: lic.valida_ate || null,
    maxMaquinas: lic.max_maquinas,
    maquinasAtivas: maquinasAtivas(lic.id),
  };
}

function checarUtilizavel(lic) {
  if (lic.status === "revogada") {
    throw new LicencaErro("LICENCA_REVOGADA", lic.motivo_status || "Licença revogada.", 403);
  }
  if (lic.status === "suspensa") {
    throw new LicencaErro(
      "LICENCA_SUSPENSA",
      lic.motivo_status || "Licença suspensa. Verifique o pagamento ou contate o suporte.",
      403
    );
  }
  if (expirou(lic.valida_ate)) {
    throw new LicencaErro("LICENCA_EXPIRADA", "Licença expirada. Renove para continuar usando.", 403);
  }
}

function revalidarAte() {
  return new Date(Date.now() + cfg.REVALIDAR_DIAS * DIA_MS).toISOString();
}

function tokenCompleto(lic, maquinaId) {
  return tokens.emitir({
    tipo: "full",
    lic: lic.id,
    email: lic.email,
    plano: lic.plano,
    recursos: recursosDaLicenca(lic),
    maquina: maquinaId,
    emitidoEm: agoraIso(),
    validade: lic.valida_ate || null,
    revalidarAte: revalidarAte(),
  });
}

function tokenTrial(email, maquinaId, expiraEm) {
  return tokens.emitir({
    tipo: "trial",
    lic: null,
    email,
    plano: "trial",
    recursos: [],
    maquina: maquinaId,
    emitidoEm: agoraIso(),
    validade: expiraEm,
    revalidarAte: revalidarAte(),
  });
}

function validarMaquinaId(maquinaId) {
  const m = String(maquinaId || "");
  if (!/^[a-f0-9]{16,128}$/i.test(m)) {
    throw new LicencaErro("MAQUINA_INVALIDA", "Identificador de máquina inválido.");
  }
  return m.toLowerCase();
}

const texto = (v, max) => (v == null ? null : String(v).slice(0, max));

// ============================================================================
// Operações do app
// ============================================================================

function ativar({ chave, maquinaId, nomeMaquina, appVersao }) {
  const canonica = canonizarChave(chave);
  if (!canonica) throw new LicencaErro("CHAVE_INVALIDA", "Chave de licença inválida.", 404);
  const maquina = validarMaquinaId(maquinaId);
  const db = abrir();

  return transacao(() => {
    const row = db.prepare("SELECT id FROM licencas WHERE chave_hash = ?").get(hashChave(canonica));
    if (!row) throw new LicencaErro("CHAVE_INVALIDA", "Chave de licença inválida.", 404);
    const lic = licencaComCliente(row.id);
    checarUtilizavel(lic);

    const agora = agoraIso();
    const existente = db
      .prepare("SELECT id FROM ativacoes WHERE licenca_id = ? AND maquina_id = ? AND desativado_em IS NULL")
      .get(lic.id, maquina);

    if (existente) {
      db.prepare("UPDATE ativacoes SET ultimo_contato = ?, nome_maquina = ?, app_versao = ? WHERE id = ?")
        .run(agora, texto(nomeMaquina, 100), texto(appVersao, 20), existente.id);
    } else {
      if (maquinasAtivas(lic.id) >= lic.max_maquinas) {
        throw new LicencaErro(
          "LIMITE_MAQUINAS",
          `Esta licença já está em uso no limite de ${lic.max_maquinas} computador(es). ` +
            "Desative-a no outro computador (Configurações → Licença → Transferir) ou contate o suporte.",
          409
        );
      }
      db.prepare(
        `INSERT INTO ativacoes (licenca_id, maquina_id, nome_maquina, app_versao, ativado_em, ultimo_contato)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(lic.id, maquina, texto(nomeMaquina, 100), texto(appVersao, 20), agora, agora);
      auditar("app", "ativar", lic.id, { maquina, nomeMaquina: texto(nomeMaquina, 100) });
    }

    const { token } = tokenCompleto(lic, maquina);
    return { token, detalhes: detalhes(lic) };
  });
}

function validar({ token }) {
  const p = tokens.decodificar(token);
  if (!p) return { valido: false, motivo: "Licença inválida (assinatura)." };

  if (p.tipo === "trial") {
    if (expirou(p.validade)) return { valido: false, motivo: "Período de teste expirado." };
    return { valido: true, token: tokenTrial(p.email, p.maquina, p.validade).token };
  }

  const lic = licencaComCliente(p.lic);
  if (!lic) return { valido: false, motivo: "Licença revogada." };
  try {
    checarUtilizavel(lic);
  } catch (e) {
    return { valido: false, motivo: e.message };
  }

  const db = abrir();
  const ativ = db
    .prepare("SELECT id FROM ativacoes WHERE licenca_id = ? AND maquina_id = ? AND desativado_em IS NULL")
    .get(lic.id, p.maquina);
  if (!ativ) {
    return { valido: false, motivo: "Este computador foi desvinculado da licença. Ative novamente." };
  }
  db.prepare("UPDATE ativacoes SET ultimo_contato = ? WHERE id = ?").run(agoraIso(), ativ.id);

  // Token renovado: reflete renovação de validade, mudança de plano e nova janela offline.
  return { valido: true, token: tokenCompleto(lic, p.maquina).token, detalhes: detalhes(lic) };
}

function desativar({ token }) {
  const p = tokens.decodificar(token);
  if (!p) throw new LicencaErro("TOKEN_INVALIDO", "Licença inválida.", 400);
  if (p.tipo !== "full") return { success: true };
  const r = abrir()
    .prepare(
      "UPDATE ativacoes SET desativado_em = ? WHERE licenca_id = ? AND maquina_id = ? AND desativado_em IS NULL"
    )
    .run(agoraIso(), p.lic, p.maquina);
  if (r.changes) auditar("app", "desativar", p.lic, { maquina: p.maquina });
  return { success: true };
}

function iniciarTrial({ email, maquinaId }) {
  const e = normEmail(email);
  if (!emailValido(e)) throw new LicencaErro("EMAIL_INVALIDO", "Informe um e-mail válido.");
  const maquina = validarMaquinaId(maquinaId);
  const db = abrir();

  return transacao(() => {
    const usado = db.prepare("SELECT 1 FROM trials WHERE email = ? OR maquina_id = ?").get(e, maquina);
    if (usado) {
      throw new LicencaErro("TRIAL_USADO", "Período de teste já utilizado neste e-mail ou neste computador.", 403);
    }
    const expiraEm = new Date(Date.now() + cfg.TRIAL_DIAS * DIA_MS).toISOString();
    db.prepare("INSERT INTO trials (email, maquina_id, emitido_em, expira_em) VALUES (?, ?, ?, ?)")
      .run(e, maquina, agoraIso(), expiraEm);
    auditar("app", "trial", e, { maquina });
    return { token: tokenTrial(e, maquina, expiraEm).token };
  });
}

// ============================================================================
// Operações administrativas (CLI; futuramente webhook do gateway)
// ============================================================================

function emitirLicenca({ email, nome, documento, plano = "vitalicia", dias, ate, maxMaquinas, observacao, ator = "admin" }) {
  const e = normEmail(email);
  if (!emailValido(e)) throw new LicencaErro("EMAIL_INVALIDO", "E-mail inválido.");
  if (!PLANOS.includes(plano)) throw new LicencaErro("PLANO_INVALIDO", `Plano deve ser: ${PLANOS.join(", ")}.`);
  const validaAte = calcularValidade({ dias, ate });
  const max = Number(maxMaquinas || cfg.MAX_MAQUINAS_PADRAO);
  if (!Number.isInteger(max) || max < 1) throw new LicencaErro("MAQUINAS_INVALIDO", "Máquinas deve ser ≥ 1.");
  const db = abrir();

  return transacao(() => {
    const agora = agoraIso();
    db.prepare(
      `INSERT INTO clientes (email, nome, documento, criado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET nome = COALESCE(excluded.nome, nome),
                                        documento = COALESCE(excluded.documento, documento)`
    ).run(e, nome || null, documento || null, agora);
    const cliente = db.prepare("SELECT id FROM clientes WHERE email = ?").get(e);

    const chave = gerarChave();
    const canonica = canonizarChave(chave);
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO licencas (id, cliente_id, chave_hash, chave_final, plano, status, max_maquinas,
                             valida_ate, observacao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, 'ativa', ?, ?, ?, ?, ?)`
    ).run(id, cliente.id, hashChave(canonica), canonica.slice(-4), plano, max, validaAte, observacao || null, agora, agora);
    auditar(ator, "emitir", id, { email: e, plano, validaAte, max });
    return { id, chave, email: e, plano, validaAte, maxMaquinas: max };
  });
}

function calcularValidade({ dias, ate, vitalicia }) {
  if (vitalicia) return null;
  if (ate) {
    const d = new Date(ate);
    if (Number.isNaN(d.getTime())) throw new LicencaErro("DATA_INVALIDA", "Data inválida (use AAAA-MM-DD).");
    return d.toISOString();
  }
  if (dias != null) {
    const n = Number(dias);
    if (!Number.isFinite(n) || n <= 0) throw new LicencaErro("DIAS_INVALIDO", "Dias deve ser > 0.");
    return new Date(Date.now() + n * DIA_MS).toISOString();
  }
  return null;
}

// Resolve uma licença por chave completa, id completo ou prefixo do id.
function resolverLicenca(ref) {
  const db = abrir();
  const canonica = canonizarChave(ref);
  if (canonica) {
    const r = db.prepare("SELECT id FROM licencas WHERE chave_hash = ?").get(hashChave(canonica));
    if (r) return licencaComCliente(r.id);
  }
  const rows = db.prepare("SELECT id FROM licencas WHERE id LIKE ?").all(`${String(ref)}%`);
  if (rows.length === 1) return licencaComCliente(rows[0].id);
  if (rows.length > 1) throw new LicencaErro("AMBIGUO", "Prefixo corresponde a mais de uma licença.");
  throw new LicencaErro("NAO_ENCONTRADA", "Licença não encontrada.", 404);
}

function alterarStatus(ref, status, motivo, ator = "admin") {
  const lic = resolverLicenca(ref);
  abrir()
    .prepare("UPDATE licencas SET status = ?, motivo_status = ?, atualizado_em = ? WHERE id = ?")
    .run(status, motivo || null, agoraIso(), lic.id);
  auditar(ator, `status:${status}`, lic.id, { motivo });
  return licencaComCliente(lic.id);
}

function estender(ref, opcoes, ator = "admin") {
  const lic = resolverLicenca(ref);
  let validaAte;
  if (opcoes.vitalicia) validaAte = null;
  else if (opcoes.ate) validaAte = calcularValidade({ ate: opcoes.ate });
  else {
    // Soma dias a partir da validade atual (ou de hoje, se já venceu).
    const base = lic.valida_ate && !expirou(lic.valida_ate) ? new Date(lic.valida_ate).getTime() : Date.now();
    const n = Number(opcoes.dias);
    if (!Number.isFinite(n) || n <= 0) throw new LicencaErro("DIAS_INVALIDO", "Informe --dias, --ate ou --vitalicia.");
    validaAte = new Date(base + n * DIA_MS).toISOString();
  }
  abrir().prepare("UPDATE licencas SET valida_ate = ?, atualizado_em = ? WHERE id = ?").run(validaAte, agoraIso(), lic.id);
  auditar(ator, "estender", lic.id, { de: lic.valida_ate, para: validaAte });
  return licencaComCliente(lic.id);
}

function definirMaxMaquinas(ref, max, ator = "admin") {
  const n = Number(max);
  if (!Number.isInteger(n) || n < 1) throw new LicencaErro("MAQUINAS_INVALIDO", "Máquinas deve ser ≥ 1.");
  const lic = resolverLicenca(ref);
  abrir().prepare("UPDATE licencas SET max_maquinas = ?, atualizado_em = ? WHERE id = ?").run(n, agoraIso(), lic.id);
  auditar(ator, "max_maquinas", lic.id, { de: lic.max_maquinas, para: n });
  return licencaComCliente(lic.id);
}

// Gera uma nova chave para a licença (a anterior deixa de ativar; ativações atuais continuam).
function regenerarChave(ref, ator = "admin") {
  const lic = resolverLicenca(ref);
  const chave = gerarChave();
  const canonica = canonizarChave(chave);
  abrir()
    .prepare("UPDATE licencas SET chave_hash = ?, chave_final = ?, atualizado_em = ? WHERE id = ?")
    .run(hashChave(canonica), canonica.slice(-4), agoraIso(), lic.id);
  auditar(ator, "regenerar_chave", lic.id);
  return { id: lic.id, chave };
}

function listarLicencas({ email } = {}) {
  const db = abrir();
  const sql = `SELECT l.id, c.email, l.plano, l.status, l.chave_final, l.valida_ate, l.max_maquinas,
                      (SELECT COUNT(*) FROM ativacoes a WHERE a.licenca_id = l.id AND a.desativado_em IS NULL) AS maquinas
                 FROM licencas l JOIN clientes c ON c.id = l.cliente_id
                ${email ? "WHERE c.email LIKE ?" : ""}
                ORDER BY l.criado_em DESC`;
  return email ? db.prepare(sql).all(`%${normEmail(email)}%`) : db.prepare(sql).all();
}

function listarAtivacoes(ref) {
  const lic = resolverLicenca(ref);
  return abrir()
    .prepare("SELECT * FROM ativacoes WHERE licenca_id = ? ORDER BY ativado_em DESC")
    .all(lic.id);
}

function desativarAtivacao(ativacaoId, ator = "admin") {
  const r = abrir()
    .prepare("UPDATE ativacoes SET desativado_em = ? WHERE id = ? AND desativado_em IS NULL")
    .run(agoraIso(), Number(ativacaoId));
  if (!r.changes) throw new LicencaErro("NAO_ENCONTRADA", "Ativação não encontrada ou já desativada.", 404);
  auditar(ator, "desativar_maquina", String(ativacaoId));
  return { success: true };
}

function listarTrials({ email } = {}) {
  const db = abrir();
  return email
    ? db.prepare("SELECT * FROM trials WHERE email LIKE ? ORDER BY emitido_em DESC").all(`%${normEmail(email)}%`)
    : db.prepare("SELECT * FROM trials ORDER BY emitido_em DESC").all();
}

function liberarTrial({ email, maquina }, ator = "admin") {
  if (!email && !maquina) throw new LicencaErro("PARAMETRO", "Informe --email ou --maquina.");
  const r = abrir()
    .prepare("DELETE FROM trials WHERE email = ? OR maquina_id = ?")
    .run(email ? normEmail(email) : "", maquina || "");
  auditar(ator, "liberar_trial", email || maquina, { removidos: r.changes });
  return { removidos: r.changes };
}

function listarAuditoria(limite = 50) {
  return abrir().prepare("SELECT * FROM auditoria ORDER BY id DESC LIMIT ?").all(Number(limite));
}

module.exports = {
  LicencaErro,
  PLANOS,
  gerarChave,
  canonizarChave,
  ativar,
  validar,
  desativar,
  iniciarTrial,
  emitirLicenca,
  resolverLicenca,
  alterarStatus,
  estender,
  definirMaxMaquinas,
  listarLicencas,
  listarAtivacoes,
  desativarAtivacao,
  listarTrials,
  liberarTrial,
  listarAuditoria,
  regenerarChave,
  licencaComCliente,
  detalhes,
  auditar,
  normEmail,
  emailValido,
};
