-- =================================================================
-- GSTI - Gestor de Serviços de TI
-- Script de Criação do Schema v1.2 (Reflete Módulos de OS e Despesas)
-- Data: 20 de Outubro de 2025
-- =================================================================

-- Cria o banco de dados se ele não existir.
CREATE DATABASE IF NOT EXISTS gsti_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gsti_db;

-- Tabela de Usuários (Mantida do script original, para futuro uso)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    login VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL -- Armazenará um hash da senha
);

-- Tabela de Clientes (Mantida do script original)
CREATE TABLE IF NOT EXISTS clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    tipo_pessoa ENUM('Física', 'Jurídica') NOT NULL,
    cpf_cnpj VARCHAR(20) NOT NULL UNIQUE,
    telefone VARCHAR(50),
    email VARCHAR(255),
    endereco TEXT
);

-- Tabela de Equipamentos (Mantida do script original, pode ser usada futuramente para histórico)
CREATE TABLE IF NOT EXISTS equipamentos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    tipo VARCHAR(100) NOT NULL, -- Ex: 'Notebook', 'Desktop'
    marca VARCHAR(100),
    modelo VARCHAR(255),
    numero_serie VARCHAR(255) UNIQUE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- Tabela de Produtos e Serviços (Mantida do script original)
CREATE TABLE IF NOT EXISTS produtos_servicos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    descricao TEXT NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    tipo VARCHAR(50) NOT NULL -- 'Produto' ou 'Serviço'
);

-- Tabela Principal das Ordens de Serviço (ATUALIZADA)
CREATE TABLE IF NOT EXISTS ordens_servico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    -- Campos estruturados do equipamento
    tipo_equipamento VARCHAR(100) DEFAULT 'Outro',
    marca VARCHAR(100),
    modelo VARCHAR(100),
    numero_serie VARCHAR(100),
    -- Detalhes da OS
    defeito_relatado TEXT,
    observacoes_entrada TEXT,
    laudo_tecnico TEXT,       -- Adicionado
    solucao_aplicada TEXT,    -- Adicionado
    status ENUM('Orçamento', 'Em Aberto', 'Aguardando Peça', 'Em Andamento', 'Finalizado', 'Entregue', 'Cancelado') NOT NULL DEFAULT 'Orçamento', -- Status Atualizado
    data_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_saida DATETIME,
    valor_total DECIMAL(10, 2) DEFAULT 0.00,
    garantia_dias INT DEFAULT 90, -- Adicionado
    FOREIGN KEY (id_cliente) REFERENCES clientes(id) ON DELETE RESTRICT -- Impede deletar cliente com OS
);

-- Tabela para Ligar Produtos/Serviços a uma OS (Mantida do script original)
CREATE TABLE IF NOT EXISTS os_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_os INT NOT NULL,
    id_produto_servico INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    valor_unitario DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (id_os) REFERENCES ordens_servico(id) ON DELETE CASCADE, -- Itens somem se a OS for deletada
    FOREIGN KEY (id_produto_servico) REFERENCES produtos_servicos(id) ON DELETE RESTRICT -- Impede deletar produto/serviço usado em OS
);

-- Tabela para o Módulo Financeiro (Despesas - NOVA ESTRUTURA)
CREATE TABLE IF NOT EXISTS despesas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    data DATE NOT NULL,
    categoria VARCHAR(100), -- Ex: Peças, Ferramentas, Combustível, Outros

    -- Campos para cálculo de combustível
    km_rodados DECIMAL(10, 2) NULL,
    preco_litro DECIMAL(10, 2) NULL,
    consumo_medio DECIMAL(5, 2) NULL,

    -- Valor final da despesa
    valor DECIMAL(10, 2) NOT NULL
);

-- Adiciona um índice na coluna de status para buscas mais rápidas (Opcional, mas recomendado)
CREATE INDEX idx_os_status ON ordens_servico(status);

CREATE TABLE receitas_avulsas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    data DATE NOT NULL
);

ALTER TABLE despesas
ADD COLUMN tipo_despesa ENUM('Fixa', 'Variável') NOT NULL DEFAULT 'Variável' AFTER categoria;


ALTER TABLE usuarios
ADD COLUMN role ENUM('Admin', 'Funcionario') NOT NULL DEFAULT 'Funcionario' AFTER senha;

-- 1. Adiciona a coluna de E-mail (obrigatória e única)
ALTER TABLE usuarios
ADD COLUMN email VARCHAR(255) UNIQUE NOT NULL AFTER nome;

-- 2. Adiciona a coluna para o token/código de redefinição (pode ser nulo)
ALTER TABLE usuarios
ADD COLUMN reset_token VARCHAR(255) NULL DEFAULT NULL AFTER role;

-- 3. Adiciona a coluna para a data de expiração do token (pode ser nulo)
ALTER TABLE usuarios
ADD COLUMN reset_token_expiry DATETIME NULL DEFAULT NULL AFTER reset_token;

-- Opcional, mas recomendado: Adiciona um índice na coluna de e-mail para buscas rápidas
CREATE INDEX idx_usuario_email ON usuarios(email);