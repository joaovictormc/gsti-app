# GSTI App — Checklist do desenvolvedor antes de exportar o `.exe`

Passo a passo para gerar uma build **íntegra e pronta para distribuição** (release no
GitHub). Voltado ao **desenvolvedor/vendedor** — não ao cliente final. Para o fluxo do
cliente, veja [INSTALACAO-E-ATIVACAO.md](./INSTALACAO-E-ATIVACAO.md).

> Marque cada item antes de rodar `npm run dist:win`.

---

## 1. Versão e metadados

- [ ] **Atualizar a versão** em `package.json` (`version`). Hoje está em `1.0.0` — ver
  sugestão de bump em [EVOLUCAO-v1-PARA-ATUAL.md](./EVOLUCAO-v1-PARA-ATUAL.md#5-sugestão-de-versionamento).
- [ ] Conferir `productName` ("GSTI App - Gestão de Serviços de TI") e `appId`
  (`com.joaovmc.gstiapp`).
- [ ] Confirmar os recursos de marca do instalador em `build_resources/`:
  - `icon.ico` (ícone do app/instalador no Windows);
  - `LICENSE.txt` (termo exibido pelo NSIS — `nsis.license`).

---

## 2. Licenciamento (crítico)

> As chaves embutidas no repositório são **de teste**. Distribuir sem regenerar
> compromete a segurança do licenciamento.

- [ ] **Regenerar as chaves Ed25519** no servidor: `node gerar-chaves.js` em
  `license-server/`. Isso cria o `private.key` (fica **só no servidor**) e imprime a
  **chave pública**.
- [ ] **Colar a nova chave pública** em `LICENSE_PUBLIC_KEY` no `main.js` (≈ linha 48).
- [ ] **Fazer backup seguro do `private.key`** — perdê-lo **invalida todas as licenças**
  já emitidas.
- [ ] Definir o **`DEFAULT_LICENSE_SERVER`** real, com **HTTPS**, no `main.js`
  (≈ linha 53) — atualmente `https://licenca.labapp.com.br`.
- [ ] Garantir o **servidor de licenças hospedado e sempre ligado** (responde em
  `/ativar`, `/trial`, `/validar`, `/health`).
- [ ] Confirmar que o **e-mail do cliente** está cadastrado em `clientes.json`
  (`"ativo": true`) no servidor — fluxo de contratação atual.

---

## 3. Segurança do pacote

> Atenção: o build usa **`asar: false`**, então o código JavaScript vai **legível**
> dentro da pasta instalada. Não embuta segredos sensíveis no app.

- [ ] **DevTools desligado em produção** — já garantido por `devTools: !app.isPackaged`
  (`main.js:3791`) e pelo carregamento via arquivo (não `localhost`) quando empacotado
  (`main.js:3803`). Confirmar que **não há** `openDevTools()` ativo.
- [ ] Ciente de que as **credenciais do banco ficam em texto puro** no `config.json`
  (dívida técnica registrada em [PROXIMA-VERSAO.md](./PROXIMA-VERSAO.md)).
- [ ] Confirmar que **`license-server/` NÃO é empacotado** — ele não está no array
  `build.files` do `package.json` (apenas `main.js`, `preload.js`, `pdf-worker.js`,
  `package.json` e `renderer/dist/**`).
- [ ] Confirmar que `private.key`, `public.key` e `trials.json` estão no `.gitignore`
  do servidor (não vão para o repositório nem para a release).

---

## 4. Build do frontend e empacotamento

- [ ] `npm install` na raiz (e em `renderer/`, se necessário).
- [ ] Garantir que o **frontend é compilado** — `npm run dist:win` já roda `build`
  antes (gera `renderer/dist/**`, que é o que entra no pacote).
- [ ] Gerar o instalador:
  ```bash
  npm run dist:win
  ```
  Saída: instalador **NSIS x64** em `dist_electron/`.
- [ ] (Opcional) `dist:mac` / `dist:linux` se for distribuir para essas plataformas.

---

## 5. Pré-requisitos do cliente (documentar na release)

O instalador **não** instala o banco. Deixar claro nas instruções da release que o
cliente precisa:

- [ ] Ter **PostgreSQL** instalado (Windows 10/11 x64).
- [ ] Criar o banco (ex.: `gsti_db`) e executar o **`script.sql`** uma vez (o schema
  base **não** é criado automaticamente; apenas as **migrações incrementais** rodam na
  primeira conexão).
- [ ] Ter **internet** no momento da ativação. Apontar para
  [INSTALACAO-E-ATIVACAO.md](./INSTALACAO-E-ATIVACAO.md).

---

## 6. Teste de fumaça (antes de publicar)

Idealmente em uma **máquina limpa** (ou VM):

- [ ] Instalar o `.exe` gerado.
- [ ] Rodar o assistente: **Ativação** (trial ou licença real) → **Banco** (testar
  conexão) → **Admin**.
- [ ] Fazer login, criar/abrir uma **OS** e **gerar um PDF**.
- [ ] Confirmar **ativação online** e **revalidação** (reabrir o app com internet).
- [ ] Verificar **status da licença** em Configurações → Licenciamento.

---

## 7. Publicação no GitHub Release

- [ ] Criar **tag** igual à versão do `package.json` (ex.: `v2.0.0`).
- [ ] Anexar o **instalador** de `dist_electron/`.
- [ ] Usar [EVOLUCAO-v1-PARA-ATUAL.md](./EVOLUCAO-v1-PARA-ATUAL.md) como base das
  *release notes*.
- [ ] Incluir, no corpo da release, os **pré-requisitos do cliente** (seção 5) e o link
  para o guia de instalação/ativação.
- [ ] **Não** anexar `license-server/`, `private.key` ou qualquer chave/segredo.

---

**Suporte:** suporte@labapp.com.br
