# GSTI App — Evolução: da primeira versão até a versão atual

Comparativo do que mudou entre a **primeira versão** do GSTI App e a **versão atual**
(branch `develop`). Serve de base para as *release notes* do GitHub e para apresentar
o salto de maturidade do produto.

---

## 1. Resumo executivo

A primeira versão era um **protótipo funcional** voltado ao uso interno: rodava sobre
**MySQL**, com as **credenciais do banco escritas diretamente no código** (`main.js`),
sem qualquer controle de licença e com identidade visual fixa.

A versão atual é um **produto instalável, licenciado e vendável por instância**: cada
cliente roda o app na própria máquina com um **banco PostgreSQL local**, faz toda a
configuração por um **assistente guiado** e **ativa o sistema online** (com período de
teste de 7 dias). Além disso, ganhou whitelabel, automações de e-mail, backup
automático e um conjunto bem maior de relatórios e recursos financeiros.

| | Primeira versão | Versão atual |
|---|---|---|
| Posicionamento | Protótipo interno | Produto vendável por instância |
| Banco de dados | MySQL, credenciais no código | PostgreSQL local, configurável no setup |
| Configuração | Editar `main.js` | Assistente de 3 passos |
| Licenciamento | Inexistente | Ativação online (Ed25519) + trial 7 dias |
| Identidade visual | Fixa | Whitelabel (logo + fundo do login) |

---

## 2. Comparativo por área (Antes × Agora)

### Banco de dados
- **Antes:** MySQL (`mysql2`), com host/usuário/senha **hardcoded no `main.js`**.
- **Agora:** **PostgreSQL** (`pg`), credenciais informadas no assistente e salvas em
  `config.json` (pasta de dados do usuário). Colunas e tabelas mais recentes são
  criadas/atualizadas **automaticamente** na primeira conexão (migrações em
  `initializeDbPool`); o schema base vem do `script.sql`.

### Instalação e primeiro acesso
- **Antes:** era preciso editar o código-fonte para apontar o banco.
- **Agora:** **assistente de 3 passos** na primeira execução — **Ativação** →
  **Banco de dados** (com "Testar Conexão") → **Conta de administrador**.

### Licenciamento e ativação
- **Antes:** não existia.
- **Agora:** **ativação online** com **assinatura Ed25519** (a chave **privada fica só
  no servidor**, o app embute apenas a chave pública — licenças não podem ser
  forjadas). Inclui **trial de 7 dias** (uma vez por e-mail/máquina), **reativação**
  quando expira/é revogada, verificação **offline** por assinatura a cada abertura e
  **URL do servidor configurável** nas Configurações.

### Identidade visual (whitelabel)
- **Antes:** visual fixo.
- **Agora:** **logo personalizável** e **imagem de fundo do login** configuráveis.

### Dashboard (Início)
- **Antes:** KPIs simples e alertas de garantia.
- **Agora:** **dashboard modular por widgets** (seções configuráveis), agenda do dia e
  alertas de estoque.

### Ordens de Serviço
- **Antes:** CRUD, busca por nome do cliente, itens, garantia, PDFs de entrada e saída.
- **Agora:** adicionado **campo atendente**, **busca avançada** (ID, cliente, telefone,
  equipamento, série…) e geração dos **PDFs em worker thread** (não trava a aplicação);
  PDF de entrada reestruturado em 2 vias.

### Financeiro
- **Antes:** despesas (Fixa/Variável, cálculo de combustível), receitas avulsas, resumo
  com cards e gráficos mensais/anuais, **"Meta de Investimento" única** e exportação
  Excel com **5 abas**.
- **Agora:** acrescentados **despesas detalhadas por categoria**, **projeção financeira**
  (com despesa fixa estimada), **metas financeiras múltiplas** (tabela
  `metas_financeiras`), gráficos de **Receitas por Fonte** e **Despesas por Categoria**,
  **fluxo de caixa detalhado** e abas-resumo adicionais no Excel.

### Relatórios
- **Antes:** OS por Cliente, Serviços Mais Usados, Histórico de Equipamento, Receitas
  Detalhadas e OS por Status (5 relatórios).
- **Agora:** somam-se **OS Abertas por Tempo** (aging), **por Atendente** e de
  **Lucratividade**.

### Comunicação e automação
- **Antes:** nenhuma automação de e-mail no produto.
- **Agora:** **e-mail/SMTP** integrado — recuperação de senha e **notificações de
  garantia** (e-mail/WhatsApp).

### Estoque e garantias
- **Antes:** sem controle de estoque dedicado na UI.
- **Agora:** **controle de estoque** com **baixa automática** ao finalizar a OS, alertas
  de estoque mínimo e **painel de garantias** com classificação de status.

### Backup
- **Antes:** procedimento manual/externo.
- **Agora:** **backup automático avançado** (dias da semana, horário, retenção, zip) e
  restauração pela tela de Configurações.

---

## 3. Linha do tempo (marcos)

Resumo derivado do histórico de commits:

1. **Fases 2–4** — OS, módulo financeiro e relatórios iniciais (base MySQL).
2. **Migração para PostgreSQL** e redesenho visual (UI minimalista) + tela de
   configuração de banco/e-mail.
3. **Sprints 4–9** — agenda e timeline do cliente, backup, ViaCEP, logo no PDF,
   sidebar recolhível, controle de estoque, relatório de lucratividade, dashboard
   modular, notificações de garantia, backup avançado, campo atendente, fluxo de caixa.
4. **Refinamentos recentes** — gráficos financeiros, busca avançada de OS, PDFs em
   worker thread, whitelabel (fundo do login), despesas detalhadas, projeção +
   metas múltiplas, relatório de OS abertas por tempo.
5. **Licenciamento online** (Ed25519 + trial) e **URL do servidor configurável**.
6. **Documentação** (manual de uso, instalação/ativação, roadmap).
7. **1.3.0** — equipamentos, histórico de status, custo e margem, aviso ao cliente,
   segurança (permissões no processo principal, senhas cifradas), perfil Técnico e
   permissões por perfil, marca no login e barra de título, nota fiscal (registro manual
   e Notaas) e testes automatizados. Detalhes no [CHANGELOG](../CHANGELOG.md).

---

## 4. Notas de compatibilidade

- **Mudança de banco (MySQL → PostgreSQL):** o cliente precisa ter **PostgreSQL**
  instalado e executar o **`script.sql`** uma vez para criar o schema base. Não é uma
  atualização "in-place" da base MySQL antiga.
- **Credenciais:** deixaram de ficar no `main.js` e passaram para o **assistente**
  (salvas em `config.json`, em `%APPDATA%`).
- **Ativação obrigatória:** a versão atual exige **ativação** (ou trial) antes do login.

---

## 5. Sugestão de versionamento

Como o produto **mudou de base de dados** (MySQL → PostgreSQL) e ganhou
**licenciamento/venda**, recomenda-se tratar como uma **major release**:

- Versão atual: **`1.3.0`** (desenvolvimento/homologação; nada vendido ainda).
- Sugestão: **`2.0.0`** para a primeira release pública vendável (decisão final do
  desenvolvedor).

> Veja também: [INSTALACAO-E-ATIVACAO.md](./INSTALACAO-E-ATIVACAO.md),
> [CHECKLIST-PRE-BUILD.md](./CHECKLIST-PRE-BUILD.md) e
> [PROXIMA-VERSAO.md](./PROXIMA-VERSAO.md).
