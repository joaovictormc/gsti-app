# GSTI App — Instalação, Contratação e Ativação

Guia técnico para **instalar**, **contratar** e **ativar** o GSTI App. Para o uso
do dia a dia, veja [MANUAL-DE-USO.md](./MANUAL-DE-USO.md).

> **Modelo de implantação:** cada cliente roda o GSTI App em sua própria máquina,
> com um **banco de dados PostgreSQL local**. A ativação da licença é **online**
> (consulta um servidor de licenças), mas o sistema funciona offline depois de
> ativado, até o vencimento.

---

## Sumário

1. [Requisitos](#1-requisitos)
2. [Preparar o banco de dados (local)](#2-preparar-o-banco-de-dados-local)
3. [Instalar o aplicativo](#3-instalar-o-aplicativo)
4. [Primeiro acesso — assistente de configuração](#4-primeiro-acesso--assistente-de-configuração)
5. [Como contratar](#5-como-contratar)
6. [Como ativar, reativar e transferir](#6-como-ativar-reativar-e-transferir)
7. [Operação do servidor de licenças (vendedor)](#7-operação-do-servidor-de-licenças-vendedor)
8. [Backup e manutenção](#8-backup-e-manutenção)
9. [Solução de problemas](#9-solução-de-problemas)

---

## 1. Requisitos

- **Windows 10/11 (64 bits).**
- **PostgreSQL** instalado na máquina do cliente (versão 13 ou superior
  recomendada) — <https://www.postgresql.org/download/windows/>.
- **Conexão com a internet** ao menos no momento da **ativação** (e
  periodicamente, para revalidar a licença).

---

## 2. Preparar o banco de dados (local)

1. **Instale o PostgreSQL** e anote o usuário (ex.: `postgres`), a senha e a
   porta (padrão **5432**).
2. **Crie o banco de dados**, por exemplo `gsti_db`:
   ```sql
   CREATE DATABASE gsti_db;
   ```
3. **Crie o schema** executando o arquivo **`script.sql`** (na raiz do projeto)
   uma única vez, conectado ao banco recém-criado. Via terminal:
   ```bash
   psql -U postgres -d gsti_db -f script.sql
   ```
   Ou abra o `script.sql` no **pgAdmin** e execute.

   Isso cria as tabelas: `usuarios`, `clientes`, `equipamentos`,
   `produtos_servicos`, `ordens_servico`, `os_itens`, `despesas`,
   `receitas_avulsas` (além dos tipos ENUM e índices).

> **Colunas e tabelas mais recentes** (endereço dividido em CEP/logradouro/
> número/bairro/cidade/estado, `id_atendente`, `estoque_baixado`, estoque dos
> produtos e a tabela `metas_financeiras`) são criadas/atualizadas
> **automaticamente** pelo aplicativo na primeira conexão. Você só precisa rodar
> o `script.sql` para o schema base.

---

## 3. Instalar o aplicativo

1. Execute o instalador `.exe` (gerado via `electron-builder`, formato **NSIS**).
2. O instalador **permite escolher a pasta** de instalação e exibe o termo de
   licença.
3. Conclua e abra o **GSTI App**.

> **Para o vendedor — como gerar o instalador:**
> ```bash
> npm install
> npm run dist:win        # gera o instalador Windows x64 em dist_electron/
> ```
> (Também há `dist:mac` e `dist:linux`.)

---

## 4. Primeiro acesso — assistente de configuração

Na primeira execução, o app abre um assistente com **3 passos**:

### Passo 1 — Ativação do Sistema
- **Tenho uma chave**: informe a **chave de licença** recebida por e-mail
  (`GSTI-XXXX-XXXX-XXXX-XXXX`). Pode colar com ou sem hífens.
- **Testar 7 dias grátis**: informe um e-mail (uma vez por e-mail e por computador).
- Requer internet. Em caso de sucesso, o assistente avança. Se a licença já estiver
  ativa (ex.: o app foi fechado no meio do assistente), este passo é pulado.

### Passo 2 — Configuração do Banco de Dados
- **Host**: `localhost` (banco local).
- **Porta**: `5432`.
- **Banco**: ex.: `gsti_db`.
- **Usuário** e **Senha** do PostgreSQL.
- Clique em **Testar Conexão**.

### Passo 3 — Acesso ao Sistema
Escolha uma das opções:

- **Criar novo administrador** — primeira instalação, banco vazio: informe
  **nome**, **e-mail**, **login**, **senha** (mín. 6 caracteres) e confirmação, e
  clique em **Salvar Configuração e Criar Admin**.
- **Já tenho cadastro** — reinstalação ou novo computador usando um banco que já
  tem usuários: informe **login e senha** de um usuário existente e clique em
  **Validar e Entrar**. Nenhum dado é alterado e o sistema já abre logado.

As configurações ficam salvas em `config.json` (na pasta de dados do usuário).

> 🖼️ *Telas do assistente: ativação → banco → administrador.*

---

## 5. Como contratar

1. O cliente escolhe o plano no **site** (Anual à vista, Anual com renovação automática
   ou Vitalícia) e paga pelo **Mercado Pago** (Pix, boleto ou cartão).
2. Confirmado o pagamento, a **chave de licença chega por e-mail** automaticamente.
3. Pela **área do cliente** (`/cliente`, acesso por link no e-mail) é possível renovar,
   desvincular computadores, gerar nova chave e cancelar a renovação automática.

Vendas fora do site (cortesias, parceiros): *Painel → Licenças → Emitir licença*.

---

## 6. Como ativar, reativar e transferir

- **Ativação**: chave de licença → vincula a licença a **este computador**
  (por padrão, 1 computador por licença).
- **Teste (trial)**: 7 dias, uma vez por e-mail/computador.
- **Verificação**: o app valida a licença **offline** a cada abertura (assinatura
  digital + computador + validade) e **revalida online** ao abrir e a cada 6 horas.
  Sem conseguir revalidar por **30 dias**, pede conexão com a internet.
- **Avisos**: faltando 15 dias ou menos para vencer, aparece um aviso no topo do
  sistema.
- **Reativação**: licença expirada, suspensa, revogada ou sem revalidação abre a
  tela **Ativação necessária** antes do login.
- **Transferir para outro computador**: **Configurações → Licenciamento e
  Ativação → Transferir para outro computador**. Depois, ative com a mesma chave no
  computador novo. Se o computador antigo não estiver mais disponível, o suporte
  libera a vaga (`node admin.js desativar-maquina`).
- **Status**: em **Configurações → Licenciamento e Ativação** (plano, validade,
  computadores em uso, última verificação).

> Atrasar o relógio do sistema é detectado e bloqueia o uso até uma revalidação online.

---

## 7. Operação do servidor de licenças (vendedor)

O servidor fica em **`license-server/`** (Node 22.13+ e Express, banco SQLite) e
entrega também o site de vendas, a área do cliente e o **painel da equipe** (`/admin`).
Guia completo — instalação, Mercado Pago, Cloudflare Tunnel, papéis da equipe,
rotação de chaves e backup — em [`license-server/README.md`](../license-server/README.md).

Resumo:
1. `npm ci --omit=dev` e `node gerar-chaves.js` (uma vez). Cole a chave pública
   impressa em `publicKeys` no **`license-config.js`** do app e ajuste `serverUrl`.
2. Hospede o servidor em um host sempre ligado (HTTPS em produção).
3. Gerencie licenças com `node admin.js` (emitir, estender, suspender, revogar,
   liberar computador).
4. Faça **backup da pasta `license-server/data/`** (chaves + banco).

---

## 8. Backup e manutenção

- **Backups do banco**: pela tela de Configurações (manual ou automático com
  dias/horário/retenção). Para backup externo, use uma pasta sincronizada
  (Google Drive/OneDrive/Dropbox).
- **Configurações do app**: ficam em `config.json`, na pasta de dados do usuário
  do Windows (`%APPDATA%`), incluindo a configuração do banco e a licença.

---

## 9. Solução de problemas

| Sintoma | Causa provável / solução |
|--------|--------------------------|
| "Usuário ou senha do banco inválidos" (erro `28P01`) | Credenciais do PostgreSQL incorretas no passo 2. |
| "Banco de dados não encontrado" (erro `3D000`) | O banco (ex.: `gsti_db`) não foi criado. Crie-o e rode o `script.sql`. |
| "Não foi possível conectar ao Host/Porta" | PostgreSQL não está rodando, porta errada, ou firewall. |
| "Não foi possível contatar o servidor de licenças" | Sem internet, servidor desligado ou `serverUrl` incorreto (`license-config.js` ou `license.serverUrl` no `config.json`). |
| "Chave de licença inválida" | Chave digitada errada ou licença não emitida no servidor. |
| "Esta licença já está em uso no limite de N computador(es)" | Transfira a licença no outro computador ou peça ao suporte para liberar a vaga. |
| "…chave que esta versão do GSTI App não reconhece" | Build com `license-config.js` desatualizado em relação ao servidor. Instale a versão mais recente. |
| "Este banco não possui cadastro do GSTI App" (Já tenho cadastro) | Banco errado ou vazio — confira o nome do banco ou use **Criar novo administrador**. |
| "Ativação necessária" ao abrir | Licença expirada/revogada — reative na tela exibida. |
| Tabelas faltando / erro de coluna inexistente | Rode o `script.sql` no banco; abra o app uma vez para aplicar as migrações automáticas. |

**Suporte:** suporte@labapp.com.br
