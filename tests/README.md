# Testes do GSTI App

Dois níveis de teste:

| Comando | O que roda | Tempo |
|---|---|---|
| `npm test` | **Unitários** (`tests/unit`): certificado A1, cofre de senhas, controle de acesso, cliente da Notaas (com simulador) e regras de recurso das licenças | segundos |
| `npm run test:e2e` | **Ponta a ponta** (`tests/e2e`): compila a interface e abre o app Electron de verdade, com pasta de dados isolada, banco temporário e licença simulada | ~8 min |

Rode os dois antes de gerar uma versão.

## Pré-requisitos

- Node.js 22.13+ (o servidor de licenças usa `node:sqlite`) e `npm install` feito.
- **PostgreSQL local** (127.0.0.1) com um usuário que possa criar e apagar bancos. As suítes
  criam bancos `gsti_e2e_*` e os apagam ao terminar; nenhum banco existente é tocado.

Credenciais do PostgreSQL de teste, nesta ordem:

1. `GSTI_TEST_PG_URL=postgres://usuario:senha@127.0.0.1:5432`
2. `PGUSER` / `PGPASSWORD` (e `PGHOST` / `PGPORT`)
3. se nada for definido: a conexão do GSTI App instalado neste computador (apenas usuário e
   senha, sempre com host 127.0.0.1)

```powershell
$env:GSTI_TEST_PG_URL = "postgres://postgres:minhasenha@127.0.0.1:5432"
npm run test:e2e
```

## Rodar só algumas suítes

```bash
npm run build
node tests/e2e/rodar.js fiscal notaas
```

| Suíte | Cobre |
|---|---|
| `seguranca` (3 fases) | permissões no processo principal, sessão, senhas cifradas (migração e arquivo de outro computador), schema automático, bloqueio do código de redefinição |
| `perfis` | Admin, Funcionário e Técnico; tabela de permissões; "só OS atribuídas"; custo oculto e preservado; migração do papel Técnico |
| `marca` | nome, logo, fundo e mensagem do login; crédito do desenvolvedor; senha do SMTP mantida ao salvar |
| `barra` | barra de título própria, layout abaixo da barra, tema dos botões nativos, atalhos |
| `fiscal` | aceite de responsabilidade, catálogo, credenciais cifradas, certificado A1, registro manual de nota na OS |
| `notaas` | emissão de NFS-e pela Notaas usando o simulador `tests/lib/notaas-simulado.js` (nenhuma chamada à Notaas real) |

## Capturas de tela

Com `GSTI_TEST_CAPTURAS=1` as suítes gravam PNGs em `tests/e2e/saida/<suíte>/` (fora do Git).
Na suíte `barra` isso também mostra a janela por alguns segundos para capturar os botões
nativos.

## Escrevendo uma suíte nova

```js
// tests/e2e/suites/exemplo.e2e.js
const { executarSuite } = require("../lib/ambiente");

async function roteiro({ api, ok, sql, criarAdmin, entrar }) {
  ok((await criarAdmin()).success, "configuração inicial");
  await entrar("admin");
  const r = await api("getCustomers()");
  ok(Array.isArray(r), "lista clientes");
}

executarSuite({ nome: "exemplo", roteiro });
```

Depois registre o nome em `SUITES` no `tests/e2e/rodar.js`.

- `api("metodo(args)")` chama `window.api` na janela (o mesmo caminho da interface, passando
  pelo controle de acesso).
- `licenca.recursos` pode ser alterado durante o roteiro (ex.: `["emissorFiscal"]`).
- `arquivos.proximo = caminho` define o arquivo "escolhido" no próximo diálogo; `abertos`
  lista os arquivos que o app tentou abrir.
- Lembrete: todo canal IPC novo precisa de política em `controle-acesso.js` — o app nem
  inicia sem ela, e as suítes quebram logo no começo.
