/** Endpoints usados pelo GSTI App (ativação, validação, transferência, trial e suporte). */
const express = require("express");
const licencas = require("../lib/licencas");
const suporte = require("../lib/suporte");
const emissores = require("../lib/emissores");
const { abrir } = require("../lib/db");
const tokens = require("../lib/tokens");
const { LicencaErro } = require("../lib/erros");
const { limitar, rota } = require("../lib/http");

const r = express.Router();

r.post(
  "/ativar",
  limitar(10, 15),
  rota((req) => {
    const out = licencas.ativar(req.body || {});
    console.log(`[ativar] licença …${out.detalhes.chaveFinal} (${out.detalhes.maquinasAtivas}/${out.detalhes.maxMaquinas} máquinas)`);
    return { success: true, ...out };
  })
);

r.post("/validar", limitar(60, 15), rota((req) => licencas.validar(req.body || {})));

r.post("/desativar", limitar(10, 15), rota((req) => licencas.desativar(req.body || {})));

r.post(
  "/trial",
  limitar(5, 60),
  rota((req) => ({ success: true, ...licencas.iniciarTrial(req.body || {}) }))
);

// --- Suporte ---
// Identifica o cliente pelo token da licença (assinatura válida; vencida também serve,
// para quem precisa de ajuda justamente com a renovação).
function licencaDoApp(req) {
  const p = tokens.decodificar(String(req.headers["x-gsti-licenca"] || ""));
  if (!p) throw new LicencaErro("LICENCA_INVALIDA", "Licença não reconhecida. Abra o chamado pelo site.", 401);
  return p;
}

r.post(
  "/suporte/chamados",
  limitar(10, 60),
  rota((req) => {
    const p = licencaDoApp(req);
    const b = req.body || {};
    const out = suporte.abrirChamado({
      nome: b.nome, email: b.email || p.email, categoria: b.categoria, assunto: b.assunto, mensagem: b.mensagem,
      origem: "app", licencaId: p.lic, dadosTecnicos: b.dadosTecnicos,
    });
    return { success: true, ...out };
  })
);

r.get(
  "/suporte/chamados",
  limitar(60, 15),
  rota((req) => {
    const p = licencaDoApp(req);
    const itens = suporte.doEmail(p.email, null, p.lic).map((c) => ({
      numero: c.numero, assunto: c.assunto, status: c.status, statusRotulo: suporte.STATUS[c.status], atualizadoEm: c.atualizado_em, link: c.link,
    }));
    return { success: true, itens };
  })
);

// --- Pedido de novo emissor de nota fiscal (Configurações → Nota fiscal) ---
r.post(
  "/emissores/pedidos",
  limitar(20, 60),
  rota((req) => {
    const p = licencaDoApp(req);
    const lic = p.lic ? abrir().prepare("SELECT cliente_id FROM licencas WHERE id = ?").get(p.lic) : null;
    return emissores.registrarPedido({ ...(req.body || {}), clienteId: lic?.cliente_id ?? null, email: p.email, origem: "app" });
  })
);

module.exports = r;
