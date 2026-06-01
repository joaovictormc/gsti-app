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
6. [Como ativar e reativar](#6-como-ativar-e-reativar)
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
- Informe o **e-mail** e escolha:
  - **Ativar Licença** — para quem já contratou (e-mail cadastrado no servidor).
  - **Testar 7 dias grátis** — inicia um período de teste (uma vez por
    e-mail/máquina).
- Requer internet. Em caso de sucesso, o assistente avança.

### Passo 2 — Configuração do Banco de Dados
- **Host**: `localhost` (banco local).
- **Porta**: `5432`.
- **Banco**: ex.: `gsti_db`.
- **Usuário** e **Senha** do PostgreSQL.
- Clique em **Testar Conexão**.

### Passo 3 — Criar Conta de Administrador
- **Nome**, **e-mail**, **login**, **senha** (mín. 6 caracteres) e confirmação.
- Clique em **Salvar Configuração e Criar Admin**.

Concluído o passo 3, o app cria o usuário administrador e está pronto para uso.
As configurações ficam salvas em `config.json` (na pasta de dados do usuário).

> 🖼️ *Telas do assistente: ativação → banco → administrador.*

---

## 5. Como contratar

**Modelo atual:**
1. O cliente entra em contato (suporte@labapp.com.br) e informa o **e-mail** que
   usará para ativar.
2. O e-mail é **cadastrado na base de clientes** do servidor de licenças
   (`clientes.json`, com `"ativo": true`).
3. A partir daí, o cliente consegue usar **Ativar Licença** com esse e-mail.

> O fluxo automatizado de compra (landing page → pagamento → cadastro e ativação
> automáticos) está planejado para a próxima versão — ver
> [PROXIMA-VERSAO.md](./PROXIMA-VERSAO.md).

---

## 6. Como ativar e reativar

- **Ativação definitiva**: e-mail cadastrado como cliente → licença sem prazo
  (ou com a validade definida no cadastro).
- **Teste (trial)**: 7 dias, uma vez por e-mail/máquina.
- **Verificação**: o app valida a licença **offline** (assinatura digital) a cada
  abertura e **revalida online** quando há internet (para refletir
  cancelamentos/renovações).
- **Reativação**: se a licença **expirar** ou for **revogada**, o app abre a tela
  de **Ativação necessária** antes do login, permitindo ativar novamente ou
  iniciar/retomar um teste.
- **Status**: visível em **Configurações → Licenciamento e Ativação** (tipo,
  validade, dias restantes) — e ali também é possível ajustar a **URL do servidor
  de ativação**.

> Como a validade é verificada também offline, atrasar o relógio do sistema é
> detectado e bloqueia o uso até uma revalidação online.

---

## 7. Operação do servidor de licenças (vendedor)

O servidor fica em **`license-server/`** (Node + Express). Resumo — detalhes
completos em [`license-server/README.md`](../license-server/README.md):

1. **Gerar as chaves** (uma vez): `node gerar-chaves.js` cria `private.key`
   (fica só no servidor) e imprime a **chave pública**, que deve ser colada em
   `LICENSE_PUBLIC_KEY` no `main.js` do app.
2. **Hospedar** o servidor em um host sempre ligado, com **HTTPS** (VPS, Render,
   Railway ou a hospedagem própria). Configurar a URL pública no app
   (`DEFAULT_LICENSE_SERVER` no `main.js` ou em Configurações).
3. **Gerenciar clientes** editando `clientes.json`:
   - Adicionar: incluir o e-mail com `"ativo": true`.
   - **Revogar**: `"ativo": false` (vale na próxima revalidação do app).
   - Licença com prazo: definir `"validade"` (data ISO) ou `null` para sem
     expiração.
4. **Endpoints**: `POST /ativar`, `POST /trial`, `POST /validar`, `GET /health`.

> ⚠️ **Importante (produção):** faça **backup do `private.key`** — perdê-lo
> invalida todas as licenças. As chaves embutidas atualmente no repositório são
> de teste; **regenere** antes de distribuir.

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
| "Não foi possível contatar o servidor de ativação" | Sem internet ou URL do servidor incorreta (Configurações → Licenciamento). |
| "Ativação necessária" ao abrir | Licença expirada/revogada — reative na tela exibida. |
| Tabelas faltando / erro de coluna inexistente | Rode o `script.sql` no banco; abra o app uma vez para aplicar as migrações automáticas. |

**Suporte:** suporte@labapp.com.br
