# GSTI App — Checklist do desenvolvedor antes de exportar o `.exe`

Passo a passo para gerar uma build **íntegra e pronta para distribuição** (release no
GitHub). Voltado ao **desenvolvedor/vendedor** — não ao cliente final. Para o fluxo do
cliente, veja [INSTALACAO-E-ATIVACAO.md](./INSTALACAO-E-ATIVACAO.md).

> Marque cada item antes de rodar `npm run dist:win`.

---

## 1. Versão e metadados

- [ ] **Atualizar a versão** em `package.json` (`version`) e registrar as mudanças no
  [`CHANGELOG.md`](../CHANGELOG.md).
- [ ] Conferir `productName` ("GSTI App - Gestão de Serviços de TI") e `appId`
  (`com.joaovmc.gstiapp`).
- [ ] Confirmar os recursos de marca do instalador em `build_resources/`:
  - `icon.ico` (ícone do app/instalador no Windows);
  - `LICENSE.txt` (termo exibido pelo NSIS — `nsis.license`).

---

## 2. Licenciamento (crítico)

> Detalhes em [`license-server/README.md`](../license-server/README.md).

- [ ] **Chave de assinatura gerada no servidor** (`node gerar-chaves.js`), com a
  chave pública colada em `publicKeys` no **`license-config.js`**.
- [ ] Conferir: `curl <servidor>/health` lista em `kids` a mesma chave presente no
  `license-config.js` (se não bater, o app mostra "chave não reconhecida").
- [ ] **Backup seguro de `license-server/data/`** (chaves + `licencas.db`).
- [ ] **`serverUrl`** correto no `license-config.js` (HTTPS em produção).
- [ ] Servidor de licenças **ligado e acessível** a partir das máquinas dos clientes.
- [ ] Site e painel publicados em HTTPS (Cloudflare Tunnel ou VPS); *Painel → Sistema* com
  Mercado Pago, webhook e SMTP em "OK".
- [ ] Planos com preços revisados e **ativados** em *Painel → Planos e preços*.
- [ ] Link do instalador preenchido em *Textos e e-mails → Informações gerais*.
- [ ] Compra real de baixo valor testada ponta a ponta (e reembolsada pelo painel).

---

## 3. Segurança do pacote

> Atenção: o build usa **`asar: false`**, então o código JavaScript vai **legível**
> dentro da pasta instalada. Não embuta segredos sensíveis no app.

- [ ] **DevTools desligado em produção** — garantido por `devTools: !app.isPackaged`
  em `createWindow` (`main.js`), pelo carregamento via arquivo quando empacotado e pelos
  atalhos F12/Ctrl+R só fora do pacote. Confirmar que **não há** `openDevTools()` ativo.
- [ ] Confirmar que **`license-server/` e `tests/` NÃO são empacotados** — o array
  `build.files` do `package.json` lista só os arquivos do app (`main.js`, `preload.js`,
  módulos `*.js` da raiz, `script.sql`, `build_resources/icon.ico` e `renderer/dist/**`).
- [ ] Hook de pre-commit ativo (`git config core.hooksPath` → `.githooks`) e
  nenhuma chave privada no repositório.
- [ ] **Instalador não é gerado?** (só `win-unpacked`): ative o *Modo de
  Desenvolvedor* do Windows — o electron-builder precisa criar links simbólicos.

---

## 4. Testes, build do frontend e empacotamento

- [ ] `npm install` na raiz (e em `renderer/`, se necessário).
- [ ] **Testes passando**: `npm test` e `npm run test:e2e` (ver
  [tests/README.md](../tests/README.md)).
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
- [ ] Criar um banco vazio (ex.: `gsti_db`) — as tabelas são criadas pelo app na
  configuração inicial.
- [ ] Ter **internet** no momento da ativação. Apontar para
  [INSTALACAO-E-ATIVACAO.md](./INSTALACAO-E-ATIVACAO.md).

---

## 6. Teste de fumaça (antes de publicar)

Idealmente em uma **máquina limpa** (ou VM):

- [ ] Instalar o `.exe` gerado.
- [ ] Rodar o assistente: **Ativação** (trial ou licença real) → **Banco** (testar
  conexão) → **Admin**.
- [ ] Fazer login, criar/abrir uma **OS**, **gerar um PDF** e **registrar uma nota** na OS
  finalizada.
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

**Suporte:** pelo e-mail de suporte informado no site do produto.
