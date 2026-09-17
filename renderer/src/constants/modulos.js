// Módulos avançados (venda por módulos). Mesma lista de /modulos.js e
// license-server/lib/modulos.js — tests/unit/modulos.test.js confere.
export const MODULOS = [
  { chave: "financeiro", nome: "Financeiro completo", descricao: "Despesas, receitas avulsas, resumo financeiro, projeção, metas e exportação para Excel." },
  { chave: "relatorios", nome: "Relatórios", descricao: "Relatórios de OS, atendentes, lucratividade, serviços mais usados e receitas." },
  { chave: "estoque", nome: "Controle de estoque", descricao: "Tela de estoque com entradas, saídas, estoque mínimo e alertas." },
  { chave: "perfis", nome: "Perfis e permissões avançadas", descricao: "Perfil Técnico e permissões configuráveis por perfil." },
  { chave: "marca", nome: "Personalização da marca", descricao: "Logo, fundo e mensagem da tela de login e logo como ícone da janela." },
  { chave: "automacoes", nome: "Automações", descricao: "Avisos automáticos por e-mail e backup automático." },
];

export const moduloPorChave = (chave) => MODULOS.find((m) => m.chave === chave) || { chave, nome: chave, descricao: "" };

// Telas que pertencem a um módulo
export const MODULO_DA_TELA = {
  ExpensesGrid: "financeiro",
  MiscRevenueGrid: "financeiro",
  FinancialDashboard: "financeiro",
  OSReportClient: "relatorios",
  OSReportStatus: "relatorios",
  OSReportAttendant: "relatorios",
  OSReportOpenAging: "relatorios",
  ProfitabilityReport: "relatorios",
  MostUsedServicesReport: "relatorios",
  EquipmentHistoryReport: "relatorios",
  DetailedRevenueReport: "relatorios",
  StockControl: "estoque",
};
