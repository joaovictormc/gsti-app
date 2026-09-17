# Plataforma GSTI App — licenças, vendas, site e painel

Um único servidor Node que entrega:

| Endereço | O quê |
|----------|-------|
| `/` | Landing page de vendas, termos, privacidade |
| `/checkout/retorno`, `/renovar/:id` | Retorno do Mercado Pago e página de renovação |
| `/cliente` | Área do cliente (acesso por link no e-mail) |
| `/suporte`, `/suporte/chamado/:id` | Abrir chamado e acompanhar (link assinado no e-mail ou sessão da área do cliente) |
| `/admin` | **Painel da equipe** (licenças, clientes, pedidos, preços, textos, equipe) |
| `/v2/*` | API do GSTI App (ativação, validação, transferência, trial) |
| `/webhooks/mercadopago` | Notificações de pagamento |
| `/health` | Verificação de saúde |

Dados ficam em **`data/`** (fora do git): banco SQLite (`licencas.db`), chaves de
assinatura (`keys/`), imagens enviadas (`uploads/`) e `.env`.

**Ambientes**

| Ambiente | Onde | Pagamentos | Acesso |
|----------|------|-----------|--------|
| Homologação | Windows local ou o Ubuntu de testes | Simulador (`scripts/mp-simulado.js`) | `localhost` / Tailscale |
| Produção | VPS com domínio próprio do produto | Mercado Pago real | HTTPS público |

---

## 1. Como funciona a venda

```
Visitante escolhe o plano no site
  → informa nome/e-mail → Mercado Pago (Pix, boleto, cartão | assinatura no cartão)
  → webhook "pagamento aprovado"  (e conciliação a cada 30 min, se o webhook falhar)
  → servidor emite a licença (ou soma 12 meses, se for renovação)
  → e-mail com a chave GSTI-XXXX-XXXX-XXXX-XXXX
  → cliente ativa no app
```

| Plano | Modalidade | Efeito |
|-------|-----------|--------|
| Anual | Pagamento único | Licença de 12 meses; lembretes de renovação 30/7/1 dias antes |
| Anual | Renovação automática | Assinatura anual no cartão; cada cobrança soma 12 meses |
| Vitalícia | Pagamento único | Licença sem expiração |

- **Estorno/chargeback** da compra → licença revogada. Da renovação → os 12 meses são removidos.
- Cancelar a assinatura → a licença vale até o fim do período pago.
- As ofertas são criadas **desativadas**: revise os preços em *Painel → Planos e preços*.

### Venda por módulos

A **base** (clientes, equipamentos, produtos, OS, agenda, garantias, usuários e registro
manual de nota) vem em qualquer plano. Os módulos avançados são escolhidos **por oferta**
em *Painel → Planos e preços*:

| Chave | Módulo | O que libera |
|---|---|---|
| `financeiro` | Financeiro completo | Despesas, receitas avulsas, resumo, projeção, metas, Excel e valores na tela inicial |
| `relatorios` | Relatórios | Todos os relatórios |
| `estoque` | Controle de estoque | Tela de estoque, ajustes e alerta de estoque crítico |
| `perfis` | Perfis e permissões avançadas | Perfil Técnico e tabela de permissões (sem ele valem os padrões) |
| `marca` | Personalização da marca | Logo, fundo e mensagem do login e logo como ícone (o nome da empresa é da base) |
| `automacoes` | Automações | E-mails automáticos e backup automático |

- **Oferta** → módulos que a licença recebe na compra (ofertas novas: só a base).
- **Renovação** por uma oferta com mais módulos **soma** os módulos (nunca remove).
- **Licença** → *Licenças → detalhe → Alterar módulos* (upgrade/cortesia). O app recebe na
  próxima verificação online (ao abrir e a cada 6 h).
- **Teste grátis** → módulos configurados no topo de *Planos e preços* (padrão: todos).
- Licenças anteriores à venda por módulos e tokens sem a lista incluem **todos** os módulos.
- A emissão de nota integrada continua exigindo **assinatura anual ativa** (ou cortesia).
- A lista de módulos existe em `lib/modulos.js`, `/modulos.js` e
  `renderer/src/constants/modulos.js` (o teste `tests/unit/modulos.test.js` confere).

## 2. Papéis da equipe

| Papel | Pode |
|-------|------|
| **Administrador** | Tudo, incluindo equipe, credenciais (Mercado Pago/SMTP), sistema e auditoria |
| **Licenças e clientes** | Ver/editar licenças, clientes, computadores e trials; ver pedidos |
| **Financeiro** | Pedidos, pagamentos, reembolsos, cancelar renovação automática, preços |
| **Conteúdo do site** | Textos da landing, páginas legais e modelos de e-mail |
| **Suporte** | Chamados de suporte (responder, notas internas, situação, responsável); ver clientes e licenças sem alterar |

O papel **Licenças e clientes** também atende chamados.

Uma pessoa pode ter vários papéis. Login com senha (mín. 10 caracteres) e
**verificação em duas etapas** opcional (Minha conta). 5 senhas erradas bloqueiam
por 15 minutos. Toda ação fica na auditoria.

---

## 3. Homologação — testar a landing page e o fluxo de compra

Requisitos: **Node.js 22.13+**.

### 3.1 Preparar (uma vez)

```bash
cd license-server
npm ci                                  # dependências do servidor
npm run build:admin                     # compila o painel
mkdir -p data && cp .env.homologacao.example data/.env
node gerar-chaves.js homologacao        # chave de assinatura de testes
node admin.js criar-usuario --email voce@exemplo.com --nome "Seu Nome" --papeis admin
node admin.js oferta anual-avulso --ativar
node admin.js oferta anual-assinatura --ativar
node admin.js oferta vitalicia-avulso --ativar
```

> No Windows (PowerShell), crie a pasta com `mkdir data` e copie com
> `copy .env.homologacao.example data\.env`.

### 3.2 Rodar (dois terminais)

```bash
node scripts/mp-simulado.js     # terminal 1: simulador do Mercado Pago (porta 3099)
node server.js                  # terminal 2: plataforma (porta 3030)
```

Abra:

| O quê | Endereço |
|-------|----------|
| Landing page | http://localhost:3030 |
| Painel da equipe | http://localhost:3030/admin |
| Área do cliente | http://localhost:3030/cliente |
| Painel do simulador | http://localhost:3099 |

Uma faixa vermelha "Ambiente de homologação" aparece no site e no painel enquanto o
simulador estiver configurado.

### 3.3 Roteiro de avaliação

1. **Landing**: navegue pelas seções, teste no celular (DevTools → modo responsivo)
   e confira textos, planos e FAQ.
2. **Editar textos**: *Painel → Textos e e-mails* → altere o título do topo → recarregue a landing.
3. **Comprar**: clique em *Comprar* num plano → preencha nome/e-mail → no simulador escolha
   *Pagar com Pix* → você volta para "Pagamento confirmado".
4. **E-mail com a chave**: sem SMTP, o e-mail aparece no terminal do servidor
   (copie a chave `GSTI-...`). Ele também fica em *Painel → Sistema*.
5. **Boleto pendente**: compre escolhendo *Gerar boleto* → no painel do simulador clique
   *Aprovar* → o pedido vira "Pago" e a licença é emitida.
6. **Renovação automática**: compre o plano com renovação → *Autorizar* → no painel do
   simulador use *Cobrar próximo ano* e veja a validade somar 12 meses.
7. **Estorno**: no simulador clique *Estornar* (ou reembolse em *Painel → Pedidos*) → a licença é revogada.
8. **Área do cliente**: `/cliente` → informe o e-mail da compra → copie o link do terminal →
   veja licenças, gere nova chave, desvincule computador.
9. **Ativar no app**: aponte o app para este servidor (`serverUrl` no `license-config.js`,
   com a chave pública de `node gerar-chaves.js --publicas`) e ative com a chave recebida.

### 3.4 Homologação no Ubuntu (acesso por Tailscale ou rede local)

Mesmos passos acima, com estes ajustes no `data/.env`:

```ini
HOST=0.0.0.0
PUBLIC_URL=http://joaosrv:3030
```

E ao iniciar o simulador informe o endereço visto pelo navegador:

```bash
SIMULADOR_URL=http://joaosrv:3099 node scripts/mp-simulado.js
```

Libere as portas só para o Tailscale: `sudo ufw allow in on tailscale0 to any port 3030,3099 proto tcp`.
Assim dá para avaliar a landing no celular (app Tailscale ligado) em `http://joaosrv:3030`.

Para manter rodando como serviço, use o systemd da seção 4 (e um segundo serviço
para o simulador, se quiser).

---

## 4. Produção (VPS)

Requisitos: VPS Ubuntu, **Node.js 22.13+**, git, Nginx, domínio próprio do produto
apontando (registro A) para a VPS.

```bash
git clone <repositório> ~/gsti-app && cd ~/gsti-app/license-server
npm ci --omit=dev
npm run build:admin
mkdir -p data && cp .env.example data/.env && chmod 600 data/.env && nano data/.env
node gerar-chaves.js                    # chave de PRODUÇÃO (diferente da de homologação)
chmod 700 data && chmod 600 data/keys/*.key
node admin.js criar-usuario --email voce@seudominio.com.br --nome "Seu Nome" --papeis admin
```

Cole a chave pública em `publicKeys` no **`license-config.js`** (raiz do app), ajuste
`serverUrl` para `https://seudominio.com.br` e gere o instalador.

### systemd

```ini
# /etc/systemd/system/gsti.service
[Unit]
Description=Plataforma GSTI App
After=network-online.target

[Service]
User=gsti
WorkingDirectory=/home/gsti/gsti-app/license-server
EnvironmentFile=/home/gsti/gsti-app/license-server/data/.env
Environment=NODE_OPTIONS=--disable-warning=ExperimentalWarning
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now gsti
curl http://127.0.0.1:3030/health
journalctl -u gsti -f
```

### Nginx + HTTPS

```nginx
# /etc/nginx/sites-available/gsti
server {
    server_name seudominio.com.br www.seudominio.com.br;
    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/gsti /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

No `data/.env`: `HOST=127.0.0.1`, `TRUST_PROXY=loopback`, `PUBLIC_URL=https://seudominio.com.br`.

### Variáveis (lista completa em `.env.example`)

| Variável | Uso |
|----------|-----|
| `PUBLIC_URL` | Endereço público **HTTPS** (e-mails, checkout, webhook) |
| `HOST` / `PORT` | `127.0.0.1` atrás do Nginx |
| `TRUST_PROXY` | `loopback` atrás do Nginx local |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` / `MP_SANDBOX` | Mercado Pago |
| `SMTP_*`, `EMAIL_FROM`, `EMAIL_SUPORTE` | E-mails (padrão: `nao-responda@` e `suporte@` o domínio de `PUBLIC_URL`). Também configurável no painel |
| `TRIAL_DIAS`, `REVALIDAR_DIAS`, `DIAS_ANUAL`, `MAX_MAQUINAS_PADRAO` | Regras de licença |

> **Não** defina `MP_API_BASE` em produção — ele só existe para o simulador.

## 5. Mercado Pago

> **Onde configurar:** *Painel → Sistema → Configurar credenciais* (só Administrador,
> pedindo a senha) **ou** variáveis de ambiente. Quando a variável existe no servidor,
> ela tem prioridade e o painel mostra "definido no servidor" — use isso para travar a
> configuração de produção. Os valores salvos pelo painel ficam cifrados em
> `data/licencas.db` com a chave `data/config.key` (inclua as duas no backup).

1. **Credenciais**: [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → criar aplicação
   (Checkout Pro + Assinaturas) → copiar o *Access Token* para `MP_ACCESS_TOKEN`.
2. **Webhook**: na aplicação → *Webhooks* → URL `https://seudominio.com.br/webhooks/mercadopago`,
   eventos **Pagamentos** e **Planos e assinaturas** → copie a *assinatura secreta* para
   `MP_WEBHOOK_SECRET` (ou para o campo correspondente no painel).
3. **Teste com o Mercado Pago real** (antes de abrir as vendas): credenciais e **contas de
   teste** (comprador e vendedor) com `MP_SANDBOX=true`. Assinaturas exigem que o
   e-mail do comprador seja o da conta de teste compradora. Esse teste precisa de URL
   HTTPS pública (a VPS) para receber webhooks.
4. Em *Painel → Sistema* confira: Mercado Pago, webhook e SMTP em "OK".
5. Faça uma compra real de baixo valor antes de divulgar (e reembolse pelo painel).

## 6. Administração pela linha de comando

Tudo do painel também existe no CLI (útil em emergência):

```bash
node admin.js --help
node admin.js emitir --email cliente@exemplo.com --plano anual --dias 365
node admin.js listar --email cliente
node admin.js ofertas
node admin.js oferta anual-avulso --preco 497,00 --ativar
node admin.js suspender <ref> --motivo "Pagamento em atraso"
node admin.js redefinir-senha --email pessoa@exemplo.com
node admin.js resetar-2fa --email pessoa@exemplo.com
node admin.js publicar-atualizacao dist_electron   # nova versão do app
```

### Atualizações do app

O servidor distribui as novas versões do app (electron-updater). O app consulta
`/atualizacoes/win/latest.yml` ao abrir e a cada 6 h enviando o token da licença; só
**licenças ativas e não vencidas** (ou teste no prazo) baixam — as demais recebem 401/403.

```bash
# na máquina de build: versão nova no package.json + seção no CHANGELOG.md
npm run dist:win          # gera dist_electron/latest.yml, o instalador e o .blockmap
# copie esses três arquivos para o servidor e publique:
node admin.js publicar-atualizacao /caminho/dist_electron
node admin.js atualizacao # versão publicada
```

- Os arquivos ficam em `data/atualizacoes/win` (a versão atual e a anterior). O instalador é
  conferido pelo sha512 do `latest.yml`, que é trocado por último.
- As **notas da versão** vêm da seção da versão no `CHANGELOG.md`
  (`scripts/notas-da-versao.js`, rodado pelo `dist:win`) e aparecem no aviso do app.
- O app baixa em segundo plano e instala ao reiniciar ou fechar. *Painel → Sistema* mostra a
  versão publicada.
- O endereço é o `serverUrl` do app (`license-config.js` ou `config.json`); a URL em
  `build.publish` no `package.json` é só referência.
- Enquanto o instalador não tiver assinatura digital, o Windows pode exibir o SmartScreen na
  instalação manual; a atualização automática não passa por ele.

### Suporte

Chamados chegam por três caminhos: página **/suporte** do site (qualquer pessoa), **área do
cliente** e botão **Suporte** do app (identificado pelo token da licença, com dados técnicos
e captura da tela opcionais). A equipe atende em *Painel → Suporte*.

- **Situações**: Aberto → Em andamento → Aguardando cliente → Resolvido → Fechado. Resposta
  da equipe muda para "Aguardando cliente" (ou a situação escolhida); resposta do cliente
  reabre. Chamados *aguardando cliente* ou *resolvidos* sem novidade por 7 dias fecham
  sozinhos (tarefa periódica).
- **Notas internas** e mudanças de situação/prioridade/responsável não aparecem ao cliente.
- **E-mails** (editáveis em *Textos e e-mails*): *chamado aberto* e *nova resposta* para o
  cliente; *aviso para a equipe* no endereço **EMAIL_SUPORTE** a cada chamado novo ou
  mensagem do cliente.
- **Acesso do cliente**: link com assinatura (HMAC com `data/config.key`) enviado por e-mail,
  ou sessão da área do cliente com o mesmo e-mail. Sem acesso, a API responde 404.
- **Anexos**: PNG, JPG, WebP, GIF, PDF e texto (.txt/.log), até 5 por mensagem e 5 MB cada,
  tipo conferido pelos bytes; ficam em `data/suporte/<nº>` e são servidos com CSP restrita
  (PDF e texto sempre como download).
- **Proteções**: limite de chamados por IP e por e-mail, campo invisível contra robôs.

## 7. Chaves de assinatura

- Homologação e produção usam **chaves diferentes**; a build do app de produção deve
  conter só a chave pública de produção.
- `node gerar-chaves.js` cria um novo `kid`; a mais recente assina os novos tokens,
  as antigas continuam validando.
- Para trocar: gere a nova, **adicione** a pública no `license-config.js` (mantendo a
  antiga), publique o app, reinicie o servidor.
- **Chave vazada**: apague `data/keys/<kid>.key`, remova-a do `license-config.js` e
  publique o app.
- O hook `.githooks/pre-commit` bloqueia commits com chaves privadas.

## 8. Backup (produção)

Copie **`data/`** inteira diariamente para fora da VPS (cifrada). Instale o `sqlite3` (`sudo apt install sqlite3`):

```bash
sqlite3 data/licencas.db ".backup /caminho/backup/licencas-$(date +%F).db"
tar czf /caminho/backup/gsti-data-$(date +%F).tgz -C data keys uploads suporte .env config.key
# data/atualizacoes não precisa de backup: basta publicar a versão de novo
```

Perder `keys/` invalida as licenças; perder o banco perde clientes e pedidos; perder
`config.key` torna ilegíveis as credenciais salvas pelo painel (basta cadastrá-las de novo).

## 9. Desenvolvimento do painel

```bash
node server.js                               # plataforma em http://localhost:3030
cd admin-ui && npm install && npm run dev    # painel com recarga em http://localhost:5174/admin
```

## 10. API do aplicativo

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/v2/ativar` | `{ chave, maquinaId, nomeMaquina, appVersao }` | `{ success, token, detalhes }` (token e detalhes trazem `recursos` e `modulos`) |
| POST | `/v2/validar` | `{ token }` | `{ valido, token?, detalhes?, motivo? }` |
| POST | `/v2/desativar` | `{ token }` | `{ success }` |
| POST | `/v2/trial` | `{ email, maquinaId }` | `{ success, token }` |
| POST | `/v2/suporte/chamados` | cabeçalho `x-gsti-licenca`; `{ categoria, assunto, mensagem, email?, nome?, dadosTecnicos? }` | `{ success, numero, mensagemId, token, link }` (anexos: `POST /api/suporte/chamados/:id/mensagens/:mensagemId/anexos?t=token`) |
| GET | `/v2/suporte/chamados` | cabeçalho `x-gsti-licenca` | `{ success, itens: [{ numero, assunto, status, atualizadoEm, link }] }` |
| GET | `/health` | — | `{ ok, versao, kids }` |
