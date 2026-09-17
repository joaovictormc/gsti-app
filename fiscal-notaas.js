// Cliente da API Notaas (https://docs.notaas.com.br).
// A chave (x-api-key, prefixo "ntaas_") é do projeto do cliente na Notaas. Não existe
// sandbox separado: o ambiente (Homologação/Produção) é configurado no projeto, no
// painel da Notaas. GSTI_NOTAAS_URL troca a URL base (usado nos testes com simulador).

const URL_PADRAO = "https://platform.notaas.com.br/api/v1";
const TEMPO_LIMITE_MS = 25000;

class NotaasErro extends Error {
  constructor(mensagem, { status = 0, codigo = null, detalhes = null } = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

function mensagemAmigavel(status, corpo) {
  const original = corpo?.error || corpo?.message || "";
  const campos = Array.isArray(corpo?.campos) ? ` (${corpo.campos.join(", ")})` : "";
  if (status === 401) return "Chave da API Notaas inválida. Confira a chave em Configurações > Nota fiscal.";
  if (status === 403) {
    if (corpo?.errorCode === "CREDIT_LIMIT") return "Limite de notas do seu plano Notaas atingido neste mês.";
    return original ? `Notaas recusou a chave: ${original}` : "Chave da API Notaas revogada ou sem assinatura ativa.";
  }
  if (status === 400) return `Dados recusados pela Notaas: ${original || "payload inválido"}${campos}`;
  if (status === 422) return `Configuração incompleta na Notaas: ${original || "verifique certificado e município no painel da Notaas"}`;
  if (status === 429) return "Muitas requisições à Notaas. Aguarde um instante e tente novamente.";
  if (status >= 500) return "A Notaas está instável no momento. Tente novamente em alguns minutos.";
  return original || `Erro ${status} na Notaas.`;
}

function criarClienteNotaas({ apiKey, baseUrl = process.env.GSTI_NOTAAS_URL || URL_PADRAO, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new NotaasErro("Cadastre a chave da API Notaas em Configurações > Nota fiscal.");
  const base = String(baseUrl).replace(/\/+$/, "");

  async function requisicao(metodo, caminho, { corpo, idempotencia } = {}) {
    const headers = { "x-api-key": apiKey, accept: "application/json" };
    if (corpo !== undefined) headers["content-type"] = "application/json";
    if (idempotencia) headers["Idempotency-Key"] = idempotencia;
    let resposta;
    try {
      resposta = await fetchImpl(base + caminho, {
        method: metodo,
        headers,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        redirect: "manual",
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (e) {
      throw new NotaasErro("Não foi possível conectar à Notaas. Verifique a internet.", { detalhes: e.message });
    }
    const texto = await resposta.text();
    let json = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }
    if (!resposta.ok) {
      throw new NotaasErro(mensagemAmigavel(resposta.status, json), {
        status: resposta.status,
        codigo: json?.errorCode || null,
        detalhes: json,
      });
    }
    return json;
  }

  // PDF/XML: a Notaas responde 302 para a CDN. A chave NÃO é enviada no redirecionamento.
  async function baixarDocumento(invoiceId, tipo) {
    const caminho = `/invoices/${encodeURIComponent(invoiceId)}/${tipo === "xml" ? "xml?type=emission" : "pdf"}`;
    let resposta;
    try {
      resposta = await fetchImpl(base + caminho, {
        headers: { "x-api-key": apiKey },
        redirect: "manual",
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (resposta.status >= 300 && resposta.status < 400) {
        const destino = resposta.headers.get("location");
        if (!destino) throw new Error("redirecionamento sem destino");
        resposta = await fetchImpl(new URL(destino, base).toString(), { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
      }
    } catch (e) {
      throw new NotaasErro("Não foi possível baixar o documento da nota.", { detalhes: e.message });
    }
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      throw new NotaasErro(mensagemAmigavel(resposta.status, json), { status: resposta.status });
    }
    return Buffer.from(await resposta.arrayBuffer());
  }

  return {
    // Confere a chave com uma leitura inofensiva
    validarChave: () => requisicao("GET", "/webhooks/endpoints"),
    emitirNFSe: (payload, idempotencia) => requisicao("POST", "/emitir", { corpo: payload, idempotencia }),
    consultar: (invoiceId) => requisicao("GET", `/invoices/${encodeURIComponent(invoiceId)}/status`),
    cancelar: (invoiceId, motivo) => requisicao("POST", "/cancelar", { corpo: { invoiceId, motivo } }),
    coberturaCidade: (nome) => requisicao("GET", `/cobertura/cidades?q=${encodeURIComponent(nome)}`),
    baixarDocumento,
  };
}

// Situação da Notaas -> situação da nota no GSTI App
const SITUACAO = {
  queued: "processando",
  processing: "processando",
  issued: "emitida",
  error: "erro",
  cancelled: "cancelada",
};

module.exports = { criarClienteNotaas, NotaasErro, SITUACAO, URL_PADRAO };
