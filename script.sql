-- =================================================================
-- GSTI - Gestor de Serviços de TI
-- MIGRATION VERSION 1: Create Initial Schema
-- Data: 10 de Agosto de 2025
-- Este script cria todas as tabelas iniciais para a v1.1 do app.
-- =================================================================

-- Cria o banco de dados se ele não existir.
CREATE DATABASE IF NOT EXISTS gsti_db;
USE gsti_db;

-- Tabela de Usuários para controle de acesso
CREATE TABLE IF NOT EXISTS usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    login VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL -- Armazenará um hash da senha
);

-- Tabela de Clientes com os novos campos
CREATE TABLE IF NOT EXISTS clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    tipo_pessoa ENUM('Física', 'Jurídica') NOT NULL,
    cpf_cnpj VARCHAR(20) NOT NULL UNIQUE,
    telefone VARCHAR(50),
    email VARCHAR(255),
    endereco TEXT
);

-- Tabela de Equipamentos do cliente (inventário)
CREATE TABLE IF NOT EXISTS equipamentos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    tipo VARCHAR(100) NOT NULL, -- Ex: 'Notebook', 'Desktop'
    marca VARCHAR(100),
    modelo VARCHAR(255),
    numero_serie VARCHAR(255) UNIQUE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- Tabela de Produtos e Serviços oferecidos
CREATE TABLE IF NOT EXISTS produtos_servicos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    descricao TEXT NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    tipo VARCHAR(50) NOT NULL -- 'Produto' ou 'Serviço'
);

-- Tabela principal de Ordens de Serviço
CREATE TABLE IF NOT EXISTS ordens_de_servico (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    equipamento_id INT NOT NULL,
    data_entrada DATETIME NOT NULL,
    data_finalizacao DATETIME,
    status VARCHAR(50) NOT NULL,
    problema_relatado TEXT,
    laudo_tecnico TEXT,
    valor_total DECIMAL(10, 2),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id)
);

-- Tabela de Itens usados em uma Ordem de Serviço
CREATE TABLE IF NOT EXISTS os_itens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    os_id INT NOT NULL,
    item_id INT NOT NULL,
    quantidade INT NOT NULL,
    valor_unitario DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (os_id) REFERENCES ordens_de_servico(id),
    FOREIGN KEY (item_id) REFERENCES produtos_servicos(id)
);

-- Tabela para o Módulo Financeiro
CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    descricao TEXT NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'Receita' ou 'Despesa'
    data DATE NOT NULL,
    os_id INT, -- Opcional, para vincular a uma OS
    FOREIGN KEY (os_id) REFERENCES ordens_de_servico(id)
);