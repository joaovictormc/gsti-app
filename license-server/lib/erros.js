/** Erro de regra de negócio com código e status HTTP. */
class LicencaErro extends Error {
  constructor(codigo, mensagem, status = 400) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

module.exports = { LicencaErro };
