# GSTI App — Pendências e Próxima Versão

Registro das mudanças **adiadas** e dos **ajustes planejados** para a próxima
versão. Atualizado em 2026-05-31.

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

---

## 2. Licenciamento + venda via landing page

Hoje a contratação é manual (cadastrar o e-mail em `clientes.json`). Como o
sistema será vendido junto a uma **landing page**, o licenciamento precisa ser
integrado ao fluxo de compra.

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

---

## 5. Notas de manutenção (produção de licenças)

- **Regenerar as chaves** Ed25519 antes de distribuir (as atuais são de teste) e
  colar a nova pública em `LICENSE_PUBLIC_KEY` (`main.js`).
- **Backup do `private.key`** do servidor — perdê-lo invalida todas as licenças.
- Definir a URL real do servidor em `DEFAULT_LICENSE_SERVER` (`main.js`) e/ou no
  `config.json` (`license.serverUrl`), sempre com **HTTPS**.
- Hospedar o `license-server/` em ambiente sempre ligado.
