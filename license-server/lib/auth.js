/**
 * Autenticação e autorização.
 * - Equipe (área admin): e-mail + senha (scrypt), 2FA TOTP opcional, papéis.
 * - Clientes (portal): link mágico por e-mail.
 * Sessões ficam no banco (id = hash do token do cookie) com token CSRF próprio.
 */
const crypto = require("crypto");
const { abrir, transacao } = require("./db");
const cfg = require("./config");
const { LicencaErro } = require("./erros");
const { lerCookies, definirCookie, limparCookie } = require("./http");

const agoraIso = () => new Date().toISOString();
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const tokenAleatorio = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
const normEmail = (e) => String(e || "").trim().toLowerCase();

// ============================================================================
// Papéis e permissões
// ============================================================================

const PAPEIS = {
  admin: "Administrador",
  licencas: "Licenças e clientes",
  financeiro: "Financeiro",
  conteudo: "Conteúdo do site",
  suporte: "Suporte",
};

// permissão -> papéis que a possuem (o papel "admin" tem todas)
const PERMISSOES = {
  "painel.ver": ["licencas", "financeiro", "conteudo", "suporte"],
  "licencas.ver": ["licencas", "financeiro", "suporte"],
  "licencas.editar": ["licencas"],
  "clientes.ver": ["licencas", "financeiro", "suporte"],
  "clientes.editar": ["licencas"],
  "pedidos.ver": ["financeiro", "licencas"],
  "pedidos.editar": ["financeiro"],
  "pagamentos.reembolsar": ["financeiro"],
  "ofertas.editar": ["financeiro"],
  "conteudo.editar": ["conteudo"],
  "emails.editar": ["conteudo"],
  "suporte.ver": ["suporte", "licencas"],
  "suporte.responder": ["suporte", "licencas"],
  "emissores.ver": ["licencas", "suporte"],
  "emissores.gerenciar": ["licencas"],
  "usuarios.gerenciar": [],
  "sistema.ver": [],
  "sistema.configurar": [],
  "auditoria.ver": [],
};

function permissoesDe(papeis) {
  if (papeis.includes("admin")) return Object.keys(PERMISSOES);
  return Object.entries(PERMISSOES)
    .filter(([, quem]) => quem.some((p) => papeis.includes(p)))
    .map(([perm]) => perm);
}

const tem = (usuario, perm) => usuario.papeis.includes("admin") || (PERMISSOES[perm] || []).some((p) => usuario.papeis.includes(p));

// ============================================================================
// Senhas (scrypt)
// ============================================================================

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(senha), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function conferirSenha(senha, armazenado) {
  const [alg, N, r, p, saltB64, hashB64] = String(armazenado || "").split("$");
  if (alg !== "scrypt") return false;
  const esperado = Buffer.from(hashB64, "base64");
  const calc = crypto.scryptSync(String(senha), Buffer.from(saltB64, "base64"), esperado.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return crypto.timingSafeEqual(calc, esperado);
}

// Hash descartável para manter tempo de resposta igual quando o e-mail não existe.
const HASH_FALSO = hashSenha(crypto.randomBytes(12).toString("hex"));

function validarForcaSenha(senha) {
  const s = String(senha || "");
  if (s.length < 10) throw new LicencaErro("SENHA_FRACA", "A senha deve ter pelo menos 10 caracteres.");
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) {
    throw new LicencaErro("SENHA_FRACA", "A senha deve conter letras e números.");
  }
}

const senhaTemporaria = () => {
  const alfabeto = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 14; i++) s += alfabeto[crypto.randomInt(alfabeto.length)];
  return s.slice(0, 7) + "-" + s.slice(7) + crypto.randomInt(10);
};

// ============================================================================
// TOTP (RFC 6238) — compatível com Google Authenticator, Authy, 1Password etc.
// ============================================================================

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0, valor = 0, out = "";
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(valor << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0, valor = 0;
  const out = [];
  for (const c of String(str).toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    valor = (valor << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totpCodigo(segredo, passo) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(passo));
  const h = crypto.createHmac("sha1", base32Decode(segredo)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const n = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 1e6).padStart(6, "0");
}

const ultimoPassoUsado = new Map(); // usuarioId -> passo (evita reutilizar o mesmo código)

function conferirTotp(usuarioId, segredo, codigo) {
  const c = String(codigo || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const passoAtual = Math.floor(Date.now() / 30000);
  for (const delta of [0, -1, 1]) {
    const passo = passoAtual + delta;
    if (crypto.timingSafeEqual(Buffer.from(totpCodigo(segredo, passo)), Buffer.from(c))) {
      if ((ultimoPassoUsado.get(usuarioId) || 0) >= passo) return false;
      ultimoPassoUsado.set(usuarioId, passo);
      return true;
    }
  }
  return false;
}

// ============================================================================
// Sessões
// ============================================================================

const COOKIE = { admin: "gsti_admin", cliente: "gsti_cliente" };

function criarSessao(req, res, tipo, { usuarioId = null, clienteId = null, horas }) {
  const token = tokenAleatorio();
  const csrf = tokenAleatorio(24);
  const expira = new Date(Date.now() + horas * 3600000);
  abrir()
    .prepare(
      `INSERT INTO sessoes (id, tipo, usuario_id, cliente_id, csrf, ip, user_agent, criado_em, expira_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(sha256(token), tipo, usuarioId, clienteId, csrf, req.ip || null,
      String(req.headers["user-agent"] || "").slice(0, 200), agoraIso(), expira.toISOString());
  const nomeCookie = tipo === "cliente" ? COOKIE.cliente : COOKIE.admin;
  definirCookie(req, res, nomeCookie, token, {
    maxAgeSeg: horas * 3600,
    sameSite: tipo === "cliente" ? "Lax" : "Strict",
  });
  return { csrf, expiraEm: expira.toISOString() };
}

function lerSessao(req, tipos) {
  const nomeCookie = tipos.includes("cliente") ? COOKIE.cliente : COOKIE.admin;
  const token = lerCookies(req)[nomeCookie];
  if (!token) return null;
  const s = abrir().prepare("SELECT * FROM sessoes WHERE id = ?").get(sha256(token));
  if (!s || !tipos.includes(s.tipo) || new Date(s.expira_em).getTime() < Date.now()) return null;
  return s;
}

function encerrarSessao(req, res, tipo) {
  const nomeCookie = tipo === "cliente" ? COOKIE.cliente : COOKIE.admin;
  const token = lerCookies(req)[nomeCookie];
  if (token) abrir().prepare("DELETE FROM sessoes WHERE id = ?").run(sha256(token));
  limparCookie(req, res, nomeCookie);
}

function limparSessoesExpiradas() {
  const agora = agoraIso();
  const db = abrir();
  db.prepare("DELETE FROM sessoes WHERE expira_em < ?").run(agora);
  db.prepare("DELETE FROM links_magicos WHERE expira_em < ?").run(new Date(Date.now() - 7 * 86400000).toISOString());
}

function conferirCsrf(req, sessao) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const enviado = String(req.headers["x-csrf-token"] || "");
  const ok = enviado.length === sessao.csrf.length &&
    crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(sessao.csrf));
  if (!ok) throw new LicencaErro("CSRF", "Sessão inválida. Recarregue a página.", 403);
}

// ============================================================================
// Usuários da equipe
// ============================================================================

function usuarioPublico(u) {
  const papeis = JSON.parse(u.papeis || "[]");
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    papeis,
    permissoes: permissoesDe(papeis),
    ativo: !!u.ativo,
    totpAtivo: !!u.totp_ativo,
    ultimoLoginEm: u.ultimo_login_em,
    criadoEm: u.criado_em,
  };
}

function validarPapeis(papeis) {
  if (!Array.isArray(papeis) || !papeis.length || papeis.some((p) => !PAPEIS[p])) {
    throw new LicencaErro("PAPEIS", `Informe ao menos um papel válido: ${Object.keys(PAPEIS).join(", ")}.`);
  }
  return [...new Set(papeis)];
}

function auditar(ator, acao, alvo, dados) {
  abrir()
    .prepare("INSERT INTO auditoria (ator, acao, alvo, dados, criado_em) VALUES (?, ?, ?, ?, ?)")
    .run(ator, acao, alvo || null, dados ? JSON.stringify(dados) : null, agoraIso());
}

function criarUsuario({ nome, email, papeis, senha }, ator = "cli") {
  const e = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new LicencaErro("EMAIL_INVALIDO", "E-mail inválido.");
  if (!String(nome || "").trim()) throw new LicencaErro("NOME", "Informe o nome.");
  const lista = validarPapeis(papeis);
  const senhaFinal = senha || senhaTemporaria();
  if (senha) validarForcaSenha(senha);
  const db = abrir();
  if (db.prepare("SELECT 1 FROM admin_usuarios WHERE email = ?").get(e)) {
    throw new LicencaErro("EMAIL_EM_USO", "Já existe um usuário com este e-mail.", 409);
  }
  const agora = agoraIso();
  const r = db
    .prepare(
      `INSERT INTO admin_usuarios (nome, email, senha_hash, papeis, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(String(nome).trim(), e, hashSenha(senhaFinal), JSON.stringify(lista), agora, agora);
  auditar(ator, "usuario_criar", e, { papeis: lista });
  return { usuario: usuarioPublico(db.prepare("SELECT * FROM admin_usuarios WHERE id = ?").get(r.lastInsertRowid)), senhaTemporaria: senha ? null : senhaFinal };
}

function obterUsuario(id) {
  const u = abrir().prepare("SELECT * FROM admin_usuarios WHERE id = ?").get(Number(id));
  if (!u) throw new LicencaErro("NAO_ENCONTRADO", "Usuário não encontrado.", 404);
  return u;
}

function listarUsuarios() {
  return abrir().prepare("SELECT * FROM admin_usuarios ORDER BY nome").all().map(usuarioPublico);
}

function adminsAtivosRestantes(excetoId) {
  return abrir()
    .prepare("SELECT papeis FROM admin_usuarios WHERE ativo = 1 AND id <> ?")
    .all(Number(excetoId))
    .filter((u) => JSON.parse(u.papeis).includes("admin")).length;
}

function atualizarUsuario(id, { nome, papeis, ativo }, ator) {
  return transacao(() => {
    const u = obterUsuario(id);
    const novosPapeis = papeis !== undefined ? validarPapeis(papeis) : JSON.parse(u.papeis);
    const novoAtivo = ativo !== undefined ? (ativo ? 1 : 0) : u.ativo;
    const eraAdmin = JSON.parse(u.papeis).includes("admin") && u.ativo;
    const seraAdmin = novosPapeis.includes("admin") && novoAtivo;
    if (eraAdmin && !seraAdmin && adminsAtivosRestantes(u.id) === 0) {
      throw new LicencaErro("ULTIMO_ADMIN", "É preciso manter pelo menos um Administrador ativo.");
    }
    abrir()
      .prepare("UPDATE admin_usuarios SET nome = ?, papeis = ?, ativo = ?, atualizado_em = ? WHERE id = ?")
      .run(nome !== undefined ? String(nome).trim() || u.nome : u.nome, JSON.stringify(novosPapeis), novoAtivo, agoraIso(), u.id);
    if (!novoAtivo) abrir().prepare("DELETE FROM sessoes WHERE usuario_id = ?").run(u.id);
    auditar(ator, "usuario_atualizar", u.email, { papeis: novosPapeis, ativo: !!novoAtivo });
    return usuarioPublico(obterUsuario(u.id));
  });
}

function redefinirSenha(id, ator) {
  const u = obterUsuario(id);
  const senha = senhaTemporaria();
  const db = abrir();
  db.prepare("UPDATE admin_usuarios SET senha_hash = ?, falhas_login = 0, bloqueado_ate = NULL, atualizado_em = ? WHERE id = ?")
    .run(hashSenha(senha), agoraIso(), u.id);
  db.prepare("DELETE FROM sessoes WHERE usuario_id = ?").run(u.id);
  auditar(ator, "usuario_redefinir_senha", u.email);
  return { senhaTemporaria: senha };
}

function resetar2fa(id, ator) {
  const u = obterUsuario(id);
  abrir().prepare("UPDATE admin_usuarios SET totp_secret = NULL, totp_ativo = 0, atualizado_em = ? WHERE id = ?").run(agoraIso(), u.id);
  auditar(ator, "usuario_resetar_2fa", u.email);
  return { success: true };
}

function alterarPropriaSenha(usuarioId, senhaAtual, novaSenha) {
  const u = obterUsuario(usuarioId);
  if (!conferirSenha(senhaAtual, u.senha_hash)) throw new LicencaErro("SENHA_ATUAL", "Senha atual incorreta.", 403);
  validarForcaSenha(novaSenha);
  abrir().prepare("UPDATE admin_usuarios SET senha_hash = ?, atualizado_em = ? WHERE id = ?").run(hashSenha(novaSenha), agoraIso(), u.id);
  auditar(u.email, "senha_alterar", u.email);
  return { success: true };
}

function iniciar2fa(usuarioId) {
  const u = obterUsuario(usuarioId);
  if (u.totp_ativo) throw new LicencaErro("2FA_ATIVO", "A verificação em duas etapas já está ativa.");
  const segredo = base32Encode(crypto.randomBytes(20));
  abrir().prepare("UPDATE admin_usuarios SET totp_secret = ?, atualizado_em = ? WHERE id = ?").run(segredo, agoraIso(), u.id);
  const emissor = "GSTI Admin";
  const uri = `otpauth://totp/${encodeURIComponent(`${emissor}:${u.email}`)}?secret=${segredo}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=30`;
  return { segredo, uri };
}

function confirmar2fa(usuarioId, codigo) {
  const u = obterUsuario(usuarioId);
  if (!u.totp_secret) throw new LicencaErro("2FA_NAO_INICIADO", "Inicie a configuração novamente.");
  if (!conferirTotp(u.id, u.totp_secret, codigo)) throw new LicencaErro("2FA_CODIGO", "Código inválido.", 403);
  abrir().prepare("UPDATE admin_usuarios SET totp_ativo = 1, atualizado_em = ? WHERE id = ?").run(agoraIso(), u.id);
  auditar(u.email, "2fa_ativar", u.email);
  return { success: true };
}

function desativar2fa(usuarioId, senha, codigo) {
  const u = obterUsuario(usuarioId);
  if (!conferirSenha(senha, u.senha_hash)) throw new LicencaErro("SENHA_ATUAL", "Senha incorreta.", 403);
  if (u.totp_ativo && !conferirTotp(u.id, u.totp_secret, codigo)) throw new LicencaErro("2FA_CODIGO", "Código inválido.", 403);
  abrir().prepare("UPDATE admin_usuarios SET totp_secret = NULL, totp_ativo = 0, atualizado_em = ? WHERE id = ?").run(agoraIso(), u.id);
  auditar(u.email, "2fa_desativar", u.email);
  return { success: true };
}

// --- Login da equipe ---
const MAX_FALHAS = 5;
const BLOQUEIO_MIN = 15;

function login(req, res, { email, senha }) {
  const db = abrir();
  const u = db.prepare("SELECT * FROM admin_usuarios WHERE email = ?").get(normEmail(email));
  const erro = new LicencaErro("LOGIN", "E-mail ou senha inválidos.", 401);

  if (!u) {
    conferirSenha(String(senha || ""), HASH_FALSO);
    throw erro;
  }
  if (u.bloqueado_ate && new Date(u.bloqueado_ate).getTime() > Date.now()) {
    throw new LicencaErro("BLOQUEADO", "Muitas tentativas. Tente novamente em alguns minutos.", 429);
  }
  if (!conferirSenha(String(senha || ""), u.senha_hash) || !u.ativo) {
    const falhas = u.falhas_login + 1;
    const bloqueio = falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MIN * 60000).toISOString() : null;
    db.prepare("UPDATE admin_usuarios SET falhas_login = ?, bloqueado_ate = ? WHERE id = ?")
      .run(bloqueio ? 0 : falhas, bloqueio, u.id);
    if (bloqueio) auditar(u.email, "login_bloqueado", u.email, { ip: req.ip });
    throw erro;
  }

  db.prepare("UPDATE admin_usuarios SET falhas_login = 0, bloqueado_ate = NULL WHERE id = ?").run(u.id);
  if (u.totp_ativo) {
    criarSessao(req, res, "admin_2fa", { usuarioId: u.id, horas: 5 / 60 });
    return { precisa2fa: true };
  }
  return concluirLogin(req, res, u);
}

function login2fa(req, res, { codigo }) {
  const s = lerSessao(req, ["admin_2fa"]);
  if (!s) throw new LicencaErro("SESSAO", "A etapa de login expirou. Entre novamente.", 401);
  const u = obterUsuario(s.usuario_id);
  if (!u.ativo || !conferirTotp(u.id, u.totp_secret, codigo)) {
    throw new LicencaErro("2FA_CODIGO", "Código inválido.", 401);
  }
  abrir().prepare("DELETE FROM sessoes WHERE id = ?").run(s.id);
  return concluirLogin(req, res, u);
}

function concluirLogin(req, res, u) {
  abrir().prepare("UPDATE admin_usuarios SET ultimo_login_em = ? WHERE id = ?").run(agoraIso(), u.id);
  const { csrf } = criarSessao(req, res, "admin", { usuarioId: u.id, horas: cfg.SESSAO_ADMIN_HORAS });
  auditar(u.email, "login", u.email, { ip: req.ip });
  return { success: true, csrf, usuario: usuarioPublico(obterUsuario(u.id)) };
}

// Middleware: exige sessão de equipe (e permissão, se informada).
function exigirEquipe(perm) {
  return (req, res, next) => {
    try {
      const s = lerSessao(req, ["admin"]);
      if (!s) throw new LicencaErro("NAO_AUTENTICADO", "Faça login para continuar.", 401);
      const u = abrir().prepare("SELECT * FROM admin_usuarios WHERE id = ?").get(s.usuario_id);
      if (!u || !u.ativo) throw new LicencaErro("NAO_AUTENTICADO", "Faça login para continuar.", 401);
      conferirCsrf(req, s);
      const usuario = usuarioPublico(u);
      if (perm && !tem(usuario, perm)) throw new LicencaErro("SEM_PERMISSAO", "Você não tem permissão para esta ação.", 403);
      req.equipe = { ...usuario, sessao: s };
      next();
    } catch (e) {
      if (e instanceof LicencaErro) return res.status(e.status).json({ success: false, codigo: e.codigo, error: e.message });
      next(e);
    }
  };
}

const exigirPermissao = (perm) => (req, res, next) => {
  if (!tem(req.equipe, perm)) return res.status(403).json({ success: false, codigo: "SEM_PERMISSAO", error: "Você não tem permissão para esta ação." });
  next();
};

// ============================================================================
// Portal do cliente (link mágico)
// ============================================================================

function criarLinkMagico(email) {
  const db = abrir();
  const cliente = db.prepare("SELECT * FROM clientes WHERE email = ?").get(normEmail(email));
  if (!cliente) return null;
  const token = tokenAleatorio();
  db.prepare("INSERT INTO links_magicos (token_hash, cliente_id, criado_em, expira_em) VALUES (?, ?, ?, ?)")
    .run(sha256(token), cliente.id, agoraIso(), new Date(Date.now() + cfg.LINK_MAGICO_MINUTOS * 60000).toISOString());
  return { cliente, url: `${cfg.PUBLIC_URL}/cliente/entrar?token=${token}` };
}

function consumirLinkMagico(req, res, token) {
  const db = abrir();
  return transacao(() => {
    const l = db.prepare("SELECT * FROM links_magicos WHERE token_hash = ?").get(sha256(String(token || "")));
    if (!l || l.usado_em || new Date(l.expira_em).getTime() < Date.now()) return null;
    db.prepare("UPDATE links_magicos SET usado_em = ? WHERE token_hash = ?").run(agoraIso(), l.token_hash);
    criarSessao(req, res, "cliente", { clienteId: l.cliente_id, horas: cfg.SESSAO_CLIENTE_HORAS });
    return l.cliente_id;
  });
}

function sessaoCliente(req) {
  const s = lerSessao(req, ["cliente"]);
  if (!s) return null;
  const cliente = abrir().prepare("SELECT * FROM clientes WHERE id = ?").get(s.cliente_id);
  return cliente ? { sessao: s, cliente } : null;
}

module.exports = {
  PAPEIS,
  PERMISSOES,
  permissoesDe,
  tem,
  hashSenha,
  conferirSenha,
  validarForcaSenha,
  totpCodigo,
  criarSessao,
  lerSessao,
  encerrarSessao,
  limparSessoesExpiradas,
  conferirCsrf,
  criarUsuario,
  listarUsuarios,
  obterUsuario,
  usuarioPublico,
  atualizarUsuario,
  redefinirSenha,
  resetar2fa,
  alterarPropriaSenha,
  iniciar2fa,
  confirmar2fa,
  desativar2fa,
  login,
  login2fa,
  exigirEquipe,
  exigirPermissao,
  criarLinkMagico,
  consumirLinkMagico,
  sessaoCliente,
};
