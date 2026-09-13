# GSTI App — Pendências e Próxima Versão

Registro das mudanças **adiadas** e dos **ajustes planejados** para a próxima
versão. Atualizado em 2026-06-02.

---

## 1. Features adiadas (fila atual)

Itens que estavam na fila e foram deixados para a próxima versão:

- **Notas por Item na OS** — permitir observações específicas por produto/serviço
  dentro da OS (tabela `os_itens`).
- **Customização de PDFs** — adicionar logo da empresa e dados de contato aos PDFs
  de entrada/saída. O worker de PDF (`pdf-worker.js`) já recebe `logoPath`; falta
  desenhar no documento e expor a opção.
- **Histórico de Status da OS** — registrar mudanças de status com data/usuário
  (auditoria). Requer nova tabela (ex.: `os_status_historico`).
- **Módulo de Equipamentos** — UI para a tabela `equipamentos` (já existe no
  schema): inventário de equipamentos por cliente. Destrava o item abaixo.
- **Vincular OS a Equipamento específico** — associar a OS a um item do inventário
  do cliente (depende do módulo de equipamentos).
- **Vincular Custo a Produtos/Serviços** — campo de custo em `produtos_servicos`
  para cálculo de margem.
- **Clareza nas configurações de personalização do login** — Os campos de
  whitelabeling nas Configurações precisam de rótulos mais descritivos: deixar
  explícito qual campo define a *imagem de fundo da tela de login* e qual define
  o *ícone do app* (ícone da barra de título / taskbar).
- **Alterar logo e nome na tela de login** — Permitir que o operador substitua a
  logo exibida na tela de login e edite o nome/título do sistema mostrado nessa
  tela, além do que já é configurável hoje via whitelabeling.
- **Crédito ao desenvolvedor em telas do sistema** — Para preservar a identidade
  do criador, incluir em algumas telas (ex.: rodapé do login, tela "Sobre" ou
  rodapé dos PDFs gerados) a informação "Desenvolvido por [nome/empresa]".
  Configurável, mas com o padrão apontando para o desenvolvedor original.
- **Emissão de NFS-e / NF-e após finalização de OS** — Criar botão ou área
  dedicada nas OS com status "Finalizado" para iniciar a emissão de nota fiscal
  (NFS-e para serviços ou NF-e para produtos). Avaliar integração com APIs de
  prefeitura/SEFAZ ou com emissores de terceiros.
- **Barra de título personalizada (frameless window)** — Substituir a barra de
  título padrão do sistema operacional por uma implementada em React, eliminando
  a barra nativa do Electron com os menus "File / Edit / View / Window / Help".
  A barra customizada deve exibir o favicon e o nome do app (configuráveis via
  whitelabeling), os botões de minimizar, maximizar/restaurar e fechar estilizados
  conforme o tema do sistema, e não expor os menus padrão do Electron em produção.
  Requer `frame: false` (ou `titleBarStyle: 'hidden'`) no `BrowserWindow` e
  implementação de drag region + controles de janela via `ipcRenderer`.

---

## 2. Licenciamento + venda via landing page

Hoje a contratação é manual (cadastrar o e-mail em `clientes.json`). Como o
sistema será vendido junto a uma **landing page**, o licenciamento precisa ser
integrado ao fluxo de compra.

> **Plano detalhado:** [PLANO-LICENCIAMENTO-E-VENDAS.md](./PLANO-LICENCIAMENTO-E-VENDAS.md)
> (arquitetura, modelo de dados, API, token v2, segurança e fases).

### Fluxo proposto (recomendado)
```
Cliente compra na landing page
        │
        ▼
Gateway de pagamento (Mercado Pago / Hotmart / Stripe / etc.)
        │  webhook de "pagamento aprovado"
        ▼
Servidor de licenças
   • cadastra o e-mail do comprador automaticamente (clientes.json ou banco)
   • dispara e-mail com instruções de ativação (e link/instalador)
        │
        ▼
Cliente instala o app e ativa com o e-mail da compra
```

### Pontos a implementar
- **Endpoint de webhook** no servidor de licenças, validando a assinatura do
  gateway (cada gateway tem seu mecanismo).
- **Cadastro automático** do e-mail como cliente ativo; **revogação/renovação**
  automáticas conforme o status do pagamento (cancelamento, estorno, assinatura
  expirada).
- **Trial self-service** iniciável a partir da landing page ou do próprio app
  (já existe o endpoint `/trial`).
- **Entrega**: e-mail automático com instalador + passo a passo de ativação.

### Proteção do endpoint/token de ativação (pedido do usuário)
A URL do servidor não deve ficar **exposta/explorável**:
- **Autenticar as chamadas** do app ao servidor — ex.: chave de aplicação +
  `nonce`/timestamp + **HMAC** da requisição (evita que qualquer um chame
  `/ativar` ou `/trial` livremente).
- **Rate limiting** e proteção contra abuso nos endpoints.
- **Ocultar/bloquear** a edição da URL do servidor na tela de Configurações em
  produção (deixar fixa e não óbvia), evitando exposição do endpoint.
- Considerar ofuscar o segredo de requisição embutido no app (sabendo que, com
  `asar: false`, o código vai legível — ver dívida técnica).

> A base criptográfica atual (assinatura **Ed25519**, com a chave **privada
> apenas no servidor**) já impede forjar licenças no cliente. Os ajustes acima
> são para proteger o **acesso aos endpoints** e a **automação da venda**.

---

## 3. Modelo de papéis e acesso

Com o sistema vendido por instância (cada cliente é dono do próprio app + banco
local), o modelo de papéis deve ser repensado:

- **O comprador (cliente) deve ter acesso Admin total** da sua instância.
- Adicionar um papel **Técnico/Operador** — distinto do atual `Funcionario` —
  com permissões próprias voltadas à operação (OS, clientes, estoque), sem
  acesso a configurações sensíveis.
- Reavaliar a granularidade atual (hoje: `Admin` x `Funcionario` + permissões
  `canSeeFinancial` / `canSeeReports`) para alinhar com esse modelo.
- O schema usa o ENUM `user_role_enum ('Admin', 'Funcionario')` — incluir o novo
  papel exigirá migração do tipo e ajustes na UI de Gerenciar Usuários e nos
  gates de acesso (`App.jsx`).

---

## 4. Dívida técnica e segurança

Itens levantados na análise técnica e durante o desenvolvimento:

- **Credenciais do banco em texto puro** no `config.json` → avaliar criptografar
  (ou usar o cofre de credenciais do SO).
- **DevTools/console em produção** → o `window.api` fica acessível pelo console;
  desabilitar DevTools no build de produção.
- **Validação de papel no backend** → vários handlers administrativos têm apenas
  checagem no frontend (há `TODO` no código para validar a role no `main.js`).
- **Criação automática do schema** no setup → executar o `script.sql` pelo próprio
  app no primeiro acesso, para o cliente não precisar rodá-lo manualmente.
- **`main.js` monolítico** (~2.800 linhas) → considerar modularizar handlers por
  domínio.
- **Backup do banco de dados em hospedagem remota** — Levantar como viabilizar
  backup automático/periódico quando o PostgreSQL está hospedado fora da máquina
  local (VPS, serviço gerenciado, etc.). Opções a avaliar: `pg_dump` agendado
  via cron no servidor, snapshots oferecidos pelo provedor, ou exportação
  disparada pelo próprio app via IPC.

---

## 5. Notas de manutenção (produção de licenças)

- **Regenerar as chaves** Ed25519 antes de distribuir (as atuais são de teste) e
  colar a nova pública em `LICENSE_PUBLIC_KEY` (`main.js`).
- **Backup do `private.key`** do servidor — perdê-lo invalida todas as licenças.
- Definir a URL real do servidor em `DEFAULT_LICENSE_SERVER` (`main.js`) e/ou no
  `config.json` (`license.serverUrl`), sempre com **HTTPS**.
- Hospedar o `license-server/` em ambiente sempre ligado.
