export const brl = (centavos) =>
  ((centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const data = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
export const dataHora = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
export const validade = (iso) => (iso ? data(iso) : "Sem expiração");

export const diasAte = (iso) => (iso ? Math.ceil((new Date(iso) - Date.now()) / 86400000) : null);

export const PLANOS = { anual: "Anual", vitalicia: "Vitalícia", cortesia: "Cortesia", mensal: "Mensal", trial: "Teste" };
export const MODALIDADES = { avulso: "Pagamento único", assinatura: "Renovação automática" };

export const STATUS = {
  ativa: ["Ativa", "success"],
  suspensa: ["Suspensa", "warning"],
  revogada: ["Revogada", "error"],
  expirada: ["Vencida", "warning"],
  pago: ["Pago", "success"],
  pendente: ["Pendente", "warning"],
  cancelado: ["Cancelado", "default"],
  expirado: ["Expirado", "default"],
  reembolsado: ["Reembolsado", "error"],
  contestado: ["Contestado", "error"],
  approved: ["Aprovado", "success"],
  pending: ["Pendente", "warning"],
  in_process: ["Em análise", "warning"],
  rejected: ["Recusado", "error"],
  cancelled: ["Cancelado", "default"],
  refunded: ["Reembolsado", "error"],
  charged_back: ["Contestado", "error"],
  authorized: ["Ativa", "success"],
  paused: ["Pausada", "warning"],
  enviado: ["Enviado", "success"],
  simulado: ["Simulado", "info"],
  erro: ["Erro", "error"],
};

export const PAPEIS_DESC = {
  admin: "Acesso total, equipe e sistema",
  licencas: "Licenças, clientes, trials e computadores",
  financeiro: "Pedidos, pagamentos, reembolsos e preços",
  conteudo: "Textos do site, páginas legais e e-mails",
};
