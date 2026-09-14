# Plataforma GSTI App — licenças, vendas, site e painel

Um único servidor Node que entrega:

| Endereço | O quê |
|----------|-------|
| `/` | Landing page de vendas, termos, privacidade |
| `/checkout/retorno`, `/renovar/:id` | Retorno do Mercado Pago e página de renovação |
| `/cliente` | Área do cliente (acesso por link no e-mail) |
| `/admin` | **Painel da equipe** (licenças, clientes, pedidos, preços, textos, equipe) |
| `/v2/*` | API do GSTI App (ativação, validação, transferência, trial) |
| `/webhooks/mercadopago` | Notificações de pagamento |
| `/health` | Verificação de saúde |

Dados ficam em **`data/`** (fora do git): banco SQLite (`licencas.db`), chaves de
assinatura (`keys/`), imagens enviadas (`uploads/`) e, em desenvolvimento, `.env`.

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

## 2. Papéis da equipe

| Papel | Pode |
|-------|------|
| **Administrador** | Tudo, incluindo equipe, sistema e auditoria |
| **Licenças e clientes** | Ver/editar licenças, clientes, computadores e trials; ver pedidos |
| **Financeiro** | Pedidos, pagamentos, reembolsos, cancelar renovação automática, preços |
| **Conteúdo do site** | Textos da landing, páginas legais e modelos de e-mail |

Uma pessoa pode ter vários papéis. Login com senha (mín. 10 caracteres) e
**verificação em duas etapas** opcional (Minha conta). 5 senhas erradas bloqueiam
por 15 minutos. Toda ação fica na auditoria.

---

## 3. Instalação (Ubuntu)

Requisitos: **Node.js 22.13+** (SQLite nativo) e git.

```bash
cd ~/gsti-app && git pull
cd license-server
npm ci --omit=dev           # servidor
npm run build:admin         # compila o painel (public/admin)
node gerar-chaves.js        # 1x: cria data/keys/<data>.key e imprime a chave pública
chmod 700 data && chmod 600 data/keys/*.key
```

Cole a chave pública impressa em `publicKeys` no **`license-config.js`** (raiz do
app) e gere o instalador do app.

### Configuração

```bash
cp .env.example data/.env && chmod 600 data/.env && nano data/.env
```

Variáveis principais (lista completa em `.env.example`):

| Variável | Uso |
|----------|-----|
| `PUBLIC_URL` | Endereço público **HTTPS** (e-mails, checkout, webhook) |
| `HOST` / `PORT` | Use `127.0.0.1` atrás do túnel |
| `TRUST_PROXY` | `loopback` atrás do Cloudflare Tunnel/Nginx local |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` / `MP_SANDBOX` | Mercado Pago |
| `SMTP_*`, `EMAIL_FROM`, `EMAIL_SUPORTE` | Envio de e-mails (sem SMTP, os e-mails só aparecem no log) |
| `TRIAL_DIAS`, `REVALIDAR_DIAS`, `DIAS_ANUAL`, `MAX_MAQUINAS_PADRAO` | Regras de licença |

### Primeiro usuário do painel

```bash
node admin.js criar-usuario --email voce@labapp.com.br --nome "Seu Nome" --papeis admin
```

Entre em `https://SEU_DOMINIO/admin` com a senha temporária, troque-a em
*Minha conta* e ative a verificação em duas etapas. Convide o restante da equipe
em *Equipe*.

### systemd

```ini
# /etc/systemd/system/gsti-license.service
[Unit]
Description=Plataforma GSTI App
After=network-online.target

[Service]
User=joaosrv
WorkingDirectory=/home/joaosrv/gsti-app/license-server
EnvironmentFile=/home/joaosrv/gsti-app/license-server/data/.env
Environment=NODE_OPTIONS=--disable-warning=ExperimentalWarning
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl restart gsti-license
curl http://127.0.0.1:3030/health
journalctl -u gsti-license -f
```

## 4. Publicar na internet sem abrir portas (Cloudflare Tunnel)

O Mercado Pago precisa alcançar o webhook por **HTTPS público**; o Tailscale
privado não serve para isso. Com o domínio `labapp.com.br` na Cloudflare:

```bash
# instalar
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login                      # autoriza o domínio no navegador
cloudflared tunnel create gsti
cloudflared tunnel route dns gsti gsti.labapp.com.br
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: gsti
credentials-file: /home/joaosrv/.cloudflared/<ID-DO-TUNEL>.json
ingress:
  - hostname: gsti.labapp.com.br
    service: http://127.0.0.1:3030
  - service: http_status:404
```

```bash
sudo cloudflared --config /home/joaosrv/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
```

Depois: `PUBLIC_URL=https://gsti.labapp.com.br`, `HOST=127.0.0.1`,
`TRUST_PROXY=loopback`, reinicie o serviço e ajuste `serverUrl` no
`license-config.js` do app para o mesmo endereço.

> Com o servidor em casa, uma queda de energia/internet derruba o site e atrasa
> ativações novas (apps já ativados seguem funcionando por até 30 dias). Ao
> crescer, mova para uma VPS — nada no código muda.

## 5. Mercado Pago

1. **Credenciais**: [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → criar aplicação
   (Checkout Pro + Assinaturas) → copiar o *Access Token* para `MP_ACCESS_TOKEN`.
2. **Webhook**: na aplicação → *Webhooks* → URL `https://SEU_DOMINIO/webhooks/mercadopago`,
   eventos **Pagamentos** e **Planos e assinaturas** → copie a *assinatura secreta*
   para `MP_WEBHOOK_SECRET`.
3. **Testes**: use credenciais e **contas de teste** (comprador e vendedor) do painel
   do Mercado Pago com `MP_SANDBOX=true`. Assinaturas exigem que o e-mail do
   comprador seja o da conta de teste compradora.
4. Em *Painel → Sistema* confira: Mercado Pago, webhook e SMTP em "OK".
5. Faça uma compra real de baixo valor antes de divulgar (e reembolse pelo painel).

## 6. Administração pela linha de comando

Tudo do painel também existe no CLI (útil em emergência):

```bash
node admin.js --help
node admin.js emitir --email cliente@x.com --plano anual --dias 365
node admin.js listar --email cliente
node admin.js suspender <ref> --motivo "Pagamento em atraso"
node admin.js redefinir-senha --email pessoa@labapp.com.br
node admin.js resetar-2fa --email pessoa@labapp.com.br
```

## 7. Chaves de assinatura

- `node gerar-chaves.js` cria um novo `kid`; a mais recente assina os novos tokens,
  as antigas continuam validando.
- Para trocar: gere a nova, **adicione** a pública no `license-config.js` (mantendo a
  antiga), publique o app, reinicie o servidor.
- **Chave vazada**: apague `data/keys/<kid>.key`, remova-a do `license-config.js` e
  publique o app.
- O hook `.githooks/pre-commit` bloqueia commits com chaves privadas.

## 8. Backup

Copie **`data/`** inteira diariamente para outro lugar (cifrada). Instale o `sqlite3` (`sudo apt install sqlite3`):

```bash
sqlite3 data/licencas.db ".backup /caminho/backup/licencas-$(date +%F).db"
tar czf /caminho/backup/gsti-data-$(date +%F).tgz -C data keys uploads .env
```

Perder `keys/` invalida as licenças; perder o banco perde clientes e pedidos.

## 9. Desenvolvimento

```bash
cp .env.example data/.env   # ajuste: HOST=0.0.0.0, PUBLIC_URL=http://localhost:3030, JOBS=0 se quiser
node gerar-chaves.js dev
node server.js              # site em http://localhost:3030
cd admin-ui && npm install && npm run dev   # painel com recarga em http://localhost:5174/admin
```

## 10. API do aplicativo

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/v2/ativar` | `{ chave, maquinaId, nomeMaquina, appVersao }` | `{ success, token, detalhes }` |
| POST | `/v2/validar` | `{ token }` | `{ valido, token?, detalhes?, motivo? }` |
| POST | `/v2/desativar` | `{ token }` | `{ success }` |
| POST | `/v2/trial` | `{ email, maquinaId }` | `{ success, token }` |
| GET | `/health` | — | `{ ok, versao, kids }` |
