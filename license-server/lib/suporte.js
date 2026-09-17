/**
 * Suporte (helpdesk): chamados abertos pelo site, pela área do cliente ou pelo app,
 * respondidos pela equipe no painel. Cada resposta avisa a outra parte por e-mail.
 *
 * Acesso do cliente a um chamado: link com assinatura (?t=...) enviado por e-mail
 * ou sessão da área do cliente com o mesmo e-mail. Anexos ficam em data/suporte/<id>.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cfg = require("./config");
const segredos = require("./segredos");
const email = require("./email");
const uploads = require("./uploads");
const { abrir, transacao } = require("./db");
const { LicencaErro } = require("./erros");

const DIR = path.join(cfg.DATA_DIR, "suporte");
const MAX_ANEXO = 5 * 1024 * 1024;
const MAX_ANEXOS_MENSAGEM = 5;
// Cliente pode anexar arquivos à própria mensagem por este tempo depois de enviá-la
const JANELA_ANEXO_MIN = 30;
// Chamados aguardando o cliente (ou resolvidos) sem novidade são fechados depois disso
const DIAS_FECHAR_INATIVO = 7;

const CATEGORIAS = {
  duvida: "Dúvida",
  erro: "Erro ou problema",
  sugestao: "Sugestão",
  financeiro: "Pagamento e licença",
  outro: "Outro",
};
const STATUS = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};
const PRIORIDADES = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };
const ORIGENS = { site: "Site", portal: "Área do cliente", app: "Aplicativo" };

const agoraIso = () => new Date().toISOString();
const normEmail = (e) => String(e || "").trim().toLowerCase();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const limpar = (v, max) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

function auditar(ator, acao, alvo, dados) {
  abrir()
    .prepare("INSERT INTO auditoria (ator, acao, alvo, dados, criado_em) VALUES (?, ?, ?, ?, ?)")
    .run(ator, acao, alvo == null ? null : String(alvo), dados ? JSON.stringify(dados) : null, agoraIso());
}

// --- Acesso por link ---
const tokenDoChamado = (id) => segredos.assinar(`chamado:${id}`);
const linkDoChamado = (id) => `${cfg.PUBLIC_URL}/suporte/chamado/${id}?t=${tokenDoChamado(id)}`;
const linkPainel = (id) => `${cfg.PUBLIC_URL}/admin/suporte/${id}`;

function tokenConfere(id, token) {
  const esperado = Buffer.from(tokenDoChamado(id));
  const enviado = Buffer.from(String(token || ""));
  return enviado.length === esperado.length && crypto.timingSafeEqual(enviado, esperado);
}

function obterChamado(id) {
  const c = /^\d+$/.test(String(id)) ? abrir().prepare("SELECT * FROM chamados WHERE id = ?").get(Number(id)) : null;
  if (!c) throw new LicencaErro("NAO_ENCONTRADO", "Chamado não encontrado.", 404);
  return c;
}

// Chamado pertence ao cliente logado na área do cliente?
const doCliente = (c, cliente) => !!cliente && (c.cliente_id === cliente.id || c.email === normEmail(cliente.email));

// --- Avisos por e-mail (falhas não interrompem o fluxo) ---
function avisar(modelo, para, vars) {
  email.enviar(modelo, para, vars).catch((e) => console.error(`[suporte] e-mail ${modelo}:`, e.message));
}

const resumo = (texto, max = 1500) => (texto.length > max ? `${texto.slice(0, max)}…` : texto);

function avisarEquipe(c, evento, texto) {
  const destino = email.suporte();
  if (!destino) return;
  avisar("chamado_equipe", destino, {
    nome: c.nome || c.email, email: c.email, numero: c.id, assunto: c.assunto, evento,
    categoria: CATEGORIAS[c.categoria] || c.categoria, mensagem: resumo(texto, 800), link_painel: linkPainel(c.id),
  });
}

// --- Abertura ---
function abrirChamado({ nome, email: emailInformado, categoria, assunto, mensagem, origem = "site", licencaId = null, dadosTecnicos = null }) {
  const e = normEmail(emailInformado);
  const n = limpar(nome, 120);
  const a = limpar(assunto, 150);
  const m = limpar(mensagem, 5000);
  if (!emailValido(e)) throw new LicencaErro("EMAIL_INVALIDO", "Informe um e-mail válido para receber as respostas.");
  if (!CATEGORIAS[categoria]) throw new LicencaErro("CATEGORIA", "Escolha o tipo do chamado.");
  if (a.length < 5) throw new LicencaErro("ASSUNTO", "Descreva o assunto em poucas palavras (mínimo 5 letras).");
  if (m.length < 10) throw new LicencaErro("MENSAGEM", "Conte com mais detalhes o que aconteceu (mínimo 10 letras).");
  if (!ORIGENS[origem]) throw new LicencaErro("ORIGEM", "Origem inválida.");

  let tecnicos = null;
  if (dadosTecnicos && typeof dadosTecnicos === "object") {
    tecnicos = JSON.stringify(dadosTecnicos);
    if (tecnicos.length > 20000) tecnicos = JSON.stringify({ aviso: "Dados técnicos grandes demais; foram descartados." });
  }

  const db = abrir();
  const agora = agoraIso();
  const { chamado, mensagemId } = transacao(() => {
    const cliente = db.prepare("SELECT id, nome FROM clientes WHERE email = ?").get(e);
    const lic = licencaId ? db.prepare("SELECT id FROM licencas WHERE id = ?").get(String(licencaId)) : null;
    const { lastInsertRowid } = db.prepare(
      `INSERT INTO chamados (cliente_id, licenca_id, email, nome, categoria, assunto, status, prioridade, origem, dados_tecnicos, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, 'aberto', 'normal', ?, ?, ?, ?)`
    ).run(cliente?.id ?? null, lic?.id ?? null, e, n || cliente?.nome || null, categoria, a, origem, tecnicos, agora, agora);
    const id = Number(lastInsertRowid);
    const msg = db.prepare(
      "INSERT INTO chamado_mensagens (chamado_id, autor, autor_nome, texto, criado_em) VALUES (?, 'cliente', ?, ?, ?)"
    ).run(id, n || e, m, agora);
    return { chamado: db.prepare("SELECT * FROM chamados WHERE id = ?").get(id), mensagemId: Number(msg.lastInsertRowid) };
  });

  auditar(`cliente:${e}`, "chamado_abrir", chamado.id, { origem, categoria });
  avisar("chamado_aberto", e, { nome: chamado.nome || "", numero: chamado.id, assunto: a, link: linkDoChamado(chamado.id) });
  avisarEquipe(chamado, "Novo chamado", m);
  return { id: chamado.id, numero: chamado.id, mensagemId, token: tokenDoChamado(chamado.id), link: linkDoChamado(chamado.id) };
}

// --- Mensagens ---
function responderCliente(id, texto) {
  const c = obterChamado(id);
  const t = limpar(texto, 5000);
  if (t.length < 2) throw new LicencaErro("MENSAGEM", "Escreva sua mensagem.");
  if (c.status === "fechado") throw new LicencaErro("CHAMADO_FECHADO", "Este chamado foi encerrado. Abra um novo chamado se precisar de ajuda.", 409);
  const db = abrir();
  const agora = agoraIso();
  const mensagemId = transacao(() => {
    const r = db.prepare("INSERT INTO chamado_mensagens (chamado_id, autor, autor_nome, texto, criado_em) VALUES (?, 'cliente', ?, ?, ?)")
      .run(c.id, c.nome || c.email, t, agora);
    // Resposta do cliente reabre o atendimento
    const status = ["aguardando_cliente", "resolvido"].includes(c.status) ? "aberto" : c.status;
    db.prepare("UPDATE chamados SET status = ?, atualizado_em = ? WHERE id = ?").run(status, agora, c.id);
    return Number(r.lastInsertRowid);
  });
  avisarEquipe(c, "Nova mensagem do cliente", t);
  return { success: true, mensagemId };
}

function responderEquipe(id, { texto, interna = false, status }, usuario) {
  const c = obterChamado(id);
  const t = limpar(texto, 10000);
  if (t.length < 2) throw new LicencaErro("MENSAGEM", "Escreva a resposta.");
  const novoStatus = interna ? c.status : status || "aguardando_cliente";
  if (!STATUS[novoStatus]) throw new LicencaErro("STATUS", "Situação inválida.");
  const db = abrir();
  const agora = agoraIso();
  const mensagemId = transacao(() => {
    const r = db.prepare(
      "INSERT INTO chamado_mensagens (chamado_id, autor, autor_nome, usuario_id, texto, interna, criado_em) VALUES (?, 'equipe', ?, ?, ?, ?, ?)"
    ).run(c.id, usuario.nome, usuario.id, t, interna ? 1 : 0, agora);
    db.prepare(
      "UPDATE chamados SET status = ?, atualizado_em = ?, fechado_em = ?, atribuido_a = COALESCE(atribuido_a, ?) WHERE id = ?"
    ).run(novoStatus, agora, novoStatus === "fechado" ? agora : null, usuario.id, c.id);
    return Number(r.lastInsertRowid);
  });
  auditar(usuario.email, interna ? "chamado_nota" : "chamado_responder", c.id, interna ? null : { status: novoStatus });
  if (!interna) {
    avisar("chamado_respondido", c.email, { nome: c.nome || "", numero: c.id, assunto: c.assunto, resposta: resumo(t), link: linkDoChamado(c.id) });
  }
  return { success: true, mensagemId };
}

// Situação, prioridade e responsável (registra nota interna do sistema)
function atualizarChamado(id, { status, prioridade, atribuidoA }, usuario) {
  const c = obterChamado(id);
  const db = abrir();
  const mudancas = [];
  const novo = { status: c.status, prioridade: c.prioridade, atribuido_a: c.atribuido_a };
  if (status !== undefined && status !== c.status) {
    if (!STATUS[status]) throw new LicencaErro("STATUS", "Situação inválida.");
    novo.status = status;
    mudancas.push(`situação: ${STATUS[c.status]} → ${STATUS[status]}`);
  }
  if (prioridade !== undefined && prioridade !== c.prioridade) {
    if (!PRIORIDADES[prioridade]) throw new LicencaErro("PRIORIDADE", "Prioridade inválida.");
    novo.prioridade = prioridade;
    mudancas.push(`prioridade: ${PRIORIDADES[c.prioridade]} → ${PRIORIDADES[prioridade]}`);
  }
  if (atribuidoA !== undefined && (atribuidoA || null) !== c.atribuido_a) {
    const alvo = atribuidoA ? db.prepare("SELECT id, nome FROM admin_usuarios WHERE id = ? AND ativo = 1").get(Number(atribuidoA)) : null;
    if (atribuidoA && !alvo) throw new LicencaErro("USUARIO", "Pessoa da equipe não encontrada.");
    novo.atribuido_a = alvo?.id ?? null;
    mudancas.push(alvo ? `responsável: ${alvo.nome}` : "sem responsável");
  }
  if (!mudancas.length) return { success: true };
  const agora = agoraIso();
  transacao(() => {
    db.prepare("UPDATE chamados SET status = ?, prioridade = ?, atribuido_a = ?, atualizado_em = ?, fechado_em = ? WHERE id = ?")
      .run(novo.status, novo.prioridade, novo.atribuido_a, agora, novo.status === "fechado" ? c.fechado_em || agora : null, c.id);
    db.prepare("INSERT INTO chamado_mensagens (chamado_id, autor, autor_nome, usuario_id, texto, interna, criado_em) VALUES (?, 'sistema', ?, ?, ?, 1, ?)")
      .run(c.id, usuario.nome, usuario.id, `${usuario.nome} alterou ${mudancas.join("; ")}.`, agora);
  });
  auditar(usuario.email, "chamado_atualizar", c.id, { status: novo.status, prioridade: novo.prioridade, atribuido_a: novo.atribuido_a });
  return { success: true };
}

// --- Anexos ---
function tipoDoAnexo(buffer, nome) {
  const imagem = uploads.detectarTipo(buffer);
  if (imagem) return imagem;
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  // Texto (logs): extensão .txt/.log, sem bytes nulos e UTF-8 válido
  if (/\.(txt|log)$/i.test(nome) && !buffer.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      return { mime: "text/plain", ext: "txt" };
    } catch {
      return null;
    }
  }
  return null;
}

function anexar(chamadoId, mensagemId, buffer, nomeOriginal, { autor }) {
  const c = obterChamado(chamadoId);
  const db = abrir();
  const msg = db.prepare("SELECT * FROM chamado_mensagens WHERE id = ? AND chamado_id = ?").get(Number(mensagemId), c.id);
  if (!msg || msg.autor !== autor) throw new LicencaErro("NAO_ENCONTRADO", "Mensagem não encontrada.", 404);
  if (autor === "cliente" && Date.now() - new Date(msg.criado_em).getTime() > JANELA_ANEXO_MIN * 60000) {
    throw new LicencaErro("ANEXO_EXPIRADO", "Envie os arquivos junto com uma nova mensagem.", 409);
  }
  if (!buffer?.length) throw new LicencaErro("ARQUIVO_VAZIO", "Selecione um arquivo.");
  if (buffer.length > MAX_ANEXO) throw new LicencaErro("ARQUIVO_GRANDE", "Cada arquivo deve ter no máximo 5 MB.", 413);
  const nome = limpar(path.basename(String(nomeOriginal || "arquivo")), 120) || "arquivo";
  const tipo = tipoDoAnexo(buffer, nome);
  if (!tipo) throw new LicencaErro("TIPO_INVALIDO", "Formato não aceito. Envie imagens (PNG, JPG, WebP, GIF), PDF ou texto (.txt, .log).");
  const qtd = db.prepare("SELECT COUNT(*) n FROM chamado_anexos WHERE mensagem_id = ?").get(msg.id).n;
  if (qtd >= MAX_ANEXOS_MENSAGEM) throw new LicencaErro("ANEXOS_LIMITE", `No máximo ${MAX_ANEXOS_MENSAGEM} arquivos por mensagem.`);

  const id = `${crypto.randomUUID()}.${tipo.ext}`;
  const pasta = path.join(DIR, String(c.id));
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, id), buffer);
  db.prepare("INSERT INTO chamado_anexos (id, chamado_id, mensagem_id, nome_original, mime, tamanho, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, c.id, msg.id, nome, tipo.mime, buffer.length, agoraIso());
  return { success: true, anexo: { id, nome, mime: tipo.mime, tamanho: buffer.length } };
}

// Arquivo de um anexo, conferindo o chamado e se a mensagem é visível para quem pede
function arquivoDoAnexo(chamadoId, anexoId, { publico }) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif|pdf|txt)$/.test(String(anexoId))) return null;
  const a = abrir().prepare(
    `SELECT a.*, m.interna FROM chamado_anexos a JOIN chamado_mensagens m ON m.id = a.mensagem_id
      WHERE a.id = ? AND a.chamado_id = ?`
  ).get(anexoId, Number(chamadoId));
  if (!a || (publico && a.interna)) return null;
  const arquivo = path.join(DIR, String(a.chamado_id), a.id);
  return fs.existsSync(arquivo) ? { arquivo, mime: a.mime, nome: a.nome_original } : null;
}

// --- Consultas ---
function detalhe(id, { publico }) {
  const c = obterChamado(id);
  const db = abrir();
  const mensagens = db.prepare(
    `SELECT id, autor, autor_nome, usuario_id, texto, interna, criado_em FROM chamado_mensagens
      WHERE chamado_id = ? ${publico ? "AND interna = 0" : ""} ORDER BY id`
  ).all(c.id);
  const anexos = db.prepare("SELECT id, mensagem_id, nome_original, mime, tamanho FROM chamado_anexos WHERE chamado_id = ? ORDER BY criado_em").all(c.id);
  const porMensagem = new Map();
  for (const a of anexos) {
    if (!porMensagem.has(a.mensagem_id)) porMensagem.set(a.mensagem_id, []);
    porMensagem.get(a.mensagem_id).push({ id: a.id, nome: a.nome_original, mime: a.mime, tamanho: a.tamanho });
  }
  const itens = mensagens.map((m) => ({
    id: m.id, autor: m.autor, texto: m.texto, criadoEm: m.criado_em, interna: !!m.interna,
    // Para o cliente, a equipe aparece só pelo primeiro nome
    autorNome: publico && m.autor === "equipe" ? `${String(m.autor_nome || "Equipe").split(" ")[0]} · Suporte` : m.autor_nome,
    anexos: porMensagem.get(m.id) || [],
  }));
  const base = {
    id: c.id, numero: c.id, assunto: c.assunto, categoria: c.categoria, status: c.status, email: c.email, nome: c.nome,
    criadoEm: c.criado_em, atualizadoEm: c.atualizado_em, fechadoEm: c.fechado_em, mensagens: itens,
  };
  if (publico) return base;
  let dadosTecnicos = null;
  try { dadosTecnicos = c.dados_tecnicos ? JSON.parse(c.dados_tecnicos) : null; } catch { /* ignora */ }
  return { ...base, prioridade: c.prioridade, origem: c.origem, atribuidoA: c.atribuido_a, clienteId: c.cliente_id, licencaId: c.licenca_id, dadosTecnicos };
}

function listar({ status, categoria, atribuido, busca, limite = 50, offset = 0, usuarioId } = {}) {
  const filtros = [];
  const args = [];
  if (status === "ativos") filtros.push("c.status IN ('aberto', 'em_andamento', 'aguardando_cliente')");
  else if (status) { filtros.push("c.status = ?"); args.push(String(status)); }
  if (categoria) { filtros.push("c.categoria = ?"); args.push(String(categoria)); }
  if (atribuido === "eu") { filtros.push("c.atribuido_a = ?"); args.push(usuarioId); }
  else if (atribuido === "ninguem") filtros.push("c.atribuido_a IS NULL");
  if (busca) {
    const b = String(busca).trim().replace(/^#/, "");
    if (/^\d+$/.test(b)) { filtros.push("c.id = ?"); args.push(Number(b)); }
    else {
      filtros.push("(lower(c.email) LIKE ? OR lower(c.nome) LIKE ? OR lower(c.assunto) LIKE ?)");
      const l = `%${b.toLowerCase()}%`;
      args.push(l, l, l);
    }
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const db = abrir();
  const total = db.prepare(`SELECT COUNT(*) n FROM chamados c ${where}`).get(...args).n;
  const itens = db.prepare(
    `SELECT c.id, c.assunto, c.categoria, c.status, c.prioridade, c.origem, c.email, c.nome, c.criado_em, c.atualizado_em,
            u.nome atribuido_nome,
            (SELECT autor FROM chamado_mensagens m WHERE m.chamado_id = c.id AND m.interna = 0 ORDER BY m.id DESC LIMIT 1) ultimo_autor,
            (SELECT COUNT(*) FROM chamado_mensagens m WHERE m.chamado_id = c.id AND m.interna = 0) mensagens
       FROM chamados c LEFT JOIN admin_usuarios u ON u.id = c.atribuido_a
       ${where}
      ORDER BY CASE c.prioridade WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END,
               CASE WHEN c.status IN ('aberto', 'em_andamento') THEN 0 ELSE 1 END, c.atualizado_em DESC
      LIMIT ? OFFSET ?`
  ).all(...args, limite, offset);
  return { total, itens };
}

function contagens() {
  const db = abrir();
  const porStatus = Object.fromEntries(Object.keys(STATUS).map((s) => [s, 0]));
  for (const r of db.prepare("SELECT status, COUNT(*) n FROM chamados GROUP BY status").all()) porStatus[r.status] = r.n;
  // Aguardando a equipe: abertos/em andamento cuja última mensagem visível é do cliente
  const semResposta = db.prepare(
    `SELECT COUNT(*) n FROM chamados c WHERE c.status IN ('aberto', 'em_andamento')
       AND (SELECT autor FROM chamado_mensagens m WHERE m.chamado_id = c.id AND m.interna = 0 ORDER BY m.id DESC LIMIT 1) = 'cliente'`
  ).get().n;
  return { porStatus, semResposta };
}

// Chamados de um cliente (área do cliente e app)
function doEmail(emailCliente, clienteId = null, licencaId = null) {
  return abrir().prepare(
    `SELECT id, assunto, categoria, status, criado_em, atualizado_em FROM chamados
      WHERE email = ? OR (? IS NOT NULL AND cliente_id = ?) OR (? IS NOT NULL AND licenca_id = ?)
      ORDER BY atualizado_em DESC LIMIT 50`
  ).all(normEmail(emailCliente), clienteId, clienteId, licencaId, licencaId)
    .map((c) => ({ ...c, numero: c.id, link: linkDoChamado(c.id) }));
}

// Tarefa periódica: fecha chamados parados esperando o cliente ou já resolvidos
function fecharInativos(dias = DIAS_FECHAR_INATIVO) {
  const db = abrir();
  const limite = new Date(Date.now() - dias * 86400000).toISOString();
  const alvos = db.prepare("SELECT id FROM chamados WHERE status IN ('aguardando_cliente', 'resolvido') AND atualizado_em < ?").all(limite);
  const agora = agoraIso();
  for (const { id } of alvos) {
    transacao(() => {
      db.prepare("UPDATE chamados SET status = 'fechado', fechado_em = ?, atualizado_em = ? WHERE id = ?").run(agora, agora, id);
      db.prepare("INSERT INTO chamado_mensagens (chamado_id, autor, autor_nome, texto, interna, criado_em) VALUES (?, 'sistema', 'Sistema', ?, 0, ?)")
        .run(id, `Chamado encerrado automaticamente após ${dias} dias sem novas mensagens. Se precisar, abra um novo chamado.`, agora);
    });
  }
  return alvos.length;
}

module.exports = {
  CATEGORIAS, STATUS, PRIORIDADES, ORIGENS, MAX_ANEXO, MAX_ANEXOS_MENSAGEM, DIR,
  tokenDoChamado, tokenConfere, linkDoChamado, obterChamado, doCliente,
  abrirChamado, responderCliente, responderEquipe, atualizarChamado,
  anexar, arquivoDoAnexo, detalhe, listar, contagens, doEmail, fecharInativos,
};
