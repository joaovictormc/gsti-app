# Emissão de nota fiscal no GSTI App — pesquisa e recomendação

Pesquisa feita em 16/09/2026. Objetivo: emitir nota a partir de uma OS finalizada.
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
| Operações | `POST /nfse`, `GET /nfse/{chave}`, `GET /dps/{id}`, eventos (cancelamento/substituição) em `/nfse/{chave}/eventos`, DANFSe (PDF) em `/danfse/{chave}` |
| Parâmetros do município | Alíquotas, códigos de tributação nacional, regimes e retenções consultáveis na API |
| URLs | Produção: `sefin.nfse.gov.br` / `adn.nfse.gov.br` · Testes: `sefin.producaorestrita.nfse.gov.br` / `adn.producaorestrita.nfse.gov.br` (Swagger publicado) |

Custo: **zero por nota**. Esforço: **médio/alto**. É preciso:
- guardar o certificado A1 do cliente no computador, cifrado como as outras senhas;
- montar e assinar o XML da DPS;
- tratar erros de schema, duplicidade (409) e relógio;
- implementar o cancelamento;
- gerar ou baixar o DANFSe;
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

## 4. Recomendação

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
- [Comparativo de APIs de NFS-e Nacional — blog da Notaas (conteúdo do próprio fornecedor)](https://www.notaas.com.br/blog/post/api-nfse-nacional-melhor-provedor-emissao-nota-fiscal-de-servico-eletronica-nacional)
