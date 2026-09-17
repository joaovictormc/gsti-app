# Emissão de nota fiscal no GSTI App — pesquisa e recomendação

Pesquisa feita em 16/09/2026. Objetivo: emitir nota a partir de uma OS finalizada.
Comparativo de emissores na seção 4; estratégia definida na seção 5.
Regras fiscais mudam com frequência e dependem do município, do estado e do regime da
empresa: **valide o enquadramento de cada cliente com o contador** antes de liberar a
funcionalidade.

---

## 1. Que nota uma assistência técnica emite

| Situação | Documento | Onde é autorizado |
|---|---|---|
| Serviço (mão de obra, formatação, reparo) | **NFS-e** | Município — hoje pelo **padrão nacional** |
| Venda de peça/produto para empresa | **NF-e** (modelo 55) | SEFAZ do estado |
| Venda de peça/produto para consumidor final | **NFC-e** (modelo 65) ou NF-e | SEFAZ do estado |

OS com serviço **e** peças pode exigir duas notas (NFS-e + NF-e/NFC-e). A forma correta
depende do município, do estado e do regime — decisão do contador de cada cliente.

---

## 2. Opções gratuitas oficiais

### 2.1 NFS-e — Emissor Nacional (gratuito, com API)

- Todos os municípios foram obrigados a aderir ao padrão nacional até 01/01/2026
  (LC 214/2025).
- **ME e EPP do Simples Nacional** que prestam serviço sujeito a ISS são obrigadas a
  emitir **pelo Emissor Nacional desde 01/09/2026** (Resolução CGSN nº 189/2026). MEI já
  era obrigado desde 09/2023.
- Canais permitidos: **portal web** (nfse.gov.br/EmissorNacional) ou **sistema próprio
  integrado à API da SEFIN Nacional** — é o caso do GSTI App.
- Ambiente de testes: **Produção Restrita**.

Como a API funciona:

| Item | Detalhe |
|---|---|
| Autenticação | mTLS com **certificado ICP-Brasil A1** da empresa (A3 exige token físico; inviável para automação) |
| Envio | **DPS** (Declaração de Prestação de Serviço) em XML **assinado (XMLDSig)**, compactado em GZip e codificado em Base64 dentro de um JSON |
| Resposta | Síncrona: devolve a NFS-e (XML) com chave de acesso de 50 caracteres |
| Operações | `POST /nfse`, `GET /nfse/{chave}`, `GET /dps/{id}`, eventos (cancelamento/substituição) em `/nfse/{chave}/eventos` |
| DANFSe (PDF) | **A API oficial do DANFSe foi descontinuada em 01/07/2026.** O próprio sistema emissor gera o PDF seguindo a Nota Técnica 008/2026 (A4, QR Code, campos iguais ao XML, incluindo IBS/CBS) |
| Parâmetros do município | Alíquotas, códigos de tributação nacional, regimes e retenções consultáveis na API |
| URLs | Produção: `sefin.nfse.gov.br` / `adn.nfse.gov.br` · Testes: `sefin.producaorestrita.nfse.gov.br` / `adn.producaorestrita.nfse.gov.br` (Swagger publicado) |

Custo: **zero por nota**. Esforço: **médio/alto**. É preciso:
- guardar o certificado A1 do cliente no computador, cifrado como as outras senhas;
- montar e assinar o XML da DPS;
- tratar erros de schema, duplicidade (409) e relógio;
- implementar o cancelamento;
- gerar o DANFSe (PDF) conforme a NT 008/2026;
- acompanhar as mudanças de leiaute.

### 2.2 NF-e e NFC-e — não há API gratuita oficial

- O **emissor gratuito da SEFAZ foi descontinuado** (SP e demais estados que usavam o
  programa, a partir de 2017).
- Restam emissores gratuitos **manuais** (ex.: Emissor Sebrae) e o portal de cada SEFAZ,
  sem API para integrar ao app.
- Integrar direto com a SEFAZ significa implementar os webservices SOAP de cada estado,
  assinatura, contingência, CSC da NFC-e, carta de correção, inutilização e as regras de
  cálculo (NCM, CFOP, CST/CSOSN). **Esforço muito alto** para manter sozinho.

---

## 3. Emissor de terceiros — Notaas (notaas.com.br)

O que a documentação pública informa:

| Item | Detalhe |
|---|---|
| Documentos | NFS-e, NF-e e NFC-e |
| API | REST/JSON, chave no cabeçalho `x-api-key`, `Idempotency-Key`, SDK Node.js |
| NFS-e | `POST /emitir`, `POST /cancelar`, `POST /emitir/batch`, `GET /invoices/{id}/status`, `/xml`, `/pdf` |
| NF-e/NFC-e | `POST /nfe/emitir`, `/nfe/cancelar`, carta de correção, status, DANFE e XML |
| Webhooks | Assinados (HMAC-SHA256), com reenvio: `nfse.issued`, `nfse.error`, `nfse.cancelled`, `nfse.documents_ready` |
| Certificado | A1 enviado **uma vez ao painel/API da Notaas**; ela assina e transmite |
| Testes | Sandbox isolado, sem valor fiscal e sem consumir créditos |
| Cobertura NFS-e | Diz atender 3.413 municípios; lista provedores municipais e o "SNNFSE" (Sistema Nacional) |
| Base URL | `https://platform.notaas.com.br/api/v1` |

Planos (site, 09/2026):

| Plano | Mensal | Notas/mês | Nota extra | CNPJs |
|---|---|---|---|---|
| Free | R$ 0 | 50 | R$ 0,50 | 1 |
| Dev | R$ 99 | 500 | R$ 0,25 | 3 |
| SaaS Pro | R$ 249 | 2.000 | R$ 0,15 | ilimitados |
| Enterprise | R$ 749 | 10.000 | R$ 0,09 | ilimitados |

Pontos de atenção:
- **Documentação incompleta** nas páginas públicas: URL do sandbox, envio do certificado
  e campos completos da NFS-e não aparecem. Confirmar criando uma conta de teste.
- **Não fica explícito** se a NFS-e sai pelo Emissor Nacional (obrigatório para ME/EPP do
  Simples) ou pelo sistema da prefeitura. É preciso confirmar com a Notaas para os municípios dos clientes.
- As avaliações/comparativos encontrados são **publicados pela própria Notaas** (blog);
  não achei avaliação independente. Empresa sem histórico público conhecido: avaliar
  estabilidade e contrato (SLA, LGPD, portabilidade dos XML).
- Dados do cliente final (tomador) e o certificado A1 ficam com um terceiro: citar no
  contrato/termos do GSTI App.

**Modelo de uso que se encaixa no GSTI App** (cada cliente é dono da própria instância):
cada assistência cria **a própria conta Notaas**, envia o certificado lá e informa a
chave de API em Configurações. O plano Free (50 notas/mês, 1 CNPJ) atende a maioria das
assistências pequenas, sem custo para nós. O alternativo seria centralizar num plano
SaaS Pro nosso e revender, o que traz custo fixo e responsabilidade fiscal para a plataforma.

---

## 4. Comparativo de emissores com API

Critérios: **robustez** (tempo de mercado, volume, cobertura), **confiabilidade**
(sandbox, webhooks, documentação) e **configuração universal** (NFS-e + NF-e + NFC-e numa
integração só, em qualquer município/estado, com o cliente configurando a própria conta).

Preços e números conforme os sites dos fornecedores em 09/2026; confirmar antes de
contratar.

| # | Emissor | Documentos | Cobertura | Entrada | Pontos fortes | Pontos de atenção |
|---|---|---|---|---|---|---|
| 1 | **Focus NFe** | NFS-e (municipal e **Nacional**), NF-e, NFC-e, CT-e, MDF-e | 3.000+ municípios; município novo em até 15 dias úteis (R$ 199) | Solo **R$ 89,90**/mês (1 CNPJ, 100 notas, R$ 0,10 extra); Retail NFC-e R$ 59,90 | 33 mil empresas e 860 mi de notas (segundo o site); API de empresas; webhooks; documentação pública com NFS-e Nacional; teste de 30 dias | Sem plano gratuito; URL de homologação e envio de certificado a confirmar na documentação detalhada |
| 2 | **PlugNotas** (TecnoSpeed) | NFS-e (incl. Nacional), NF-e, NFC-e, NFCom, MDF-e | NFS-e 2.200+ municípios; NF-e/NFC-e todos os estados | Sob consulta (cobrança mensal por nota emitida) | 20 anos de mercado, 4.100 software houses; sandbox público sem cadastro; idempotência; webhooks | Feita para **software house** (conta do parceiro, multi-CNPJ): melhor para o modelo centralizado; preço não público |
| 3 | **WebmaniaBR** | NF-e, NFC-e, NFS-e (incl. Nacional), CT-e, MDF-e | Nacional (número de municípios não confirmado) | A partir de **R$ 69,90**/mês | Painel + API, SDK npm, webhooks, suporte com contadores | Página de planos bloqueou a consulta; limites por plano a confirmar |
| 4 | **Spedy** | NF-e, NFS-e, NFC-e | Nacional (segundo o site) | Essencial **R$ 79**/mês (200 documentos somados entre os tipos) | Volume compartilhado entre os tipos; webhooks; SDKs | Foco em negócios digitais; histórico/volume não informados |
| 5 | **Notaas** | NFS-e, NF-e, NFC-e | 3.413 municípios (segundo o site) | **Grátis** (50 notas/mês, 1 CNPJ) | Plano gratuito real; sandbox; webhooks assinados | Empresa sem histórico público; documentação com lacunas; comparativos só do próprio blog |
| 6 | NFE.io | NFS-e (páginas de preço não citam NF-e/NFC-e) | — | API só a partir do Growth, **R$ 265**/mês | Integrações prontas (gateways, Zapier/n8n); guarda 11 anos | Não é universal (produto) e caro para assistência pequena |
| 7 | eNotas | NFS-e, NF-e | "Centenas" de prefeituras | Preços não confirmados no site oficial | Desde 2011 | Foco em infoprodutores (Hotmart); API não destacada |
| — | ~~Nuvem Fiscal~~ | — | — | — | — | **Serviço desativado em 31/07/2026** (comunicado de 22/04/2026) — descartar |
| — | Emissor Nacional (direto) | Só NFS-e | Todos os municípios | **Grátis** | Oficial, sem intermediário | Certificado no app, XML assinado, mTLS e **DANFSe gerado por nós** (NT 008/2026) |

### Leitura do comparativo

- **Mais universal para o cliente configurar sozinho:** **Focus NFe**. Cobre os três
  documentos e a NFS-e Nacional, tem o maior histórico público e um plano de 1 CNPJ em que
  cada assistência contrata e configura a própria conta.
- **Mais robusto para um modelo centralizado (revenda):** **PlugNotas**. Faz sentido se no
  futuro a plataforma contratar a emissão e repassar no plano; exige negociação comercial.
- **Menor custo de entrada:** **Notaas** (grátis) e **WebmaniaBR / Spedy** (R$ 70–80).
  Bons como segunda opção, depois de validados em sandbox.
- **Opção sem mensalidade para NFS-e:** Emissor Nacional direto. Fica para depois, porque
  exige gerar o PDF e manter a assinatura do XML.

---

## 5. Estratégia definida

- **Emissores integrados, escolhidos e configurados pelo cliente no app.** Cada provedor é um
  adaptador com as mesmas operações (validar configuração, emitir, consultar, cancelar,
  baixar PDF/XML) e declara os campos de configuração; a tela é gerada a partir disso.
  Não haverá cadastro genérico de "qualquer API".
- **Modo "emito por fora"** disponível para todos: registrar na OS o número, a data, o valor e o
  PDF/XML da nota emitida no portal da prefeitura, no Emissor Nacional ou pelo contador.
- **Credenciais só no app** (cifradas, como as senhas do banco). O portal do cliente não
  guarda chave de API nem certificado.
- **Liberação por plano:** configurar um emissor integrado fica disponível a partir do
  **plano anual com recorrência** (assinatura). A licença passa a carregar esse recurso; o
  modo "emito por fora" continua disponível nos demais planos.
- **Portal do cliente:** catálogo de emissores com guia passo a passo e formulário
  "solicitar outro emissor". Os pedidos formam um ranking no painel admin, que orienta as próximas integrações.
- **Aviso automático (opcional, avançado):** enviar os dados da OS finalizada para uma URL
  (n8n, Zapier, sistema do contador).

### Ordem de implementação sugerida

1. Estrutura de adaptadores + tabela `notas_fiscais` + modo "emito por fora" + recurso
   por plano na licença.
2. Adaptador **Focus NFe** (NFS-e municipal/Nacional; depois NF-e/NFC-e).
3. Adaptador **Notaas** (opção de entrada gratuita).
4. Demais (PlugNotas, WebmaniaBR, Spedy) conforme o ranking de pedidos do portal.
5. Emissor Nacional direto (NFS-e grátis), se houver demanda.

---

## 6. Notaas na prática (integração feita em 16/09/2026)

Verificado com a API real e implementado em `fiscal-notaas.js`:

- **Não há sandbox separado.** A chave `ntaas_` é do projeto; o ambiente
  (Homologação/Produção) é configurado **no projeto, no painel da Notaas**. Para testar
  sem valor fiscal, o projeto precisa estar em Homologação.
- Sem certificado A1 no projeto, `POST /emitir` responde **422 "Nenhum certificado A1
  válido encontrado"** — nenhuma nota é emitida.
- Chave inválida: 401. Invoice inexistente: 404 (um id fora do formato UUID devolve 500).
- Emissão assíncrona: `202 queued` → `GET /invoices/{id}/status` (queued → processing →
  issued | error). PDF/XML respondem 302 para a CDN (o app não repassa a chave no
  redirecionamento).
- Cobertura: `GET /cobertura/cidades?q=<nome>` (busca por **nome**; pelo código IBGE
  retornou vazio). Ex.: Londrina → `SNNFSE Nacional`.
- Cadastro de empresa, certificado e chaves por API existe só com **token de organização**
  (`ntaas_org_`), em `/org/projects`. O GSTI App usa a chave do projeto, criada pelo
  cliente no painel.

## 7. Alternativas para teste (sem burocracia)

- **PlugNotas (TecnoSpeed)** — sandbox **público**, sem cadastro:
  `https://api.sandbox.plugnotas.com.br` com o token fixo
  `2da392a6-79d2-4304-a8b7-959572c7e44d` (confirmado em 09/2026). Respostas simuladas (não
  vão à prefeitura/SEFAZ), NFS-e, NF-e e NFC-e. Bom para desenvolver o adaptador; para
  produção exige contrato comercial.
- **NFE.io** — conta própria com empresa em modo "Development" (sem URL de sandbox; o
  ambiente é da conta). Só NFS-e.
- **WebmaniaBR** — teste gratuito liberado por atendimento (homologação `ambiente=2`).
- **Emissor Nacional (API oficial)** — existe: SEFIN Nacional em **Produção Restrita**
  (`sefin.producaorestrita.nfse.gov.br`), autenticação por **mTLS com o certificado A1** (não
  há chave/token nem cadastro de desenvolvedor), DPS em XML assinado. Exige certificado
  real da empresa e o DANFSe é gerado pelo sistema desde 07/2026.

## 8. Recomendação inicial (antes do comparativo)

**Arquitetura com "provedor de emissão" plugável** (`emissor-fiscal.js`), para não
prender o app a um fornecedor:

1. **Fase 1 — Notaas (NFS-e, depois NF-e/NFC-e).** Menor esforço, sandbox, webhooks e
   cobertura dos três documentos. Cada cliente usa a própria conta e chave.
   - Configurações > Nota fiscal: provedor, chave de API (cifrada), ambiente
     (sandbox/produção), dados fiscais da empresa (CNPJ, inscrição municipal/estadual,
     regime, código IBGE do município), código de tributação e alíquota de ISS padrão.
   - OS finalizada: botão **Emitir NFS-e**, pré-visualização dos dados, emissão, status,
     PDF/XML e cancelamento. Tabela `notas_fiscais` ligada à OS (id externo, chave,
     número, status, valores, motivo de erro, datas).
   - Permissão nova por perfil: "Emitir nota fiscal".
   - Como o app é desktop (sem URL pública para webhook), consultar o status por
     `GET /invoices/{id}/status` após a emissão e ao abrir a OS.
2. **Fase 2 (opcional) — Emissor Nacional direto para NFS-e.** Provedor gratuito sem
   custo por nota, para quem preferir guardar o certificado A1 no próprio computador.
   Validar primeiro na Produção Restrita.
3. **NF-e/NFC-e só via terceiro.** Integração direta com as SEFAZ não compensa.

**Antes de codificar:**
- [ ] Criar conta de teste na Notaas e confirmar: URL do sandbox, envio do certificado,
      campos obrigatórios da NFS-e (inclui CPF de tomador pessoa física?), se a NFS-e sai
      pelo Emissor Nacional e o formato do status/PDF.
- [ ] Listar os municípios dos primeiros clientes e confirmar a cobertura.
- [ ] Validar com um contador: códigos de tributação usuais de assistência técnica,
      alíquota de ISS e quando emitir NF-e/NFC-e para as peças.

---

## Fontes

- [NFS-e e Simples Nacional: obrigatoriedade de emissão através do Emissor Nacional — gov.br/nfse](https://www.gov.br/nfse/pt-br/noticias/nfs-e-e-simples-nacional-obrigatoriedade-de-emissao-atraves-do-emissor-nacional)
- [NFS-e de padrão nacional será obrigatória para optantes do Simples Nacional — Receita Federal](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/abril/nfs-e-de-padrao-nacional-sera-obrigatoria-para-optantes-do-simples-nacional)
- [APIs — Produção Restrita e Produção — gov.br/nfse](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao)
- [Manual do contribuinte — Emissor Público API (v1.2, out/2025) — gov.br/nfse](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf)
- [NFS-e Nacional: obrigatoriedade, prazos e impacto contábil — Contábeis](https://www.contabeis.com.br/artigos/77741/nfs-e-nacional-obrigatoriedade-prazos-e-impacto-contabil/)
- [API NFS-e Nacional: guia para devs e ERPs — Nota Gateway](https://notagateway.com.br/blog/api-nfse-nacional/)
- [Descontinuidade do Emissor Gratuito de NF-e — SEFAZ-PE](https://www.sefaz.pe.gov.br/Noticias/Paginas/Descontinuidade-do-Emissor-Gratuito-de-NF-e-e-Emissor-Gratuito-do-CT-e-.aspx)
- [Emissor de NF-e gratuito em 2026 — Inteligência Setorial](https://inteligenciasetorial.com.br/emissor-de-nfe-gratuito/)
- [Notaas — site e planos](https://www.notaas.com.br/)
- [Notaas — documentação (NFS-e)](https://docs.notaas.com.br/docs/endpoints) · [NF-e/NFC-e](https://docs.notaas.com.br/docs/nfe/endpoints)
- [API do DANFSe descontinuada em julho de 2026 — Reforma Tributária](https://www.reformatributaria.com/tecnologia/api-do-danfse-sera-descontinuada-em-julho-de-2026-e-emissao-passa-a-ser-feita-pelos-sistemas-das-empresas/)
- [Focus NFe — planos](https://focusnfe.com.br/precos/) · [documentação](https://doc.focusnfe.com.br/)
- [PlugNotas — TecnoSpeed](https://tecnospeed.com.br/plugdfe/plugnotas/) · [como funciona a tabela de preço](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/360019622493-Como-funciona-a-tabela-de-pre%C3%A7o)
- [WebmaniaBR — planos](https://webmania.com.br/planos/) · [API NFS-e](https://webmania.com.br/docs/rest-api-nfse/)
- [Spedy — API](https://lp.spedy.com.br/api)
- [NFE.io — preços](https://nfe.io/precos/)
- [eNotas](https://enotas.com.br/)
- [Comunicado de desativação da Nuvem Fiscal](https://www.nuvemfiscal.com.br/suporte/) · [Projeto ACBr](https://www.projetoacbr.com.br/forum/topic/91922-comunicado-de-desativa%C3%A7%C3%A3o-do-servi%C3%A7o-nuvem-fiscal-22042026/)
- [Comparativo de APIs de NFS-e Nacional — blog da Notaas (conteúdo do próprio fornecedor)](https://www.notaas.com.br/blog/post/api-nfse-nacional-melhor-provedor-emissao-nota-fiscal-de-servico-eletronica-nacional)
