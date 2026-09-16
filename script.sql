-- =================================================================
-- GSTI - Gestor de Serviços de TI
-- Script de Criação do Schema v1.2 — PostgreSQL
-- =================================================================

-- Tipos ENUM (devem ser criados antes das tabelas que os referenciam)
CREATE TYPE tipo_pessoa_enum   AS ENUM ('Física', 'Jurídica');
CREATE TYPE os_status_enum     AS ENUM ('Orçamento', 'Aguardando Autorização', 'Em Aberto', 'Aguardando Peça', 'Em Andamento', 'Finalizado', 'Entregue', 'Cancelado');
CREATE TYPE tipo_despesa_enum  AS ENUM ('Fixa', 'Variável');
CREATE TYPE user_role_enum     AS ENUM ('Admin', 'Funcionario');

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id                 SERIAL PRIMARY KEY,
    nome               VARCHAR(255) NOT NULL,
    email              VARCHAR(255) NOT NULL UNIQUE,
    login              VARCHAR(100) NOT NULL UNIQUE,
    senha              VARCHAR(255) NOT NULL,
    role               user_role_enum NOT NULL DEFAULT 'Funcionario',
    reset_token        VARCHAR(255) NULL DEFAULT NULL,
    reset_token_expiry TIMESTAMP NULL DEFAULT NULL
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id         SERIAL PRIMARY KEY,
    nome       VARCHAR(255) NOT NULL,
    tipo_pessoa tipo_pessoa_enum NOT NULL,
    cpf_cnpj   VARCHAR(20) NOT NULL UNIQUE,
    telefone   VARCHAR(50),
    email      VARCHAR(255),
    endereco   TEXT
);

-- Tabela de Equipamentos (reservada para uso futuro)
CREATE TABLE IF NOT EXISTS equipamentos (
    id           SERIAL PRIMARY KEY,
    cliente_id   INT NOT NULL,
    tipo         VARCHAR(100) NOT NULL,
    marca        VARCHAR(100),
    modelo       VARCHAR(255),
    numero_serie VARCHAR(255) UNIQUE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- Tabela de Produtos e Serviços
CREATE TABLE IF NOT EXISTS produtos_servicos (
    id       SERIAL PRIMARY KEY,
    descricao       TEXT NOT NULL,
    valor           DECIMAL(10, 2) NOT NULL,
    tipo            VARCHAR(50) NOT NULL,
    estoque_atual   INT NOT NULL DEFAULT 0,
    estoque_minimo  INT NOT NULL DEFAULT 0,
    custo           DECIMAL(10, 2)
);

-- Tabela Principal das Ordens de Serviço
CREATE TABLE IF NOT EXISTS ordens_servico (
    id                  SERIAL PRIMARY KEY,
    id_cliente          INT NOT NULL,
    tipo_equipamento    VARCHAR(100) DEFAULT 'Outro',
    marca               VARCHAR(100),
    modelo              VARCHAR(100),
    numero_serie        VARCHAR(100),
    defeito_relatado    TEXT,
    observacoes_entrada TEXT,
    laudo_tecnico       TEXT,
    solucao_aplicada    TEXT,
    status              os_status_enum NOT NULL DEFAULT 'Orçamento',
    data_entrada        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_saida          TIMESTAMP,
    data_prevista       TIMESTAMP,
    valor_total         DECIMAL(10, 2) DEFAULT 0.00,
    garantia_dias       INT DEFAULT 90,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id) ON DELETE RESTRICT
);

-- Tabela de Itens de OS
CREATE TABLE IF NOT EXISTS os_itens (
    id                  SERIAL PRIMARY KEY,
    id_os               INT NOT NULL,
    id_produto_servico  INT NOT NULL,
    quantidade          INT NOT NULL DEFAULT 1,
    valor_unitario      DECIMAL(10, 2) NOT NULL,
    observacao          TEXT,
    custo_unitario      DECIMAL(10, 2),
    FOREIGN KEY (id_os) REFERENCES ordens_servico(id) ON DELETE CASCADE,
    FOREIGN KEY (id_produto_servico) REFERENCES produtos_servicos(id) ON DELETE RESTRICT
);

-- Tabela de Despesas
CREATE TABLE IF NOT EXISTS despesas (
    id            SERIAL PRIMARY KEY,
    descricao     VARCHAR(255) NOT NULL,
    data          DATE NOT NULL,
    categoria     VARCHAR(100),
    tipo_despesa  tipo_despesa_enum NOT NULL DEFAULT 'Variável',
    km_rodados    DECIMAL(10, 2) NULL,
    preco_litro   DECIMAL(10, 2) NULL,
    consumo_medio DECIMAL(5, 2) NULL,
    valor         DECIMAL(10, 2) NOT NULL
);

-- Tabela de Receitas Avulsas
CREATE TABLE IF NOT EXISTS receitas_avulsas (
    id        SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    valor     DECIMAL(10, 2) NOT NULL,
    data      DATE NOT NULL
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_os_status       ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_usuario_email   ON usuarios(email);
