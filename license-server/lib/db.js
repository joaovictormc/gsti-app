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

function transacao(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

module.exports = { abrir, transacao };
