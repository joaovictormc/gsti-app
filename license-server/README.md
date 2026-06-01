# Servidor de Ativação — GSTI App

Servidor Express que emite e valida licenças do GSTI App. Mantém a **chave
privada** (assina as licenças) e a lista de **clientes pagantes**. O app cliente
embute apenas a **chave pública** e verifica as licenças offline; a revalidação
online permite **revogação**.

## Como funciona

- Cada licença é um token assinado (Ed25519) com `{ email, tipo, validade, maquina }`.
- `tipo: "full"` (definitiva, sem validade) ou `tipo: "trial"` (7 dias).
- O app verifica a assinatura com a chave pública embutida — não dá para forjar
  sem a chave privada, que **só existe neste servidor**.

## Setup

```bash
cd license-server
npm install
node gerar-chaves.js          # gera private.key + public.key (1x só!)
```

Copie a **chave pública** impressa e cole em `main.js` do app, na constante
`LICENSE_PUBLIC_KEY`. Depois rode o servidor:

```bash
npm start                     # porta 3030 (ou defina PORT)
```

Publique em um host sempre ligado (VPS, Render, Railway, ou sua hospedagem) e
configure a URL pública no app (constante `DEFAULT_LICENSE_SERVER` em `main.js`,
ou no `config.json` do cliente em `license.serverUrl`). Use **HTTPS** em produção.

## Gerenciar clientes

Edite `clientes.json`:

```json
[
  { "email": "cliente@empresa.com", "ativo": true, "validade": null }
]
```

- **Adicionar cliente**: inclua o e-mail com `"ativo": true`.
- **Revogar**: mude para `"ativo": false` (vale na próxima revalidação do app).
- **Licença definitiva com prazo**: defina `"validade"` como uma data ISO
  (`"2027-01-01T00:00:00.000Z"`); `null` = sem expiração.

O arquivo é lido a cada requisição — não precisa reiniciar o servidor.

## Endpoints

| Método | Rota       | Corpo                | Resposta                          |
|--------|------------|----------------------|-----------------------------------|
| POST   | `/ativar`  | `{ email, maquina }` | `{ success, token, license }`     |
| POST   | `/trial`   | `{ email, maquina }` | `{ success, token, license }`     |
| POST   | `/validar` | `{ token }`          | `{ valido, motivo? }`             |
| GET    | `/health`  | —                    | `{ ok: true }`                    |

## Arquivos

- `private.key` — chave privada (gitignored). **Nunca** versione nem distribua.
- `public.key` — chave pública (cópia da que vai no app).
- `clientes.json` — base de clientes pagantes.
- `trials.json` — trials já emitidos (gerado automaticamente; gitignored).

Faça **backup do `private.key`**: perdê-lo invalida todas as licenças emitidas.
