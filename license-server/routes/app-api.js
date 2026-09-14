/** Endpoints usados pelo GSTI App (ativação, validação, transferência, trial). */
const express = require("express");
const licencas = require("../lib/licencas");
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

module.exports = r;
