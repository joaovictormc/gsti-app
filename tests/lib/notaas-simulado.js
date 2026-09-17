// Simulador da API Notaas para testes (comportamento conforme docs.notaas.com.br).
const http = require("http");
const crypto = require("crypto");

function iniciarSimulador({ chave = "ntaas_teste_mock" } = {}) {
  const invoices = new Map(); // id -> { consultas, status, rejeitar, cancelar }
  const idempotencia = new Map();
  const registro = { payloads: [], idempotencia: [], chaveNaCdn: 0, cancelamentos: [] };

  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const json = (status, corpo, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(corpo));
    };

    // CDN (sem autenticação): registra se a chave vazou
    if (url.pathname.startsWith("/cdn/")) {
      if (req.headers["x-api-key"]) registro.chaveNaCdn++;
      if (url.pathname.endsWith(".pdf")) {
        res.writeHead(200, { "content-type": "application/pdf" });
        return res.end("%PDF-1.4\n% NFS-e simulada\n");
      }
      res.writeHead(200, { "content-type": "application/xml" });
      return res.end('<?xml version="1.0"?><NFSe><infNFSe><nNFSe>1001</nNFSe></infNFSe></NFSe>');
    }

    if (req.headers["x-api-key"] !== chave) return json(401, { error: "API key inválida." });

    let corpo = "";
    req.on("data", (c) => (corpo += c));
    req.on("end", () => {
      const dados = corpo ? JSON.parse(corpo) : {};
      const p = url.pathname.replace(/^\/api\/v1/, "");

      if (req.method === "GET" && p === "/webhooks/endpoints") return json(200, []);

      if (req.method === "POST" && p === "/emitir") {
        const faltando = [];
        if (!dados.tomador?.nome) faltando.push("tomador.nome");
        if (!dados.tomador?.cnpj && !dados.tomador?.cpf) faltando.push("tomador.cnpj");
        if (!dados.servico?.descricao) faltando.push("servico.descricao");
        if (typeof dados.valores?.total !== "number") faltando.push("valores.total");
        if (typeof dados.valores?.aliquotaIss !== "number") faltando.push("valores.aliquotaIss");
        if (faltando.length) return json(400, { error: "Payload inválido", campos: faltando });
        const chaveIdem = req.headers["idempotency-key"];
        registro.idempotencia.push(chaveIdem);
        if (chaveIdem && idempotencia.has(chaveIdem)) {
          const id = idempotencia.get(chaveIdem);
          return json(202, { queued: true, invoiceId: id, status: invoices.get(id).status, pollUrl: `/api/v1/invoices/${id}/status` });
        }
        registro.payloads.push(dados);
        const id = crypto.randomUUID();
        invoices.set(id, { consultas: 0, status: "queued", rejeitar: /REJEITAR/.test(dados.tomador.nome) });
        if (chaveIdem) idempotencia.set(chaveIdem, id);
        return json(202, { queued: true, invoiceId: id, status: "queued", pollUrl: `/api/v1/invoices/${id}/status` });
      }

      const status = p.match(/^\/invoices\/([^/]+)\/status$/);
      if (req.method === "GET" && status) {
        const inv = invoices.get(status[1]);
        if (!inv) return json(404, { error: "Invoice não encontrada" });
        inv.consultas++;
        if (inv.status === "queued") inv.status = "processing";
        else if (inv.status === "processing") inv.status = inv.rejeitar ? "error" : "issued";
        else if (inv.status === "cancelling") inv.status = "cancelled";
        if (inv.status === "issued" || inv.status === "cancelled") {
          return json(200, {
            status: inv.status,
            chNFSe: "4113700" + "1".repeat(43),
            numeroNfe: "1001",
            emittedAt: "2026-09-16T15:00:00.000Z",
            pdfUrl: `/cdn/${status[1]}.pdf`,
            xmlUrl: `/cdn/${status[1]}.xml`,
            documentsCached: true,
          });
        }
        if (inv.status === "error") {
          return json(200, {
            status: "error",
            errorCode: "E0540",
            errorMessage: "Código de tributação nacional inválido para o município",
            errors: [{ Codigo: "E0540", Descricao: "cTribNac não permitido", Complemento: "140101" }],
          });
        }
        return json(200, { status: inv.status });
      }

      const doc = p.match(/^\/invoices\/([^/]+)\/(pdf|xml)$/);
      if (req.method === "GET" && doc) {
        const inv = invoices.get(doc[1]);
        if (!inv) return json(404, { error: "Invoice não encontrada" });
        if (inv.status !== "issued" && inv.status !== "cancelled") return json(409, { error: "Nota ainda não emitida" });
        res.writeHead(302, { location: `/cdn/${doc[1]}.${doc[2]}` });
        return res.end();
      }

      if (req.method === "POST" && p === "/cancelar") {
        const inv = invoices.get(dados.invoiceId);
        if (!inv) return json(404, { error: "Invoice não encontrada" });
        registro.cancelamentos.push(dados);
        inv.status = "cancelling";
        return json(202, { success: true, status: "cancelling" });
      }

      return json(404, { error: "Rota não encontrada" });
    });
  });

  return new Promise((resolve) => {
    servidor.listen(0, "127.0.0.1", () => {
      resolve({ url: `http://127.0.0.1:${servidor.address().port}/api/v1`, registro, chave, fechar: () => servidor.close() });
    });
  });
}

module.exports = { iniciarSimulador };
