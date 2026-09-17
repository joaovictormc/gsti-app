/**
 * Banco SQLite (módulo nativo node:sqlite — sem dependências de compilação).
 * Migrações versionadas via PRAGMA user_version.
 */
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { DATA_DIR, DB_PATH } = require("./config");

const MIGRACOES = [
  // 1 — base do licenciamento v2
  `
  CREATE TABLE clientes (
    id         INTEGER PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    nome       TEXT,
    documento  TEXT,
    criado_em  TEXT NOT NULL
  );

  CREATE TABLE licencas (
    id            TEXT PRIMARY KEY,
    cliente_id    INTEGER NOT NULL REFERENCES clientes(id),
    chave_hash    TEXT NOT NULL UNIQUE,
    chave_final   TEXT NOT NULL,
    plano         TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('ativa', 'suspensa', 'revogada')),
    motivo_status TEXT,
    max_maquinas  INTEGER NOT NULL DEFAULT 1,
    valida_ate    TEXT,
    observacao    TEXT,
    criado_em     TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX ix_licencas_cliente ON licencas(cliente_id);

  CREATE TABLE ativacoes (
    id             INTEGER PRIMARY KEY,
    licenca_id     TEXT NOT NULL REFERENCES licencas(id),
    maquina_id     TEXT NOT NULL,
    nome_maquina   TEXT,
    app_versao     TEXT,
    ativado_em     TEXT NOT NULL,
    ultimo_contato TEXT NOT NULL,
    desativado_em  TEXT
  );
  CREATE UNIQUE INDEX ux_ativacoes_ativa
    ON ativacoes(licenca_id, maquina_id) WHERE desativado_em IS NULL;

  CREATE TABLE trials (
    id         INTEGER PRIMARY KEY,
    email      TEXT NOT NULL,
    maquina_id TEXT NOT NULL,
    emitido_em TEXT NOT NULL,
    expira_em  TEXT NOT NULL
  );
  CREATE INDEX ix_trials_email ON trials(email);
  CREATE INDEX ix_trials_maquina ON trials(maquina_id);

  CREATE TABLE auditoria (
    id        INTEGER PRIMARY KEY,
    ator      TEXT NOT NULL,
    acao      TEXT NOT NULL,
    alvo      TEXT,
    dados     TEXT,
    criado_em TEXT NOT NULL
  );
  `,

  // 2 — área admin, vendas (Mercado Pago), conteúdo do site e portal do cliente
  `
  ALTER TABLE clientes ADD COLUMN telefone TEXT;
  CREATE INDEX ix_auditoria_alvo ON auditoria(alvo);

  CREATE TABLE admin_usuarios (
    id             INTEGER PRIMARY KEY,
    nome           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    senha_hash     TEXT NOT NULL,
    papeis         TEXT NOT NULL DEFAULT '[]',
    ativo          INTEGER NOT NULL DEFAULT 1,
    totp_secret    TEXT,
    totp_ativo     INTEGER NOT NULL DEFAULT 0,
    falhas_login   INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate  TEXT,
    ultimo_login_em TEXT,
    criado_em      TEXT NOT NULL,
    atualizado_em  TEXT NOT NULL
  );

  -- Sessões de admin e de cliente (id = hash do token do cookie)
  CREATE TABLE sessoes (
    id          TEXT PRIMARY KEY,
    tipo        TEXT NOT NULL CHECK (tipo IN ('admin', 'admin_2fa', 'cliente')),
    usuario_id  INTEGER,
    cliente_id  INTEGER,
    csrf        TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT,
    criado_em   TEXT NOT NULL,
    expira_em   TEXT NOT NULL
  );
  CREATE INDEX ix_sessoes_expira ON sessoes(expira_em);

  CREATE TABLE links_magicos (
    token_hash  TEXT PRIMARY KEY,
    cliente_id  INTEGER NOT NULL REFERENCES clientes(id),
    criado_em   TEXT NOT NULL,
    expira_em   TEXT NOT NULL,
    usado_em    TEXT
  );

  -- Ofertas exibidas no site (preços em centavos)
  CREATE TABLE ofertas (
    id              TEXT PRIMARY KEY,
    plano           TEXT NOT NULL CHECK (plano IN ('anual', 'vitalicia')),
    modalidade      TEXT NOT NULL CHECK (modalidade IN ('avulso', 'assinatura')),
    nome            TEXT NOT NULL,
    descricao       TEXT,
    preco_centavos  INTEGER NOT NULL,
    parcelas_max    INTEGER NOT NULL DEFAULT 1,
    max_maquinas    INTEGER NOT NULL DEFAULT 1,
    destaque        INTEGER NOT NULL DEFAULT 0,
    ativo           INTEGER NOT NULL DEFAULT 1,
    ordem           INTEGER NOT NULL DEFAULT 0,
    atualizado_em   TEXT NOT NULL
  );

  CREATE TABLE pedidos (
    id                TEXT PRIMARY KEY,
    cliente_id        INTEGER NOT NULL REFERENCES clientes(id),
    oferta_id         TEXT NOT NULL,
    plano             TEXT NOT NULL,
    modalidade        TEXT NOT NULL,
    tipo              TEXT NOT NULL CHECK (tipo IN ('nova', 'renovacao')),
    valor_centavos    INTEGER NOT NULL,
    status            TEXT NOT NULL CHECK (status IN ('pendente', 'pago', 'cancelado', 'reembolsado', 'contestado', 'expirado')),
    licenca_id        TEXT REFERENCES licencas(id),
    mp_preference_id  TEXT,
    mp_preapproval_id TEXT,
    checkout_url      TEXT,
    pago_em           TEXT,
    criado_em         TEXT NOT NULL,
    atualizado_em     TEXT NOT NULL
  );
  CREATE INDEX ix_pedidos_cliente ON pedidos(cliente_id);
  CREATE INDEX ix_pedidos_status ON pedidos(status);
  CREATE INDEX ix_pedidos_preapproval ON pedidos(mp_preapproval_id);

  CREATE TABLE pagamentos (
    id              INTEGER PRIMARY KEY,
    pedido_id       TEXT NOT NULL REFERENCES pedidos(id),
    mp_payment_id   TEXT NOT NULL UNIQUE,
    origem          TEXT NOT NULL CHECK (origem IN ('checkout', 'assinatura')),
    status          TEXT NOT NULL,
    status_detail   TEXT,
    valor_centavos  INTEGER,
    metodo          TEXT,
    parcelas        INTEGER,
    aplicado_em     TEXT,
    emitiu_licenca  INTEGER NOT NULL DEFAULT 0,
    estornado_em    TEXT,
    criado_em       TEXT NOT NULL,
    atualizado_em   TEXT NOT NULL
  );
  CREATE INDEX ix_pagamentos_pedido ON pagamentos(pedido_id);

  CREATE TABLE assinaturas (
    id               TEXT PRIMARY KEY,
    pedido_id        TEXT NOT NULL REFERENCES pedidos(id),
    cliente_id       INTEGER NOT NULL REFERENCES clientes(id),
    licenca_id       TEXT REFERENCES licencas(id),
    status           TEXT NOT NULL,
    valor_centavos   INTEGER NOT NULL,
    proxima_cobranca TEXT,
    criado_em        TEXT NOT NULL,
    atualizado_em    TEXT NOT NULL
  );
  CREATE INDEX ix_assinaturas_licenca ON assinaturas(licenca_id);

  CREATE TABLE eventos_webhook (
    id            INTEGER PRIMARY KEY,
    origem        TEXT NOT NULL,
    tipo          TEXT,
    acao          TEXT,
    recurso_id    TEXT,
    payload       TEXT,
    recebido_em   TEXT NOT NULL,
    processado_em TEXT,
    tentativas    INTEGER NOT NULL DEFAULT 0,
    erro          TEXT
  );
  CREATE INDEX ix_eventos_pendentes ON eventos_webhook(processado_em);

  CREATE TABLE conteudo (
    chave          TEXT PRIMARY KEY,
    valor          TEXT NOT NULL,
    atualizado_por TEXT,
    atualizado_em  TEXT NOT NULL
  );

  CREATE TABLE conteudo_historico (
    id        INTEGER PRIMARY KEY,
    chave     TEXT NOT NULL,
    valor     TEXT NOT NULL,
    autor     TEXT,
    criado_em TEXT NOT NULL
  );
  CREATE INDEX ix_conteudo_historico ON conteudo_historico(chave, id);

  CREATE TABLE uploads (
    id            TEXT PRIMARY KEY,
    nome_original TEXT,
    mime          TEXT NOT NULL,
    tamanho       INTEGER NOT NULL,
    enviado_por   TEXT,
    criado_em     TEXT NOT NULL
  );

  CREATE TABLE emails_log (
    id        INTEGER PRIMARY KEY,
    para      TEXT NOT NULL,
    assunto   TEXT NOT NULL,
    modelo    TEXT,
    status    TEXT NOT NULL,
    erro      TEXT,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE avisos_renovacao (
    licenca_id  TEXT NOT NULL,
    valida_ate  TEXT NOT NULL,
    marco       INTEGER NOT NULL,
    enviado_em  TEXT NOT NULL,
    PRIMARY KEY (licenca_id, valida_ate, marco)
  );
  `,

  // 3 — configurações sensíveis editáveis pelo painel (valores cifrados)
  `
  CREATE TABLE configuracoes (
    chave          TEXT PRIMARY KEY,
    valor          TEXT NOT NULL,
    atualizado_por TEXT,
    atualizado_em  TEXT NOT NULL
  );
  `,

  // 4 — venda por módulos: módulos por licença (NULL = todos) e por oferta; parâmetros gerais
  `
  ALTER TABLE licencas ADD COLUMN modulos TEXT;
  ALTER TABLE ofertas ADD COLUMN modulos TEXT NOT NULL DEFAULT '[]';
  CREATE TABLE parametros (
    chave          TEXT PRIMARY KEY,
    valor          TEXT NOT NULL,
    atualizado_por TEXT,
    atualizado_em  TEXT NOT NULL
  );
  `,

  // 5 — suporte (chamados, mensagens e anexos)
  `
  CREATE TABLE chamados (
    id             INTEGER PRIMARY KEY,
    cliente_id     INTEGER REFERENCES clientes(id),
    licenca_id     TEXT,
    email          TEXT NOT NULL,
    nome           TEXT,
    categoria      TEXT NOT NULL,
    assunto        TEXT NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado')),
    prioridade     TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    origem         TEXT NOT NULL,
    atribuido_a    INTEGER REFERENCES admin_usuarios(id),
    dados_tecnicos TEXT,
    criado_em      TEXT NOT NULL,
    atualizado_em  TEXT NOT NULL,
    fechado_em     TEXT
  );
  CREATE INDEX ix_chamados_status ON chamados(status, atualizado_em);
  CREATE INDEX ix_chamados_email ON chamados(email);
  CREATE INDEX ix_chamados_cliente ON chamados(cliente_id);

  CREATE TABLE chamado_mensagens (
    id          INTEGER PRIMARY KEY,
    chamado_id  INTEGER NOT NULL REFERENCES chamados(id),
    autor       TEXT NOT NULL CHECK (autor IN ('cliente', 'equipe', 'sistema')),
    autor_nome  TEXT,
    usuario_id  INTEGER,
    texto       TEXT NOT NULL,
    interna     INTEGER NOT NULL DEFAULT 0,
    criado_em   TEXT NOT NULL
  );
  CREATE INDEX ix_chamado_mensagens ON chamado_mensagens(chamado_id, id);

  CREATE TABLE chamado_anexos (
    id            TEXT PRIMARY KEY,
    chamado_id    INTEGER NOT NULL REFERENCES chamados(id),
    mensagem_id   INTEGER NOT NULL REFERENCES chamado_mensagens(id),
    nome_original TEXT NOT NULL,
    mime          TEXT NOT NULL,
    tamanho       INTEGER NOT NULL,
    criado_em     TEXT NOT NULL
  );
  CREATE INDEX ix_chamado_anexos ON chamado_anexos(chamado_id);
  `,
];

let db = null;

function abrir() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

  const versao = db.prepare("PRAGMA user_version").get().user_version;
  for (let i = versao; i < MIGRACOES.length; i++) {
    transacao(() => {
      db.exec(MIGRACOES[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
  return db;
}

// Transação síncrona; chamadas aninhadas usam SAVEPOINT.
let profundidade = 0;
function transacao(fn) {
  const nome = `sp${profundidade}`;
  db.exec(profundidade === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${nome}`);
  profundidade++;
  try {
    const r = fn();
    profundidade--;
    db.exec(profundidade === 0 ? "COMMIT" : `RELEASE ${nome}`);
    return r;
  } catch (e) {
    profundidade--;
    db.exec(profundidade === 0 ? "ROLLBACK" : `ROLLBACK TO ${nome}; RELEASE ${nome}`);
    throw e;
  }
}

module.exports = { abrir, transacao };
