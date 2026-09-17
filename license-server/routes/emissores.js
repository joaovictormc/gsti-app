/**
 * Emissores de nota fiscal no site: guia público (/emissores) e pedidos de novos
 * emissores pela área do cliente.
 */
const express = require("express");
const auth = require("../lib/auth");
const emissores = require("../lib/emissores");
const { LicencaErro } = require("../lib/erros");
const { limitar, rota, csp } = require("../lib/http");
const views = require("../views/emissores");

const r = express.Router();

r.get("/emissores", csp, (req, res) => {
  res.type("html").set("Cache-Control", "no-store").send(
    views.pagina({ catalogo: emissores.catalogo(), planejados: emissores.planejados(), logado: !!auth.sessaoCliente(req) })
  );
});

function exigirCliente(req) {
  const s = auth.sessaoCliente(req);
  if (!s) throw new LicencaErro("NAO_AUTENTICADO", "Sua sessão expirou. Entre novamente.", 401);
  auth.conferirCsrf(req, s.sessao);
  return s.cliente;
}

r.get("/api/cliente/emissores", rota((req) => {
  const cliente = exigirCliente(req);
  return { success: true, pedidos: emissores.pedidosDoCliente(cliente.email), tipos: emissores.TIPOS_NOTA, ufs: emissores.UFS };
}));

r.post("/api/cliente/emissores", limitar(20, 60), rota((req) => {
  const cliente = exigirCliente(req);
  return emissores.registrarPedido({ ...(req.body || {}), clienteId: cliente.id, email: cliente.email, origem: "portal" });
}));

module.exports = r;
