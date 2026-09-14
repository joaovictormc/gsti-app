# Servidor de Licenças — GSTI App (v2)

Emite e valida as licenças do GSTI App. Guarda as **chaves privadas** (assinam
as licenças) e o **banco de licenças**. O app embute só as **chaves públicas**
(`license-config.js`) e verifica as licenças offline; a revalidação online aplica
revogação, suspensão e renovação.

## Como funciona

- O cliente recebe uma **chave de licença** `GSTI-XXXX-XXXX-XXXX-XXXX` e ativa no app.
- Cada ativação ocupa uma vaga de **computador** (`max_maquinas`, padrão 1). O
  cliente libera a vaga em *Configurações → Licença → Transferir*.
- O servidor devolve um **token assinado (Ed25519)** com `kid` (id da chave),
  plano, validade, computador e `revalidarAte` (janela offline, padrão 30 dias).
- A cada revalidação o app recebe um token renovado. Sem revalidar dentro da
  janela, o app pede conexão.
- **Trial**: 7 dias, uma vez por e-mail e por computador.

## Requisitos

- **Node.js 22.13 ou superior** (usa o SQLite nativo `node:sqlite`, sem compilar nada).
- Express (única dependência).

## Instalação

```bash
cd license-server
npm ci --omit=dev
node gerar-chaves.js           # cria data/keys/<data>.key e imprime a chave pública
chmod 600 data/keys/*.key
```

Cole o trecho impresso em `publicKeys` no **`license-config.js`** (raiz do app),
ajuste `serverUrl` e gere uma build nova. Depois:

```bash
npm start                      # porta 3030
```

### systemd (Ubuntu)

```ini
[Unit]
Description=Servidor de licencas GSTI
After=network.target

[Service]
User=SEU_USUARIO
WorkingDirectory=/caminho/gsti-app/license-server
ExecStart=/usr/bin/node server.js
Environment=PORT=3030
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--disable-warning=ExperimentalWarning
Restart=always

[Install]
WantedBy=multi-user.target
```

### Variáveis de ambiente

| Variável | Padrão | Uso |
|----------|--------|-----|
| `PORT` / `HOST` | `3030` / `0.0.0.0` | Onde escutar |
| `DATA_DIR` | `./data` | Banco (`licencas.db`) e chaves (`keys/`) |
| `TRIAL_DIAS` | `7` | Duração do teste |
| `REVALIDAR_DIAS` | `30` | Janela offline do app |
| `MAX_MAQUINAS_PADRAO` | `1` | Computadores por licença nova |
| `ACTIVE_KID` | mais recente | Força a chave que assina novos tokens |
| `TRUST_PROXY` | — | Defina (ex.: `loopback`) atrás de proxy/túnel, para o rate limit ver o IP real |

## Administração

```bash
node admin.js --help

# Vender / cortesia
node admin.js emitir --email cliente@empresa.com --nome "Empresa X" --plano anual --dias 365
node admin.js emitir --email amigo@x.com --plano cortesia --maquinas 2          # sem expiração

node admin.js listar [--email parte-do-email]
node admin.js ver <ref>                       # detalhes + computadores
node admin.js estender <ref> --dias 365       # renovação
node admin.js suspender <ref> --motivo "Pagamento em atraso"
node admin.js reativar <ref>
node admin.js revogar <ref> --motivo "Estorno"
node admin.js maquinas <ref> 3                # novo limite de computadores
node admin.js desativar-maquina <ativacaoId>  # libera vaga (cliente perdeu o PC)
node admin.js trials / liberar-trial --email x@y.com
node admin.js importar-clientes clientes.json # migra a base da v1
node admin.js auditoria
```

`<ref>` é a chave completa ou o início do id mostrado em `listar`. A chave só é
exibida na emissão (o banco guarda apenas o hash) — envie ao cliente na hora.

Pode rodar com o servidor ligado.

## Endpoints

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/v2/ativar` | `{ chave, maquinaId, nomeMaquina, appVersao }` | `{ success, token, detalhes }` |
| POST | `/v2/validar` | `{ token }` | `{ valido, token?, detalhes?, motivo? }` |
| POST | `/v2/desativar` | `{ token }` | `{ success }` |
| POST | `/v2/trial` | `{ email, maquinaId }` | `{ success, token }` |
| GET | `/health` | — | `{ ok, versao, kids }` |

As rotas da v1 (`/ativar`, `/trial`, `/validar`) respondem **410** avisando que
o app está desatualizado. Há rate limit por IP em todas as rotas `/v2`.

## Rotação de chaves

1. `node gerar-chaves.js` (gera um novo `kid`; a chave antiga continua válida).
2. Adicione a nova chave pública em `license-config.js`, **mantendo a antiga**, e
   publique a build nova.
3. Reinicie o servidor: novos tokens passam a usar a chave nova, e os apps
   atualizados trocam o token na próxima revalidação.
4. **Chave vazada:** apague `data/keys/<kid>.key`, remova-a do `license-config.js`
   e publique a build — tokens com essa chave deixam de valer.

`node gerar-chaves.js --publicas` reimprime as chaves públicas existentes.

## Backup

Faça backup de **`data/`** inteiro (chaves + `licencas.db`) em local seguro e
separado. Perder as chaves invalida as licenças; perder o banco perde a base
de clientes. Para cópia consistente com o servidor ligado:

```bash
sqlite3 data/licencas.db ".backup data/backup-$(date +%F).db"
```

## Segurança

- `data/`, `*.key` e `*.pem` estão no `.gitignore`, e o hook `.githooks/pre-commit`
  bloqueia commits com chaves privadas.
- Nunca coloque chaves privadas no app nem no repositório.
