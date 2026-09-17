const test = require("node:test");
const assert = require("node:assert/strict");
const { lerCertificadoA1, CertificadoErro } = require("../../fiscal-certificado");
const { gerarPfx } = require("../lib/certificado-teste");

const futuro = new Date(Date.now() + 86400000 * 200);

test("lê titular, CNPJ, emissor e validade de certificado ICP-Brasil", () => {
  const info = lerCertificadoA1(gerarPfx({ cn: "ASSISTENCIA SILVA LTDA:12345678000199", validoAte: futuro, cnpjOtherName: "12345678000199" }), "1234");
  assert.equal(info.titular, "ASSISTENCIA SILVA LTDA");
  assert.deepEqual(info.documento, { tipo: "CNPJ", numero: "12345678000199" });
  assert.equal(info.emissor, "AC TESTE GSTI");
  assert.equal(new Date(info.validoAte).getTime(), Math.floor(futuro.getTime() / 1000) * 1000);
});

test("usa o CNPJ do nome do titular quando não há otherName", () => {
  const info = lerCertificadoA1(gerarPfx({ cn: "OFICINA PC:98765432000110", validoAte: futuro }), "1234");
  assert.equal(info.documento.numero, "98765432000110");
});

test("lê CPF de certificado de pessoa física", () => {
  const info = lerCertificadoA1(gerarPfx({ cn: "JOAO DA SILVA", validoAte: futuro, cpfOtherName: "01011990123456789010000000000" }), "1234");
  assert.deepEqual(info.documento, { tipo: "CPF", numero: "12345678901" });
});

test("recusa senha errada, vencido, sem chave privada e arquivo inválido", () => {
  const erro = (fn, texto) => assert.throws(fn, (e) => e instanceof CertificadoErro && texto.test(e.message));
  erro(() => lerCertificadoA1(gerarPfx({ cn: "X:12345678000199", validoAte: futuro }), "errada"), /Senha/);
  erro(() => lerCertificadoA1(gerarPfx({ cn: "X:12345678000199", validoAte: new Date(Date.now() - 86400000) }), "1234"), /vencido/);
  erro(() => lerCertificadoA1(gerarPfx({ cn: "X:12345678000199", validoAte: futuro, semChave: true }), "1234"), /chave privada/);
  erro(() => lerCertificadoA1(Buffer.from("não é um pfx"), "1234"), /inválido/);
});
