/** Tarefas periódicas: webhooks pendentes, conciliação, lembretes e limpeza. */
const vendas = require("./vendas");
const auth = require("./auth");

const MIN = 60000;

function agendar(nome, intervaloMs, fn, atrasoInicialMs = 15000) {
  let rodando = false;
  const executar = async () => {
    if (rodando) return;
    rodando = true;
    try {
      await fn();
    } catch (e) {
      console.error(`[tarefa ${nome}]`, e.message);
    } finally {
      rodando = false;
    }
  };
  setTimeout(executar, atrasoInicialMs).unref();
  setInterval(executar, intervaloMs).unref();
}

function iniciar() {
  agendar("webhooks", 10 * MIN, vendas.reprocessarEventosPendentes);
  agendar("conciliacao", 30 * MIN, vendas.reconciliarPendentes, 60000);
  agendar("lembretes", 60 * MIN, vendas.enviarLembretesRenovacao, 120000);
  agendar("limpeza", 6 * 60 * MIN, async () => auth.limparSessoesExpiradas());
}

module.exports = { iniciar };
