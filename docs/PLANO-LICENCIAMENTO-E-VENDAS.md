# GSTI App — Plano de Licenciamento e Vendas (v2)

Plano para evoluir o licenciamento atual para um fluxo **comercial automatizado**,
integrado à futura **landing page de vendas**. Para executar quando o produto for
publicado. Complementa a seção 2 de [PROXIMA-VERSAO.md](./PROXIMA-VERSAO.md).

> Criado em 2026-09-13.

---

## 1. Objetivo

```
Visitante → landing page → compra (Pix/cartão/boleto) → recebe e-mail com
chave de licença + instalador → instala → ativa com a chave → usa.
Cancelamento/estorno/inadimplência → licença revogada automaticamente.
```

Sem nenhuma etapa manual do vendedor no caminho feliz.

---

## 2. O que manter e o que muda

### Manter (a base está correta)
- **Token assinado com Ed25519**, chave privada **só no servidor**, chave pública
  embutida no app.
- **Verificação offline** a cada abertura + **revalidação online** periódica.
- **Anti-retrocesso de relógio** (`lastSeen`).

### Lacunas do modelo atual (v1)

| # | Problema hoje | Consequência |
|---|---------------|--------------|
| 1 | Ativação só pelo **e-mail** | Quem souber o e-mail de um cliente ativa em outra máquina |
| 2 | `maquina` vai no token, mas o **app não confere** | Um `config.json` copiado funciona em qualquer PC |
| 3 | **Sem limite de máquinas** por licença | Uma compra vira N instalações |
| 4 | `clientes.json` / `trials.json` editados à mão | Não escala, sem histórico, gravação não atômica |
| 5 | **Uma única chave** de assinatura, sem identificador | Trocar a chave invalida todas as builds já distribuídas |
| 6 | Nenhum diagnóstico de chave divergente | Build e servidor com chaves diferentes só geram "licença inválida" |
| 7 | ID de máquina = `hostname` + **primeiro MAC** | Muda com VPN/Tailscale, dock USB, troca de placa de rede ou renomear o PC |
| 8 | `/ativar` e `/trial` **sem rate limit** | Abuso e enumeração de e-mails |
| 9 | URL do servidor editável e ausente no assistente | Configuração confusa para o cliente |
| 10 | Chaves já foram versionadas por engano (commit `cabe97e`) | Precisa de trava automática contra reincidência |

---

## 3. Decisões a tomar antes de começar

| Decisão | Opções | Recomendação |
|---------|--------|--------------|
| **Modelo de cobrança** | Vitalícia · Assinatura mensal/anual · Vitalícia + manutenção anual | Assinatura anual (receita recorrente) com opção mensal |
| **Gateway** | Mercado Pago · Asaas · Hotmart/Kiwify · Stripe | **Asaas** ou **Mercado Pago** (Pix, boleto, cartão, assinaturas e webhooks). Hotmart/Kiwify se quiser afiliados e checkout pronto |
| **Máquinas por licença** | 1 · 2 · por plano | 1 no plano básico, com **transferência self-service** |
| **Trial** | Pelo app · pela landing (com e-mail confirmado) | Pela landing, com confirmação de e-mail (reduz abuso) |
| **Hospedagem do servidor** | Servidor doméstico + Cloudflare Tunnel · VPS | **VPS pequena** (Hetzner, Contabo, Magalu Cloud etc.) ao vender; Cloudflare Tunnel é aceitável no início |
| **Domínio** | `licenca.labapp.com.br` · `api.labapp.com.br` | `api.labapp.com.br`, fixo no `DEFAULT_LICENSE_SERVER` |
| **Envio de e-mail** | Brevo · Resend · Amazon SES | **Brevo** (já usado no app) |

Aspectos legais: emissão de NFS-e sobre as vendas (o gateway pode automatizar),
termos de uso e política de privacidade na landing (LGPD: e-mail, nome e ID de
máquina são dados pessoais).

---

## 4. Arquitetura alvo

```
┌──────────────┐   checkout   ┌──────────────┐
│ Landing page │ ───────────► │   Gateway    │
└──────┬───────┘              └──────┬───────┘
       │ trial / portal              │ webhook (assinado)
       ▼                             ▼
┌─────────────────────────────────────────────┐
│          Servidor de licenças (v2)          │
│  API app · webhook · portal · painel admin  │
│  Banco (PostgreSQL/SQLite) · chave privada  │
└──────┬───────────────────────────┬──────────┘
       │ e-mail (chave + link)     │ ativar / validar
       ▼                           ▼
   Cliente  ─────── instala ───►  GSTI App (chaves públicas embutidas)
```

---

## 5. Modelo de dados

```
clientes        id, email (único), nome, documento (CPF/CNPJ), criado_em
pedidos         id, cliente_id, gateway, gateway_id (único), plano, valor,
                status (pendente|pago|estornado|cancelado), criado_em
licencas        id, cliente_id, pedido_id, chave (GSTI-XXXX-XXXX-XXXX, único),
                plano, status (ativa|suspensa|revogada|expirada),
                max_maquinas, valida_ate (null = vitalícia), criado_em
ativacoes       id, licenca_id, maquina_id, nome_maquina, ativado_em,
                ultimo_contato, desativado_em
trials          id, email, maquina_id, emitido_em, expira_em
eventos_webhook id, gateway, evento_id (único → idempotência), payload,
                processado_em, erro
chaves_assinatura kid, criada_em, aposentada_em   (a chave privada fica em arquivo/secret)
auditoria       id, ator, acao, alvo, dados, criado_em
```

- A **chave de licença** é aleatória (≥ 80 bits) e gravada **como hash** no banco
  (como uma senha); o texto claro só vai no e-mail.
- `eventos_webhook.evento_id` único garante que o mesmo webhook processado duas
  vezes não gere duas licenças.

---

## 6. API do servidor

### App (público, com rate limit)
| Método | Rota | Corpo | Função |
|--------|------|-------|--------|
| POST | `/v2/ativar` | `{ chave, maquinaId, nomeMaquina, appVersao }` | Valida a chave, respeita `max_maquinas`, registra ativação, devolve token |
| POST | `/v2/validar` | `{ token }` | Revogação/expiração; **devolve token renovado** quando a assinatura foi renovada |
| POST | `/v2/desativar` | `{ token }` | Libera a vaga da máquina (usado em "transferir licença") |
| POST | `/v2/trial` | `{ codigoTrial, maquinaId }` | Emite trial a partir do código enviado ao e-mail confirmado |
| GET | `/health` | — | `{ ok, kids: ["2027-01"], versao }` → permite ao app diagnosticar chave divergente |

### Gateway
| POST | `/v2/webhooks/<gateway>` | payload do gateway | Verifica assinatura/token do gateway, grava evento, processa de forma idempotente |

Mapeamento de eventos:
- **pagamento aprovado / assinatura criada** → cria cliente, pedido e licença; envia e-mail.
- **renovação paga** → estende `valida_ate`.
- **estorno / chargeback / cancelamento** → `status = revogada`.
- **atraso** → `suspensa` após N dias de tolerância.

### Portal do cliente (link mágico por e-mail, sem senha)
- Ver licenças, reenviar chave, **desativar máquina** (transferência), baixar instalador, notas fiscais.

### Admin (autenticado, só pela rede privada/Tailscale ou com 2FA)
- Buscar cliente, emitir licença manual/cortesia, revogar, estender, ver auditoria.

---

## 7. Token v2

```json
{
  "v": 2,
  "kid": "2027-01",
  "lic": "uuid-da-licenca",
  "email": "cliente@empresa.com",
  "plano": "anual",
  "tipo": "full",
  "maquina": "id-estável-da-máquina",
  "emitidoEm": "2027-01-10T12:00:00Z",
  "validade": "2028-01-10T00:00:00Z",
  "revalidarAte": "2027-02-09T12:00:00Z"
}
```

Regras no app:
1. **`kid`** seleciona a chave pública dentro de um mapa embutido
   (`LICENSE_PUBLIC_KEYS = { "2027-01": "...", "2028-01": "..." }`). A build já
   traz a chave seguinte, então é possível **rotacionar sem quebrar** builds antigas.
2. **`maquina` deve bater** com o ID da máquina atual; senão, pede reativação.
3. **`revalidarAte`** = janela offline (ex.: 30 dias). Passou dela sem contato com
   o servidor → aviso e, após a tolerância, bloqueio até revalidar. Isso faz a
   revogação chegar mesmo em quem nunca fica online.
4. `/v2/validar` pode devolver **token novo** (renovação, mudança de plano); o
   app substitui o salvo.

**ID de máquina estável:** usar o `MachineGuid` do Windows
(`HKLM\SOFTWARE\Microsoft\Cryptography`, ex.: pacote `node-machine-id`) em vez
de `hostname + MAC`. Ele não muda com adaptadores de rede.

---

## 8. Mudanças no app

- [ ] Assistente e tela de reativação: campo **chave de licença** (com máscara
      `GSTI-XXXX-XXXX-XXXX`) no lugar do e-mail; link "Não tem chave? Compre / teste grátis".
- [ ] Remover a edição da URL do servidor da interface em produção (manter só via
      `config.json` para suporte).
- [ ] `LICENSE_PUBLIC_KEYS` com `kid`; verificação de `maquina` e `revalidarAte`.
- [ ] Revalidação automática em segundo plano (na abertura e a cada 24 h), com
      substituição do token quando o servidor devolver um novo.
- [ ] **Diagnóstico**: se o servidor responder e nenhum `kid` bater, mostrar
      "Build desatualizada: servidor usa chave diferente" (evita o problema de 2026-09).
- [ ] Tela Configurações → Licença: plano, validade, máquinas usadas,
      botão **Transferir para outro computador** (chama `/v2/desativar`).
- [ ] Aviso de vencimento (15, 7 e 1 dia) com link para renovar.
- [ ] **Migração v1 → v2**: tokens v1 (sem `kid`) continuam aceitos por uma versão;
      na primeira revalidação o servidor troca por um token v2.

---

## 9. Segurança

- **Chaves fora do git, sempre**: `private.key` só no servidor (permissão 600) e
  backup cifrado fora dele. Adicionar **verificação automática** que falha se
  houver `*.key`/`BEGIN PRIVATE KEY` rastreado (hook de pre-commit + checagem no CI),
  e rodar `gitleaks` no repositório.
- **Rate limit** por IP e por chave (`express-rate-limit`) em `/v2/ativar`,
  `/v2/trial`, `/v2/validar`; bloqueio temporário após falhas repetidas.
- **Webhooks**: validar assinatura/token do gateway, aceitar só HTTPS, idempotência
  por `evento_id`, e **confirmar o pagamento consultando a API do gateway** antes de
  emitir a licença (não confiar só no corpo do webhook).
- Chaves de licença armazenadas como **hash**; respostas genéricas para não
  revelar se um e-mail/chave existe.
- Segredo embutido no app (HMAC de requisição) **não é proteção real** com
  `asar: false`: o código é legível. A proteção vem da entropia da chave + rate limit
  + limite de máquinas.
- Painel admin fora da internet pública (Tailscale) ou com 2FA.
- `helmet`, limite de tamanho de corpo, logs sem dados sensíveis.

---

## 10. Hospedagem e operação

- **HTTPS obrigatório** e **URL pública estável**: o gateway precisa alcançar o webhook.
  O Tailscale privado (uso atual) **não serve** para vendas.
- Servidor doméstico: **Cloudflare Tunnel** com `api.labapp.com.br`, sem abrir
  portas. Porém uma queda de luz ou de internet impede compras novas de ativarem e
  atrasa webhooks (os gateways reenviam por algumas horas). Ao escalar, migrar para VPS.
- **Backups**: `pg_dump` diário cifrado para armazenamento externo + backup do
  `private.key` guardado separado (cofre de senhas).
- **Monitoramento**: checagem externa de `/health` (UptimeRobot, BetterStack) com alerta.
- Deploy via `git pull` + `systemd` (já em uso) ou Docker Compose (app + Postgres).
- Ambiente de **homologação** usando o sandbox do gateway.

---

## 11. Landing page

- Seções: proposta de valor, funcionalidades, screenshots, planos/preços, FAQ,
  depoimentos, contato, termos e privacidade.
- **Checkout** do gateway (link de pagamento ou checkout transparente).
- **Teste grátis**: formulário de e-mail → e-mail de confirmação com código de
  trial + link do instalador.
- **Download** do instalador (hospedado em GitHub Releases ou armazenamento de
  objetos), com hash SHA-256 publicado.
- E-mails transacionais: boas-vindas com chave, trial, lembrete de vencimento,
  pagamento falhou, licença revogada.
- Pode ser estática (Astro/Next export) em Cloudflare Pages/Vercel; só o servidor
  de licenças precisa de backend.

---

## 12. Fases de implementação

### Fase 0 — Correções imediatas (antes de qualquer distribuição)
- [ ] Remover `private.key`/`public.key` do repositório e restaurar `.gitignore`.
- [ ] Regenerar as chaves no servidor, atualizar `LICENSE_PUBLIC_KEY`, gerar build nova.
- [ ] Trava de pre-commit contra chaves privadas.

### Fase 1 — Servidor v2 (base)
- [ ] Banco + migrações; importar `clientes.json` atual.
- [ ] Chaves de licença, `ativacoes` com `max_maquinas`, `kid` nos tokens.
- [ ] Endpoints `/v2/*`, rate limit, `/health` com `kids`.
- [ ] Painel admin mínimo (CLI ou página simples) para emitir/revogar.

### Fase 2 — App v2
- [ ] Itens da seção 8 + ID de máquina estável.
- [ ] Compatibilidade com tokens v1 durante a transição.

### Fase 3 — Pagamentos
- [ ] Integração com o gateway escolhido (sandbox → produção).
- [ ] Webhooks idempotentes, e-mails transacionais, assinaturas e renovações.

### Fase 4 — Landing page e portal
- [ ] Landing, checkout, trial com e-mail confirmado, download.
- [ ] Portal do cliente (link mágico, transferência de máquina).

### Fase 5 — Go-live
- [ ] Servidor em URL pública com HTTPS, backups e monitoramento ativos.
- [ ] `DEFAULT_LICENSE_SERVER` final na build; instalador assinado (ver checklist).
- [ ] Teste ponta a ponta: compra real de baixo valor → e-mail → instalação →
      ativação → estorno → revogação.
- [ ] Termos, privacidade e emissão fiscal configurados.

---

## 13. Riscos

| Risco | Mitigação |
|-------|-----------|
| Perda do `private.key` | Backup cifrado em 2 locais; mapa de `kid` permite introduzir chave nova |
| Vazamento do `private.key` | Rotação por `kid` + build nova; revalidação troca tokens antigos |
| Servidor fora do ar | Janela offline de 30 dias; monitoramento; VPS ao escalar |
| Webhook perdido | Reprocessamento periódico consultando a API do gateway |
| Cliente troca de PC | Transferência self-service no app e no portal |
| App crackeado (código legível) | Aceitar o risco residual; habilitar `asar` e ofuscação leve em produção; foco em facilitar a compra |
