/**
 * Emissores de nota fiscal: catálogo público (o mesmo do app, em /fiscal-emissores.js) e
 * pedidos de novos emissores feitos pelos clientes (área do cliente ou app), com ranking
 * e situação no painel.
 */
const path = require("path");
const email = require("./email");
const cfg = require("./config");
const { abrir, transacao } = require("./db");
const { LicencaErro } = require("./erros");

// Fonte única do catálogo: o arquivo do app na raiz do repositório
const { EMISSORES, TIPOS_NOTA } = require(path.join(__dirname, "..", "..", "fiscal-emissores.js"));

const STATUS = {
  novo: "Recebido",
  em_analise: "Em análise",
  planejado: "Planejado",
  disponivel: "Disponível",
  descartado: "Não previsto",
};
const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");

const agoraIso = () => new Date().toISOString();
const limpar = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// "Focus NFe", "focusnfe" e "Fócus-NF-e" viram a mesma chave
const chaveDoNome = (nome) =>
  String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Catálogo para o site (sem os campos internos de credenciais)
function catalogo() {
  return EMISSORES.map((e) => ({
    id: e.id, nome: e.nome, integrado: e.integrado, status: e.status, custo: e.custo, documentos: e.documentos,
    emite: e.emite || null, certificado: e.certificado, resumo: e.resumo,
    // Os passos são escritos para a tela do app ("abaixo"); no site apontam para onde fica no app
    guia: (e.guia || []).map((p) => p.replace(/abaixo/g, "no GSTI App (Configurações → Nota fiscal)")),
    ondeEmitirGratis: e.ondeEmitirGratis || [], site: e.site,
  }));
}

function jaNoCatalogo(chave) {
  return EMISSORES.find((e) => {
    const nomeBase = chaveDoNome(e.nome.split(/[—(]/)[0]);
    return chave === chaveDoNome(e.id) || (nomeBase.length >= 4 && chave === nomeBase);
  });
}

function registrarPedido({ clienteId = null, email: emailCliente, origem, nome, documentos, municipio, uf, site, observacao }) {
  const n = limpar(nome, 80);
  const chave = chaveDoNome(n);
  if (chave.length < 3) throw new LicencaErro("NOME", "Informe o nome do emissor (ex.: Focus NFe, eNotas, portal da prefeitura).");
  const existente = jaNoCatalogo(chave);
  if (existente) throw new LicencaErro("JA_EXISTE", `${existente.nome} já está no catálogo do GSTI App.`, 409);
  const docs = [...new Set((Array.isArray(documentos) ? documentos : []).filter((d) => TIPOS_NOTA.includes(d)))];
  if (!docs.length) throw new LicencaErro("DOCUMENTOS", "Marque quais notas você precisa emitir (NFS-e, NF-e ou NFC-e).");
  const u = limpar(uf, 2).toUpperCase();
  if (u && !UFS.includes(u)) throw new LicencaErro("UF", "UF inválida.");
  const s = limpar(site, 200);
  if (s && !/^https?:\/\/[^\s]+\.[^\s]+/.test(s)) throw new LicencaErro("SITE", "Informe o site completo (https://…) ou deixe em branco.");
  const e = String(emailCliente || "").trim().toLowerCase();
  if (!e) throw new LicencaErro("NAO_AUTENTICADO", "Identificação do cliente ausente.", 401);

  const db = abrir();
  const agora = agoraIso();
  transacao(() => {
    const anterior = db.prepare("SELECT id FROM emissores_pedidos WHERE email = ? AND chave = ?").get(e, chave);
    if (anterior) {
      // Mesmo cliente pedindo de novo: atualiza (sem apagar o que não foi informado) em vez de contar duas vezes
      db.prepare(
        "UPDATE emissores_pedidos SET nome = ?, documentos = ?, municipio = COALESCE(?, municipio), uf = COALESCE(?, uf), site = COALESCE(?, site), observacao = COALESCE(?, observacao), origem = ?, atualizado_em = ? WHERE id = ?"
      ).run(n, JSON.stringify(docs), limpar(municipio, 80) || null, u || null, s || null, limpar(observacao, 500) || null, origem, agora, anterior.id);
    } else {
      db.prepare(
        `INSERT INTO emissores_pedidos (cliente_id, email, origem, nome, chave, documentos, municipio, uf, site, observacao, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(clienteId, e, origem, n, chave, JSON.stringify(docs), limpar(municipio, 80) || null, u || null, s || null, limpar(observacao, 500) || null, agora, agora);
    }
    if (!db.prepare("SELECT 1 FROM emissores_avaliacao WHERE chave = ?").get(chave)) {
      db.prepare("INSERT INTO emissores_avaliacao (chave, nome, status, atualizado_em) VALUES (?, ?, 'novo', ?)").run(chave, n, agora);
    }
  });
  return { success: true, chave, status: situacao(chave).status };
}

function situacao(chave) {
  return abrir().prepare("SELECT * FROM emissores_avaliacao WHERE chave = ?").get(chave) || { chave, status: "novo" };
}

function pedidosDoCliente(emailCliente) {
  return abrir().prepare(
    `SELECT p.nome, p.chave, p.documentos, p.municipio, p.uf, p.criado_em, a.status, a.nota_publica
       FROM emissores_pedidos p LEFT JOIN emissores_avaliacao a ON a.chave = p.chave
      WHERE p.email = ? ORDER BY p.criado_em DESC`
  ).all(String(emailCliente || "").trim().toLowerCase())
    .map((p) => ({ ...p, documentos: JSON.parse(p.documentos), status: p.status || "novo", statusRotulo: STATUS[p.status || "novo"] }));
}

// Ranking para o painel: um item por emissor, com quantos clientes pediram
function ranking({ status } = {}) {
  const db = abrir();
  const linhas = db.prepare(
    `SELECT p.chave, COUNT(DISTINCT p.email) pedidos, MIN(p.criado_em) primeiro, MAX(p.atualizado_em) ultimo,
            SUM(CASE WHEN p.avisado_em IS NULL THEN 1 ELSE 0 END) sem_aviso,
            a.nome, a.status, a.nota, a.nota_publica, a.atualizado_por, a.atualizado_em
       FROM emissores_pedidos p JOIN emissores_avaliacao a ON a.chave = p.chave
      ${status ? "WHERE a.status = ?" : ""}
      GROUP BY p.chave ORDER BY pedidos DESC, ultimo DESC`
  ).all(...(status ? [status] : []));
  return linhas.map((l) => {
    const detalhes = db.prepare("SELECT nome, documentos, uf, municipio FROM emissores_pedidos WHERE chave = ?").all(l.chave);
    const documentos = [...new Set(detalhes.flatMap((d) => JSON.parse(d.documentos)))];
    const ufs = [...new Set(detalhes.map((d) => d.uf).filter(Boolean))].sort();
    return { ...l, documentos, ufs, statusRotulo: STATUS[l.status] };
  });
}

function detalheDoEmissor(chave) {
  const a = abrir().prepare("SELECT * FROM emissores_avaliacao WHERE chave = ?").get(String(chave));
  if (!a) throw new LicencaErro("NAO_ENCONTRADO", "Emissor não encontrado.", 404);
  const pedidos = abrir().prepare(
    `SELECT p.id, p.email, p.origem, p.nome, p.documentos, p.municipio, p.uf, p.site, p.observacao, p.criado_em, p.avisado_em,
            c.id cliente_id, c.nome cliente_nome
       FROM emissores_pedidos p LEFT JOIN clientes c ON c.email = p.email
      WHERE p.chave = ? ORDER BY p.criado_em`
  ).all(a.chave).map((p) => ({ ...p, documentos: JSON.parse(p.documentos) }));
  return { emissor: { ...a, statusRotulo: STATUS[a.status] }, pedidos };
}

function avaliar(chave, { nome, status, nota, notaPublica }, ator) {
  const atual = detalheDoEmissor(chave).emissor;
  if (status !== undefined && !STATUS[status]) throw new LicencaErro("STATUS", "Situação inválida.");
  const novo = {
    nome: nome !== undefined ? limpar(nome, 80) || atual.nome : atual.nome,
    status: status ?? atual.status,
    nota: nota !== undefined ? limpar(nota, 1000) || null : atual.nota,
    notaPublica: notaPublica !== undefined ? limpar(notaPublica, 300) || null : atual.nota_publica,
  };
  abrir().prepare("UPDATE emissores_avaliacao SET nome = ?, status = ?, nota = ?, nota_publica = ?, atualizado_por = ?, atualizado_em = ? WHERE chave = ?")
    .run(novo.nome, novo.status, novo.nota, novo.notaPublica, ator, agoraIso(), atual.chave);
  abrir().prepare("INSERT INTO auditoria (ator, acao, alvo, dados, criado_em) VALUES (?, 'emissor_avaliar', ?, ?, ?)")
    .run(ator, atual.chave, JSON.stringify({ status: novo.status }), agoraIso());
  return { success: true };
}

// Avisa por e-mail quem pediu e ainda não foi avisado (só com o emissor disponível)
async function avisarDisponivel(chave, ator) {
  const { emissor, pedidos } = detalheDoEmissor(chave);
  if (emissor.status !== "disponivel") throw new LicencaErro("STATUS", "Marque o emissor como Disponível antes de avisar os clientes.", 409);
  const pendentes = pedidos.filter((p) => !p.avisado_em);
  let enviados = 0;
  for (const p of pendentes) {
    const r = await email.enviar("emissor_disponivel", p.email, {
      nome: p.cliente_nome || "", emissor: emissor.nome, link: `${cfg.PUBLIC_URL}/emissores`,
    });
    if (r.success) {
      abrir().prepare("UPDATE emissores_pedidos SET avisado_em = ? WHERE id = ?").run(agoraIso(), p.id);
      enviados++;
    }
  }
  abrir().prepare("INSERT INTO auditoria (ator, acao, alvo, dados, criado_em) VALUES (?, 'emissor_avisar', ?, ?, ?)")
    .run(ator, emissor.chave, JSON.stringify({ enviados }), agoraIso());
  return { success: true, enviados, falhas: pendentes.length - enviados };
}

// Emissores em estudo exibidos no site (transparência para quem pediu)
const planejados = () =>
  abrir().prepare("SELECT nome, status, nota_publica FROM emissores_avaliacao WHERE status IN ('planejado', 'em_analise') ORDER BY status DESC, nome").all()
    .map((p) => ({ ...p, statusRotulo: STATUS[p.status] }));

module.exports = {
  STATUS, UFS, TIPOS_NOTA, chaveDoNome, catalogo, registrarPedido, pedidosDoCliente, ranking, detalheDoEmissor, avaliar, avisarDisponivel, planejados,
};
